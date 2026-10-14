# Cardápio com pedido pelo WhatsApp

Site estático, sem banco de dados e sem instalação. O cliente monta o pedido e ele chega pronto no WhatsApp da loja.

## Admin: cadastrar e exportar cada loja (jeito recomendado)

O admin é uma ferramenta só sua. Roda no seu computador (nada vai para a internet), sem login, e guarda tudo no navegador.

**Abrir:** inicie o servidor local (abaixo) e acesse **http://localhost:5500/admin/admin.html** no **Google Chrome**. Precisa de internet só para as bibliotecas de ZIP e QR Code.

### Servidor local (porta 5500)

- **Jeito fácil:** dê dois cliques em `iniciar-servidor.command`, na pasta do projeto. Ele abre o admin no navegador. Na primeira vez, se o Mac bloquear, clique com o botão direito → **Abrir**.
- **Pelo Terminal:** abra o Terminal na pasta do projeto (no Finder, botão direito na pasta → **Serviços → Novo Terminal na Pasta**) e rode:

  ```
  python3 -m http.server 5500
  ```

- **Endereços:** app em **http://localhost:5500/** e admin em **http://localhost:5500/admin/admin.html**.
- **Para desligar:** feche a janela do Terminal ou aperte `Ctrl+C`.

> ⚠️ **Use sempre o mesmo endereço: `http://localhost:5500`.** O navegador guarda as lojas separadas por endereço. Se abrir por `127.0.0.1:5500`, por outra porta ou com dois cliques no `admin.html`, as lojas não aparecem (continuam salvas no endereço antigo). Para passar de um para o outro: **Exportar backup** num e **Importar backup** no outro.

**Cadastrar um cliente**
- **Nova loja** começa do zero. **Duplicar** copia uma loja pronta: é só trocar nome, logo, cores e WhatsApp.
- **Importar loja.js** traz uma loja que já existe. Escolha a pasta do site para vir junto com as fotos.
- Preencha as seções do menu à esquerda. Tudo salva sozinho, e o celular à direita mostra o cardápio real enquanto você edita. Use "Aberta"/"Fechada" para ver os dois estados.
- As fotos são reduzidas e convertidas para WebP na hora. A imagem de compartilhamento sai em JPG 1200x630.

**Exportar e publicar**
1. Clique em **Revisar e exportar**. Erros (em vermelho) bloqueiam; avisos (em amarelo) só alertam.
2. **Exportar site** baixa `nome-do-link.zip`, já com as meta tags gravadas. Não precisa rodar nenhum comando.
3. Descompacte e arraste a pasta em **app.netlify.com/drop**.
4. No Netlify, em **Site configuration → Change site name**, use o nome que o admin mostra na tela. Se estiver ocupado, troque na seção **Link** e exporte de novo.
5. Baixe o **QR Code** em PNG para balcão, embalagem e Instagram.

**Backup:** os dados ficam só neste navegador. Clique em **Exportar backup** de vez em quando (o admin avisa depois de 7 dias sem backup). O arquivo `.json` vai para a pasta **Downloads**; guarde uma cópia no Google Drive ou num pendrive. **Importar backup** restaura tudo, com imagens, em qualquer computador.

> Se você mudar o app (`index.html`, `css/` ou `js/`), rode `node scripts/admin-bundle.js` para o admin usar a versão nova.

## Sem o admin: editando à mão

### Nova hamburgueria em 3 passos

**1. Duplique a pasta** do projeto e dê o nome do cliente.

**2. Edite só o `config/loja.js`.** Tudo que muda de uma loja para outra está nele, com comentários:

| O que | Campo |
|---|---|
| Nome, nome do link, endereço, WhatsApp (só dígitos, com 55 + DDD) | `nome`, `slug`, `endereco`, `whatsapp` |
| Logo e ícone da aba | `logo`, `favicon` (vazio = iniciais na cor da marca) |
| Cores | `cores.principal`, `cores.secundaria` (tom escuro), `cores.escuro` |
| Visual | `layout` (`"lista"` ou `"grade"`), `mostrarBanner`, `banner` |
| Horário por dia | `horarios` — ex.: `sex: ["18:00-01:00"]`. `[]` = fechado. Pode ter mais de um turno: `["11:00-14:00", "18:00-23:00"]` |
| Fechar num feriado ou imprevisto | `fechadoManual: true` (os pedidos viram agendados). Volte para `false` depois |
| Entrega | `tempoEntrega`, `tempoRetirada`, `taxaEntrega`, `pedidoMinimo` |
| Pagamento e cupons | `pagamentos`, `cupons` |
| Cardápio | `produtos` e `grupos` (ponto da carne, adicionais, remover, sabores…) |
| Combos | produto com `tipo: "combo"` e `itens` — o preço cheio riscado é calculado sozinho |
| Prévia do link no WhatsApp/Instagram (título, descrição, imagem) | `seo`. O endereço do site vem de `seo.url` ou, se vazio, do `urlPadrao` (`https://{slug}.netlify.app`) |

**3. Troque as imagens** em `assets/`:

- `assets/produtos/` — fotos dos produtos, de preferência **quadradas, em WebP, com cerca de 720px**
- `assets/banner.webp` — banner da home (cerca de 960×320)
- `assets/compartilhar.jpg` — prévia do link no WhatsApp/Instagram, **1200×630 em JPG**
- logo (opcional): coloque em `assets/` e aponte em `logo`

> ⚠️ **As imagens atuais são de demonstração** (banco de imagens gratuito). Troque sempre pelas fotos reais da hamburgueria antes de publicar.

Para converter uma foto para WebP: `cwebp -q 70 -resize 720 0 foto.jpg -o assets/produtos/nome.webp`, ou use o site squoosh.app.

### Publicar no Netlify Drop

1. **Mudou nome, descrição, imagem de compartilhamento ou endereço na config?** Rode `node scripts/meta.js` na pasta do projeto. Isso grava essas informações no `index.html`, que é de onde o WhatsApp lê a prévia do link (o Netlify Drop não roda esse passo sozinho).
2. Crie uma pasta nova só com o que vai para o ar: `index.html`, `css/`, `js/`, `config/` e `assets/`. As pastas `design/` e `scripts/` e os outros arquivos ficam de fora.
3. Abra **app.netlify.com/drop**, entre na sua conta e arraste essa pasta.
4. O Netlify cria um endereço aleatório. Vá em **Site configuration → Change site name** e use o mesmo `slug` da config (ex.: `brasa-burger`), para o site ficar em `https://brasa-burger.netlify.app`, o endereço que está gravado nas meta tags.
5. Para atualizar depois: no painel do site, aba **Deploys**, arraste a pasta de novo.

**Testar a prévia do link:** cole o endereço em **developers.facebook.com/tools/debug** e clique em "Scrape Again" (confere a imagem e o título, e renova o cache de WhatsApp e Instagram). Depois mande o link numa conversa do WhatsApp. O WhatsApp guarda a prévia em cache; para ver uma versão nova, envie com `?v=2` no final.

**Para testar no computador:** inicie o servidor local (veja "Servidor local" acima) e abra `http://localhost:5500`.

## Estrutura

```
index.html        página
iniciar-servidor.command   dois cliques = servidor local na porta 5500
config/loja.js    ← único arquivo a editar por cliente (ou o admin gera)
assets/           imagens
css/ js/          app (não precisa mexer)
admin/            admin gerador (nunca vai para o site do cliente)
scripts/          meta tags e cópia do app para o admin (nunca vai para o site)
design/           arquivos originais do Claude Design (só referência, o site não usa)
```
