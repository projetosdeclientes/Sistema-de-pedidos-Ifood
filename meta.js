// Grava no index.html as meta tags (título, descrição, favicon e imagem de compartilhamento)
// a partir de config/loja.js. WhatsApp, Instagram e Facebook não executam JavaScript ao
// montar a prévia do link, por isso as tags precisam estar escritas no HTML.
// Uso: node scripts/meta.js   (rode depois de mudar nome, descrição, imagem ou endereço na config)
// Lojas exportadas pelo admin já saem com as tags gravadas; não precisa rodar nada.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const MetaTags = require('./meta-tags');

const raiz = path.join(__dirname, '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(raiz, 'config/loja.js'), 'utf8'), ctx);
const L = ctx.window.LOJA;
if (!L) throw new Error('config/loja.js não definiu window.LOJA');

const arq = path.join(raiz, 'index.html');
fs.writeFileSync(arq, MetaTags.aplicar(fs.readFileSync(arq, 'utf8'), L));
console.log('Meta tags atualizadas para "' + ((L.seo || {}).titulo || L.nome) + '"');
