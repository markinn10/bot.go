module.exports = {
  apps: [
    {
      name: 'mvc-backend',
      script: 'java',
      args: '-jar /home/ubuntu/mvc-transportes/backend/target/core-0.0.1-SNAPSHOT.jar',
      cwd: '/home/ubuntu/mvc-transportes/backend',
      interpreter: 'none',
      autorestart: true, // Recomendo deixar true para produção
      watch: false,
      env: {
        SERVER_PORT: 8080
      }
    },
    {
      name: 'meu-bot-default',
      script: '/home/ubuntu/mvc-transportes/bot/bot.js',
      cwd: '/home/ubuntu/mvc-transportes/bot',
      autorestart: true,
      watch: false,
      env: {
        name: 'meu-bot-default',
        INICIO_TURNO: '0',
        FIM_TURNO: '23',
        CORE_API: 'http://localhost:8080',
        CHROME_BIN: '/usr/bin/chromium-browser'
      }
    },
    {
      name: 'meu-bot-2',
      script: '/home/ubuntu/mvc-transportes/bot/bot.js',
      cwd: '/home/ubuntu/mvc-transportes/bot',
      autorestart: true,
      watch: false,
      env: {
        name: 'meu-bot-2',
        INICIO_TURNO: '0',
        FIM_TURNO: '23',
        CORE_API: 'http://localhost:8080',
        CHROME_BIN: '/usr/bin/chromium-browser'
      }
    },
    {
      // 👉 O SEU BACKEND (FASTIFY/NODE)
      name: 'mvc-server',
      script: '/home/ubuntu/mvc-transportes/server.js',
      cwd: '/home/ubuntu/mvc-transportes',
      autorestart: true,
      watch: false,
      env: {
        PORT: 5000,
        CORE_API: 'http://localhost:8080',
        WT_SECRET: 'mvc-transportes-secret-key',
        ADMIN_USER: 'admin',
        ADMIN_PASS: 'mvc2024',
        NODE_ENV: 'production'
      }
    },
    {
      // 👉 O SEU FRONTEND (ANGULAR)
      name: 'mvc-painel',
      script: 'serve',
      env: {
        PM2_SERVE_PATH: '/home/ubuntu/mvc-transportes/frontend/painel/dist/painel/browser',
        PM2_SERVE_PORT: 4200,
        PM2_SERVE_SPA: 'true',
        PM2_SERVE_HOMEPAGE: '/index.html'
      }
    }
  ]
}