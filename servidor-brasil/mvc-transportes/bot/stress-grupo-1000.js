/**
 * stress-grupo-1000.js
 * Simula um grupo WhatsApp com 1000 participantes enviando mensagens em rajada.
 * Mede: tempo de triagem (ignorar vs reagir), latência de reação e throughput.
 *
 * Uso: node stress-grupo-1000.js
 */

'use strict';

// ─── Lógica extraída do bot.js ────────────────────────────────────────────────
const REGEX_ACENTOS = /[̀-ͯ]/g;

const REGIOES_ACEITAS = [
    "aguas claras", "vicente pires", "vp", "jockey",
    "vicente jockey", "joquei", "colonia agricola", "colonia", "previsão de rotas",
    "previsão", "previsao", "rota prevista", "rotas previstas"
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

// ─── Pool de mensagens realistas ──────────────────────────────────────────────
const MSGS_ACEITAS = [
    "Rotas em Aguas Claras disponíveis agora",
    "Preciso de ajuda Vicente Pires",
    "VP tá liberado pessoal",
    "Rota prevista para Colônia Agrícola",
    "Quem pega Jockey hoje?",
    "Rotas previstas para amanhã - Aguas Claras",
    "colonia perto do comercial",
    "Joquei - rota disponível",
    "Boa tarde, existe previsão de rotas?",
    "previsao de hoje saiu?",
    "VP e Vicente Jockey - quem quer?",
    "Rota Aguas Claras ainda aberta",
];

const MSGS_IGNORADAS = [
    "Alguém em Samambaia agora?",
    "Planaltina tem rotas hoje?",
    "Sobradinho II - pegando corrida",
    "Taguatinga norte bloqueado",
    "Ceilândia - quem tá aí?",
    "Van disponível em Guará",
    "Recanto das Emas - rota aberta",
    "Santa Maria tem entrega",
    "Fiorino para Riacho Fundo",
    "Moto em Arniqueiras",
    "SIA tem corrida urgente",
    "Lago Sul - premium route",
    "Candangolândia disponível",
    "Lago Norte abriu rotas",
];

const MSGS_NEUTRAS = [
    "Bom dia galera!",
    "Alguém me passa o telefone do coordenador?",
    "👍",
    "Obrigado",
    "ok",
    "Já peguei",
    "😎🚚",
    "Boa tarde a todos",
    "Alguém conseguiu ontem?",
    "Quanto rende a rota?",
    "Qual a distância?",
    "Pode ser hoje à tarde",
    "🔥🔥🔥",
    "Confirmado",
    "tô chegando",
    "Já foi tudo",
    "Alguém aí no grupo ainda?",
    "não tô conseguindo logar",
];

// ─── Mock de react() com latência realista de rede WhatsApp ──────────────────
function mockReact(msgId) {
    // WhatsApp web leva ~200–900ms para confirmar uma reação (variável de rede)
    const latencia = 200 + Math.random() * 700;
    return new Promise(resolve => setTimeout(() => resolve(latencia), latencia));
}

// ─── Simulador de mensagem ────────────────────────────────────────────────────
function criarMensagem(tipo, participanteId) {
    const pool = tipo === 'aceita' ? MSGS_ACEITAS
               : tipo === 'ignorada' ? MSGS_IGNORADAS
               : MSGS_NEUTRAS;
    const corpo = pool[Math.floor(Math.random() * pool.length)];
    return {
        type: 'chat',
        from: '120363338093856913@g.us',
        author: participanteId + '@s.whatsapp.net',
        body: corpo,
        timestamp: Math.floor(Date.now() / 1000),
        _id: `MSG_${participanteId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
}

// ─── Lógica de processamento idêntica ao bot.js ───────────────────────────────
async function processarMensagem(msg, stats) {
    const tInicio = process.hrtime.bigint();

    // Filtros rápidos (sequência idêntica ao bot.js)
    if (msg.type !== 'chat')                    { stats.ignorado_tipo++;    return registrar(stats, 'ignorado', tInicio); }
    if (msg.from === 'status@broadcast')        { stats.ignorado_broadcast++; return registrar(stats, 'ignorado', tInicio); }
    if (!msg.from.endsWith('@g.us'))            { stats.ignorado_direto++;  return registrar(stats, 'ignorado', tInicio); }
    if (!msg.body)                              { stats.ignorado_vazio++;   return registrar(stats, 'ignorado', tInicio); }

    const norm = msg.body.toLowerCase().normalize('NFD').replace(REGEX_ACENTOS, '');

    if (REGEX_IGNORADAS.test(norm)) { stats.ignorado_regiao++; return registrar(stats, 'ignorado', tInicio); }

    const match = norm.match(REGEX_ACEITAS);
    if (!match)                     { stats.ignorado_sem_match++; return registrar(stats, 'ignorado', tInicio); }

    // --- Alvo encontrado: reagir ---
    const tReacao = process.hrtime.bigint();
    const latenciaReacao = await mockReact(msg._id);
    const tFim = process.hrtime.bigint();

    stats.reagido++;
    stats.latencias_reacao.push(latenciaReacao);
    stats.latencias_triagem.push(Number(tReacao - tInicio) / 1e6);
    stats.regioes[match[0]] = (stats.regioes[match[0]] || 0) + 1;

    return {
        decisao: 'reagido',
        msgId: msg._id,
        regiao: match[0],
        tempoTriagem: Number(tReacao - tInicio) / 1e6,
        tempoReacao: latenciaReacao,
        tempoTotal: Number(tFim - tInicio) / 1e6,
    };
}

function registrar(stats, decisao, tInicio) {
    const ns = Number(process.hrtime.bigint() - tInicio);
    stats.latencias_triagem.push(ns / 1e6);
    return { decisao };
}

// ─── Percentil ───────────────────────────────────────────────────────────────
function percentil(arr, p) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * s.length) - 1;
    return s[Math.max(0, idx)].toFixed(2);
}

// ─── Cenários de teste ────────────────────────────────────────────────────────
async function cenario(nome, mensagens, concorrencia = 50) {
    const stats = {
        ignorado_tipo: 0, ignorado_broadcast: 0, ignorado_direto: 0,
        ignorado_vazio: 0, ignorado_regiao: 0, ignorado_sem_match: 0,
        reagido: 0,
        latencias_triagem: [],
        latencias_reacao: [],
        regioes: {},
    };

    const tInicioGeral = Date.now();

    // Processa em lotes para simular concorrência
    for (let i = 0; i < mensagens.length; i += concorrencia) {
        const lote = mensagens.slice(i, i + concorrencia);
        await Promise.all(lote.map(msg => processarMensagem(msg, stats)));
    }

    const duracao = Date.now() - tInicioGeral;
    const total   = mensagens.length;
    const ignorados = total - stats.reagido;

    console.log(`\n${'═'.repeat(60)}`);
    console.log(` CENÁRIO: ${nome}`);
    console.log(`${'═'.repeat(60)}`);
    console.log(` Total de mensagens : ${total}`);
    console.log(` Duração total      : ${duracao} ms`);
    console.log(` Throughput         : ${(total / (duracao / 1000)).toFixed(0)} msg/s`);
    console.log(`\n [TRIAGEM — tempo p/ decidir ignorar ou reagir]`);
    console.log(`   p50  : ${percentil(stats.latencias_triagem, 50)} ms`);
    console.log(`   p95  : ${percentil(stats.latencias_triagem, 95)} ms`);
    console.log(`   p99  : ${percentil(stats.latencias_triagem, 99)} ms`);
    console.log(`   max  : ${percentil(stats.latencias_triagem, 100)} ms`);
    console.log(`\n [DECISÕES]`);
    console.log(`   Ignorados        : ${ignorados} (${((ignorados/total)*100).toFixed(1)}%)`);
    console.log(`     ↳ tipo errado  : ${stats.ignorado_tipo}`);
    console.log(`     ↳ região bloq. : ${stats.ignorado_regiao}`);
    console.log(`     ↳ sem match    : ${stats.ignorado_sem_match}`);
    console.log(`   Reagidos (👍)    : ${stats.reagido} (${((stats.reagido/total)*100).toFixed(1)}%)`);

    if (stats.latencias_reacao.length) {
        console.log(`\n [REAÇÃO — latência de rede (mock WhatsApp 200–900ms)]`);
        console.log(`   p50  : ${percentil(stats.latencias_reacao, 50)} ms`);
        console.log(`   p95  : ${percentil(stats.latencias_reacao, 95)} ms`);
        console.log(`   p99  : ${percentil(stats.latencias_reacao, 99)} ms`);
        console.log(`   mais rápida : ${percentil(stats.latencias_reacao, 1)} ms`);
        console.log(`   mais lenta  : ${percentil(stats.latencias_reacao, 100)} ms`);
    }

    if (Object.keys(stats.regioes).length) {
        console.log(`\n [REGIÕES DETECTADAS]`);
        Object.entries(stats.regioes)
            .sort((a,b) => b[1] - a[1])
            .forEach(([r, c]) => console.log(`   "${r}" → ${c}x`));
    }
}

// ─── Gerador de população ─────────────────────────────────────────────────────
function gerarPopulacao(n, distribuicao) {
    const msgs = [];
    const { pct_aceitas, pct_ignoradas } = distribuicao;
    for (let i = 1; i <= n; i++) {
        const r = Math.random() * 100;
        const tipo = r < pct_aceitas ? 'aceita'
                   : r < pct_aceitas + pct_ignoradas ? 'ignorada'
                   : 'neutra';
        msgs.push(criarMensagem(tipo, `user${i}`));
    }
    return msgs;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
    console.log('\n🚀  STRESS TEST — BOT SNIPER MVC TRANSPORTES');
    console.log('    Simulando grupo com 1.000 participantes\n');

    // ── Cenário 1: Dia normal (maioria mensagens neutras)
    await cenario(
        '1 — Dia normal (15% aceitas / 30% ignoradas / 55% neutras)',
        gerarPopulacao(1000, { pct_aceitas: 15, pct_ignoradas: 30 }),
        100
    );

    // ── Cenário 2: Pico da manhã (muitas rotas sendo anunciadas)
    await cenario(
        '2 — Pico da manhã (40% aceitas / 40% ignoradas / 20% neutras)',
        gerarPopulacao(1000, { pct_aceitas: 40, pct_ignoradas: 40 }),
        200
    );

    // ── Cenário 3: Tsunami de lixo (spam / figurinhas / emojis)
    const spamMsgs = Array.from({ length: 1000 }, (_, i) => ({
        type: 'chat',
        from: '120363338093856913@g.us',
        author: `spammer${i}@s.whatsapp.net`,
        body: ['😂😂😂', '🔥🔥', 'kkkkk', 'hahaha', 'rs', '👀', 'opa', '???'][i % 8],
        timestamp: Math.floor(Date.now() / 1000),
        _id: `SPAM_${i}`,
    }));
    await cenario('3 — Tsunami de spam / emojis (0% rotas)', spamMsgs, 200);

    // ── Cenário 4: Ataque de reações (tipo errado — bot deve ignorar instantâneo)
    const reactionMsgs = Array.from({ length: 1000 }, (_, i) => ({
        type: 'reaction',   // <-- tipo errado, bot ignora no primeiro check
        from: '120363338093856913@g.us',
        author: `user${i}@s.whatsapp.net`,
        body: '👍',
        timestamp: Math.floor(Date.now() / 1000),
        _id: `REACT_${i}`,
    }));
    await cenario('4 — 1000 reações simultâneas (tipo ≠ chat → descarte imediato)', reactionMsgs, 500);

    // ── Cenário 5: Pior caso — todas as 1000 mensagens devem ser reagidas
    const melhoresMsgs = Array.from({ length: 1000 }, (_, i) =>
        criarMensagem('aceita', `driver${i}`)
    );
    await cenario('5 — Pior caso: 1000 rotas simultâneas (100% aceitas)', melhoresMsgs, 50);

    console.log(`\n${'═'.repeat(60)}`);
    console.log(' TESTE CONCLUÍDO');
    console.log(`${'═'.repeat(60)}\n`);
})();
