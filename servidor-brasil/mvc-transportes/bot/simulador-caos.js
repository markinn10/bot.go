const EventEmitter = require('events');

// Criamos um "WhatsApp Falso" só para o teste
class MockWhatsAppClient extends EventEmitter {}
const client = new MockWhatsAppClient();

let joinhasProcessados = 0;
let lixoIgnorado = 0;

// ==========================================
// 🧠 A LÓGICA DO SEU BOT (O LEÃO DE CHÁCARA)
// ==========================================
client.on('message_reaction', (reaction) => {
    // 🛡️ A BARREIRA: Se NÃO for o joinha, encerra a função em 1 milissegundo.
    if (reaction.reaction !== '👍') {
        lixoIgnorado++;
        return; 
    }

    // Se passou da barreira, é porque é o nosso alvo!
    joinhasProcessados++;
    console.log(`\n✅ [ALVO CAPTURADO] Joinha detectado na mensagem: ${reaction.msgId}`);
    console.log(`Processando confirmação de rota para o motorista... 🚚💨\n`);
});


// ==========================================
// 🌪️ O TESTE DE ESTRESSE (A SIMULAÇÃO)
// ==========================================
console.log('Iniciando o Tsunami: Disparando 100 reações inúteis em 0.1 segundos...');

const reacoesLixo = ['❤️', '😂', '😮', '😢', '🔥', '👏', '🎉', '💩', '👀', '💯'];

// Simula 100 pessoas reagindo com lixo ao mesmo tempo
for (let i = 1; i <= 100; i++) {
    const reacaoAleatoria = reacoesLixo[Math.floor(Math.random() * reacoesLixo.length)];
    
    client.emit('message_reaction', {
        reaction: reacaoAleatoria,
        msgId: `msg_grupo_${i}`
    });
}

console.log(`Tsunami passou. O bot ignorou com sucesso ${lixoIgnorado} reações inúteis sem travar.`);

console.log('\nAgora, o motorista mandou o joinha no meio do caos...');

// Dispara O Joinha
client.emit('message_reaction', {
    reaction: '👍',
    msgId: `msg_rota_oficial_8899`
});

console.log(`Resumo do Teste: Lixo Ignorado: ${lixoIgnorado} | Joinhas Processados: ${joinhasProcessados}`);