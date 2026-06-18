package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// ─── Pool de mensagens reais dos grupos ──────────────────────────────────────

var poolAceitas = []string{
	"Rotas em Águas Claras disponíveis agora",
	"Preciso de alguém em Vicente Pires",
	"VP liberado galera",
	"Quem pega Jockey hoje?",
	"Colônia tem rota aberta",
	"joquei disponível agora",
	"aguas claras 2 rotas sobrando",
	"previsão de rotas saiu pessoal",
	"rota prevista para amanhã Aguas Claras",
	"Vicente Jockey - alguém pega?",
	"carregamento às 06:00",
	"onda 1 liberada agora",
	"segunda onda disponível",
	"rotas no app já",
	"sem aceites ainda galera",
	"segunda chamada Aguas Claras",
	"horário de carregamento 5h",
}

var poolIgnoradas = []string{
	"Samambaia tem corrida urgente",
	"Taguatinga norte liberado",
	"Ceilândia quem tá?",
	"Van disponível no Guará",
	"Recanto das Emas aberto",
	"Santa Maria entrega urgente",
	"Fiorino pra Riacho Fundo",
	"Moto no SIA hoje",
	"Sobradinho II tem rota",
	"Planaltina abrindo corridas",
}

var poolNeutras = []string{
	"Bom dia!", "ok", "👍", "😂😂", "Obrigado", "Já peguei",
	"Quanto rende?", "tô chegando", "🔥🔥", "Confirmado",
	"Alguém aí?", "não consigo logar", "boa tarde", "tá longe?",
	"quanto km?", "valeu", "boa", "que horas abre?", "ainda tem?",
}

var todasMsgs = func() []string {
	all := make([]string, 0, len(poolAceitas)+len(poolIgnoradas)+len(poolNeutras))
	all = append(all, poolAceitas...)
	all = append(all, poolIgnoradas...)
	all = append(all, poolNeutras...)
	return all
}()

// ─── 1. normalizar() ─────────────────────────────────────────────────────────

func BenchmarkNormalizar(b *testing.B) {
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		normalizar(todasMsgs[i%len(todasMsgs)])
	}
}

// ─── 2. Regex: regiões ignoradas ─────────────────────────────────────────────

func BenchmarkRegexIgnoradas(b *testing.B) {
	normed := make([]string, len(poolIgnoradas))
	for i, m := range poolIgnoradas {
		normed[i] = normalizar(m)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		regexIgnoradas.MatchString(normed[i%len(normed)])
	}
}

// ─── 3. Regex: regiões aceitas ────────────────────────────────────────────────

func BenchmarkRegexAceitas(b *testing.B) {
	normed := make([]string, len(poolAceitas))
	for i, m := range poolAceitas {
		normed[i] = normalizar(m)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		regexAceitas.FindString(normed[i%len(normed)])
	}
}

// ─── 4. Pipeline completo de triagem (caminho quente do eventHandler) ─────────

func BenchmarkTriagemCompleta(b *testing.B) {
	b.ReportAllocs()
	var reagidas, ignoradas int64
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		txt := normalizar(todasMsgs[i%len(todasMsgs)])
		if regexIgnoradas.MatchString(txt) {
			ignoradas++
			continue
		}
		if regexAceitas.FindString(txt) == "" {
			ignoradas++
			continue
		}
		reagidas++
	}
	b.ReportMetric(float64(reagidas)*100/float64(b.N), "%reagidas")
}

// ─── 5. apiQueue: throughput do worker de HTTP ────────────────────────────────

func BenchmarkAPIQueue(b *testing.B) {
	var count int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt64(&count, 1)
		w.WriteHeader(200)
	}))
	defer srv.Close()

	// Substitui fila e coreAPI globais para o benchmark
	oldAPI := coreAPI
	coreAPI = srv.URL
	defer func() { coreAPI = oldAPI }()

	oldQueue := apiQueue
	apiQueue = make(chan func(), 2000)
	defer func() { apiQueue = oldQueue }()

	go func() {
		for fn := range apiQueue {
			fn()
		}
	}()

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		registrarRota("Aguas Claras", "rota disponivel", "aguas claras", "5561999999999", 12)
	}
	// drena a fila antes de retornar
	deadline := time.Now().Add(5 * time.Second)
	for len(apiQueue) > 0 && time.Now().Before(deadline) {
		time.Sleep(1 * time.Millisecond)
	}
}

// ─── 6. Despacho de goroutines (simulação do go atirarReacao) ─────────────────

func BenchmarkDespachoGoroutines(b *testing.B) {
	for _, conc := range []int{1, 10, 50, 100, 500} {
		b.Run(fmt.Sprintf("conc%d", conc), func(b *testing.B) {
			sem := make(chan struct{}, conc)
			var wg sync.WaitGroup
			b.ReportAllocs()
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				sem <- struct{}{}
				wg.Add(1)
				go func() {
					defer wg.Done()
					defer func() { <-sem }()
					txt := normalizar("aguas claras disponivel agora")
					_ = regexAceitas.FindString(txt)
				}()
			}
			wg.Wait()
		})
	}
}

// ─── 7. Carga mista realista (mistura aceitas/ignoradas/neutras) ──────────────

func BenchmarkCargaMista(b *testing.B) {
	var wg sync.WaitGroup
	var reagidas, ignoradas int64
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		txt := normalizar(todasMsgs[i%len(todasMsgs)])
		if regexIgnoradas.MatchString(txt) {
			atomic.AddInt64(&ignoradas, 1)
			continue
		}
		match := regexAceitas.FindString(txt)
		if match == "" {
			atomic.AddInt64(&ignoradas, 1)
			continue
		}
		// Despacha goroutine igual ao eventHandler real
		wg.Add(1)
		go func(m, match string) {
			defer wg.Done()
			atomic.AddInt64(&reagidas, 1)
		}(txt, match)
	}
	wg.Wait()
	b.ReportMetric(float64(reagidas), "reagidas")
	b.ReportMetric(float64(ignoradas), "ignoradas")
}
