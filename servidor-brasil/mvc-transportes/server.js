'use strict'

require('dotenv').config()

const path = require('path')
const fs = require('fs')
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')
const nodemailer = require('nodemailer')
const { execSync } = require('child_process')
const fastify = require('fastify')({ logger: { level: process.env.LOG_LEVEL || 'warn' } })

const PORT = parseInt(process.env.PORT || '5000', 10)
const SPRING_URL = process.env.CORE_API || 'http://localhost:8080'
const STATIC_DIR = path.join(__dirname, 'frontend', 'painel', 'dist', 'painel', 'browser')
const JWT_SECRET = process.env.JWT_SECRET || 'mvc-transportes-secret-key'

// Servidor remoto onde os bots rodam
const REMOTE_HOST = process.env.REMOTE_HOST || '150.136.90.169'
const REMOTE_KEY  = process.env.REMOTE_KEY  || '/home/ubuntu/.ssh/chave-virginia.key'
const REMOTE_USER = 'ubuntu'
const REMOTE_BIN  = '/home/ubuntu/sniper-va'
const CORE_API_BOT = 'http://137.131.197.105:8080'

function sshRemoto(cmd) {
  return execSync(
    `ssh -i ${REMOTE_KEY} -o StrictHostKeyChecking=no -o ConnectTimeout=15 ${REMOTE_USER}@${REMOTE_HOST} ${JSON.stringify(cmd)}`,
    { encoding: 'utf8', timeout: 25000 }
  )
}

function nomeSeguro(name) {
  if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Nome de bot inválido')
  return name
}

const pool = new Pool({
  user: process.env.DB_USER || 'mvcadmin',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'mvctransportes',
  password: process.env.DB_PASS || 'mvc@2024',
  port: parseInt(process.env.DB_PORT || '5432')
})

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
})

async function enviarEmail(para, assunto, html) {
  if (!process.env.EMAIL_USER) return
  try { await transporter.sendMail({ from: `MVC Transportes <${process.env.EMAIL_USER}>`, to: para, subject: assunto, html }) }
  catch(e) { console.error('Erro email:', e.message) }
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY, nome VARCHAR(100) NOT NULL, sobrenome VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL, telefone VARCHAR(20), senha VARCHAR(255) NOT NULL,
      pergunta_seguranca TEXT, resposta_seguranca VARCHAR(255), aprovado BOOLEAN DEFAULT false,
      admin BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bots_config (
      id SERIAL PRIMARY KEY, bot_id VARCHAR(100) UNIQUE NOT NULL,
      regioes_aceitas TEXT[], updated_at TIMESTAMP DEFAULT NOW()
    );
  `)
  console.log('✅ Banco PostgreSQL iniciado')
}

async function start() {
  await initDB()

  await fastify.register(require('@fastify/cors'), { origin: true })
  await fastify.register(require('@fastify/jwt'), { secret: JWT_SECRET })
  await fastify.register(require('@fastify/reply-from'), { base: SPRING_URL })

  fastify.decorate('authenticate', async (request, reply) => {
    try { await request.jwtVerify() }
    catch { return reply.code(401).send({ erro: 'Não autorizado' }) }
  })

  // AUTH
  fastify.post('/auth/cadastro', async (req, reply) => {
    const { nome, sobrenome, email, telefone, senha, pergunta_seguranca, resposta_seguranca } = req.body
    if (!nome || !sobrenome || !email || !senha || !pergunta_seguranca || !resposta_seguranca)
      return reply.code(400).send({ erro: 'Preencha todos os campos obrigatórios.' })
    if (senha.length < 6) return reply.code(400).send({ erro: 'Senha mínimo 6 caracteres.' })
    try {
      const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email])
      if (existe.rows.length > 0) return reply.code(400).send({ erro: 'E-mail já cadastrado.' })
      const hash = await bcrypt.hash(senha, 10)
      const hashResp = await bcrypt.hash(resposta_seguranca.toLowerCase().trim(), 10)
      await pool.query('INSERT INTO usuarios (nome, sobrenome, email, telefone, senha, pergunta_seguranca, resposta_seguranca) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [nome, sobrenome, email, telefone, hash, pergunta_seguranca, hashResp])
      const admins = await pool.query('SELECT email FROM usuarios WHERE admin = true')
      for (const a of admins.rows) await enviarEmail(a.email, 'Novo cadastro', `<p>${nome} ${sobrenome} (${email}) solicitou acesso.</p>`)
      return reply.send({ sucesso: 'Cadastro realizado! Aguarde a aprovação do administrador.' })
    } catch(e) { console.error(e); return reply.code(500).send({ erro: 'Erro interno.' }) }
  })

  fastify.post('/auth/login', async (req, reply) => {
    const { email, senha } = req.body
    if (!email || !senha) return reply.code(400).send({ erro: 'Preencha todos os campos.' })
    try {
      const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email])
      if (result.rows.length === 0) return reply.code(401).send({ erro: 'E-mail não encontrado.', sugerirCadastro: true })
      const user = result.rows[0]
      if (!user.aprovado) return reply.code(403).send({ erro: 'Sua conta ainda não foi aprovada pelo administrador.' })
      if (!(await bcrypt.compare(senha, user.senha))) return reply.code(401).send({ erro: 'Senha incorreta.' })
      const token = fastify.jwt.sign({ id: user.id, email: user.email, admin: user.admin, nome: user.nome }, { expiresIn: '24h' })
      return reply.send({ token, usuario: { id: user.id, nome: user.nome, email: user.email, admin: user.admin } })
    } catch(e) { return reply.code(500).send({ erro: 'Erro interno.' }) }
  })

  fastify.post('/auth/esqueci-senha/email', async (req, reply) => {
    const { email } = req.body
    try {
      const result = await pool.query('SELECT id, pergunta_seguranca FROM usuarios WHERE email = $1', [email])
      if (result.rows.length === 0) return reply.code(404).send({ erro: 'E-mail não encontrado.' })
      return reply.send({ pergunta: result.rows[0].pergunta_seguranca })
    } catch(e) { return reply.code(500).send({ erro: 'Erro interno.' }) }
  })

  fastify.post('/auth/esqueci-senha/verificar', async (req, reply) => {
    const { email, resposta } = req.body
    try {
      const result = await pool.query('SELECT id, resposta_seguranca FROM usuarios WHERE email = $1', [email])
      if (result.rows.length === 0) return reply.code(404).send({ erro: 'E-mail não encontrado.' })
      const ok = await bcrypt.compare(resposta.toLowerCase().trim(), result.rows[0].resposta_seguranca)
      if (!ok) return reply.code(401).send({ erro: 'Resposta incorreta.' })
      const token = fastify.jwt.sign({ id: result.rows[0].id, resetSenha: true }, { expiresIn: '15m' })
      return reply.send({ token })
    } catch(e) { return reply.code(500).send({ erro: 'Erro interno.' }) }
  })

  fastify.post('/auth/esqueci-senha/redefinir', async (req, reply) => {
    const { token, novaSenha } = req.body
    try {
      const payload = fastify.jwt.verify(token)
      if (!payload.resetSenha) return reply.code(401).send({ erro: 'Token inválido.' })
      if (novaSenha.length < 6) return reply.code(400).send({ erro: 'Senha mínimo 6 caracteres.' })
      const hash = await bcrypt.hash(novaSenha, 10)
      await pool.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [hash, payload.id])
      return reply.send({ sucesso: 'Senha redefinida com sucesso!' })
    } catch(e) { return reply.code(500).send({ erro: 'Token expirado ou inválido.' }) }
  })

  // BOTS — operações via SSH no servidor remoto 150.136.90.169
  fastify.get('/api/bots/pm2', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    try {
      const saida = sshRemoto('pm2 jlist 2>/dev/null')
      const lista = JSON.parse(saida)
      return lista.map(p => ({
        id: p.name,
        status: (p.pm2_env?.status || 'unknown').toUpperCase(),
        memory: ((p.monit?.memory || 0) / 1024 / 1024).toFixed(1) + 'MB',
        cpu: (p.monit?.cpu || 0) + '%',
        restarts: p.pm2_env?.restart_time || 0
      }))
    } catch(e) {
      console.error('Erro SSH listagem bots:', e.message)
      return []
    }
  })

  fastify.post('/api/bots/create', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { name } = req.body
    try {
      nomeSeguro(name)
      sshRemoto(`BOT_ID=${name} CORE_API=${CORE_API_BOT} pm2 start ${REMOTE_BIN} --name ${name} && pm2 save`)
      return reply.send({ sucesso: true })
    } catch(e) {
      return reply.send({ sucesso: false, erro: e.message })
    }
  })

  fastify.post('/api/bots/start', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    try {
      nomeSeguro(req.body.name)
      sshRemoto(`pm2 start ${req.body.name}`)
      return reply.send({ sucesso: true })
    } catch(e) { return reply.send({ sucesso: false, erro: e.message }) }
  })

  fastify.post('/api/bots/stop', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    try {
      nomeSeguro(req.body.name)
      sshRemoto(`pm2 stop ${req.body.name}`)
      return reply.send({ sucesso: true })
    } catch(e) { return reply.send({ sucesso: false, erro: e.message }) }
  })

  fastify.post('/api/bots/restart', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    console.log(`[RESTART] ${new Date().toISOString()} bot=${req.body.name} from=${req.ip}`)
    try {
      nomeSeguro(req.body.name)
      sshRemoto(`pm2 restart ${req.body.name}`)
      return reply.send({ sucesso: true })
    } catch(e) { return reply.send({ sucesso: false, erro: e.message }) }
  })

  fastify.post('/api/bots/delete', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { name } = req.body
    if (!name) return reply.code(400).send({ sucesso: false, erro: 'Nome não informado' })
    try {
      nomeSeguro(name)
      sshRemoto(`pm2 delete ${name} 2>/dev/null || true ; rm -f /home/ubuntu/sessao-${name}.db /home/ubuntu/qrcodes/${name}.png ; pm2 save`)
      return reply.send({ sucesso: true, mensagem: 'Bot e arquivos residuais excluídos com sucesso!' })
    } catch(e) {
      return reply.send({ sucesso: false, erro: e.message })
    }
  })

  fastify.post('/api/bots/trocar-numero', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { name } = req.body
    try { nomeSeguro(name) } catch(e) { return reply.send({ sucesso: false, erro: e.message }) }

    try { sshRemoto(`pm2 stop ${name}`) } catch(e) {}
    try { sshRemoto(`rm -f /home/ubuntu/sessao-${name}.db /home/ubuntu/qrcodes/${name}.png`) } catch(e) {}
    try { sshRemoto(`pm2 restart ${name}`) } catch(e) {}

    // Aguarda o novo QR aparecer no servidor remoto (até 40s)
    let tentativas = 0
    await new Promise(resolve => {
      const verificar = setInterval(() => {
        try {
          const b64 = sshRemoto(`[ -f /home/ubuntu/qrcodes/${name}.png ] && base64 -w 0 /home/ubuntu/qrcodes/${name}.png || echo ''`).trim()
          if (b64) {
            clearInterval(verificar)
            reply.send({ sucesso: true, qrcode: 'data:image/png;base64,' + b64 })
            return resolve(null)
          }
        } catch(e) {}
        if (++tentativas > 20) {
          clearInterval(verificar)
          reply.send({ sucesso: true, qrcode: null })
          resolve(null)
        }
      }, 2000)
    })
  })

  fastify.get('/api/bots/:botId/regioes', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const result = await pool.query('SELECT regioes_aceitas FROM bots_config WHERE bot_id = $1', [req.params.botId])
    return reply.send({ regioes: result.rows.length > 0 ? result.rows[0].regioes_aceitas || [] : [] })
  })

  fastify.put('/api/bots/:botId/regioes', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    await pool.query('INSERT INTO bots_config (bot_id, regioes_aceitas) VALUES ($1,$2) ON CONFLICT (bot_id) DO UPDATE SET regioes_aceitas=$2, updated_at=NOW()',
      [req.params.botId, req.body.regioes])
    return reply.send({ sucesso: true })
  })

  fastify.get('/api/admin/usuarios', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const result = await pool.query('SELECT id, nome, sobrenome, email, telefone, aprovado, admin, created_at FROM usuarios ORDER BY created_at DESC')
    return reply.send(result.rows)
  })

  fastify.patch('/api/admin/usuarios/:id/aprovar', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params
    const { aprovado } = req.body
    await pool.query('UPDATE usuarios SET aprovado = $1 WHERE id = $2', [aprovado, id])
    if (aprovado) {
      const user = await pool.query('SELECT email, nome FROM usuarios WHERE id = $1', [id])
      if (user.rows.length > 0) await enviarEmail(user.rows[0].email, 'Conta aprovada!', `<p>Olá ${user.rows[0].nome}, sua conta foi aprovada!</p>`)
    }
    return reply.send({ sucesso: true })
  })

  fastify.all('/api/*', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    return reply.from(request.url)
  })

  // QR Codes — lidos do servidor remoto via SSH
  fastify.get('/qrcodes/:arquivo', async (req, reply) => {
    try {
      // Remove extensão primeiro, depois sanitiza
      const nome = req.params.arquivo.replace(/\.png$/i, '').replace(/[^a-zA-Z0-9_-]/g, '')
      if (!nome) return reply.code(400).send()
      const b64 = sshRemoto(`[ -f /home/ubuntu/qrcodes/${nome}.png ] && base64 -w 0 /home/ubuntu/qrcodes/${nome}.png || echo ''`).trim()
      if (!b64) return reply.code(404).send()
      return reply.type('image/png').send(Buffer.from(b64, 'base64'))
    } catch(e) {
      return reply.code(404).send()
    }
  })

  fastify.setNotFoundHandler((request, reply) => {
    const url = request.raw.url || '';
    
    // 👉 MUDANÇA 1: Adicionamos o '/qrcodes' aqui. Se a imagem não existir, devolve 404 limpo!
    if (url.startsWith('/api') || url.startsWith('/auth') || url.startsWith('/qrcodes')) {
      return reply.code(404).send({ erro: 'Não encontrado' });
    }
    
    // 👉 MUDANÇA 2: Lemos o HTML na mão para evitar o erro "sendFile is not a function"
    if (fs.existsSync(path.join(STATIC_DIR, 'index.html'))) {
      const indexHtml = fs.readFileSync(path.join(STATIC_DIR, 'index.html'), 'utf8');
      return reply.type('text/html').send(indexHtml);
    }
    
    return reply.code(503).send({ erro: 'Build não disponível' });
  });

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`✅ MVC Transportes rodando na porta ${PORT}`);
  } catch(err) { 
    console.error(err); 
    process.exit(1); 
  }
}

start();
