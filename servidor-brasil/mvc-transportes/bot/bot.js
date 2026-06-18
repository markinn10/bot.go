// Stub: redireciona pro binario Go (mvc-sniper).
const { spawn } = require('child_process');

const BIN = '/home/ubuntu/mvc-sniper/mvc-sniper';
const CWD = '/home/ubuntu/mvc-sniper';
const BOT_ID = process.env.name || process.env.BOT_ID || 'meu-bot-default';

console.log(`[STUB] Iniciando Go binary: ${BIN} (BOT_ID=${BOT_ID})`);

const child = spawn(BIN, [], {
  cwd: CWD,
  env: { ...process.env, BOT_ID },
  stdio: 'inherit',
});

['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig => {
  process.on(sig, () => child.kill(sig));
});

child.on('exit', (code, signal) => {
  console.log(`[STUB] Go binary saiu (code=${code}, signal=${signal})`);
  process.exit(code ?? 1);
});

child.on('error', (err) => {
  console.error('[STUB] Falha:', err.message);
  process.exit(1);
});
