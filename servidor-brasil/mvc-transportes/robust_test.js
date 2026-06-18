// Teste robusto para análise do projeto
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando teste robusto do projeto...\n');

// 1. Verificação de arquivos principais
const requiredFiles = [
  'package.json',
  'server.js',
  'backend/',
  'frontend/',
  'bot/',
  '.gitignore'
];

console.log('1. Verificação de arquivos principais:');
let allFilesFound = true;

requiredFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  try {
    const exists = fs.existsSync(fullPath);
    if (exists) {
      console.log(`   ✓ ${file}: Encontrado`);
    } else {
      console.log(`   ✗ ${file}: Não encontrado`);
      allFilesFound = false;
    }
  } catch (error) {
    console.log(`   ✗ ${file}: Erro ao verificar`);
    allFilesFound = false;
  }
});

// 2. Verificação do package.json
console.log('\n2. Verificação do package.json:');
try {
  const packageJson = fs.readFileSync('package.json', 'utf8');
  const package = JSON.parse(packageJson);
  
  console.log('   ✓ package.json lido com sucesso');
  console.log(`   Nome: ${package.name || 'Não definido'}`);
  console.log(`   Versão: ${package.version || 'Não definido'}`);
  console.log(`   Descrição: ${package.description || 'Não definido'}`);
  console.log(`   Scripts: ${Object.keys(package.scripts || {}).length} scripts`);
  
  // Verificar dependências principais
  const dependencies = package.dependencies || {};
  const devDependencies = package.devDependencies || {};
  
  console.log(`   Dependências: ${Object.keys(dependencies).length} principais`);
  console.log(`   Dependências de desenvolvimento: ${Object.keys(devDependencies).length} principais`);
  
} catch (error) {
  console.log(`   ✗ Erro ao ler package.json: ${error.message}`);
}

// 3. Verificação da estrutura de diretórios
console.log('\n3. Verificação da estrutura de diretórios:');
const directories = ['backend', 'frontend', 'bot'];
let allDirsFound = true;

directories.forEach(dir => {
  try {
    const stats = fs.statSync(dir);
    if (stats.isDirectory()) {
      console.log(`   ✓ Diretório ${dir}: Encontrado`);
    } else {
      console.log(`   ✗ Diretório ${dir}: Não é um diretório`);
      allDirsFound = false;
    }
  } catch (error) {
    console.log(`   ✗ Diretório ${dir}: Não encontrado`);
    allDirsFound = false;
  }
});

// 4. Verificação do servidor principal
console.log('\n4. Verificação do servidor principal:');
try {
  const serverStats = fs.statSync('server.js');
  if (serverStats.isFile()) {
    console.log('   ✓ server.js: Encontrado');
    
    // Tentar ler o conteúdo
    const serverContent = fs.readFileSync('server.js', 'utf8');
    const lines = serverContent.split('\n');
    console.log(`   Linhas de código: ${lines.length}`);
    
    // Verificar se tem imports ou exports
    const hasImports = serverContent.includes('require(') || serverContent.includes('import ');
    const hasExports = serverContent.includes('module.exports') || serverContent.includes('export ');
    
    console.log(`   Tem imports: ${hasImports ? 'Sim' : 'Não'}`);
    console.log(`   Tem exports: ${hasExports ? 'Sim' : 'Não'}`);
    
  } else {
    console.log('   ✗ server.js: Não é um arquivo');
  }
} catch (error) {
  console.log(`   ✗ Erro ao verificar server.js: ${error.message}`);
}

// 5. Verificação de arquivos de configuração
console.log('\n5. Verificação de arquivos de configuração:');
const configFiles = ['.gitignore', 'ecosystem.config.js'];
configFiles.forEach(file => {
  try {
    const exists = fs.existsSync(file);
    if (exists) {
      console.log(`   ✓ ${file}: Encontrado`);
    } else {
      console.log(`   ⚠ ${file}: Não encontrado (opcional)`);
    }
  } catch (error) {
    console.log(`   ✗ Erro ao verificar ${file}: ${error.message}`);
  }
});

// 6. Resumo
console.log('\n=== RESUMO DO TESTE ===');
const overallSuccess = allFilesFound && allDirsFound;
console.log(`✓ Projeto está completo: ${overallSuccess ? 'Sim' : 'Não'}`);

if (overallSuccess) {
  console.log('\n🎉 Parabéns! O projeto parece estar bem estruturado.');
  console.log('   Você pode agora executar os testes ou iniciar o desenvolvimento.');
} else {
  console.log('\n⚠️  Atenção: Algumas partes do projeto estão faltando.');
  console.log('   Você pode corrigir os arquivos faltantes antes de continuar.');
}

console.log('\n🧪 Teste robusto concluído!');