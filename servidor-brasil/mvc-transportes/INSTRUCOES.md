# Instruções para Execução dos Testes

Este projeto contém uma série de testes robustos para verificar a integridade e estrutura do projeto.

## Estrutura do Projeto

```
.
├── backend/          # Código do backend
├── frontend/       # Código do frontend
├── bot/            # Código do bot
├── server.js      # Servidor principal
├── package.json   # Configurações do projeto
├── test_server.js # Teste específico para o servidor
├── robust_test.js # Teste robusto completo
├── run_tests.js   # Script de execução de testes
├── example_test.js # Exemplo de teste
└── run_all_tests.sh # Script para executar todos os testes
```

## Como Executar os Testes

### 1. Teste de Estrutura Básica
```bash
node robust_test.js
```

### 2. Teste de Integridade Completo
```bash
node run_tests.js
```

### 3. Exemplo de Teste
```bash
node example_test.js
```

### 4. Executar Todos os Testes
```bash
node robust_test.js
node run_tests.js
node example_test.js
```

## Arquivos de Teste Criados

- **robust_test.js**: Verificação completa da estrutura do projeto
- **run_tests.js**: Script para execução de testes automatizados
- **example_test.js**: Exemplo de teste funcional
- **test_server.js**: Teste específico para o servidor

## Próximos Passos

1. Execute `node robust_test.js` para verificar a estrutura
2. Execute `node run_tests.js` para testes mais completos
3. Verifique os resultados e ajuste conforme necessário

## Observações

- Todos os testes foram criados para funcionar com Node.js
- Os testes verificam a existência dos arquivos principais
- Os testes verificam a integridade da estrutura do projeto
- Os testes podem ser executados em qualquer ordem