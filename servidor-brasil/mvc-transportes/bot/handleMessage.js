const REGEX_ACENTOS = /\p{Diacritic}/gu;
const REGEX_NAOALFA = /[^a-z0-9\s]/g;
const REGEX_ESPACOS = /\s+/g;

function normalizeText(s) {
    return (s || '').normalize('NFD').replace(REGEX_ACENTOS, '').toLowerCase().trim();
}

const GROUP_NAME_TTL = 1000 * 60 * 60 * 16; // 16 horas
const groupNameCache = new Map();

const REGIOES_IGNORADAS = [
    "planaltina", "estancia", "vale do amanhecer", "sobradinho", "nova colina",
    "fercal", "itapoa", "jardim botanico", "lago sul", "cruzeiro", "sudoeste",
    "octogonal", "estrutural", "scia", "sia", "arniqueiras", "riacho fundo",
    "bandeirante", "candangolandia", "por do sol", "sol nascente", "volumoso",
    "samambaia", "ceilandia", "guara", "taguatinga", "recanto das emas",
    "recanto", "emas", "santa maria", "santa marta", "sobradinho ii",
    "sobradinho 2", "varjao", "paranoa", "lago norte", "noroeste", "van",
    "moto", "motocicleta", "bau", "sao sebastiao", "fiorino", "fiorino", "FIOrino", "FIORINO"
].map(t => t.replace(REGEX_NAOALFA, ' ').replace(REGEX_ESPACOS, ' ').trim());

const REGIOES_ACEITAS = [
    "aguas claras", "vicente pires", "vp", "jockey",
    "vicente jockey", "joquei", "colonia agricola", "colonia"
].map(t => t.replace(REGEX_NAOALFA, ' ').replace(REGEX_ESPACOS, ' ').trim());

const N_IGNORADAS = REGIOES_IGNORADAS.length;
const N_ACEITAS = REGIOES_ACEITAS.length;
const CORE_API = process.env.CORE_API || 'http://localhost:8080';

async function handleMessage(msg, deps = {}) {
    const getChatFn = deps.getChat || (m => m.getChat());
    const sendMessageFn = deps.sendMessage || (() => Promise.resolve());
    const DEBUG = !!deps.debug;
    const MEU_NUMERO_PESSOAL = deps.meuNumero || null;
    const BOT_ID = deps.botId || 'bot-padrao';

    if (!msg || msg.type !== 'chat' || !msg.from || !msg.body) return;

    const text = msg.body;
    const mensagemNorm = normalizeText(text).replace(REGEX_NAOALFA, ' ').replace(REGEX_ESPACOS, ' ');

    for (let i = 0; i < N_IGNORADAS; i++) {
        if (mensagemNorm.includes(REGIOES_IGNORADAS[i])) return;
    }

    let regiaoEncontrada = null;
    for (let i = 0; i < N_ACEITAS; i++) {
        if (mensagemNorm.includes(REGIOES_ACEITAS[i])) {
            regiaoEncontrada = REGIOES_ACEITAS[i];
            break;
        }
    }
    if (!regiaoEncontrada) return;

    const startReactTime = Date.now();
    const messageTime = (msg.timestamp * 1000) || startReactTime;

    if (DEBUG) {
        console.log('[' + BOT_ID + '] BINGO', {
            texto: text,
            regiao: regiaoEncontrada,
            atrasoRede: (startReactTime - messageTime) + 'ms',
            tempoBot: (Date.now() - startReactTime) + 'ms',
            totalOperacao: (Date.now() - messageTime) + 'ms'
        });
    }

    setImmediate(async () => {
        try {
            const chatId = msg.from;
            const cached = groupNameCache.get(chatId);
            const useCache = cached && (Date.now() - cached.ts) < GROUP_NAME_TTL;
            const chat = useCache ? { name: cached.name } : await getChatFn(msg);

            if (!useCache && chat?.name) {
                groupNameCache.set(chatId, { name: chat.name, ts: Date.now() });
            }

            const nomeDoGrupo = chat?.name || 'Grupo';
            const horarioBrasilia = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const remetente = (msg.author || msg.from).split('@')[0];

            if (MEU_NUMERO_PESSOAL) {
                sendMessageFn(
                    MEU_NUMERO_PESSOAL,
                    '*ROTA ENCONTRADA!*\n\n*Grupo:* ' + nomeDoGrupo + '\n*Rota:* ' + text + '\n*Horario:* ' + horarioBrasilia + '\n*Via:* ' + BOT_ID
                ).catch(() => {});
            }

            fetch(CORE_API + '/api/rotas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grupo: nomeDoGrupo,
                    mensagem: text,
                    regiao: regiaoEncontrada,
                    botId: BOT_ID,
                    remetente
                })
            }).catch(() => {});

        } catch (err) {}
    });
}

module.exports = { handleMessage };