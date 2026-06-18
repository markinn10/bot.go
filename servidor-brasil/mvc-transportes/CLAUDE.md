# MVC Transportes - Contexto para Claude Code

## Sobre o Projeto
Sistema de monitoramento e automação de rotas para entregas (ML / Amazon Flex) com bots WhatsApp, frontend Angular e backend Java/Spring. Gerenciado via PM2 na Oracle Cloud.

## Gestão dos Bots (WhatsApp)

| O que fazer | Comando |
|:---|:---|
| Listar todos os bots | `pm2 list` |
| Adicionar novo bot | `pm2 start dist/index.js --name "bot-nome"` |
| Restartar um bot | `pm2 restart bot-nome` |
| Remover um bot | `pm2 delete bot-nome` |
| Ver logs de um bot | `pm2 logs bot-nome` |

## Frontend (Angular)

| O que fazer | Comando |
|:---|:---|
| Build de produção | `deploy` ou `npx ng build --configuration production` |
| Limpar cache | `rm -rf dist/` |
| Restartar Nginx | `sudo systemctl restart nginx` |

## Backend (Java/Spring)

| O que fazer | Comando |
|:---|:---|
| Restartar API | `pm2 restart mvc-api` |
| Ver logs da API | `pm2 logs mvc-api` |
| Build do JAR | `./mvnw clean package` |

## Observações
- QR Code dos bots é exibido no terminal via `pm2 logs bot-nome` e também no painel web
- Para atualizar o frontend, sempre rodar `deploy` e depois `sudo systemctl restart nginx`
- Para atualizar o backend, buildar o JAR antes se houver mudança no código Java
