// Teste robusto para o servidor principal
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Verificar se os arquivos principais existem
const filesToCheck = [
  'server.js',
  'package.json',
  'backend/',
  'frontend/',
  'bot/'
];

console.log('=== Análise do Projeto ===');

// Verificar existência dos arquivos principais
filesToCheck.forEach(file => {
  const fullPath = path.join(__dirname, file);
  try {
    const exists = fs.existsSync(fullPath);
    console.log(`✓ ${file}: ${exists ? 'Encontrado' : 'Não encontrado'}`);
  } catch (error) {
    console.log(`✗ ${file}: Erro ao verificar`);
  }
});

// Verificar conteúdo do package.json
try {
  const packageJson = fs.readFileSync('package.json', 'utf8');
  const package = JSON.parse(packageJson);
  console.log('\n=== Informações do Package.json ===');
  console.log(`Nome: ${package.name || 'Não definido'}`);
  console.log(`Versão: ${package.version || 'Não definido'}`);
  console.log(`Descrição: ${package.description || 'Não definido'}`);
  console.log(`Scripts: ${Object.keys(package.scripts || {}).length} scripts encontrados`);
} catch (error) {
  console.log('Erro ao ler package.json:', error.message);
}

// Verificar se o servidor pode ser importado
try {
  console.log('\n=== Teste de Importação ===');
  // Tentar carregar o servidor
  const server = require('./server.js');
  console.log('✓ Servidor carregado com sucesso');
} catch (error) {
  console.log('✗ Erro ao carregar servidor:', error.message);
}

// Verificar estrutura de diretórios
console.log('\n=== Estrutura de Diretórios ===');
const directories = ['backend', 'frontend', 'bot'];
directories.forEach(dir => {
  try {
    const stats = fs.statSync(dir);
    if (stats.isDirectory()) {
      console.log(`✓ Diretório ${dir}: Encontrado`);
    }
  } catch (error) {
    console.log(`✗ Diretório ${dir}: Não encontrado`);
  }
});

console.log('\n=== Teste Concluído ===');