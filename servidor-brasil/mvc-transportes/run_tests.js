// Script para executar testes robustos
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando execução de testes robustos...\n');

// Função para executar um teste específico
function runTest(name, testFunction) {
  console.log(`🧪 Executando teste: ${name}`);
  try {
    const result = testFunction();
    console.log(`✅ Teste ${name}: Sucesso`);
    return { success: true, result };
  } catch (error) {
    console.log(`❌ Teste ${name}: Falha - ${error.message}`);
    return { success: false, error };
  }
}

// Teste 1: Verificação de estrutura básica
const testStructure = () => {
  const requiredFiles = ['package.json', 'server.js', 'backend/', 'frontend/', 'bot/'];
  const missingFiles = [];
  
  requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      missingFiles.push(file);
    }
  });
  
  if (missingFiles.length > 0) {
    throw new Error(`Arquivos faltando: ${missingFiles.join(', ')}`);
  }
  
  return 'Estrutura básica verificada com sucesso';
};

// Teste 2: Verificação do package.json
const testPackageJson = () => {
  const packageJson = fs.readFileSync('package.json', 'utf8');
  const package = JSON.parse(packageJson);
  
  if (!package.name) {
    throw new Error('Nome do projeto não definido no package.json');
  }
  
  if (!package.version) {
    throw new Error('Versão do projeto não definida no package.json');
  }
  
  return `Projeto ${package.name} versão ${package.version} verificado`;
};

// Teste 3: Verificação de diretórios principais
const testDirectories = () => {
  const directories = ['backend', 'frontend', 'bot'];
  const missingDirs = [];
  
  directories.forEach(dir => {
    try {
      const stats = fs.statSync(dir);
      if (!stats.isDirectory()) {
        missingDirs.push(dir);
      }
    } catch (error) {
      missingDirs.push(dir);
    }
  });
  
  if (missingDirs.length > 0) {
    throw new Error(`Diretórios faltando: ${missingDirs.join(', ')}`);
  }
  
  return 'Diretórios principais verificados com sucesso';
};

// Teste 4: Verificação do servidor
const testServer = () => {
  try {
    // Tentar carregar o servidor
    const server = require('./server.js');
    return 'Servidor carregado com sucesso';
  } catch (error) {
    throw new Error(`Erro ao carregar servidor: ${error.message}`);
  }
};

// Executar todos os testes
const tests = [
  { name: 'Estrutura básica', test: testStructure },
  { name: 'package.json', test: testPackageJson },
  { name: 'Diretórios principais', test: testDirectories },
  { name: 'Servidor principal', test: testServer }
];

let passedTests = 0;
let failedTests = 0;

tests.forEach(test => {
  const result = runTest(test.name, test.test);
  if (result.success) {
    passedTests++;
  } else {
    failedTests++;
  }
});

// Resultado final
console.log('\n=== RESULTADO FINAL ===');
console.log(`✅ Testes passados: ${passedTests}`);
console.log(`❌ Testes falhados: ${failedTests}`);
console.log(`📊 Total de testes: ${tests.length}`);

if (failedTests === 0) {
  console.log('\n🎉 Todos os testes passaram! O projeto está pronto para uso.');
  console.log('   Você pode agora executar o servidor com: node server.js');
} else {
  console.log('\n⚠️  Alguns testes falharam. Verifique os erros acima.');
  console.log('   Corrija os problemas antes de continuar.');
}

console.log('\n🚀 Execução de testes concluída!');