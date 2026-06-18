'use strict';

/**
 * stress-robusto.js
 *
 * Testa a lógica REAL do bot.js (inline), não handleMessage.js.
 * Replica exatamente o fluxo do client.on('message') de produção.
 *
 * Mede:
 *  - Tempo de triagem (decisão ignorar/reagir) — puro Node.js
 *  - Fila serial do Puppeteer: react() e fetch() não são paralelos no Chrome
 *  - Event loop lag sob rajada
 *  - Latência fim-a-fim (chegada → reação confirmada)
 *  - Crescimento de memória (memory leak check)
 */

const { performance } = require('perf_hooks');

// ─── Constantes extraídas de bot.js ──────────────────────────────────────────
const REGEX_ACENTOS = /[̀-ͯ]/g;

const REGIOES_ACEITAS = [
    "aguas claras", "vicente pires", "vp", "jockey",
    "vicente jockey", "joquei", "colonia agricola", "colonia",
    "previsao de rotas", "previsao", "rota prevista", "rotas previstas"
].map(t => t.normalize('NFD').replace(REGEX_ACENTOS, '').toLowerCase());

const REGIOES_IGNORADAS = [
    "planaltina", "estancia", "vale do amanhecer", "sobradinho", "nova colina",
    "fercal", "itapoa", "jardim botanico", "lago sul", "cruzeiro", "sudoeste",
    "octogonal", "estrutural", "scia", "sia", "arniqueiras", "riacho fundo",
    "bandeirante", "candangolandia", "por do sol", "sol nascente", "volumoso",
    "samambaia", "ceilandia", "guara", "taguatinga", "recanto das emas",
    "recanto", "emas", "santa maria", "santa marta", "sobradinho ii",
    "sobradinho 2", "varjao", "paranoa", "lago norte", "noroeste", "van",
    "moto", "motocicleta", "bau", "sao sebastiao", "fiorino"
].map(t => t.normalize('NFD').replace(REGEX_ACENTOS, '').toLowerCase());

const REGEX_ACEITAS   = new RegExp(REGIOES_ACEITAS.join('|'));
const REGEX_IGNORADAS = new RegExp(REGIOES_IGNORADAS.join('|'));

const HORA_DA_PARTIDA = Math.floor(Date.now() / 1000) - 120;
const BOT_ID          = 'stress-bot';
const CORE_API        = 'http://localhost:8080';

// ─── Fila serial do Puppeteer ─────────────────────────────────────────────────
// No bot real, react() passa por page.evaluate() — chamadas simultâneas ficam
// enfileiradas e executam uma por vez dentro do Chrome.
class FilaPuppeteer {
    constructor(latMin, latMax) {
        this.latMin       = latMin;
        this.latMax       = latMax;
        this._fila        = [];
        this._rodando     = false;
        this.maxFila      = 0;
        this.totalCalls   = 0;
        this.totalEspera  = 0;
        this.latencias    = [];  // tempo dentro do Puppeteer (rede WA)
        this.esperas      = [];  // tempo aguardando na fila antes de ser atendido
    }

    executar(fn) {
        return new Promise((resolve, reject) => {
            const chegou = performance.now();
            this._fila.push({ fn, resolve, reject, chegou });
            if (this._fila.length > this.maxFila) this.maxFila = this._fila.length;
            this._processar();
        });
    }

    async _processar() {
        if (this._rodando) return;
        this._rodando = true;
        while (this._fila.length) {
            const { fn, resolve, reject, chegou } = this._fila.shift();
            const espera = performance.now() - chegou;
            this.esperas.push(espera);
            this.totalEspera += espera;
            this.totalCalls++;

            const lat = this.latMin + Math.random() * (this.latMax - this.latMin);
            this.latencias.push(lat);
            await new Promise(r => setTimeout(r, lat));
            try { resolve(await fn()); } catch (e) { reject(e); }
        }
        this._rodando = false;
    }

    reset() {
        this._fila       = [];
        this._rodando    = false;
        this.maxFila     = 0;
        this.totalCalls  = 0;
        this.totalEspera = 0;
        this.latencias   = [];
        this.esperas     = [];
    }
}

const filaReact = new FilaPuppeteer(200, 850);  // react(): 200–850ms (rede WA real)
const filaFetch = new FilaPuppeteer(20, 150);   // fetch() API local: 20–150ms

// ─── Mock do client do WhatsApp ───────────────────────────────────────────────
const mockMsg = (corpo, tipo = 'chat') => ({
    type:      tipo,
    from:      '120363338093856913@g.us',
    author:    `user${Math.floor(Math.random() * 1000)}@s.whatsapp.net`,
    body:      corpo,
    timestamp: Math.floor(Date.now() / 1000),
    react:     (emoji) => filaReact.executar(() => {}),
});

// Mock fetch via fila serial (API local também tem latência)
global.fetch = (url, opts) => filaFetch.executar(() => ({ ok: true }));

// ─── Lógica EXATA do bot.js (client.on('message')) ────────────────────────────
async function processarMensagem(msg, stats) {
    const tChegada = performance.now();

    // — Filtros idênticos ao bot.js —
    if (msg.type !== 'chat')                 { stats.ignorado_tipo++;      return { ms: performance.now() - tChegada, decisao: 'ignorado' }; }
    if (!msg.from.endsWith('@g.us'))         { stats.ignorado_direto++;    return { ms: performance.now() - tChegada, decisao: 'ignorado' }; }
    if (msg.from === 'status@broadcast')     { stats.ignorado_broadcast++; return { ms: performance.now() - tChegada, decisao: 'ignorado' }; }
    if (msg.timestamp < HORA_DA_PARTIDA)     { stats.ignorado_antigo++;    return { ms: performance.now() - tChegada, decisao: 'ignorado' }; }
    if (!msg.body)                           { stats.ignorado_vazio++;     return { ms: performance.now() - tChegada, decisao: 'ignorado' }; }

    const norm = msg.body.toLowerCase().normalize('NFD').replace(REGEX_ACENTOS, '');

    if (REGEX_IGNORADAS.test(norm)) { stats.ignorado_regiao++; return { ms: performance.now() - tChegada, decisao: 'ignorado' }; }

    const match = norm.match(REGEX_ACEITAS);
    if (!match)                     { stats.ignorado_sematch++;  return { ms: performance.now() - tChegada, decisao: 'ignorado' }; }

    const regiaoEncontrada = match[0];
    const tDecisao = performance.now();
    const msTriagem = tDecisao - tChegada;

    // — React: fire-and-forget, igual ao bot.js —
    const tReacao = performance.now();
    const reactPromise = msg.react('👍').then(() => {
        stats.latReacao.push(performance.now() - tReacao);
    }).catch(() => {});

    // — setImmediate para API, igual ao bot.js —
    const fetchPromise = new Promise(resolve => {
        setImmediate(async () => {
            const grupo    = msg.from;
            const remetente = (msg.author || msg.from).split('@')[0];
            await fetch(CORE_API + '/api/rotas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ grupo, mensagem: msg.body, regiao: regiaoEncontrada, botId: BOT_ID, remetente }),
            }).catch(() => {});
            resolve();
        });
    });

    stats.reagido++;
    stats.latTriagem.push(msTriagem);
    stats.regioes[regiaoEncontrada] = (stats.regioes[regiaoEncontrada] || 0) + 1;
    stats._pendentes.push(reactPromise, fetchPromise);

    return { ms: msTriagem, decisao: 'reagido', regiao: regiaoEncontrada };
}

// ─── Monitor de event loop lag ────────────────────────────────────────────────
class MonitorEL {
    constructor() { this.lags = []; this._t = null; }

    iniciar() {
        let ref = performance.now();
        this._t = setInterval(() => {
            const agora = performance.now();
            this.lags.push(Math.max(0, agora - ref - 50));
            ref = agora;
        }, 50);
        this._t.unref();
    }

    parar() { clearInterval(this._t); }

    pct(p) {
        if (!this.lags.length) return 'n/a';
        const s = [...this.lags].sort((a, b) => a - b);
        return s[Math.ceil((p / 100) * s.length) - 1].toFixed(2);
    }
}

// ─── Pool de mensagens ────────────────────────────────────────────────────────
const MSGS = {
    aceitas: [
        'Rotas em Aguas Claras disponíveis agora',
        'Preciso de alguém em Vicente Pires',
        'VP liberado galera',
        'Quem pega Jockey hoje?',
        'Colônia tem rota aberta',
        'joquei disponível agora',
        'aguas claras 2 rotas sobrando',
        'vp quem quer?',
        'previsão de rotas saiu pessoal',
        'rota prevista para amanhã Aguas Claras',
        'Vicente Jockey - alguém pega?',
        'colonia agricola hoje tem',
    ],
    ignoradas: [
        'Samambaia tem corrida urgente',
        'Taguatinga norte liberado',
        'Ceilândia quem tá?',
        'Van disponível no Guará',
        'Recanto das Emas aberto',
        'Santa Maria entrega urgente',
        'Fiorino pra Riacho Fundo',
        'Moto no SIA hoje',
        'Sobradinho II tem rota',
        'Planaltina abrindo corridas',
    ],
    neutras: [
        'Bom dia!', 'ok', '👍', '😂😂', 'Obrigado', 'Já peguei',
        'Quanto rende?', 'tô chegando', '🔥🔥', 'Confirmado',
        'Alguém aí?', 'não consigo logar', 'boa tarde', 'tá longe?',
        'quanto km?', 'valeu', 'boa', 'que horas abre?', 'ainda tem?',
    ],
};

function gerarMensagens(n, pctAceitas, pctIgnoradas) {
    return Array.from({ length: n }, () => {
        const r = Math.random() * 100;
        const pool = r < pctAceitas                    ? MSGS.aceitas
                   : r < pctAceitas + pctIgnoradas     ? MSGS.ignoradas
                   : MSGS.neutras;
        return pool[Math.floor(Math.random() * pool.length)];
    });
}

// ─── Executor de cenário ──────────────────────────────────────────────────────
async function cenario(cfg) {
    const { nome, mensagens, msgPorSegundo, concorrencia } = cfg;

    const stats = {
        ignorado_tipo: 0, ignorado_direto: 0, ignorado_broadcast: 0,
        ignorado_antigo: 0, ignorado_vazio: 0, ignorado_regiao: 0, ignorado_sematch: 0,
        reagido:    0,
        latTriagem: [],
        latReacao:  [],
        regioes:    {},
        _pendentes: [],
    };

    filaReact.reset();
    filaFetch.reset();

    const elMonitor = new MonitorEL();
    elMonitor.iniciar();

    const memAntes = process.memoryUsage();
    const tInicio  = performance.now();

    const intervaloMs = msgPorSegundo > 0 ? 1000 / msgPorSegundo : 0;
    const promises    = [];

    for (let i = 0; i < mensagens.length; i++) {
        promises.push(processarMensagem(mockMsg(mensagens[i]), stats));

        if (intervaloMs > 0) {
            await new Promise(r => setTimeout(r, intervaloMs));
        } else if ((i + 1) % concorrencia === 0 || i === mensagens.length - 1) {
            await Promise.all(promises.splice(0));
        }
    }

    await Promise.all(promises);

    // Aguarda todas as reações e fetch pendentes
    if (stats._pendentes.length) {
        await Promise.all(stats._pendentes);
    }

    const duracao  = performance.now() - tInicio;
    const memDepois = process.memoryUsage();
    elMonitor.parar();

    const total     = mensagens.length;
    const ignorados = total - stats.reagido;
    const pct       = (n) => ((n / total) * 100).toFixed(1);
    const p         = (arr, v) => {
        if (!arr.length) return '—';
        const s = [...arr].sort((a, b) => a - b);
        return s[Math.ceil((v / 100) * s.length) - 1].toFixed(2);
    };

    const sep = '═'.repeat(64);
    console.log(`\n${sep}`);
    console.log(` ${nome}`);
    console.log(sep);

    console.log(`\n  VOLUME & THROUGHPUT`);
    console.log(`    Total mensagens   : ${total}`);
    console.log(`    Duração           : ${duracao.toFixed(0)} ms`);
    console.log(`    Taxa configurada  : ${msgPorSegundo > 0 ? msgPorSegundo + ' msg/s' : 'rajada máxima (sem throttle)'}`);
    console.log(`    Throughput real   : ${(total / (duracao / 1000)).toFixed(1)} msg/s`);

    console.log(`\n  TRIAGEM (tempo até decidir — Node.js puro, sem I/O)`);
    if (stats.latTriagem.length) {
        console.log(`    p50 : ${p(stats.latTriagem, 50)} ms   p95 : ${p(stats.latTriagem, 95)} ms   p99 : ${p(stats.latTriagem, 99)} ms   max : ${p(stats.latTriagem, 100)} ms`);
    } else {
        console.log(`    (nenhuma mensagem ativou triagem completa)`);
    }

    console.log(`\n  DECISÕES`);
    console.log(`    Reagidas  👍 : ${stats.reagido.toString().padStart(4)}  (${pct(stats.reagido)}%)`);
    console.log(`    Ignoradas    : ${ignorados.toString().padStart(4)}  (${pct(ignorados)}%)`);
    console.log(`      ↳ tipo ≠ chat     : ${stats.ignorado_tipo}`);
    console.log(`      ↳ região bloqueada: ${stats.ignorado_regiao}`);
    console.log(`      ↳ sem match       : ${stats.ignorado_sematch}`);

    console.log(`\n  FILA PUPPETEER — react() [gargalo principal]`);
    console.log(`    Chamadas totais        : ${filaReact.totalCalls}`);
    console.log(`    Fila máxima simultânea : ${filaReact.maxFila}  ← quanto maior, mais reações atrasadas`);
    if (filaReact.esperas.length) {
        console.log(`    Espera na fila  p50 : ${p(filaReact.esperas, 50)} ms`);
        console.log(`    Espera na fila  p95 : ${p(filaReact.esperas, 95)} ms`);
        console.log(`    Espera na fila  p99 : ${p(filaReact.esperas, 99)} ms`);
        console.log(`    Espera na fila  max : ${p(filaReact.esperas, 100)} ms`);
        console.log(`      (tempo aguardando na fila antes de ser atendido)`);
        console.log(`      ${parseFloat(p(filaReact.esperas, 100)) > 100 ? '⚠️  FILA MUITO LONGA — REAÇÕES ATRASADAS' : '✓ fila saudável'}`);
    }
    if (filaReact.latencias.length) {
        console.log(`    Latência rede WA p50: ${p(filaReact.latencias, 50)} ms  (tempo dentro do Puppeteer)`);
        console.log(`    Latência rede WA p95: ${p(filaReact.latencias, 95)} ms`);
    }

    console.log(`\n  FETCH → API  (via setImmediate, fire-and-forget)`);
    console.log(`    Chamadas totais        : ${filaFetch.totalCalls}`);
    console.log(`    Fila máxima simultânea : ${filaFetch.maxFila}`);
    if (filaFetch.esperas.length) {
        console.log(`    Espera na fila  p95 : ${p(filaFetch.esperas, 95)} ms`);
    }

    console.log(`\n  EVENT LOOP LAG`);
    if (elMonitor.lags.length) {
        console.log(`    média : ${(elMonitor.lags.reduce((a,b)=>a+b,0)/elMonitor.lags.length).toFixed(2)} ms`);
        console.log(`    p95   : ${elMonitor.pct(95)} ms`);
        console.log(`    p99   : ${elMonitor.pct(99)} ms`);
        console.log(`    max   : ${elMonitor.pct(100)} ms   ${parseFloat(elMonitor.pct(100)) > 100 ? '⚠️  TRAVAMENTO DETECTADO' : '✓ saudável'}`);
    } else {
        console.log(`    (cenário rápido demais para amostrar — sem problema)`);
    }

    console.log(`\n  MEMÓRIA`);
    const dHeap = ((memDepois.heapUsed - memAntes.heapUsed) / 1024 / 1024).toFixed(2);
    const dRSS  = ((memDepois.rss - memAntes.rss) / 1024 / 1024).toFixed(2);
    console.log(`    Heap : ${(memAntes.heapUsed/1024/1024).toFixed(1)} MB → ${(memDepois.heapUsed/1024/1024).toFixed(1)} MB  (Δ ${dHeap > 0 ? '+' : ''}${dHeap} MB)`);
    console.log(`    RSS  : ${(memAntes.rss/1024/1024).toFixed(1)} MB → ${(memDepois.rss/1024/1024).toFixed(1)} MB  (Δ ${dRSS > 0 ? '+' : ''}${dRSS} MB)`);

    if (Object.keys(stats.regioes).length) {
        console.log(`\n  REGIÕES DETECTADAS`);
        Object.entries(stats.regioes)
            .sort((a, b) => b[1] - a[1])
            .forEach(([r, c]) => console.log(`    "${r}"  →  ${c}x`));
    }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
    console.log('\n' + '█'.repeat(64));
    console.log('  STRESS TEST ROBUSTO — BOT SNIPER MVC TRANSPORTES');
    console.log('  Lógica real do bot.js · Fila Puppeteer · Event loop lag');
    console.log('█'.repeat(64));

    await cenario({
        nome:          'CENÁRIO 1 — Carga normal  |  10 msg/s  |  300 msgs  |  15% rotas',
        mensagens:     gerarMensagens(300, 15, 30),
        msgPorSegundo: 10,
        concorrencia:  10,
    });

    await cenario({
        nome:          'CENÁRIO 2 — Pico da manhã  |  50 msg/s  |  1000 msgs  |  35% rotas',
        mensagens:     gerarMensagens(1000, 35, 35),
        msgPorSegundo: 50,
        concorrencia:  50,
    });

    await cenario({
        nome:          'CENÁRIO 3 — Rajada pura  |  sem throttle  |  1000 msgs  |  40% rotas',
        mensagens:     gerarMensagens(1000, 40, 30),
        msgPorSegundo: 0,
        concorrencia:  1000,
    });

    await cenario({
        nome:          'CENÁRIO 4 — Tsunami de spam  |  1000 msgs  |  0% rotas',
        mensagens:     gerarMensagens(1000, 0, 0),
        msgPorSegundo: 0,
        concorrencia:  1000,
    });

    await cenario({
        nome:          'CENÁRIO 5 — Pior caso  |  500 rotas simultâneas  |  fila Puppeteer ao limite',
        mensagens:     gerarMensagens(500, 100, 0),
        msgPorSegundo: 0,
        concorrencia:  500,
    });

    await cenario({
        nome:          'CENÁRIO 6 — Carga sustentada  |  5 msg/s  |  600 msgs  |  foco: memory leak',
        mensagens:     gerarMensagens(600, 20, 30),
        msgPorSegundo: 5,
        concorrencia:  5,
    });

    console.log('\n' + '═'.repeat(64));
    console.log('  TODOS OS CENÁRIOS CONCLUÍDOS');
    console.log('═'.repeat(64) + '\n');
})();
