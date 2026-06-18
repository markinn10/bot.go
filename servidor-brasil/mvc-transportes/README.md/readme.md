# MVC Transportes - Hub de Logística v3.0

Sistema de monitoramento e automação de rotas para entregas (ML / Amazon Flex) integrado com bots WhatsApp, frontend Angular e backend Java/Spring.

---

## Arquitetura

```
[Painel Web / Angular]
        |
        v
[mvc-server — Fastify/Node :5000]  ←→  PostgreSQL
        |
        | SSH (chave-virginia.key)
        v
[Servidor Virginia — 150.136.90.169]
   └── Bots Go (sniper-va) via PM2
   └── Sessões WhatsApp (.db)
   └── QR Codes (/home/ubuntu/qrcodes/)
        |
        | CORE_API → http://137.131.197.105:8080
        v
[mvc-backend — Java/Spring :8080]
```

Os bots rodam exclusivamente no servidor Virginia. O painel gerencia tudo via SSH — criar, listar, parar, reiniciar, deletar e ler QR codes.

---

## Processos PM2 neste servidor (137.131.197.105)

| ID | Nome | Função |
|:---|:---|:---|
| 0 | `mvc-backend` | API Java/Spring |
| 11 | `mvc-painel` | Serve o frontend Angular |
| 3 | `mvc-server` | Servidor Fastify (API + proxy) |

```bash
# Ver todos os processos
pm2 list

# Logs de cada processo
pm2 logs mvc-server
pm2 logs mvc-backend
pm2 logs mvc-painel

# Reiniciar
pm2 restart mvc-server
pm2 restart mvc-backend
```

---

## Bots WhatsApp (servidor Virginia — 150.136.90.169)

Os bots são gerenciados pelo painel ou diretamente via SSH:

```bash
# Acessar o servidor remoto
ssh -i ~/.ssh/chave-virginia.key ubuntu@150.136.90.169

# Já dentro do servidor remoto:
pm2 list
pm2 logs sniper-virginia
pm2 restart sniper-virginia
```

Ao criar um bot pelo painel, ele nasce automaticamente no servidor Virginia com o binário `/home/ubuntu/sniper-va` e sessão salva em `/home/ubuntu/sessao-<nome>.db`.

---

## Frontend (Angular)

| Ação | Comando |
|:---|:---|
| Build de produção | `deploy` ou `npx ng build --configuration production` |
| Limpar cache | `rm -rf dist/` |
| Restartar Nginx | `sudo systemctl restart nginx` |

---

## Backend (Java/Spring)

| Ação | Comando |
|:---|:---|
| Restartar API | `pm2 restart mvc-backend` |
| Logs da API | `pm2 logs mvc-backend` |
| Build do JAR | `./mvnw clean package` |

---

## Chave SSH

A chave de acesso ao servidor Virginia fica em:
```
/home/ubuntu/.ssh/chave-virginia.key
```
