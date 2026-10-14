// Copia os arquivos do app (index.html, css/app.css, js/app.js) para admin/app-files.js.
// O admin usa essa cópia na pré-visualização e na exportação, porque o navegador não deixa
// uma página aberta direto do disco (file://) ler outros arquivos.
// Uso: node scripts/admin-bundle.js   (rode sempre que mudar o index.html, o css ou o js do app)
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(raiz, f), 'utf8');
const index = ler('index.html').replace(
  /(<!-- META:INICIO[^>]*-->)[\s\S]*?(\s*<!-- META:FIM -->)/, '$1$2');   // o admin grava as tags de cada loja

const arquivos = { 'index.html': index, 'css/app.css': ler('css/app.css'), 'js/app.js': ler('js/app.js') };
const saida = '// Gerado por scripts/admin-bundle.js em ' + new Date().toLocaleString('pt-BR') + ' — não edite à mão.\n' +
  'window.APP_FILES = ' + JSON.stringify(arquivos) + ';\n' +
  'window.APP_FILES_DATA = ' + JSON.stringify(new Date().toISOString()) + ';\n';
fs.writeFileSync(path.join(raiz, 'admin/app-files.js'), saida);
console.log('admin/app-files.js atualizado (' + Math.round(saida.length / 1024) + ' KB)');
