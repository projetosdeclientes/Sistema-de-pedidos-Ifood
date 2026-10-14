// Meta tags de compartilhamento (título, descrição, imagem, favicon) a partir da config da loja.
// Usado pelo scripts/meta.js (Node) e pelo admin (navegador). Não vai para o site do cliente.
(function (root, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else root.MetaTags = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // Endereço do site: seo.url ou, se vazio, o urlPadrao com o slug (ex.: https://brasa-burger.netlify.app/)
  function urlDoSite(L) {
    var seo = L.seo || {};
    var url = seo.url || (L.urlPadrao && L.slug ? L.urlPadrao.replace('{slug}', L.slug) : '');
    return url ? url.replace(/\/?$/, '/') : '';
  }
  function iniciais(nome) { return String(nome || '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }

  function gerar(L) {
    var seo = L.seo || {}, base = urlDoSite(L);
    var abs = function (u) { return (!u || /^(https?:|data:)/.test(u) || !base) ? u : new URL(u, base).href; };
    var titulo = seo.titulo || L.nome || '';
    var descricao = seo.descricao || '';
    var imagem = abs(seo.imagem || L.logo || '');
    var favicon = L.favicon || L.logo || 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="' + ((L.cores || {}).principal || '#E8590C') + '"/>' +
      '<text x="32" y="42" font-family="Arial,sans-serif" font-weight="700" font-size="26" fill="#fff" text-anchor="middle">' + esc(iniciais(L.nome)) + '</text></svg>');
    return [
      '<title>' + esc(titulo) + '</title>',
      '<meta name="description" content="' + esc(descricao) + '">',
      '<meta property="og:type" content="website">',
      '<meta property="og:locale" content="pt_BR">',
      '<meta property="og:site_name" content="' + esc(L.nome) + '">',
      '<meta property="og:title" content="' + esc(titulo) + '">',
      '<meta property="og:description" content="' + esc(descricao) + '">',
      imagem && '<meta property="og:image" content="' + esc(imagem) + '">',
      seo.imagem && '<meta property="og:image:width" content="1200">',
      seo.imagem && '<meta property="og:image:height" content="630">',
      base && '<meta property="og:url" content="' + esc(base) + '">',
      base && '<link rel="canonical" href="' + esc(base) + '">',
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:title" content="' + esc(titulo) + '">',
      '<meta name="twitter:description" content="' + esc(descricao) + '">',
      imagem && '<meta name="twitter:image" content="' + esc(imagem) + '">',
      '<link rel="icon" href="' + esc(favicon) + '">',
      (L.favicon || L.logo) && '<link rel="apple-touch-icon" href="' + esc(L.favicon || L.logo) + '">'
    ].filter(Boolean).map(function (t) { return '  ' + t; }).join('\n');
  }

  // Substitui o trecho entre <!-- META:INICIO --> e <!-- META:FIM --> do index.html
  function aplicar(html, L) {
    var re = /(<!-- META:INICIO[^>]*-->)[\s\S]*?(\s*<!-- META:FIM -->)/;
    if (!re.test(html)) throw new Error('Marcadores META:INICIO / META:FIM não encontrados no index.html');
    var tags = gerar(L);
    return html.replace(re, function (_, a, b) { return a + '\n' + tags + b; });
  }

  return { gerar: gerar, aplicar: aplicar, urlDoSite: urlDoSite };
});
