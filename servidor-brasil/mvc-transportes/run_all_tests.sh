#!/bin/bash

echo "🚀 Executando todos os testes do projeto..."

echo "1. Executando teste de estrutura..."
node robust_test.js

echo -e "\n2. Executando teste de integridade..."
node run_tests.js

echo -e "\n3. Executando exemplo de teste..."
node example_test.js

echo -e "\n✅ Todos os testes foram executados!"
echo "Você pode agora verificar os resultados acima."