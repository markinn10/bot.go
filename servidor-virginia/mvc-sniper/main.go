package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
	"unicode"

	"github.com/mdp/qrterminal/v3"
	qrcode "github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
	_ "modernc.org/sqlite"
)

// ====================== CONFIG (env vars) ======================
var (
	botID   = getenv("BOT_ID", "mvc-sniper-go")
	coreAPI = getenv("CORE_API", "http://localhost:8080")
)

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

// Mapeamento de grupos: JID -> nome amigavel exibido no painel.
// Populado dinamicamente em preAquecerGrupos() ao conectar.
// O mutex protege contra leitura concorrente (atirarReacao em goroutines).
var (
	gruposConhecidos = map[string]string{}
	gruposMu         sync.RWMutex
)

func nomeDoGrupo(jid string) string {
	gruposMu.RLock()
	defer gruposMu.RUnlock()
	if nome, ok := gruposConhecidos[jid]; ok {
		return nome
	}
	return jid
}

// ====================== MIRA ======================
var rotaTerms = []string{
	`aguas claras`, `vicente pires`, `vp`,
	`jockey`, `jokey`, `vicente jockey`, `joquei`, `jóquei`,
	`colonia agricola`, `colonia`,

	`previsão de rotas`, `previsão`, `previsao`,
	`rota prevista`, `rotas previstas`,
	`rotas sem aceites`, `sem aceites`,
	`segunda chamada`, `segundo chamada`, `segundo chamado`, `segunda chamado`,
	`serão passadas`, `serao passadas`,
	`rotas no app`, `rotas no aplicativo`,
	`rotas enviadas`, `rotas enviadas para o app`, `rotas enviadas para o aplicativo`,

	`horário do carregamento`, `horario do carregamento`,
	`horário de carregamento`, `horario de carregamento`,
	`carregamento`,

	`onda 1`, `onda1`, `onda 2`, `onda2`, `onda 3`, `onda3`,
	`primeira onda`, `segunda onda`, `terceira onda`,
	`1° onda`, `2° onda`, `3° onda`,
	`1 onda`, `2 onda`, `3 onda`,
}

var rotaIgnoradas = []string{
	`planaltina`, `estancia`, `vale do amanhecer`, `sobradinho`, `nova colina`,
	`fercal`, `itapoa`, `jardim botanico`, `lago sul`, `cruzeiro`, `sudoeste`,
	`octogonal`, `estrutural`, `scia`, `sia`, `arniqueiras`, `riacho fundo`,
	`bandeirante`, `candangolandia`, `por do sol`, `sol nascente`, `volumoso`,
	`samambaia`, `ceilandia`, `guara`, `taguatinga`, `recanto das emas`,
	`recanto`, `emas`, `santa maria`, `santa marta`, `sobradinho ii`,
	`sobradinho 2`, `varjao`, `paranoa`, `lago norte`, `noroeste`,
	`van`, `moto`, `motocicleta`, `bau`, `sao sebastiao`, `fiorino`,
	`park way`, `parque way`, `parqueway`,
}

func normalizar(s string) string {
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	out, _, err := transform.String(t, s)
	if err != nil {
		return strings.ToLower(s)
	}
	return strings.ToLower(out)
}

func compilaRegex(termos []string) *regexp.Regexp {
	parts := make([]string, len(termos))
	for i, t := range termos {
		parts[i] = regexp.QuoteMeta(normalizar(t))
	}
	return regexp.MustCompile(`\b(` + strings.Join(parts, `|`) + `)\b`)
}

var (
	regexAceitas   = compilaRegex(rotaTerms)
	regexIgnoradas = compilaRegex(rotaIgnoradas)
)

var horaDePartida = time.Now().Add(-2 * time.Minute)

// ====================== PAINEL (integracao HTTP) ======================
var httpClient = &http.Client{
	Timeout: 5 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        10,
		MaxIdleConnsPerHost: 4,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 3 * time.Second,
		DisableKeepAlives:   false,
	},
}

// apiQueue serializa todas as chamadas HTTP ao CORE_API num unico worker.
// Evita que goroutines concorrentes abram multiplas conexoes TCP simultaneas
// para o servidor Brasil, o que disputava banda com o WebSocket do WhatsApp
// e causava ack delay de 200-600ms extras.
var apiQueue = make(chan func(), 200)

func iniciarWorkerAPI() {
	go func() {
		for fn := range apiQueue {
			fn()
		}
	}()
}

func enviarStatusAsync(dados map[string]any) {
	body, _ := json.Marshal(dados)
	apiQueue <- func() {
		req, err := http.NewRequest("PUT", coreAPI+"/api/bots/"+botID, bytes.NewReader(body))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := httpClient.Do(req)
		if err != nil {
			return
		}
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}
}

// enviarStatus é chamado em caminhos críticos (Connected, Disconnected).
// Usa o mesmo worker para não bloquear o event handler.
func enviarStatus(dados map[string]any) {
	enviarStatusAsync(dados)
}

// POST /api/rotas - mesmo contrato do bot.js
func registrarRota(grupo, mensagem, regiao, remetente string, perfMs int64) {
	body, _ := json.Marshal(map[string]any{
		"grupo":     grupo,
		"mensagem":  mensagem,
		"regiao":    regiao,
		"botId":     botID,
		"remetente": remetente,
	})
	apiQueue <- func() {
		resp, err := httpClient.Post(coreAPI+"/api/rotas", "application/json", bytes.NewReader(body))
		if err == nil {
			io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
		}
		// status de rota vai logo depois, ainda no mesmo worker
		statusBody, _ := json.Marshal(map[string]any{
			"lastAction": "Rota: " + time.Now().In(brasilia()).Format("15:04:05"),
			"perf":       fmt.Sprintf("%dms", perfMs),
		})
		req, err := http.NewRequest("PUT", coreAPI+"/api/bots/"+botID, bytes.NewReader(statusBody))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			resp2, err2 := httpClient.Do(req)
			if err2 == nil {
				io.Copy(io.Discard, resp2.Body)
				resp2.Body.Close()
			}
		}
	}
}

func brasilia() *time.Location {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		return time.UTC
	}
	return loc
}

const qrDir = "qrcodes"

func salvarQR(qrString string) {
	_ = os.MkdirAll(qrDir, 0o755)
	file := filepath.Join(qrDir, botID+".png")
	_ = qrcode.WriteFile(qrString, qrcode.Low, 512, file)
}

func removerQR() {
	file := filepath.Join(qrDir, botID+".png")
	_ = os.Remove(file)
}

// ====================== BOT ======================
type MVCBot struct {
	client    *whatsmeow.Client
	numeroBot atomic.Pointer[string]
}

func (bot *MVCBot) numero() string {
	p := bot.numeroBot.Load()
	if p == nil {
		return "Desconectado"
	}
	return *p
}

func (bot *MVCBot) eventHandler(evt interface{}) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("[CRITICAL] Recovered from panic no eventHandler: %v\n", r)

		}
	}()
	switch v := evt.(type) {

	case *events.Connected:
		if bot.client.Store.ID != nil {
			user := bot.client.Store.ID.User
			if len(user) >= 4 {
				masked := "****" + user[len(user)-4:]
				bot.numeroBot.Store(&masked)
			} else {
				conn := "Conectado"
				bot.numeroBot.Store(&conn)
			}
		}
		removerQR()
		enviarStatus(map[string]any{
			"status":     "ONLINE",
			"numero":     bot.numero(),
			"lastAction": "Monitorando rotas...",
			"online":     true,
		})
		fmt.Println("[SISTEMA] Conectado! Aguardando rotas...")

		go bot.preAquecerGrupos()

	case *events.Disconnected:
		enviarStatus(map[string]any{
			"status":     "OFFLINE",
			"lastAction": "Desconectado. Reconectando...",
		})
		fmt.Println("[SISTEMA] Desconectado")

	case *events.LoggedOut:
		enviarStatus(map[string]any{
			"status":     "ERRO",
			"lastAction": "Sessao expirada. Apague sessao.db e relogue.",
		})
		fmt.Println("[ERRO] Sessao expirada. Apague sessao.db e rode de novo.")

	case *events.PairSuccess:
		fmt.Println("[SISTEMA] Pareamento OK")

	case *events.Message:
		if v.Info.IsFromMe {
			return
		}
		if v.Info.Chat.Server != types.GroupServer {
			return
		}
		if v.Info.Timestamp.Before(horaDePartida) {
			return
		}

		texto := v.Message.GetConversation()
		if texto == "" {
			texto = v.Message.GetExtendedTextMessage().GetText()
		}
		if texto == "" {
			return
		}

		txt := normalizar(texto)
		if regexIgnoradas.MatchString(txt) {
			return
		}

		match := regexAceitas.FindString(txt)
		if match == "" {
			return
		}

		go bot.atirarReacao(v, match, texto)
	}
}

// preAquecerGrupos: descobre todos os grupos, popula gruposConhecidos
// e pre-busca o cache de devices para eliminar a latencia de 15s na 1a reacao.
func (bot *MVCBot) preAquecerGrupos() {
	time.Sleep(2 * time.Second) // espera conexao estabilizar

	ctx := context.Background()
	grupos, err := bot.client.GetJoinedGroups(ctx)
	if err != nil {
		fmt.Printf("[AQUECIMENTO] Falha ao listar grupos: %v\n", err)
		return
	}
	fmt.Printf("[AQUECIMENTO] %d grupos descobertos\n", len(grupos))

	novoMapa := make(map[string]string, len(grupos))
	dedup := make(map[types.JID]struct{})
	var todosParticipantes []types.JID

	for _, g := range grupos {
		novoMapa[g.JID.String()] = g.Name
		fmt.Printf("[AQUECIMENTO] - %-40s (%d membros) | %s\n",
			g.Name, len(g.Participants), g.JID.String())

		for _, p := range g.Participants {
			if _, ja := dedup[p.JID]; !ja {
				dedup[p.JID] = struct{}{}
				todosParticipantes = append(todosParticipantes, p.JID)
			}
		}
	}

	gruposMu.Lock()
	gruposConhecidos = novoMapa
	gruposMu.Unlock()

	if len(todosParticipantes) > 0 {
		inicio := time.Now()
		_, err = bot.client.GetUserDevicesContext(ctx, todosParticipantes)
		if err != nil {
			fmt.Printf("[AQUECIMENTO] GetUserDevices falhou: %v\n", err)
		} else {
			fmt.Printf("[AQUECIMENTO] %d usuarios unicos cacheados em %v - PRONTO!\n",
				len(todosParticipantes), time.Since(inicio))
		}
	}
}

func (bot *MVCBot) atirarReacao(v *events.Message, regiaoEncontrada, mensagemOriginal string) {
	inicio := time.Now()
	chatJID := v.Info.Chat
	senderJID := v.Info.Sender
	messageID := v.Info.ID

	reactionMsg := bot.client.BuildReaction(chatJID, senderJID, messageID, "\U0001F44D")
	resp, err := bot.client.SendMessage(context.Background(), chatJID, reactionMsg)
	tempoDisparo := time.Since(inicio)

	if err != nil {
		fmt.Printf("[ERRO] Falha no disparo: %v\n", err)
		return
	}

	// Quebra detalhada do tempo (pra entender onde o gargalo esta).
	t := resp.DebugTimings
	fmt.Printf("[SNIPER] %v | %s | encrypt=%v devices=%v send=%v ack=%v\n",
		tempoDisparo,
		truncate(mensagemOriginal, 40),
		t.GroupEncrypt,
		t.GetDevices,
		t.Send,
		t.Resp,
	)

	grupoNome := nomeDoGrupo(chatJID.String())
	// registrarRota enfileira no apiQueue — não abre goroutine concorrente,
	// evitando disputa de banda com o WebSocket do WhatsApp.
	registrarRota(grupoNome, mensagemOriginal, regiaoEncontrada, senderJID.User, tempoDisparo.Milliseconds())
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

func iniciarHeartbeat(bot *MVCBot) {
	go func() {
		t := time.NewTicker(5 * time.Minute)
		defer t.Stop()
		for range t.C {
			enviarStatus(map[string]any{
				"status":              "ONLINE",
				"numero":              bot.numero(),
				"ultimaSincronizacao": time.Now().UTC().Format(time.RFC3339),
				"lastAction":          "Heartbeat",
			})
		}
	}()
}


// ====================== MAIN ======================
func main() {
	ctx := context.Background()
	fmt.Printf("[BOT] %s -> %s\n", botID, coreAPI)

	// Banco de sessao por bot: sessao-{BOT_ID}.db.
	// Permite varias instancias PM2 do mesmo binario com BOT_IDs diferentes.
	dbPath := fmt.Sprintf("file:sessao-%s.db?_pragma=foreign_keys(1)&_pragma=busy_timeout(10000)", botID)
	container, err := sqlstore.New(ctx, "sqlite", dbPath, nil)
	if err != nil {
		panic(err)
	}

	deviceStore, err := container.GetFirstDevice(ctx)
	if err != nil {
		panic(err)
	}

	client := whatsmeow.NewClient(deviceStore, nil)
	bot := &MVCBot{client: client}
	client.AddEventHandler(bot.eventHandler)

	if client.Store.ID == nil {
		// Primeiro login: precisa do QR
		qrChan, _ := client.GetQRChannel(ctx)
		if err = client.Connect(); err != nil {
			panic(err)
		}
		for evt := range qrChan {
			switch evt.Event {
			case "code":
				qrterminal.GenerateHalfBlock(evt.Code, qrterminal.L, os.Stdout)
				fmt.Println("[AVISO] Escaneie o QR Code (terminal ou painel)")
				salvarQR(evt.Code)
				enviarStatus(map[string]any{
					"status":     "AGUARDANDO_QR",
					"numero":     "Desconectado",
					"lastAction": "QR Gerado. Escaneie rapido!",
				})
			case "timeout":
				removerQR()
				enviarStatus(map[string]any{
					"status":     "AGUARDANDO_QR",
					"lastAction": "QR Expirado. Gerando novo...",
				})
			case "success":
				removerQR()
			default:
				fmt.Println("Status:", evt.Event)
			}
		}
	} else {
		// Sessao salva: reconecta direto
		if err = client.Connect(); err != nil {
			panic(err)
		}
	}

	iniciarWorkerAPI()
	iniciarHeartbeat(bot)

	c := make(chan os.Signal, 1)
	// Captura TODOS os sinais comuns pra descobrir qual esta matando o bot.
	signal.Notify(c, os.Interrupt, syscall.SIGTERM, syscall.SIGHUP, syscall.SIGQUIT)
	sig := <-c

	fmt.Printf("[SISTEMA] >>> SINAL RECEBIDO: %v <<< - encerrando...\n", sig)

	enviarStatus(map[string]any{
		"status":     "OFFLINE",
		"lastAction": fmt.Sprintf("Encerrando (sig=%v)", sig),
	})
	client.Disconnect()
}
