/* Admin gerador — cadastra as lojas e exporta o site pronto de cada uma.
   Roda só no navegador: dados no IndexedDB, sem servidor, sem login, sem rastreamento. */
(function () {
  'use strict';

  var URL_PADRAO = 'https://{slug}.netlify.app';
  var DIAS = [['seg', 'Segunda'], ['ter', 'Terça'], ['qua', 'Quarta'], ['qui', 'Quinta'], ['sex', 'Sexta'], ['sab', 'Sábado'], ['dom', 'Domingo']];
  var PAGAMENTOS = ['Pix', 'Dinheiro', 'Crédito', 'Débito'];
  var SECOES = [
    ['dados', 'Dados da loja'], ['link', 'Link'], ['aparencia', 'Aparência'], ['funcionamento', 'Funcionamento'],
    ['entrega', 'Entrega e retirada'], ['pagamentos', 'Pagamentos'], ['categorias', 'Categorias'], ['produtos', 'Produtos'],
    ['grupos', 'Grupos de opções'], ['combos', 'Combos'], ['cupons', 'Cupons'], ['compartilhamento', 'Compartilhamento']
  ];
  var IMG = {   // como cada imagem é tratada no upload
    logo: { max: 512 }, produto: { max: 800 }, banner: { max: 1600 },
    compartilhar: { cobrir: [1200, 630], formato: 'image/jpeg', q: 0.86 }
  };
  var raiz = document.getElementById('raiz');
  var A = { lojas: [], loja: null, secao: 'dados', busca: '', filtroCat: '', aberto: {}, previa: 'real', ultimoBackup: 0, exportado: null };

  // =============================================================== utilidades
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid(p) { return (p || '') + Math.random().toString(36).slice(2, 8); }
  function M(n) { return (+n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function centavos(t) { var d = String(t || '').replace(/\D/g, ''); return d ? parseInt(d, 10) : 0; }
  function mascaraReais(t) { var c = centavos(t); return c ? M(c / 100) : ''; }
  function slugify(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  }
  function slugDigitando(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+/, '').slice(0, 50);
  }
  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) { var ks = p.split('.'), last = ks.pop(); (ks.length ? getPath(o, ks.join('.')) : o)[last] = v; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dataHora(ts) { var d = new Date(ts); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' às ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function hojeISO() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function iniciais(n) { return String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }
  function localWhats(num) { var d = String(num || '').replace(/\D/g, ''); return d.length >= 12 && d.indexOf('55') === 0 ? d.slice(2) : d; }
  function fmtFone(d) {
    if (!d) return '';
    if (d.length <= 2) return '(' + d;
    var ddd = d.slice(0, 2), r = d.slice(2);
    if (r.length <= 4) return '(' + ddd + ') ' + r;
    var corte = r.length >= 9 ? 5 : r.length - 4;
    return '(' + ddd + ') ' + r.slice(0, corte) + '-' + r.slice(corte);
  }
  function erroWhats(num) {
    var d = localWhats(num);
    if (!d) return 'Informe o WhatsApp da loja.';
    if (d.length !== 10 && d.length !== 11) return 'Número incompleto: digite DDD + número.';
    if (+d.slice(0, 2) < 11) return 'DDD inválido.';
    if (d.length === 11 && d[2] !== '9') return 'Celular com 11 dígitos precisa ter 9 depois do DDD.';
    return '';
  }
  function urlLoja(l) { return MetaTags.urlDoSite({ slug: l.slug, urlPadrao: l.urlPadrao || URL_PADRAO, seo: { url: l.urlSite } }); }
  function nomeNetlify(url) {
    try { var h = new URL(url).hostname; return /\.netlify\.app$/.test(h) ? h.replace(/\.netlify\.app$/, '') : ''; } catch (e) { return ''; }
  }
  function urlValida(u) { try { var x = new URL(u); return /^https?:$/.test(x.protocol) && x.hostname.indexOf('.') > 0; } catch (e) { return false; } }
  function baixar(dados, nome) {
    var a = document.createElement('a'), url = typeof dados === 'string' ? dados : URL.createObjectURL(dados);
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    if (typeof dados !== 'string') setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function lerArquivo(f, comoTexto) {
    return new Promise(function (ok, erro) {
      var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = function () { erro(r.error); };
      if (comoTexto) r.readAsText(f); else r.readAsDataURL(f);
    });
  }
  var toastT;
  function toast(t) {
    var el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = t; clearTimeout(toastT); toastT = setTimeout(function () { el.remove(); }, 2600);
  }

  // =============================================================== modal
  function modal(o) {
    return new Promise(function (ok) {
      var f = document.createElement('div');
      f.className = 'modal-fundo';
      f.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><h3>' + esc(o.titulo) + '</h3>' +
        (o.texto ? '<p>' + o.texto + '</p>' : '') +
        (o.campo != null ? '<input class="inp" id="modal-campo" value="' + esc(o.campo) + '" placeholder="' + esc(o.ph || '') + '">' : '') +
        (o.extra || '') +
        '<div class="acoes">' + (o.cancelar === false ? '' : '<button class="btn fantasma" data-r="0">Cancelar</button>') +
        (o.semOk ? '' : '<button class="btn ' + (o.perigo ? 'escuro' : 'primario') + '" data-r="1">' + esc(o.ok || 'OK') + '</button>') + '</div></div>';
      document.body.appendChild(f);
      var campo = f.querySelector('#modal-campo');
      if (campo) { campo.focus(); campo.select(); }
      function fim(v) { f.remove(); ok(v); }
      f.addEventListener('click', function (e) {
        if (e.target === f) return fim(null);
        var b = e.target.closest('[data-r]'); if (b) fim(b.dataset.r === '1' ? (campo ? campo.value : true) : null);
        var x = e.target.closest('[data-extra]'); if (x) fim(x.dataset.extra);
      });
      f.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') fim(null);
        if (e.key === 'Enter' && campo) fim(campo.value);
      });
    });
  }

  // =============================================================== IndexedDB
  var db;
  function abrirDB() {
    return new Promise(function (ok, erro) {
      var r = indexedDB.open('admin-gerador', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('lojas', { keyPath: 'id' }); r.result.createObjectStore('meta', { keyPath: 'k' }); };
      r.onsuccess = function () { db = r.result; ok(); };
      r.onerror = function () { erro(r.error); };
    });
  }
  function tx(store, modo, fn) {
    return new Promise(function (ok, erro) {
      var t = db.transaction(store, modo), req = fn(t.objectStore(store));
      t.oncomplete = function () { ok(req && req.result); };
      t.onerror = function () { erro(t.error); };
    });
  }
  var BD = {
    listar: function () { return tx('lojas', 'readonly', function (s) { return s.getAll(); }); },
    salvar: function (l) { return tx('lojas', 'readwrite', function (s) { return s.put(l); }); },
    excluir: function (id) { return tx('lojas', 'readwrite', function (s) { return s.delete(id); }); },
    meta: function (k) { return tx('meta', 'readonly', function (s) { return s.get(k); }).then(function (r) { return r && r.v; }); },
    setMeta: function (k, v) { return tx('meta', 'readwrite', function (s) { return s.put({ k: k, v: v }); }); }
  };

  // =============================================================== modelo
  function grupoPadrao(id, titulo, tipo, estilo, obrig, opcoes, padrao) {
    return { id: id, titulo: titulo, tipo: tipo, estilo: estilo, obrigatorio: obrig, min: obrig ? 1 : 0, max: 0, padrao: padrao || '',
      opcoes: opcoes.map(function (o) { return { id: uid('o'), nome: o[0], preco: o[1] || 0 }; }) };
  }
  function novaLoja(nome) {
    var horarios = {};
    DIAS.forEach(function (d) { horarios[d[0]] = { aberto: d[0] !== 'seg', turnos: [{ ini: '18:00', fim: '23:00' }] }; });
    return {
      id: uid('l'), criadoEm: Date.now(), editadoEm: Date.now(),
      nome: nome || 'Nova hamburgueria', slug: slugify(nome || 'nova-hamburgueria'), slugManual: false,
      logo: '', icone: '', endereco: '', whatsapp: '', instagram: '', urlSite: '', urlPadrao: URL_PADRAO,
      cores: { principal: '#E8590C', secundaria: '#1C1917', escuro: '#8A3B12' }, layout: 'lista', mostrarBanner: true,
      banner: { imagem: '', titulo: '', subtitulo: '' },
      horarios: horarios, fechadoManual: false, tempoEntrega: '30 a 45 min', tempoRetirada: '20 a 30 min',
      aceitaEntrega: true, aceitaRetirada: true, taxaEntrega: 0, pedidoMinimo: 0,
      pagamentos: { 'Pix': true, 'Dinheiro': true, 'Crédito': true, 'Débito': true },
      categorias: [{ id: uid('k'), nome: 'Burgers', oculta: false }, { id: uid('k'), nome: 'Bebidas', oculta: false }],
      produtos: [],
      grupos: [
        grupoPadrao('ponto', 'Ponto da carne', 'unico', 'escolha', true, [['Mal passado'], ['Ao ponto'], ['Bem passado']], 'Ao ponto'),
        grupoPadrao('adicionais', 'Adicionais', 'multiplo', 'adicional', false, [['Bacon', 4], ['Queijo extra', 4]]),
        grupoPadrao('remover', 'Remover', 'multiplo', 'remocao', false, [['Sem cebola'], ['Sem tomate'], ['Sem molho']])
      ],
      combos: [], cupons: [], seo: { titulo: '', descricao: '', imagem: '' }
    };
  }
  // Completa campos que faltem (lojas de backups antigos)
  function normalizar(l) {
    var d = novaLoja(l.nome);
    Object.keys(d).forEach(function (k) { if (l[k] === undefined) l[k] = d[k]; });
    ['cores', 'banner', 'seo', 'pagamentos'].forEach(function (k) { l[k] = Object.assign({}, d[k], l[k]); });
    DIAS.forEach(function (x) { if (!l.horarios[x[0]]) l.horarios[x[0]] = { aberto: false, turnos: [{ ini: '18:00', fim: '23:00' }] }; });
    l.grupos.forEach(function (g) { g.opcoes.forEach(function (o) { if (!o.id) o.id = uid('o'); }); });
    l.cupons.forEach(function (c) { if (!c.id) c.id = uid('u'); });
    return l;
  }

  // Converte o window.LOJA de um config/loja.js para o formato do admin
  async function daConfig(L, img) {
    var l = novaLoja(L.nome);
    l.categorias = []; l.grupos = [];
    l.slug = L.slug || slugify(L.nome);
    l.slugManual = l.slug !== slugify(L.nome);
    l.endereco = L.endereco || '';
    l.whatsapp = localWhats(L.whatsapp) ? '55' + localWhats(L.whatsapp) : '';
    l.instagram = String(L.instagram || '').replace(/^@/, '');
    l.urlSite = (L.seo || {}).url || '';
    l.urlPadrao = L.urlPadrao || URL_PADRAO;
    l.cores = Object.assign(l.cores, L.cor ? { principal: L.cor } : {}, L.cores || {});
    l.layout = L.layout === 'grade' ? 'grade' : 'lista';
    l.mostrarBanner = L.mostrarBanner !== false;
    var b = L.banner || {};
    l.banner = { imagem: await img(b.imagem), titulo: b.titulo || '', subtitulo: b.subtitulo || '' };
    if (L.horarios) DIAS.forEach(function (x) {
      var v = L.horarios[x[0]], arr = !v || v === 'fechado' ? [] : (Array.isArray(v) ? v : [v]);
      var turnos = arr.map(function (s) {
        var m = String(s).match(/(\d{1,2})(?:[:h](\d{2}))?\s*(?:-|–|às|as|a|até)\s*(\d{1,2})(?:[:h](\d{2}))?/i);
        return m ? { ini: pad(m[1]) + ':' + (m[2] || '00'), fim: pad(m[3]) + ':' + (m[4] || '00') } : null;
      }).filter(Boolean);
      l.horarios[x[0]] = { aberto: turnos.length > 0, turnos: turnos.length ? turnos : [{ ini: '18:00', fim: '23:00' }] };
    });
    l.fechadoManual = !!L.fechadoManual || L.aberto === false;
    ['tempoEntrega', 'tempoRetirada'].forEach(function (k) { if (L[k] != null) l[k] = String(L[k]); });
    l.aceitaEntrega = L.aceitaEntrega !== false;
    l.aceitaRetirada = L.aceitaRetirada !== false;
    l.taxaEntrega = +L.taxaEntrega || 0;
    l.pedidoMinimo = +L.pedidoMinimo || 0;
    PAGAMENTOS.forEach(function (p) { l.pagamentos[p] = (L.pagamentos || PAGAMENTOS).indexOf(p) >= 0; });
    l.cupons = Object.keys(L.cupons || {}).map(function (c) {
      var cp = L.cupons[c];
      return { id: uid('u'), codigo: c.toUpperCase(), tipo: cp.tipo === 'fixo' ? 'fixo' : 'percentual', valor: +cp.valor || 0,
        ativo: cp.ativo !== false, validade: cp.validade || '', minimo: +cp.minimo || 0 };
    });
    Object.keys(L.grupos || {}).forEach(function (id) {
      var g = L.grupos[id], unico = g.tipo === 'unico';
      var min = g.min != null ? +g.min : (g.obrigatorio ? 1 : 0);
      l.grupos.push({ id: id, titulo: g.titulo || id, tipo: unico ? 'unico' : 'multiplo', estilo: g.estilo || (unico ? 'escolha' : 'adicional'),
        obrigatorio: min > 0 || !!g.obrigatorio, min: Math.max(min, g.obrigatorio ? 1 : 0), max: +g.max || 0, padrao: g.padrao || '',
        opcoes: (g.opcoes || []).map(function (o) { return { id: uid('o'), nome: o.nome, preco: +o.preco || 0 }; }) });
    });
    var produtos = L.produtos || [], nomes = [];
    var ehCombo = function (p) { return p.tipo === 'combo'; };
    (L.categorias || []).concat(produtos.filter(function (p) { return !ehCombo(p); }).map(function (p) { return p.categoria; }))
      .forEach(function (n) {
        if (n && nomes.indexOf(n) < 0 && produtos.some(function (p) { return !ehCombo(p) && p.categoria === n; })) nomes.push(n);
      });
    var catId = {};
    nomes.forEach(function (n) { var c = { id: uid('k'), nome: n, oculta: false }; catId[n] = c.id; l.categorias.push(c); });
    var gruposOk = function (gs) { return (gs || []).filter(function (g) { return l.grupos.some(function (x) { return x.id === g; }); }); };
    for (var i = 0; i < produtos.length; i++) {
      var p = produtos[i];
      if (ehCombo(p)) {
        l.combos.push({ id: p.id, nome: p.nome || '', descricao: p.descricao || '', imagem: await img(p.imagem),
          itens: (p.itens || []).map(function (x) { return { id: x.id, qtd: x.qtd || 1 }; }), preco: +p.preco || 0,
          disponivel: p.disponivel !== false, grupos: gruposOk(p.grupos) });
      } else {
        l.produtos.push({ id: p.id, nome: p.nome || '', descricao: p.descricao || '', preco: +p.preco || 0, imagem: await img(p.imagem),
          categoriaId: catId[p.categoria], disponivel: p.disponivel !== false, destaque: !!p.destaque, grupos: gruposOk(p.grupos) });
      }
    }
    var seo = L.seo || {};
    l.seo = { titulo: seo.titulo || '', descricao: seo.descricao || '', imagem: await img(seo.imagem) };
    l.logo = await img(L.logo);
    l.icone = l.logo ? await processar(l.logo, { quadrado: 180, formato: 'image/png' }).catch(function () { return ''; }) : '';
    return l;
  }

  // Converte a loja do admin no window.LOJA do site. `img(src, nome)` devolve o caminho de cada imagem.
  function paraConfig(l, img) {
    var visiveis = l.categorias.filter(function (c) { return !c.oculta; });
    var ordemCat = {}; visiveis.forEach(function (c, i) { ordemCat[c.id] = i; });
    var nomeCat = {}; l.categorias.forEach(function (c) { nomeCat[c.id] = c.nome; });
    var idsGrupos = l.grupos.map(function (g) { return g.id; });
    var soGrupos = function (gs) { var r = (gs || []).filter(function (g) { return idsGrupos.indexOf(g) >= 0; }); return r.length ? r : undefined; };
    var grupos = {};
    l.grupos.forEach(function (g) {
      var unico = g.tipo === 'unico', min = unico ? (g.obrigatorio ? 1 : 0) : (+g.min || 0);
      grupos[g.id] = {
        titulo: g.titulo, tipo: unico ? 'unico' : 'multiplo', estilo: unico ? 'escolha' : g.estilo,
        obrigatorio: min > 0 || undefined, min: !unico && min > 1 ? min : undefined, max: !unico && +g.max ? +g.max : undefined,
        padrao: unico && g.padrao ? g.padrao : undefined, prefixo: !unico && g.estilo === 'adicional' ? '+ ' : undefined,
        opcoes: g.opcoes.filter(function (o) { return String(o.nome).trim(); }).map(function (o) { return o.preco ? { nome: o.nome.trim(), preco: +o.preco } : { nome: o.nome.trim() }; })
      };
    });
    var combos = l.combos.map(function (c) {
      return { id: c.id, tipo: 'combo', categoria: 'Combos', nome: c.nome, preco: +c.preco || 0,
        itens: c.itens.map(function (i) { return i.qtd > 1 ? { id: i.id, qtd: i.qtd } : { id: i.id }; }),
        grupos: soGrupos(c.grupos), descricao: c.descricao || undefined,
        imagem: img(c.imagem, 'produtos/' + (slugify(c.nome) || c.id)), disponivel: c.disponivel === false ? false : undefined };
    });
    var produtos = l.produtos.filter(function (p) { return p.categoriaId in ordemCat; })
      .map(function (p, i) { return { p: p, i: i }; })
      .sort(function (a, b) { return ordemCat[a.p.categoriaId] - ordemCat[b.p.categoriaId] || a.i - b.i; })
      .map(function (x) {
        var p = x.p;
        return { id: p.id, categoria: nomeCat[p.categoriaId], nome: p.nome, preco: +p.preco || 0, destaque: p.destaque || undefined,
          disponivel: p.disponivel === false ? false : undefined, grupos: soGrupos(p.grupos), descricao: p.descricao || '',
          imagem: img(p.imagem, 'produtos/' + (slugify(p.nome) || p.id)) };
      });
    var cupons = {};
    l.cupons.filter(function (c) { return c.ativo && c.codigo; }).forEach(function (c) {
      cupons[c.codigo] = { tipo: c.tipo, valor: +c.valor || 0, minimo: +c.minimo || undefined, validade: c.validade || undefined };
    });
    var horarios = {};
    ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'].forEach(function (k) {
      var h = l.horarios[k];
      horarios[k] = h && h.aberto ? h.turnos.filter(function (t) { return t.ini && t.fim; }).map(function (t) { return t.ini + '-' + t.fim; }) : [];
    });
    return {
      nome: l.nome, slug: l.slug,
      logo: img(l.logo, 'logo'), favicon: img(l.icone, 'icone'),
      whatsapp: l.whatsapp, endereco: l.endereco, instagram: l.instagram || undefined,
      cores: clone(l.cores), layout: l.layout, mostrarBanner: !!l.mostrarBanner,
      fuso: 'America/Sao_Paulo', horarios: horarios, fechadoManual: !!l.fechadoManual,
      tempoEntrega: l.tempoEntrega, tempoRetirada: l.tempoRetirada,
      aceitaEntrega: !!l.aceitaEntrega, aceitaRetirada: !!l.aceitaRetirada,
      taxaEntrega: +l.taxaEntrega || 0, pedidoMinimo: +l.pedidoMinimo || 0,
      pagamentos: PAGAMENTOS.filter(function (p) { return l.pagamentos[p]; }),
      cupons: cupons,
      banner: { titulo: l.banner.titulo, subtitulo: l.banner.subtitulo, imagem: img(l.banner.imagem, 'banner') },
      seo: { titulo: l.seo.titulo || l.nome, descricao: l.seo.descricao, imagem: img(l.seo.imagem, 'compartilhar'), url: l.urlSite || '' },
      urlPadrao: l.urlPadrao || URL_PADRAO,
      categorias: (combos.length ? ['Combos'] : []).concat(visiveis.map(function (c) { return c.nome; })),
      grupos: grupos,
      produtos: combos.concat(produtos)
    };
  }

  // =============================================================== imagens
  function carregarImg(src) {
    return new Promise(function (ok, erro) {
      var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { erro(new Error('Não consegui ler essa imagem.')); }; i.src = src;
    });
  }
  // Redimensiona em etapas (melhor qualidade) e converte. op: {max} | {cobrir:[w,h]} | {quadrado:n}, formato, q
  async function processar(src, op) {
    var img = await carregarImg(src), w = img.naturalWidth, h = img.naturalHeight;
    var W, H, dx = 0, dy = 0, dw, dh;
    if (op.cobrir) { W = op.cobrir[0]; H = op.cobrir[1]; var e1 = Math.max(W / w, H / h); dw = w * e1; dh = h * e1; dx = (W - dw) / 2; dy = (H - dh) / 2; }
    else if (op.quadrado) { W = H = op.quadrado; var e2 = Math.min(W / w, H / h); dw = w * e2; dh = h * e2; dx = (W - dw) / 2; dy = (H - dh) / 2; }
    else { var e3 = Math.min(1, op.max / Math.max(w, h)); W = dw = Math.round(w * e3); H = dh = Math.round(h * e3); }
    var fonte = img, fw = w, fh = h;
    while (fw / 2 >= dw && fh / 2 >= dh) {   // reduz pela metade até chegar perto do tamanho final
      var t = document.createElement('canvas'); t.width = Math.round(fw / 2); t.height = Math.round(fh / 2);
      t.getContext('2d').drawImage(fonte, 0, 0, t.width, t.height); fonte = t; fw = t.width; fh = t.height;
    }
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    if (op.formato !== 'image/webp' && op.formato) { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); }
    g.drawImage(fonte, dx, dy, dw, dh);
    var tipo = op.formato || 'image/webp', out = c.toDataURL(tipo, op.q || 0.82);
    if (tipo === 'image/webp' && out.indexOf('data:image/webp') !== 0) out = c.toDataURL('image/jpeg', 0.86);
    return out;
  }
  function temImg(src) { return /^(data:|https?:)/.test(src || ''); }
  function extDe(dataUrl) {
    var m = /^data:image\/([a-z+]+)/.exec(dataUrl) || [];
    return { jpeg: 'jpg', 'svg+xml': 'svg' }[m[1]] || m[1] || 'bin';
  }

  // =============================================================== validação
  function validar(l) {
    var erros = [], avisos = [];
    var E = function (s, m) { erros.push({ secao: s, msg: m }); }, W = function (s, m) { avisos.push({ secao: s, msg: m }); };
    if (!l.nome.trim()) E('dados', 'A loja está sem nome.');
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(l.slug)) E('dados', 'Nome do link inválido: use só letras minúsculas, números e hífen.');
    else if (A.lojas.some(function (x) { return x.id !== l.id && x.slug === l.slug; })) W('dados', 'Outra loja cadastrada usa o mesmo nome de link (' + l.slug + ').');
    var ew = erroWhats(l.whatsapp); if (ew) E('dados', 'WhatsApp: ' + ew);
    if (!temImg(l.logo)) W('dados', 'Loja sem logo (o app mostra as iniciais).');
    if (!l.endereco.trim()) W('dados', 'Loja sem endereço.');
    if (l.urlSite && !urlValida(l.urlSite)) E('link', 'O endereço do site não é um link válido (comece com https://).');
    if (l.mostrarBanner && l.banner.titulo && !temImg(l.banner.imagem)) W('aparencia', 'Banner sem imagem.');
    var algumDia = false;
    DIAS.forEach(function (d) {
      var h = l.horarios[d[0]];
      if (!h.aberto) return;
      algumDia = true;
      if (!h.turnos.length || h.turnos.some(function (t) { return !t.ini || !t.fim; })) E('funcionamento', d[1] + ': preencha o horário de abertura e fechamento.');
      else if (h.turnos.some(function (t) { return t.ini === t.fim; })) W('funcionamento', d[1] + ': abertura igual ao fechamento conta como aberto 24 horas.');
    });
    if (!algumDia) W('funcionamento', 'A loja está fechada todos os dias: todo pedido vira agendado.');
    if (l.fechadoManual) W('funcionamento', '"Fechado agora" está ligado: o site vai receber só pedidos agendados.');
    if (!l.aceitaEntrega && !l.aceitaRetirada) E('entrega', 'Ligue pelo menos entrega ou retirada.');
    if (!PAGAMENTOS.some(function (p) { return l.pagamentos[p]; })) E('pagamentos', 'Ligue pelo menos uma forma de pagamento.');
    var visiveis = l.categorias.filter(function (c) { return !c.oculta; });
    l.categorias.forEach(function (c) {
      if (!c.nome.trim()) E('categorias', 'Há uma categoria sem nome.');
      else if (!c.oculta && !l.produtos.some(function (p) { return p.categoriaId === c.id; })) W('categorias', 'Categoria "' + c.nome + '" está vazia (não aparece no site).');
    });
    var noSite = l.produtos.filter(function (p) { return visiveis.some(function (c) { return c.id === p.categoriaId; }); });
    if (!noSite.length && !l.combos.length) E('produtos', 'Nenhum produto no cardápio.');
    var semFoto = [];
    l.produtos.forEach(function (p) {
      var n = p.nome.trim() || '(sem nome)';
      if (!p.nome.trim()) E('produtos', 'Há um produto sem nome.');
      if (!(+p.preco > 0)) E('produtos', '"' + n + '" está sem preço.');
      if (!l.categorias.some(function (c) { return c.id === p.categoriaId; })) E('produtos', '"' + n + '" está sem categoria.');
      if (!temImg(p.imagem)) semFoto.push(n);
    });
    if (semFoto.length) W('produtos', semFoto.length === 1 ? '"' + semFoto[0] + '" está sem foto.' : semFoto.length + ' produtos sem foto: ' + semFoto.slice(0, 4).join(', ') + (semFoto.length > 4 ? '…' : '') + '.');
    l.grupos.forEach(function (g) {
      var n = g.titulo.trim() || '(sem nome)', ops = g.opcoes.filter(function (o) { return String(o.nome).trim(); }).length;
      var min = g.tipo === 'unico' ? (g.obrigatorio ? 1 : 0) : +g.min || 0;
      if (!g.titulo.trim()) E('grupos', 'Há um grupo de opções sem nome.');
      if (!ops) (min > 0 ? E : W)('grupos', 'Grupo "' + n + '" não tem opções' + (min > 0 ? ' e é obrigatório.' : '.'));
      else if (min > ops) E('grupos', 'Grupo "' + n + '" pede no mínimo ' + min + ' escolhas, mas só tem ' + ops + ' opções.');
      if (g.tipo === 'multiplo' && +g.max && +g.max < min) E('grupos', 'Grupo "' + n + '": o máximo é menor que o mínimo.');
      if (g.opcoes.some(function (o) { return !String(o.nome).trim(); })) W('grupos', 'Grupo "' + n + '" tem opção sem nome (será ignorada).');
    });
    l.combos.forEach(function (c) {
      var n = c.nome.trim() || '(sem nome)';
      if (!c.nome.trim()) E('combos', 'Há um combo sem nome.');
      if (!(+c.preco > 0)) E('combos', 'Combo "' + n + '" está sem preço.');
      if (!c.itens.length) E('combos', 'Combo "' + n + '" não tem produtos.');
      c.itens.forEach(function (i) {
        var p = l.produtos.find(function (x) { return x.id === i.id; });
        if (!p) E('combos', 'Combo "' + n + '" inclui um produto que foi excluído.');
        else if (!visiveis.some(function (k) { return k.id === p.categoriaId; })) W('combos', 'Combo "' + n + '" inclui "' + p.nome + '", que está numa categoria oculta (o combo aparece esgotado).');
      });
      if (!temImg(c.imagem)) W('combos', 'Combo "' + n + '" está sem foto.');
    });
    var hoje = hojeISO(), codigos = {};
    l.cupons.forEach(function (c) {
      if (!c.codigo) return E('cupons', 'Há um cupom sem código.');
      if (codigos[c.codigo]) E('cupons', 'Cupom ' + c.codigo + ' está repetido.');
      codigos[c.codigo] = 1;
      if (!(+c.valor > 0)) E('cupons', 'Cupom ' + c.codigo + ' está sem valor.');
      if (c.tipo === 'percentual' && +c.valor > 100) E('cupons', 'Cupom ' + c.codigo + ': desconto acima de 100%.');
      if (c.ativo && c.validade && c.validade < hoje) W('cupons', 'Cupom ' + c.codigo + ' venceu em ' + c.validade.split('-').reverse().join('/') + '.');
    });
    A.lojas.forEach(function (x) {
      if (x.id === l.id || !x.nome || x.nome.length < 3 || l.nome.indexOf(x.nome) >= 0) return;
      if ((l.seo.titulo + ' ' + l.seo.descricao).indexOf(x.nome) >= 0) W('compartilhamento', 'O texto de compartilhamento cita "' + x.nome + '", que é outra loja.');
    });
    if (!temImg(l.seo.imagem)) W('compartilhamento', 'Sem imagem de compartilhamento: a prévia do link no WhatsApp fica sem foto.');
    if (!l.seo.descricao.trim()) W('compartilhamento', 'Sem descrição para a prévia do link.');
    return { erros: erros, avisos: avisos };
  }

  // =============================================================== persistência
  var salvarT;
  function agendarSalvar() {
    var el = document.getElementById('status-salvo');
    if (el) el.textContent = 'Salvando…';
    clearTimeout(salvarT);
    salvarT = setTimeout(salvarAgora, 350);
  }
  function salvarAgora() {
    clearTimeout(salvarT);
    if (!A.loja) return Promise.resolve();
    return BD.salvar(A.loja).then(function () {
      var el = document.getElementById('status-salvo');
      if (el) el.textContent = 'Salvo automaticamente às ' + dataHora(A.loja.editadoEm).split(' às ')[1];
    }).catch(function (e) { toast('Erro ao salvar: ' + e.message); });
  }

  // =============================================================== LISTA DE LOJAS
  async function abrirLista() {
    await salvarAgora();
    A.loja = null;
    A.lojas = (await BD.listar()).map(normalizar).sort(function (a, b) { return b.editadoEm - a.editadoEm; });
    A.ultimoBackup = (await BD.meta('ultimoBackup')) || 0;
    renderLista();
  }
  function logoBox(l) {
    return '<div class="logo-box" style="color:' + esc(l.cores.principal) + '">' + (l.logo ? '<img src="' + esc(l.logo) + '" alt="">' : esc(iniciais(l.nome))) + '</div>';
  }
  function avisoBackup() {
    if (!A.lojas.length) return '';
    var ref = A.ultimoBackup || Math.min.apply(null, A.lojas.map(function (l) { return l.criadoEm; }));
    var dias = Math.floor((Date.now() - ref) / 864e5);
    if (dias <= 7) return '';
    return '<div class="faixa aviso"><span class="flex1">' + (A.ultimoBackup ? 'Seu último backup foi há ' + dias + ' dias.' : 'Você ainda não fez nenhum backup das lojas.') +
      ' Guarde uma cópia para não perder nada se o navegador for limpo.</span><button class="btn pequeno" data-act="exportarBackup">Exportar backup</button></div>';
  }
  function renderLista() {
    document.title = 'Admin gerador de cardápios';
    var semApp = !window.APP_FILES;
    raiz.innerHTML =
      '<div class="topo-lista"><div class="titulo"><small>Admin gerador</small><h1>Lojas</h1></div>' +
      '<div class="acoes-lista">' +
      '<button class="btn fantasma" data-act="importarLojaJs">' + IC.importar + 'Importar loja.js</button>' +
      '<button class="btn fantasma" data-act="importarBackup">' + IC.importar + 'Importar backup</button>' +
      '<button class="btn fantasma" data-act="exportarBackup">' + IC.baixar + 'Exportar backup</button>' +
      '<button class="btn primario" data-act="novaLoja">' + IC.mais + 'Nova loja</button></div></div>' +
      '<div class="corpo-lista">' +
      (semApp ? '<div class="faixa erro">Não encontrei o arquivo admin/app-files.js. Rode <code>node scripts/admin-bundle.js</code> na pasta do projeto.</div>' : '') +
      avisoBackup() +
      (A.lojas.length ? '<div class="grade-lojas">' + A.lojas.map(function (l) {
        return '<div class="loja-card" data-loja="' + esc(l.id) + '"><div class="cab">' + logoBox(l) +
          '<div class="flex1"><div class="nome">' + esc(l.nome) + '</div><div class="meta">' + esc(urlLoja(l).replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</div>' +
          '<div class="meta">Editada em ' + dataHora(l.editadoEm) + '</div></div></div>' +
          '<div class="acoes"><button class="btn escuro flex1" data-act="editar" data-id="' + esc(l.id) + '">Editar</button>' +
          '<button class="btn" data-act="duplicar" data-id="' + esc(l.id) + '">' + IC.copiar + 'Duplicar</button>' +
          '<button class="btn fantasma perigo" data-act="excluirLoja" data-id="' + esc(l.id) + '" aria-label="Excluir ' + esc(l.nome) + '">' + IC.lixo + '</button></div></div>';
      }).join('') + '</div>'
        : '<div class="vazio"><b style="font-size:17px">Nenhuma loja cadastrada</b><span class="dica">Comece importando uma loja existente (botão "Importar loja.js") ou crie uma nova.</span>' +
          '<div class="linha" style="margin-top:6px"><button class="btn" data-act="importarLojaJs">Importar loja.js</button><button class="btn primario" data-act="novaLoja">Nova loja</button></div></div>') +
      '<div class="dica" style="text-align:center;margin-top:12px">Tudo fica salvo neste navegador. ' +
      (window.APP_FILES_DATA ? 'App embutido de ' + dataHora(Date.parse(window.APP_FILES_DATA)) + '.' : '') + '</div></div>';
  }

  // =============================================================== EDITOR
  function abrirEditor(id, secao) {
    A.loja = A.lojas.find(function (l) { return l.id === id; });
    if (!A.loja) return abrirLista();
    A.secao = secao || 'dados'; A.busca = ''; A.filtroCat = ''; A.aberto = {}; A.exportado = null;
    raiz.innerHTML = '<div class="editor"><aside class="lateral" id="lateral"></aside>' +
      '<main class="principal" id="principal"><div class="miolo" id="miolo"></div></main>' +
      '<section class="previa"><div class="ctrl"><div class="seg" id="seg-previa">' +
      [['real', 'Horário real'], ['aberto', 'Aberta'], ['fechado', 'Fechada']].map(function (o) {
        return '<button data-act="previa" data-v="' + o[0] + '" class="' + (A.previa === o[0] ? 'on' : '') + '">' + o[1] + '</button>';
      }).join('') + '</div><small>Pré-visualização: atualiza enquanto você edita</small></div>' +
      '<div class="moldura-wrap" id="moldura-wrap"><div class="moldura" id="moldura"><iframe id="previa-frame" title="Pré-visualização do app"></iframe></div></div></section></div>';
    A.lateralHtml = ''; renderLateral(); renderSecao(); atualizarPrevia(); ajustarMoldura();
  }
  function renderLateral() {
    var l = A.loja, v = validar(l), porSecao = {};
    v.erros.forEach(function (e) { porSecao[e.secao] = 'erro'; });
    v.avisos.forEach(function (e) { if (!porSecao[e.secao]) porSecao[e.secao] = 'aviso'; });
    document.title = l.nome + ' · Admin';
    var el = document.getElementById('lateral'), salvo = document.getElementById('status-salvo');
    var html =
      '<div class="topo"><button class="btn fantasma pequeno" style="align-self:flex-start;margin-left:-8px" data-act="voltar">' + IC.voltar + 'Todas as lojas</button>' +
      '<div class="loja">' + logoBox(l) + '<div style="min-width:0"><b>' + esc(l.nome) + '</b><span class="salvo" id="status-salvo">Salvo automaticamente</span></div></div></div>' +
      '<nav class="menu">' + SECOES.map(function (s, i) {
        return '<button data-act="secao" data-v="' + s[0] + '" class="' + (A.secao === s[0] ? 'on' : '') + '"><span class="n">' + (i + 1) + '</span><span class="t">' + s[1] + '</span>' +
          (porSecao[s[0]] ? '<span class="ponto ' + porSecao[s[0]] + '" title="' + (porSecao[s[0]] === 'erro' ? 'Tem erro' : 'Tem aviso') + '"></span>' : '') + '</button>';
      }).join('') +
      '<button data-act="secao" data-v="exportar" class="exportar ' + (A.secao === 'exportar' ? 'on' : '') + '"><span class="n">' + IC.foguete + '</span><span class="t">Revisar e exportar</span>' +
      (v.erros.length ? '<span class="selo erro">' + v.erros.length + '</span>' : v.avisos.length ? '<span class="selo aviso">' + v.avisos.length + '</span>' : '<span class="selo ok">OK</span>') + '</button></nav>';
    if (html === A.lateralHtml) return;
    var txt = salvo && salvo.textContent;
    el.innerHTML = A.lateralHtml = html;
    if (txt) document.getElementById('status-salvo').textContent = txt;
  }
  function renderSecao() {
    var fn = SEC[A.secao] || SEC.dados, nome = (SECOES.find(function (s) { return s[0] === A.secao; }) || ['', 'Revisar e exportar'])[1];
    var r = fn(A.loja);
    document.getElementById('miolo').innerHTML =
      '<div class="cab-secao"><div class="flex1"><h2>' + esc(nome) + '</h2>' + (r.sub ? '<p>' + r.sub + '</p>' : '') + '</div>' + (r.acao || '') + '</div>' + r.html;
    if (r.depois) r.depois();
    atualizarDerivados();
  }
  function irPara(secao) { A.secao = secao; renderLateral(); renderSecao(); document.getElementById('principal').scrollTop = 0; }

  // Chamado a cada alteração
  function mudou(estrutural) {
    A.loja.editadoEm = Date.now();
    renderLateral(); agendarSalvar(); agendarPrevia();
    if (estrutural) renderSecao(); else atualizarDerivados();
  }

  // ---------- pré-visualização
  var previaT;
  function agendarPrevia() { clearTimeout(previaT); previaT = setTimeout(atualizarPrevia, 400); }
  function htmlPrevia() {
    var f = window.APP_FILES;
    if (!f) return '<p style="font-family:sans-serif;padding:24px">Rode node scripts/admin-bundle.js</p>';
    var cfg = paraConfig(A.loja, function (src) { return /^(data:|https?:)/.test(src || '') ? src : ''; });
    var inl = function (s) { return s.replace(/<\/script/gi, '<\\/script'); };
    return MetaTags.aplicar(f['index.html'], cfg)
      .replace('<link rel="stylesheet" href="css/app.css">', function () { return '<style>' + f['css/app.css'] + '</style>'; })
      .replace('<script src="config/loja.js"></script>', function () {
        return '<script>window.LOJA = ' + inl(JSON.stringify(cfg)) + ';window.LOJA_PREVIEW_STATUS = ' + JSON.stringify(A.previa === 'real' ? '' : A.previa) + ';</' + 'script>';
      })
      .replace('<script src="js/app.js"></script>', function () { return '<script>' + inl(f['js/app.js']) + '</' + 'script>'; });
  }
  function atualizarPrevia() {
    var fr = document.getElementById('previa-frame');
    if (!fr || !A.loja) return;
    var y = 0;
    try { y = fr.contentWindow.scrollY; } catch (e) {}
    fr.onload = function () { try { fr.contentWindow.scrollTo(0, y); } catch (e) {} };
    fr.srcdoc = htmlPrevia();
  }
  function ajustarMoldura() {
    var w = document.getElementById('moldura-wrap'), m = document.getElementById('moldura');
    if (!w || !m) return;
    var s = Math.min(1, (w.clientHeight - 16) / 844, (w.clientWidth - 20) / 390);
    m.style.transform = 'scale(' + s + ')';
  }
  window.addEventListener('resize', ajustarMoldura);

  // ---------- valores calculados na tela (sem redesenhar a seção)
  function comboCalc(c) {
    var cheio = c.itens.reduce(function (a, i) { var p = A.loja.produtos.find(function (x) { return x.id === i.id; }); return a + (p ? p.preco * (i.qtd || 1) : 0); }, 0);
    return { cheio: cheio, eco: cheio - (+c.preco || 0) };
  }
  function atualizarDerivados() {
    var l = A.loja; if (!l) return;
    var q = function (s) { return document.querySelectorAll(s); };
    q('[data-espelho]').forEach(function (el) {
      var v = getPath(l, el.dataset.espelho);
      if ((v === '' || v == null) && el.dataset.alt) v = getPath(l, el.dataset.alt);
      el.textContent = el.dataset.fmt === 'money' ? M(v) : (v || el.dataset.vazio || '');
    });
    var url = urlLoja(l), nn = nomeNetlify(url);
    q('[data-link]').forEach(function (el) { el.textContent = url; });
    q('[data-dominio]').forEach(function (el) { try { el.textContent = new URL(url).hostname; } catch (e) { el.textContent = ''; } });
    q('[data-netlify]').forEach(function (el) { el.textContent = nn || '(domínio próprio)'; });
    q('[data-wa]').forEach(function (el) {
      var e = erroWhats(l.whatsapp);
      el.className = 'dica ' + (e ? 'erro' : 'ok');
      el.textContent = e || 'Número válido: o pedido chega em wa.me/' + l.whatsapp;
    });
    q('[data-madrugada]').forEach(function (el) {
      var t = getPath(l, el.dataset.madrugada);
      el.textContent = t && t.ini && t.fim && t.fim <= t.ini && t.fim !== t.ini ? 'termina no dia seguinte' : '';
    });
    q('[data-combo]').forEach(function (el) {
      var c = l.combos.find(function (x) { return x.id === el.dataset.combo; }); if (!c) return;
      var r = comboCalc(c);
      el.innerHTML = 'Preço cheio <b>' + M(r.cheio) + '</b> · Combo <b>' + M(c.preco) + '</b> · ' +
        (r.eco > 0 ? '<span style="color:var(--ok)">Economia <b>' + M(r.eco) + '</b> (' + Math.round(r.eco / r.cheio * 100) + '%)</span>'
          : '<span style="color:var(--erro)">O combo não está mais barato que os itens separados</span>');
    });
    q('[data-contar]').forEach(function (el) {
      var v = String(getPath(l, el.dataset.contar) || ''), lim = +el.dataset.lim;
      el.textContent = v.length + '/' + lim; el.style.color = v.length > lim ? 'var(--aviso)' : '';
    });
    var slugErr = document.getElementById('d-slug');
    if (slugErr) {
      var ok = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(l.slug);
      slugErr.className = 'dica' + (ok ? '' : ' erro');
      slugErr.innerHTML = ok ? 'Endereço: <b>' + esc(url) + '</b>' : 'Use só letras minúsculas, números e hífen.';
    }
  }

  // =============================================================== componentes de formulário
  var IC = {
    mais: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>',
    lixo: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    copiar: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    baixar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    importar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V4M7 9l5-5 5 5M5 20h14"/></svg>',
    voltar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 18l-6-6 6-6"/></svg>',
    alca: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
    seta: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg>',
    foto: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/></svg>',
    foguete: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V4M7 9l5-5 5 5M5 20h14"/></svg>'
  };
  function campo(rotulo, dentro, dica, extra) {
    return '<div class="campo"' + (extra || '') + '>' + (rotulo ? '<label>' + rotulo + '</label>' : '') + dentro + (dica ? '<div class="dica">' + dica + '</div>' : '') + '</div>';
  }
  function inp(path, o) {
    o = o || {};
    var v = getPath(A.loja, path);
    if (o.t === 'money') v = v ? M(v) : '';
    return '<input class="inp" data-bind="' + esc(path) + '"' + (o.t ? ' data-t="' + o.t + '"' : '') + ' type="' + (o.type || 'text') + '"' +
      (o.im ? ' inputmode="' + o.im + '"' : o.t === 'money' || o.t === 'int' ? ' inputmode="numeric"' : '') +
      ' value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(o.ph || '') + '"' + (o.attrs || '') + '>';
  }
  function area(path, o) {
    o = o || {};
    return '<textarea class="inp" data-bind="' + esc(path) + '" rows="' + (o.rows || 2) + '" placeholder="' + esc(o.ph || '') + '">' + esc(getPath(A.loja, path) || '') + '</textarea>';
  }
  function chave(path, rotulo, inverso) {
    var v = !!getPath(A.loja, path);
    return '<label class="chave"><input type="checkbox" data-bind="' + esc(path) + '"' + (inverso ? ' data-t="inv"' : '') + ((inverso ? !v : v) ? ' checked' : '') + '><i></i>' + rotulo + '</label>';
  }
  function seg(path, opcoes) {
    var v = getPath(A.loja, path);
    return '<div class="seg">' + opcoes.map(function (o) {
      return '<button type="button" data-act="set" data-path="' + esc(path) + '" data-v=\'' + esc(JSON.stringify(o[0])) + '\' class="' + (v === o[0] ? 'on' : '') + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function sel(path, opcoes, o) {
    var v = getPath(A.loja, path);
    return '<select class="inp" data-bind="' + esc(path) + '"' + ((o || {}).attrs || '') + '>' + opcoes.map(function (x) {
      return '<option value="' + esc(x[0]) + '"' + (x[0] === v ? ' selected' : '') + '>' + esc(x[1]) + '</option>';
    }).join('') + '</select>';
  }
  function fotoSlot(path, tipo, dica, classe) {
    var src = getPath(A.loja, path) || '';
    var ok = /^(data:|https?:)/.test(src);
    return '<div class="foto"><div class="caixa ' + (classe || '') + (ok ? ' cheia' : '') + '">' + (ok ? '<img src="' + esc(src) + '" alt="">' : IC.foto) + '</div>' +
      '<div class="campo"><div class="linha"><button type="button" class="btn pequeno" data-act="foto" data-path="' + esc(path) + '" data-tipo="' + tipo + '">' + (ok ? 'Trocar' : 'Enviar imagem') + '</button>' +
      (ok ? '<button type="button" class="btn pequeno fantasma perigo" data-act="semFoto" data-path="' + esc(path) + '">Remover</button>' : '') + '</div>' +
      (dica ? '<div class="dica">' + dica + '</div>' : '') + (src && !ok ? '<div class="dica erro">Imagem não encontrada (' + esc(src) + '). Envie de novo.</div>' : '') + '</div></div>';
  }
  function alca() { return '<span class="alca" title="Arraste para reordenar" data-alca>' + IC.alca + '</span>'; }
  function arrastavel(lista, id) { return ' data-lista="' + esc(lista) + '" data-id="' + esc(id) + '"'; }
  function grupoChips(path) {
    var usados = getPath(A.loja, path) || [];
    if (!A.loja.grupos.length) return '<div class="dica">Nenhum grupo criado ainda. Crie em "Grupos de opções".</div>';
    return '<div class="chips">' + A.loja.grupos.map(function (g) {
      var on = usados.indexOf(g.id) >= 0;
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-act="toggleGrupo" data-path="' + esc(path) + '" data-v="' + esc(g.id) + '">' + (on ? '✓ ' : '') + esc(g.titulo || '(sem nome)') + '</button>';
    }).join('') + '</div>';
  }

  // =============================================================== SEÇÕES
  var SEC = {};
  SEC.dados = function (l) {
    return { sub: 'Informações que aparecem no topo do cardápio.', html:
      '<div class="cartao"><div class="grade2">' +
      campo('Nome da loja', inp('nome', { ph: 'Ex.: Brasa Burger' })) +
      campo('Nome do link (slug)', inp('slug', { t: 'slug', ph: 'brasa-burger' }), '<span id="d-slug"></span>') +
      '</div>' + campo('Logo', fotoSlot('logo', 'logo', 'Quadrada, de preferência. Vira WebP até 512px. Também vira o ícone da aba.', 'logo')) +
      campo('Endereço', inp('endereco', { ph: 'Rua, número - bairro' }), 'Aparece no topo e na opção de retirada.') +
      '<div class="grade2">' +
      campo('WhatsApp que recebe os pedidos', '<div class="prefixado"><span>+55</span><input class="inp" data-bind="whatsapp" data-t="phone" inputmode="tel" value="' +
        esc(fmtFone(localWhats(l.whatsapp))) + '" placeholder="(11) 99999-9999"></div>', '<span data-wa></span>') +
      campo('Instagram (opcional)', '<div class="prefixado"><span>@</span>' + inp('instagram', { t: 'insta', ph: 'brasaburger' }) + '</div>', 'Aparece no rodapé do cardápio.') +
      '</div></div>' };
  };
  SEC.link = function (l) {
    return { sub: 'Endereço onde o cardápio vai ficar no ar.', html:
      '<div class="cartao"><div class="campo"><span class="rotulo">Endereço do site</span><div style="font-size:20px;font-weight:700;word-break:break-all" data-link></div>' +
      '<div class="dica">Gerado a partir do nome do link (<b data-espelho="slug"></b>) e do modelo <code>' + esc(l.urlPadrao || URL_PADRAO) + '</code>.</div></div>' +
      '<div class="linha"><span class="rotulo">Nome do site no Netlify:</span><code data-netlify></code><button class="btn pequeno" data-act="copiarNetlify">' + IC.copiar + 'Copiar</button></div></div>' +
      '<div class="cartao"><h3>Usar outro endereço</h3>' +
      campo('', inp('urlSite', { ph: MetaTags.urlDoSite({ slug: l.slug, urlPadrao: l.urlPadrao || URL_PADRAO }).replace(/\/$/, ''), type: 'url' }),
        'Deixe vazio para usar o endereço acima. Preencha se o nome estiver ocupado no Netlify (ex.: <code>https://' + esc(l.slug) + '-sp.netlify.app</code>) ou se a loja tiver domínio próprio.') +
      '</div>' };
  };
  SEC.aparencia = function (l) {
    var cor = function (k, rot, dica) {
      return campo(rot, '<div class="linha"><input type="color" data-bind="cores.' + k + '" data-t="color" value="' + esc(l.cores[k]) + '" style="width:48px;height:44px;border:0;background:none;padding:0;cursor:pointer">' +
        inp('cores.' + k, { t: 'color', attrs: ' maxlength="7" style="font-family:ui-monospace,monospace"' }) + '</div>', dica);
    };
    return { sub: 'Cores, layout e banner do cardápio.', html:
      '<div class="cartao"><h3>Cores</h3><div class="grade3">' +
      cor('principal', 'Cor principal', 'Botões de ação, preços e selos.') +
      cor('secundaria', 'Cor secundária', 'Seleção e barra da sacola. Use um tom escuro.') +
      cor('escuro', 'Tom escuro', 'Categoria do produto e avisos.') + '</div></div>' +
      '<div class="cartao"><h3>Layout do cardápio</h3>' + seg('layout', [['lista', 'Lista'], ['grade', 'Grade (2 colunas)']]) + '</div>' +
      '<div class="cartao"><div class="cab"><h3 class="flex1">Banner</h3>' + chave('mostrarBanner', 'Mostrar banner') + '</div>' +
      (l.mostrarBanner ? campo('Imagem', fotoSlot('banner.imagem', 'banner', 'Horizontal, cerca de 3:1. Vira WebP até 1600px.', 'larga')) +
        '<div class="grade2">' + campo('Título', inp('banner.titulo', { ph: 'Combo da casa com 15% off' })) + campo('Subtítulo', inp('banner.subtitulo', { ph: 'Toda terça e quarta' })) + '</div>'
        : '<div class="dica">O banner está escondido.</div>') + '</div>' };
  };
  SEC.funcionamento = function (l) {
    return { sub: 'O site calcula sozinho se está aberto, pelo horário de Brasília.', html:
      (l.fechadoManual ? '<div class="faixa aviso">"Fechado agora" está ligado: o site mostra a loja fechada e os pedidos chegam como agendados.</div>' : '') +
      '<div class="cartao"><div class="cab"><div class="flex1"><h3>Fechado agora</h3><div class="dica">Para feriado ou imprevisto. Volta ao normal quando desligar.</div></div>' + chave('fechadoManual', '') + '</div></div>' +
      '<div class="cartao"><div class="cab"><h3 class="flex1">Horários</h3><button class="btn pequeno fantasma" data-act="copiarHorario">Copiar o primeiro dia aberto para todos</button></div><div class="dias">' +
      DIAS.map(function (d) {
        var h = l.horarios[d[0]], base = 'horarios.' + d[0];
        return '<div class="dia"><b>' + d[1] + '</b>' + seg(base + '.aberto', [[true, 'Aberto'], [false, 'Fechado']]) +
          (h.aberto ? '<div class="turnos">' + h.turnos.map(function (t, i) {
            return '<div class="turno">' + inp(base + '.turnos.' + i + '.ini', { type: 'time' }) + '<span>às</span>' + inp(base + '.turnos.' + i + '.fim', { type: 'time' }) +
              (h.turnos.length > 1 ? '<button class="icone-btn" data-act="removerIdx" data-arr="' + base + '.turnos" data-i="' + i + '" aria-label="Remover turno">' + IC.lixo + '</button>' : '') +
              '<span class="madrugada" data-madrugada="' + base + '.turnos.' + i + '"></span></div>';
          }).join('') + '<div><button class="btn pequeno fantasma" data-act="novoTurno" data-v="' + d[0] + '">' + IC.mais + 'Outro turno</button></div></div>'
            : '<span class="dica">Não abre</span>') + '</div>';
      }).join('') + '</div><div class="dica">Passa da meia-noite? Coloque o fechamento menor que a abertura, ex.: 18:00 às 01:00.</div></div>' +
      '<div class="cartao"><h3>Tempos</h3><div class="grade2">' +
      campo('Tempo de entrega', inp('tempoEntrega', { ph: '30 a 45 min' })) + campo('Tempo de retirada', inp('tempoRetirada', { ph: '20 a 30 min' })) + '</div></div>' };
  };
  SEC.entrega = function (l) {
    return { sub: 'Como o cliente pode receber o pedido.', html:
      (!l.aceitaEntrega && !l.aceitaRetirada ? '<div class="faixa erro">Ligue pelo menos uma opção.</div>' : '') +
      '<div class="cartao"><div class="cab"><h3 class="flex1">Entrega</h3>' + chave('aceitaEntrega', 'Aceita entrega') + '</div>' +
      (l.aceitaEntrega ? '<div class="grade2">' + campo('Taxa de entrega', inp('taxaEntrega', { t: 'money', ph: 'Grátis' }), 'Vazio = entrega grátis.') +
        campo('Pedido mínimo para entrega', inp('pedidoMinimo', { t: 'money', ph: 'Sem mínimo' }), 'Vazio = sem pedido mínimo.') + '</div>' : '') + '</div>' +
      '<div class="cartao"><div class="cab"><h3 class="flex1">Retirada no local</h3>' + chave('aceitaRetirada', 'Aceita retirada') + '</div>' +
      (l.aceitaRetirada ? '<div class="dica">O cliente vê o endereço da loja e o tempo de retirada.</div>' : '') + '</div>' };
  };
  SEC.pagamentos = function () {
    return { sub: 'Formas aceitas na entrega ou retirada.', html: '<div class="cartao">' +
      PAGAMENTOS.map(function (p) { return '<div class="cab"><span class="flex1" style="font-weight:600">' + p + (p === 'Dinheiro' ? ' <span class="dica">· mostra o campo de troco</span>' : '') + '</span>' + chave('pagamentos.' + p, '') + '</div>'; }).join('') + '</div>' };
  };
  SEC.categorias = function (l) {
    return { sub: 'Arraste pela alça para mudar a ordem no cardápio. Categorias ocultas não aparecem no site.', html:
      '<div class="cartao"><div class="linha"><input class="inp" id="nova-cat" placeholder="Nome da nova categoria"><button class="btn primario" data-act="novaCategoria">' + IC.mais + 'Adicionar</button></div></div>' +
      '<div class="lista-itens">' + l.categorias.map(function (c, i) {
        var n = l.produtos.filter(function (p) { return p.categoriaId === c.id; }).length;
        return '<div class="item"' + arrastavel('categorias', c.id) + '><div class="resumo">' + alca() +
          '<div class="flex1">' + inp('categorias.' + i + '.nome', { ph: 'Nome da categoria' }) + '</div>' +
          '<span class="selo" style="width:92px;justify-content:center">' + n + (n === 1 ? ' produto' : ' produtos') + '</span>' +
          chave('categorias.' + i + '.oculta', 'Visível', true) +
          '<button class="icone-btn" data-act="excluirCategoria" data-id="' + esc(c.id) + '" aria-label="Excluir categoria">' + IC.lixo + '</button></div></div>';
      }).join('') + '</div>' };
  };
  SEC.produtos = function (l) {
    var semFoto = l.produtos.filter(function (p) { return !/^(data:|https?:)/.test(p.imagem || ''); }).length;
    return { sub: 'Clique num produto para editar. Arraste pela alça para mudar a ordem.',
      acao: '<button class="btn primario" data-act="novoProduto">' + IC.mais + 'Novo produto</button>',
      html: (semFoto ? '<div class="faixa aviso"><span class="flex1">' + semFoto + (semFoto === 1 ? ' produto está' : ' produtos estão') + ' sem foto.</span><button class="btn pequeno" data-act="filtroSemFoto">Mostrar</button></div>' : '') +
        '<div class="linha"><input class="inp flex1" id="busca-prod" placeholder="Buscar produto" value="' + esc(A.busca) + '">' +
        '<select class="inp" id="filtro-cat" style="width:220px"><option value="">Todas as categorias</option>' +
        l.categorias.map(function (c) { return '<option value="' + esc(c.id) + '"' + (A.filtroCat === c.id ? ' selected' : '') + '>' + esc(c.nome) + (c.oculta ? ' (oculta)' : '') + '</option>'; }).join('') +
        '<option value="semfoto"' + (A.filtroCat === 'semfoto' ? ' selected' : '') + '>Sem foto</option></select></div>' +
        '<div class="lista-itens" id="lista-produtos">' + listaProdutos(l) + '</div>' };
  };
  function listaProdutos(l) {
    var q = A.busca.trim().toLowerCase(), catNome = {};
    l.categorias.forEach(function (c) { catNome[c.id] = c.nome; });
    var lista = l.produtos.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) {
      var p = x.p;
      if (A.filtroCat === 'semfoto' ? /^(data:|https?:)/.test(p.imagem || '') : A.filtroCat && p.categoriaId !== A.filtroCat) return false;
      return !q || (p.nome + ' ' + p.descricao).toLowerCase().indexOf(q) >= 0;
    });
    if (!lista.length) return '<div class="vazio"><b>Nenhum produto aqui</b><span class="dica">' + (l.produtos.length ? 'Mude a busca ou o filtro.' : 'Clique em "Novo produto" para começar.') + '</span></div>';
    return lista.map(function (x) {
      var p = x.p, b = 'produtos.' + x.i, aberto = A.aberto[p.id], temFoto = /^(data:|https?:)/.test(p.imagem || '');
      return '<div class="item' + (aberto ? ' aberto' : '') + '"' + arrastavel('produtos', p.id) + '>' +
        '<div class="resumo clicavel" data-act="abrir" data-id="' + esc(p.id) + '">' + alca() +
        '<div class="thumb">' + (temFoto ? '<img src="' + esc(p.imagem) + '" alt="">' : IC.foto) + '</div>' +
        '<div class="flex1"><div class="nome" data-espelho="' + b + '.nome" data-vazio="(sem nome)"></div>' +
        '<div class="sub">' + esc(catNome[p.categoriaId] || 'Sem categoria') + ' · <span data-espelho="' + b + '.preco" data-fmt="money"></span></div></div>' +
        (p.disponivel ? '' : '<span class="selo">Esgotado</span>') + (p.destaque ? '<span class="selo acao">Mais pedido</span>' : '') +
        (temFoto ? '' : '<span class="selo aviso">Sem foto</span>') + (+p.preco > 0 ? '' : '<span class="selo erro">Sem preço</span>') +
        '<span class="icone-btn">' + IC.seta + '</span></div>' +
        (aberto ? '<div class="detalhe"><div class="grade2">' + campo('Nome', inp(b + '.nome', { attrs: ' data-foco="' + esc(p.id) + '"' })) +
          campo('Preço', inp(b + '.preco', { t: 'money', ph: 'R$ 0,00' })) + '</div>' +
          campo('Descrição', area(b + '.descricao', { ph: 'Ingredientes, tamanho, quantas pessoas serve…' })) +
          '<div class="grade2">' + campo('Categoria', sel(b + '.categoriaId', l.categorias.map(function (c) { return [c.id, c.nome]; }), { attrs: ' data-estrutural' })) +
          '<div class="campo"><span class="rotulo">Situação</span><div class="linha" style="height:44px;gap:20px">' + chave(b + '.disponivel', 'Disponível') + chave(b + '.destaque', 'Mais pedido') + '</div></div></div>' +
          campo('Foto', fotoSlot(b + '.imagem', 'produto', 'Quadrada fica melhor. Vira WebP até 800px.')) +
          campo('Grupos de opções', grupoChips(b + '.grupos'), 'Ponto da carne, adicionais, remover… Crie e edite em "Grupos de opções".') +
          '<div class="linha"><button class="btn pequeno" data-act="duplicarProduto" data-id="' + esc(p.id) + '">' + IC.copiar + 'Duplicar</button><span class="flex1"></span>' +
          '<button class="btn pequeno fantasma perigo" data-act="excluirProduto" data-id="' + esc(p.id) + '">' + IC.lixo + 'Excluir produto</button></div></div>' : '') +
        '</div>';
    }).join('');
  }
  SEC.grupos = function (l) {
    var uso = function (id) {
      return l.produtos.filter(function (p) { return p.grupos.indexOf(id) >= 0; }).length + l.combos.filter(function (c) { return c.grupos.indexOf(id) >= 0; }).length;
    };
    return { sub: 'Opções que o cliente escolhe no produto. Um grupo pode ser usado em vários produtos.',
      acao: '<button class="btn primario" data-act="novoGrupo">' + IC.mais + 'Novo grupo</button>',
      html: (l.grupos.length ? '' : '<div class="vazio"><b>Nenhum grupo de opções</b></div>') + l.grupos.map(function (g, i) {
        var b = 'grupos.' + i, n = uso(g.id), unico = g.tipo === 'unico';
        var ops = g.opcoes.filter(function (o) { return String(o.nome).trim(); }).length;
        return '<div class="cartao"><div class="cab"><div class="flex1">' + inp(b + '.titulo', { ph: 'Nome do grupo, ex.: Adicionais' }) + '</div>' +
          '<span class="selo">Usado em ' + n + (n === 1 ? ' item' : ' itens') + '</span>' +
          '<button class="icone-btn" data-act="excluirGrupo" data-id="' + esc(g.id) + '" aria-label="Excluir grupo">' + IC.lixo + '</button></div>' +
          '<div class="grade2">' + campo('Seleção', seg(b + '.tipo', [['unico', 'Única (escolhe 1)'], ['multiplo', 'Múltipla']])) +
          (unico ? campo('Já vem marcado', sel(b + '.padrao', [['', 'Nenhuma']].concat(g.opcoes.filter(function (o) { return o.nome; }).map(function (o) { return [o.nome, o.nome]; })), { attrs: ' data-padrao="' + i + '"' }))
            : campo('Aparece na mensagem como', sel(b + '.estilo', [['adicional', '+ Adicional'], ['remocao', '- Remoção'], ['escolha', 'Título: opções']]))) + '</div>' +
          '<div class="grade3" style="align-items:end">' + '<div class="campo"><span class="rotulo">Obrigatório</span><div style="height:44px;display:flex;align-items:center">' + chave(b + '.obrigatorio', g.obrigatorio ? 'Sim' : 'Não') + '</div></div>' +
          (unico ? '' : campo('Mínimo de escolhas', inp(b + '.min', { t: 'int', ph: '0' })) + campo('Máximo de escolhas', inp(b + '.max', { t: 'int', ph: 'Sem limite' }), '0 = sem limite')) + '</div>' +
          (!ops && (g.obrigatorio || +g.min > 0) ? '<div class="faixa erro">Grupo obrigatório sem opções: o cliente não conseguiria adicionar o produto.</div>' : '') +
          '<div class="campo"><span class="rotulo">Opções</span><div class="lista-itens">' + g.opcoes.map(function (o, j) {
            return '<div class="linha"' + arrastavel(b + '.opcoes', o.id) + '>' + alca() + '<div class="flex1">' + inp(b + '.opcoes.' + j + '.nome', { ph: 'Nome da opção' }) + '</div>' +
              '<div style="width:150px">' + inp(b + '.opcoes.' + j + '.preco', { t: 'money', ph: 'Sem custo' }) + '</div>' +
              '<button class="icone-btn" data-act="removerId" data-arr="' + b + '.opcoes" data-id="' + esc(o.id) + '" aria-label="Remover opção">' + IC.lixo + '</button></div>';
          }).join('') + '</div><div><button class="btn pequeno" data-act="novaOpcao" data-v="' + i + '">' + IC.mais + 'Adicionar opção</button></div>' +
          '<div class="dica">Preço vazio = sem custo extra.</div></div></div>';
      }).join('') };
  };
  SEC.combos = function (l) {
    var nomeProd = {}; l.produtos.forEach(function (p) { nomeProd[p.id] = p; });
    return { sub: 'O preço cheio e a economia são calculados pela soma dos produtos incluídos.',
      acao: '<button class="btn primario" data-act="novoCombo">' + IC.mais + 'Novo combo</button>',
      html: (l.combos.length ? '' : '<div class="vazio"><b>Nenhum combo</b><span class="dica">Combos aparecem numa seção própria, no topo do cardápio.</span></div>') + l.combos.map(function (c, i) {
        var b = 'combos.' + i;
        return '<div class="cartao"><div class="cab"><div class="flex1">' + inp(b + '.nome', { ph: 'Nome do combo' }) + '</div>' + chave(b + '.disponivel', 'Disponível') +
          '<button class="icone-btn" data-act="excluirCombo" data-id="' + esc(c.id) + '" aria-label="Excluir combo">' + IC.lixo + '</button></div>' +
          '<div class="grade2">' + campo('Preço do combo', inp(b + '.preco', { t: 'money', ph: 'R$ 0,00' })) + campo('Descrição (opcional)', inp(b + '.descricao', { ph: 'Ex.: Para quem chega com fome.' })) + '</div>' +
          '<div class="faixa info" data-combo="' + esc(c.id) + '"></div>' +
          '<div class="campo"><span class="rotulo">Produtos incluídos</span><div class="lista-itens">' + c.itens.map(function (it, j) {
            var p = nomeProd[it.id];
            return '<div class="linha" style="background:var(--bg);border-radius:12px;padding:6px 6px 6px 14px">' +
              '<span class="flex1">' + (p ? '<b>' + esc(p.nome) + '</b> <span class="dica">' + M(p.preco) + '</span>' : '<span class="selo erro">Produto excluído</span>') + '</span>' +
              '<button class="icone-btn" data-act="qtdItem" data-path="' + b + '.itens.' + j + '" data-v="-1" aria-label="Menos">−</button><b style="min-width:18px;text-align:center">' + (it.qtd || 1) + '</b>' +
              '<button class="icone-btn" data-act="qtdItem" data-path="' + b + '.itens.' + j + '" data-v="1" aria-label="Mais">+</button>' +
              '<button class="icone-btn" data-act="removerIdx" data-arr="' + b + '.itens" data-i="' + j + '" aria-label="Tirar do combo">' + IC.lixo + '</button></div>';
          }).join('') + '</div><select class="inp" data-change="addItemCombo" data-v="' + i + '"><option value="">+ Adicionar produto ao combo…</option>' +
          l.produtos.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nome) + ' · ' + M(p.preco) + '</option>'; }).join('') + '</select></div>' +
          campo('Foto', fotoSlot(b + '.imagem', 'produto', 'Vira WebP até 800px.')) +
          campo('Grupos de opções', grupoChips(b + '.grupos'), 'Ex.: ponto da carne do burger e sabor da bebida.') + '</div>';
      }).join('') };
  };
  SEC.cupons = function (l) {
    var hoje = hojeISO();
    return { sub: 'O cliente digita o código na sacola.',
      acao: '<button class="btn primario" data-act="novoCupom">' + IC.mais + 'Novo cupom</button>',
      html: (l.cupons.length ? '' : '<div class="vazio"><b>Nenhum cupom</b></div>') + l.cupons.map(function (c, i) {
        var b = 'cupons.' + i, vencido = c.validade && c.validade < hoje;
        return '<div class="cartao"><div class="cab"><div style="width:220px">' + inp(b + '.codigo', { t: 'upper', ph: 'CODIGO10', attrs: ' style="font-weight:700;letter-spacing:.04em"' }) + '</div>' +
          (vencido ? '<span class="selo aviso">Vencido</span>' : '') + (c.ativo ? '' : '<span class="selo">Inativo</span>') + '<span class="flex1"></span>' + chave(b + '.ativo', 'Ativo') +
          '<button class="icone-btn" data-act="removerId" data-arr="cupons" data-id="' + esc(c.id) + '" aria-label="Excluir cupom">' + IC.lixo + '</button></div>' +
          '<div class="grade2">' + campo('Tipo', seg(b + '.tipo', [['percentual', 'Porcentagem'], ['fixo', 'Valor fixo']])) +
          campo(c.tipo === 'percentual' ? 'Desconto (%)' : 'Desconto (R$)', c.tipo === 'percentual' ? inp(b + '.valor', { t: 'int', ph: '10' }) : inp(b + '.valor', { t: 'money', ph: 'R$ 5,00' })) + '</div>' +
          '<div class="grade2">' + campo('Pedido mínimo', inp(b + '.minimo', { t: 'money', ph: 'Sem mínimo' })) +
          campo('Validade', inp(b + '.validade', { type: 'date' }), 'Vazio = não vence.') + '</div></div>';
      }).join('') };
  };
  SEC.compartilhamento = function (l) {
    return { sub: 'Como o link aparece quando é enviado no WhatsApp e no Instagram.', html:
      '<div class="cartao">' + campo('Título <span class="dica" data-contar="seo.titulo" data-lim="60"></span>', inp('seo.titulo', { ph: l.nome })) +
      campo('Descrição <span class="dica" data-contar="seo.descricao" data-lim="160"></span>', area('seo.descricao', { ph: 'Burgers artesanais, combos e porções. Peça pelo WhatsApp.' })) +
      campo('Imagem', fotoSlot('seo.imagem', 'compartilhar', 'Sai em JPG 1200x630 (recorta o centro), o formato mais aceito pelo WhatsApp.', 'compart') +
        (l.banner.imagem || l.logo ? '<div><button class="btn pequeno fantasma" data-act="compartDoBanner">Gerar a partir do ' + (l.banner.imagem ? 'banner' : 'logo') + '</button></div>' : '')) + '</div>' +
      '<div class="cartao"><h3>Prévia no WhatsApp</h3><div class="wa-previa"><div class="caixa">' +
      (l.seo.imagem ? '<img src="' + esc(l.seo.imagem) + '" alt="">' : '') +
      '<div class="txt"><b data-espelho="seo.titulo" data-alt="nome"></b><span data-espelho="seo.descricao"></span><small data-dominio></small></div></div>' +
      '<div class="link" data-link></div></div><div class="dica">Aproximação. Depois de publicar, confira em developers.facebook.com/tools/debug.</div></div>' };
  };
  SEC.exportar = function (l) {
    var v = validar(l), url = urlLoja(l), nn = nomeNetlify(url), exp = A.exportado && A.exportado.id === l.id;
    var item = function (e, tipo) {
      return '<div class="it"><span class="selo ' + tipo + '">' + (tipo === 'erro' ? 'Erro' : 'Aviso') + '</span><span class="t">' + esc(e.msg) + '</span>' +
        '<button class="btn pequeno fantasma" data-act="secao" data-v="' + e.secao + '">Corrigir</button></div>';
    };
    var semLibs = !window.JSZip || !window.QRious;
    return { sub: 'Confira o checklist, exporte o ZIP e publique no Netlify Drop.', html:
      '<div class="cartao"><h3>Checklist</h3>' +
      (!v.erros.length && !v.avisos.length ? '<div class="faixa ok">Tudo certo. Pode exportar.</div>'
        : '<div class="check">' + v.erros.map(function (e) { return item(e, 'erro'); }).join('') + v.avisos.map(function (e) { return item(e, 'aviso'); }).join('') + '</div>') +
      (v.erros.length ? '<div class="dica erro">Erros bloqueiam a exportação. Avisos só alertam.</div>' : '') + '</div>' +
      '<div class="cartao"><h3>Exportar site</h3>' +
      (semLibs ? '<div class="faixa erro">Sem internet: não consegui carregar as bibliotecas de ZIP e QR Code (cdnjs). Conecte e recarregue a página.</div>' : '') +
      '<div class="dica">Gera <b>' + esc(l.slug) + '.zip</b> com index.html, css, js, config/loja.js e as imagens usadas. As meta tags saem gravadas com o endereço <b>' + esc(url) + '</b>.</div>' +
      '<div><button class="btn primario grande" data-act="exportarSite"' + (v.erros.length || semLibs ? ' disabled' : '') + '>' + IC.baixar + 'Exportar site</button></div>' +
      (exp ? '<div class="faixa ok">Exportado: ' + esc(l.slug) + '.zip (' + A.exportado.arquivos + ' arquivos, ' + A.exportado.kb + ' KB).</div>' +
        '<h3 style="margin-top:4px">Como publicar</h3><ol class="passos">' +
        '<li><span>Descompacte <b>' + esc(l.slug) + '.zip</b>. Vai aparecer a pasta <b>' + esc(l.slug) + '</b>.</span></li>' +
        '<li><span>Abra <b>app.netlify.com/drop</b> (com login) e arraste a pasta <b>' + esc(l.slug) + '</b>.</span></li>' +
        (nn ? '<li><span>Em <b>Site configuration → Change site name</b>, use exatamente: <code>' + esc(nn) + '</code> <button class="btn pequeno" data-act="copiarNetlify">' + IC.copiar + 'Copiar</button><br>O site fica em <b>' + esc(url) + '</b>. Se o nome estiver ocupado, escolha outro na seção <a href="#" data-act="secao" data-v="link">Link</a> e exporte de novo.</span></li>'
          : '<li><span>Em <b>Domain management</b>, conecte o domínio <b>' + esc(url) + '</b>.</span></li>') +
        '<li><span>Teste a prévia: cole o link em <b>developers.facebook.com/tools/debug</b> e clique em <b>Scrape Again</b>. Depois mande o link numa conversa do WhatsApp.</span></li>' +
        '<li><span>Para atualizar depois: exporte de novo e, no Netlify, aba <b>Deploys</b>, arraste a pasta nova.</span></li></ol>' : '') + '</div>' +
      '<div class="cartao"><h3>QR Code</h3><div class="qr-box"><canvas id="qr" width="320" height="320"></canvas><div class="campo">' +
      '<div class="dica">Aponta para <b data-link></b><br>Para balcão, embalagem e Instagram. Confira se é o endereço final antes de imprimir.</div>' +
      '<div><button class="btn" data-act="baixarQR"' + (semLibs ? ' disabled' : '') + '>' + IC.baixar + 'Baixar QR Code (PNG)</button></div></div></div></div>',
      depois: function () { if (window.QRious) new window.QRious({ element: document.getElementById('qr'), value: url, size: 320, level: 'M' }); } };
  };

  // =============================================================== exportação
  function coletorImagens() {
    var mapa = {}, usados = {}, arquivos = [];
    return {
      arquivos: arquivos,
      caminho: function (src, nome) {
        if (!src) return '';
        if (!/^data:/.test(src)) return /^https?:/.test(src) ? src : '';
        if (mapa[src]) return mapa[src];
        var ext = extDe(src), base = 'assets/' + nome, p = base + '.' + ext, n = 2;
        while (usados[p]) p = base + '-' + (n++) + '.' + ext;
        usados[p] = 1; mapa[src] = p; arquivos.push({ caminho: p, dados: src });
        return p;
      }
    };
  }
  function gerarLojaJs(cfg) {
    return '// ============================================================\n' +
      '//  CONFIGURAÇÃO DA LOJA — gerada pelo Admin em ' + dataHora(Date.now()) + '\n' +
      '//  Para mudar, edite a loja no admin e exporte de novo.\n' +
      '// ============================================================\n' +
      'window.LOJA = ' + JSON.stringify(cfg, null, 2) + ';\n';
  }
  async function montarZip(l) {
    var col = coletorImagens(), cfg = paraConfig(l, col.caminho), f = window.APP_FILES;
    var zip = new window.JSZip(), pasta = zip.folder(l.slug);
    pasta.file('index.html', MetaTags.aplicar(f['index.html'], cfg));
    pasta.file('css/app.css', f['css/app.css']);
    pasta.file('js/app.js', f['js/app.js']);
    pasta.file('config/loja.js', gerarLojaJs(cfg));
    col.arquivos.forEach(function (a) { pasta.file(a.caminho, a.dados.slice(a.dados.indexOf(',') + 1), { base64: true }); });
    var blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    return { blob: blob, total: 4 + col.arquivos.length };
  }
  async function exportarSite() {
    var l = A.loja;
    if (validar(l).erros.length) return toast('Corrija os erros antes de exportar.');
    await salvarAgora();
    var r = await montarZip(l);
    baixar(r.blob, l.slug + '.zip');
    A.exportado = { id: l.id, arquivos: r.total, kb: Math.round(r.blob.size / 1024) };
    renderSecao();
    toast(l.slug + '.zip exportado');
  }
  function baixarQR() {
    var l = A.loja, url = urlLoja(l), T = 1200, margem = 80;
    var qr = new window.QRious({ value: url, size: T - margem * 2, level: 'H', background: '#ffffff', foreground: '#1C1917' });
    var c = document.createElement('canvas'); c.width = T; c.height = T + 170;
    var g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(qr.canvas || qr.element, margem, margem);
    g.fillStyle = '#1C1917'; g.textAlign = 'center';
    g.font = '700 56px Onest, Arial, sans-serif'; g.fillText(l.nome, T / 2, T + 40);
    g.fillStyle = '#57504A'; g.font = '500 34px Onest, Arial, sans-serif'; g.fillText(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), T / 2, T + 100);
    baixar(c.toDataURL('image/png'), 'qrcode-' + l.slug + '.png');
  }

  // =============================================================== importação e backup
  async function importarConfig(texto, carregarImg) {
    var w = {};
    try { new Function('window', texto)(w); } catch (e) { throw new Error('Não consegui ler o loja.js: ' + e.message); }
    if (!w.LOJA) throw new Error('O arquivo não define window.LOJA.');
    var cache = {};
    var img = async function (src) {
      if (!src) return '';
      if (/^data:/.test(src)) return src;
      if (cache[src] !== undefined) return cache[src];
      var r = '';
      if (/^https?:/.test(src)) {
        try { var resp = await fetch(src); r = await lerArquivo(await resp.blob()); } catch (e) { r = src; }
      } else r = (await carregarImg(src.replace(/^\.?\//, ''))) || src;
      return (cache[src] = r);
    };
    var l = await daConfig(w.LOJA, img);
    await BD.salvar(l);
    A.lojas.unshift(l);
    return l;
  }
  function escolherArquivo(id) {
    return new Promise(function (ok) {
      var el = document.getElementById(id);
      el.value = '';
      el.onchange = function () { ok(el.files); };
      el.oncancel = function () { ok([]); };
      el.click();
    });
  }
  async function fluxoImportarLojaJs() {
    var r = await modal({ titulo: 'Importar loja.js', texto: 'Escolha a <b>pasta do site</b> para trazer o cardápio junto com as imagens, ou só o arquivo <b>loja.js</b> (as fotos precisarão ser enviadas de novo).',
      extra: '<div class="linha"><button class="btn primario flex1" data-extra="pasta">Escolher a pasta do site</button><button class="btn flex1" data-extra="arquivo">Só o loja.js</button></div>',
      semOk: true });
    if (r !== 'pasta' && r !== 'arquivo') return;
    try {
      var l;
      if (r === 'arquivo') {
        var fs = await escolherArquivo('arq-lojajs');
        if (!fs.length) return;
        l = await importarConfig(await lerArquivo(fs[0], true), function () { return ''; });
      } else {
        var todos = Array.prototype.slice.call(await escolherArquivo('arq-pasta'));
        var cfg = todos.find(function (f) { return /(^|\/)config\/loja\.js$/.test(f.webkitRelativePath); }) ||
          todos.find(function (f) { return /(^|\/)loja\.js$/.test(f.webkitRelativePath); });
        if (!cfg) return toast('Não achei config/loja.js nessa pasta.');
        var base = cfg.webkitRelativePath.replace(/(config\/)?loja\.js$/, '');
        var porCaminho = {};
        todos.forEach(function (f) { porCaminho[f.webkitRelativePath] = f; });
        l = await importarConfig(await lerArquivo(cfg, true), function (p) {
          var f = porCaminho[base + p]; return f ? lerArquivo(f) : '';
        });
      }
      toast('"' + l.nome + '" importada');
      abrirEditor(l.id);
    } catch (e) { modal({ titulo: 'Não foi possível importar', texto: esc(e.message), cancelar: false }); }
  }
  async function exportarBackup() {
    await salvarAgora();
    var lojas = await BD.listar();
    var dados = { app: 'admin-gerador', versao: 1, exportadoEm: new Date().toISOString(), lojas: lojas };
    baixar(new Blob([JSON.stringify(dados)], { type: 'application/json' }), 'backup-lojas-' + hojeISO() + '.json');
    A.ultimoBackup = Date.now();
    await BD.setMeta('ultimoBackup', A.ultimoBackup);
    toast('Backup de ' + lojas.length + (lojas.length === 1 ? ' loja' : ' lojas') + ' exportado');
    if (!A.loja) renderLista();
  }
  async function importarBackup() {
    var fs = await escolherArquivo('arq-backup');
    if (!fs.length) return;
    try {
      var d = JSON.parse(await lerArquivo(fs[0], true));
      if (d.app !== 'admin-gerador' || !Array.isArray(d.lojas)) throw new Error('Esse arquivo não é um backup do admin.');
      var existentes = d.lojas.filter(function (l) { return A.lojas.some(function (x) { return x.id === l.id; }); }).length;
      var ok = await modal({ titulo: 'Importar backup', texto: 'O arquivo tem <b>' + d.lojas.length + '</b> loja(s)' +
        (existentes ? ', das quais ' + existentes + ' já existem aqui e serão <b>substituídas</b> pela versão do backup.' : '.') + ' Continuar?', ok: 'Importar' });
      if (!ok) return;
      for (var i = 0; i < d.lojas.length; i++) await BD.salvar(normalizar(d.lojas[i]));
      toast(d.lojas.length + ' loja(s) importada(s)');
      abrirLista();
    } catch (e) { modal({ titulo: 'Não foi possível importar', texto: esc(e.message), cancelar: false }); }
  }

  // =============================================================== ações (cliques)
  var acoes = {
    novaLoja: async function () {
      var nome = await modal({ titulo: 'Nova loja', campo: '', ph: 'Nome da hamburgueria', ok: 'Criar' });
      if (!nome || !nome.trim()) return;
      var l = novaLoja(nome.trim()); await BD.salvar(l); A.lojas.unshift(l); abrirEditor(l.id);
    },
    editar: function (el) { abrirEditor(el.dataset.id); },
    duplicar: async function (el) {
      var o = A.lojas.find(function (l) { return l.id === el.dataset.id; }), l = clone(o);
      l.id = uid('l'); l.nome = o.nome + ' (cópia)'; l.slug = slugify(l.nome); l.slugManual = false; l.urlSite = '';
      ['titulo', 'descricao'].forEach(function (k) { if (o.nome && l.seo[k]) l.seo[k] = l.seo[k].split(o.nome).join(l.nome); });
      l.criadoEm = l.editadoEm = Date.now();
      await BD.salvar(l); A.lojas.unshift(l);
      toast('Cópia criada. Troque nome, logo, cores e WhatsApp.');
      abrirEditor(l.id);
    },
    excluirLoja: async function (el) {
      var l = A.lojas.find(function (x) { return x.id === el.dataset.id; });
      var ok = await modal({ titulo: 'Excluir "' + l.nome + '"?', texto: 'A loja e as imagens dela serão apagadas deste navegador. Isso não tira o site do ar. Se tiver backup, dá para recuperar.', ok: 'Excluir', perigo: true });
      if (!ok) return;
      await BD.excluir(l.id); abrirLista();
    },
    importarLojaJs: fluxoImportarLojaJs,
    exportarBackup: exportarBackup,
    importarBackup: importarBackup,
    voltar: function () { abrirLista(); },
    secao: function (el, e) { if (e) e.preventDefault(); irPara(el.dataset.v); },
    previa: function (el) {
      A.previa = el.dataset.v;
      document.querySelectorAll('#seg-previa button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === A.previa); });
      atualizarPrevia();
    },
    set: function (el) {
      setPath(A.loja, el.dataset.path, JSON.parse(el.dataset.v));
      mudou(true);
    },
    foto: async function (el) {
      var fs = await escolherArquivo('arq-imagem');
      if (!fs.length) return;
      var tipo = el.dataset.tipo, path = el.dataset.path;
      try {
        var bruto = await lerArquivo(fs[0]);
        var pronto = await processar(bruto, IMG[tipo]);
        setPath(A.loja, path, pronto);
        if (tipo === 'logo') A.loja.icone = await processar(bruto, { quadrado: 180, formato: 'image/png' });
        mudou(true);
        toast('Imagem pronta: ' + extDe(pronto).toUpperCase() + ', ' + Math.round(pronto.length * 0.75 / 1024) + ' KB');
      } catch (e) { toast(e.message); }
    },
    semFoto: function (el) { setPath(A.loja, el.dataset.path, ''); if (el.dataset.path === 'logo') A.loja.icone = ''; mudou(true); },
    compartDoBanner: async function () {
      A.loja.seo.imagem = await processar(A.loja.banner.imagem || A.loja.logo, IMG.compartilhar);
      mudou(true);
    },
    copiarNetlify: function () {
      var t = nomeNetlify(urlLoja(A.loja)) || urlLoja(A.loja);
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Copiado: ' + t); }, function () { toast(t); });
    },
    copiarHorario: function () {
      var H = A.loja.horarios, base = DIAS.map(function (d) { return H[d[0]]; }).find(function (h) { return h.aberto; });
      if (!base) return toast('Nenhum dia aberto para copiar.');
      DIAS.forEach(function (d) { if (H[d[0]].aberto) H[d[0]].turnos = clone(base.turnos); });
      mudou(true); toast('Horário copiado para os dias abertos');
    },
    novoTurno: function (el) { A.loja.horarios[el.dataset.v].turnos.push({ ini: '11:00', fim: '14:00' }); mudou(true); },
    removerIdx: function (el) { getPath(A.loja, el.dataset.arr).splice(+el.dataset.i, 1); mudou(true); },
    removerId: function (el) {
      var arr = getPath(A.loja, el.dataset.arr), i = arr.findIndex(function (x) { return x.id === el.dataset.id; });
      if (i >= 0) arr.splice(i, 1); mudou(true);
    },
    novaCategoria: function () {
      var inpEl = document.getElementById('nova-cat'), nome = inpEl.value.trim();
      if (!nome) return inpEl.focus();
      A.loja.categorias.push({ id: uid('k'), nome: nome, oculta: false }); mudou(true);
      document.getElementById('nova-cat').focus();
    },
    excluirCategoria: async function (el) {
      var l = A.loja, c = l.categorias.find(function (x) { return x.id === el.dataset.id; });
      var prods = l.produtos.filter(function (p) { return p.categoriaId === c.id; });
      if (prods.length) {
        var ok = await modal({ titulo: 'Excluir "' + c.nome + '"?', texto: 'Os <b>' + prods.length + ' produtos</b> dessa categoria também serão excluídos. Para só esconder do site, desligue "Visível".', ok: 'Excluir tudo', perigo: true });
        if (!ok) return;
      }
      l.produtos = l.produtos.filter(function (p) { return p.categoriaId !== c.id; });
      l.categorias = l.categorias.filter(function (x) { return x !== c; });
      mudou(true);
    },
    novoProduto: function () {
      var l = A.loja;
      if (!l.categorias.length) l.categorias.push({ id: uid('k'), nome: 'Cardápio', oculta: false });
      var cat = l.categorias.some(function (c) { return c.id === A.filtroCat; }) ? A.filtroCat : l.categorias[0].id;
      var p = { id: uid('p'), nome: '', descricao: '', preco: 0, imagem: '', categoriaId: cat, disponivel: true, destaque: false, grupos: [] };
      l.produtos.push(p); A.aberto = {}; A.aberto[p.id] = true; A.busca = '';
      mudou(true);
      var f = document.querySelector('[data-foco="' + p.id + '"]'); if (f) { f.focus(); f.scrollIntoView({ block: 'center' }); }
    },
    abrir: function (el, e) {
      if (e && e.target.closest('[data-alca]')) return;
      var id = el.dataset.id, era = A.aberto[id]; A.aberto = {}; if (!era) A.aberto[id] = true;
      document.getElementById('lista-produtos').innerHTML = listaProdutos(A.loja); atualizarDerivados();
    },
    duplicarProduto: function (el) {
      var l = A.loja, i = l.produtos.findIndex(function (p) { return p.id === el.dataset.id; }), p = clone(l.produtos[i]);
      p.id = uid('p'); p.nome += ' (cópia)'; l.produtos.splice(i + 1, 0, p); A.aberto = {}; A.aberto[p.id] = true; mudou(true);
    },
    excluirProduto: async function (el) {
      var l = A.loja, p = l.produtos.find(function (x) { return x.id === el.dataset.id; });
      var emCombos = l.combos.filter(function (c) { return c.itens.some(function (i) { return i.id === p.id; }); });
      var ok = await modal({ titulo: 'Excluir "' + (p.nome || 'produto') + '"?', ok: 'Excluir', perigo: true,
        texto: emCombos.length ? 'Ele faz parte de ' + emCombos.length + ' combo(s). O checklist vai apontar para você ajustar.' : '' });
      if (!ok) return;
      l.produtos = l.produtos.filter(function (x) { return x !== p; }); mudou(true);
    },
    filtroSemFoto: function () { A.filtroCat = 'semfoto'; renderSecao(); },
    toggleGrupo: function (el) {
      var arr = getPath(A.loja, el.dataset.path), i = arr.indexOf(el.dataset.v);
      if (i >= 0) arr.splice(i, 1); else arr.push(el.dataset.v);
      mudou(true);
    },
    novoGrupo: function () {
      var g = grupoPadrao(uid('g'), '', 'multiplo', 'adicional', false, [['', 0]]);
      A.loja.grupos.push(g); mudou(true);
      var inps = document.querySelectorAll('[data-bind$=".titulo"][data-bind^="grupos."]'); if (inps.length) inps[inps.length - 1].focus();
    },
    novaOpcao: function (el) {
      A.loja.grupos[+el.dataset.v].opcoes.push({ id: uid('o'), nome: '', preco: 0 }); mudou(true);
      var inps = document.querySelectorAll('[data-bind^="grupos.' + el.dataset.v + '.opcoes."][data-bind$=".nome"]'); if (inps.length) inps[inps.length - 1].focus();
    },
    excluirGrupo: async function (el) {
      var l = A.loja, id = el.dataset.id, g = l.grupos.find(function (x) { return x.id === id; });
      var ok = await modal({ titulo: 'Excluir o grupo "' + (g.titulo || 'sem nome') + '"?', texto: 'Ele sai de todos os produtos e combos que o usam.', ok: 'Excluir', perigo: true });
      if (!ok) return;
      l.grupos = l.grupos.filter(function (x) { return x !== g; });
      l.produtos.concat(l.combos).forEach(function (p) { p.grupos = p.grupos.filter(function (x) { return x !== id; }); });
      mudou(true);
    },
    novoCombo: function () {
      A.loja.combos.push({ id: uid('c'), nome: '', descricao: '', imagem: '', itens: [], preco: 0, disponivel: true, grupos: [] }); mudou(true);
      var inps = document.querySelectorAll('[data-bind^="combos."][data-bind$=".nome"]'); if (inps.length) inps[inps.length - 1].focus();
    },
    excluirCombo: async function (el) {
      var c = A.loja.combos.find(function (x) { return x.id === el.dataset.id; });
      if (!(await modal({ titulo: 'Excluir o combo "' + (c.nome || 'sem nome') + '"?', ok: 'Excluir', perigo: true }))) return;
      A.loja.combos = A.loja.combos.filter(function (x) { return x !== c; }); mudou(true);
    },
    qtdItem: function (el) {
      var it = getPath(A.loja, el.dataset.path); it.qtd = Math.max(1, (it.qtd || 1) + +el.dataset.v); mudou(true);
    },
    novoCupom: function () {
      A.loja.cupons.push({ id: uid('u'), codigo: '', tipo: 'percentual', valor: 10, ativo: true, validade: '', minimo: 0 }); mudou(true);
      var inps = document.querySelectorAll('[data-bind^="cupons."][data-bind$=".codigo"]'); if (inps.length) inps[inps.length - 1].focus();
    },
    exportarSite: function () { exportarSite().catch(function (e) { modal({ titulo: 'Erro ao exportar', texto: esc(e.message), cancelar: false }); }); },
    baixarQR: baixarQR
  };

  // =============================================================== eventos
  function aplicarBind(el) {
    var path = el.dataset.bind, t = el.dataset.t, v = el.value, l = A.loja;
    if (el.type === 'checkbox') v = t === 'inv' ? !el.checked : el.checked;
    else if (t === 'money') { var m = mascaraReais(v); if (m !== v) { el.value = m; } v = centavos(m) / 100; }
    else if (t === 'int') { var d = v.replace(/\D/g, '').slice(0, 4); if (d !== v) el.value = d; v = d ? parseInt(d, 10) : 0; }
    else if (t === 'phone') {
      var dig = v.replace(/\D/g, ''); if (dig.length > 11 && dig.indexOf('55') === 0) dig = dig.slice(2); dig = dig.slice(0, 11);
      var f = fmtFone(dig); if (f !== v) el.value = f; v = dig ? '55' + dig : '';
    }
    else if (t === 'slug') { var s = slugDigitando(v); if (s !== v) el.value = s; v = s; l.slugManual = true; }
    else if (t === 'upper') { var u = v.toUpperCase().replace(/[^A-Z0-9_-]/g, ''); if (u !== v) el.value = u; v = u; }
    else if (t === 'insta') v = v.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?].*$/, '');
    else if (t === 'color') { if (!/^#[0-9a-f]{6}$/i.test(v)) return; v = v.toUpperCase(); }
    var antes = getPath(l, path);
    setPath(l, path, v);
    // Trocou o nome: atualiza os textos de compartilhamento que citavam o nome antigo
    if (path === 'nome' && antes && antes.length >= 3) {
      ['titulo', 'descricao'].forEach(function (k) {
        if (l.seo[k] && l.seo[k].indexOf(antes) >= 0) l.seo[k] = l.seo[k].split(antes).join(v);
      });
    }
    if (path === 'nome' && !l.slugManual) {
      l.slug = slugify(v);
      document.querySelectorAll('[data-bind="slug"]').forEach(function (x) { x.value = l.slug; });
    }
    if (/^grupos\.\d+\.obrigatorio$/.test(path)) {
      var g = getPath(l, path.replace(/\.obrigatorio$/, ''));
      g.min = v ? Math.max(1, +g.min || 0) : 0;
    }
    if (/^grupos\.\d+\.min$/.test(path)) getPath(l, path.replace(/\.min$/, '')).obrigatorio = v > 0;
    // outros campos ligados ao mesmo valor (ex.: seletor de cor + texto)
    document.querySelectorAll('[data-bind="' + path + '"]').forEach(function (x) {
      if (x !== el && x.type !== 'checkbox') x.value = t === 'phone' ? fmtFone(localWhats(v)) : v;
    });
    return true;
  }
  raiz.addEventListener('input', function (e) {
    var el = e.target;
    if (el.id === 'busca-prod') { A.busca = el.value; document.getElementById('lista-produtos').innerHTML = listaProdutos(A.loja); atualizarDerivados(); return; }
    if (!el.dataset.bind || el.type === 'checkbox' || el.tagName === 'SELECT') return;
    if (aplicarBind(el)) mudou(el.hasAttribute('data-estrutural'));
  });
  raiz.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'filtro-cat') { A.filtroCat = el.value; document.getElementById('lista-produtos').innerHTML = listaProdutos(A.loja); atualizarDerivados(); return; }
    if (el.dataset.change === 'addItemCombo') {
      if (el.value) { A.loja.combos[+el.dataset.v].itens.push({ id: el.value, qtd: 1 }); mudou(true); }
      return;
    }
    if (!el.dataset.bind) return;
    if (el.type === 'checkbox' || el.tagName === 'SELECT') { if (aplicarBind(el)) mudou(true); return; }
    // ao sair do campo: normaliza o texto e redesenha o que depende dele
    if (el.dataset.t === 'slug') { A.loja.slug = slugify(el.value) || A.loja.slug; el.value = A.loja.slug; mudou(false); }
    else if (el.dataset.t === 'insta') { el.value = A.loja.instagram; }
  });
  // "Já vem marcado": atualiza as opções ao abrir (os nomes podem ter mudado sem redesenhar a seção)
  raiz.addEventListener('mousedown', function (e) {
    var s = e.target.closest('select[data-padrao]'); if (!s) return;
    var g = A.loja.grupos[+s.dataset.padrao];
    s.innerHTML = [['', 'Nenhuma']].concat(g.opcoes.filter(function (o) { return String(o.nome).trim(); }).map(function (o) { return [o.nome, o.nome]; }))
      .map(function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] === g.padrao ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('');
  });
  raiz.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var fn = acoes[el.dataset.act];
    if (fn) fn(el, e);
  });
  raiz.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'nova-cat') acoes.novaCategoria();
  });

  // ---------- arrastar para reordenar (pela alça)
  var arraste = null;
  raiz.addEventListener('mousedown', function (e) {
    var a = e.target.closest('[data-alca]'); if (!a) return;
    var item = a.closest('[data-lista]'); if (item) item.draggable = true;
  });
  raiz.addEventListener('dragstart', function (e) {
    var item = e.target.closest && e.target.closest('[data-lista][draggable="true"]'); if (!item) return;
    arraste = { lista: item.dataset.lista, id: item.dataset.id, el: item };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.id);
    setTimeout(function () { item.classList.add('arrastando'); }, 0);
  });
  function limparAlvos() { document.querySelectorAll('.alvo-antes,.alvo-depois').forEach(function (x) { x.classList.remove('alvo-antes', 'alvo-depois'); }); }
  raiz.addEventListener('dragover', function (e) {
    if (!arraste) return;
    var alvo = e.target.closest('[data-lista="' + arraste.lista + '"]');
    if (!alvo || alvo === arraste.el) return;
    e.preventDefault();
    var r = alvo.getBoundingClientRect(), depois = e.clientY > r.top + r.height / 2;
    limparAlvos(); alvo.classList.add(depois ? 'alvo-depois' : 'alvo-antes');
  });
  raiz.addEventListener('drop', function (e) {
    if (!arraste) return;
    var alvo = e.target.closest('[data-lista="' + arraste.lista + '"]');
    if (!alvo || alvo === arraste.el) return;
    e.preventDefault();
    var depois = alvo.classList.contains('alvo-depois'), arr = getPath(A.loja, arraste.lista);
    var de = arr.findIndex(function (x) { return x.id === arraste.id; }), item = arr.splice(de, 1)[0];
    var para = arr.findIndex(function (x) { return x.id === alvo.dataset.id; }) + (depois ? 1 : 0);
    arr.splice(para, 0, item);
    arraste = null; limparAlvos(); mudou(true);
  });
  raiz.addEventListener('dragend', function () {
    if (arraste && arraste.el) { arraste.el.classList.remove('arrastando'); arraste.el.draggable = false; }
    arraste = null; limparAlvos();
  });

  // =============================================================== início
  window.addEventListener('beforeunload', function () { salvarAgora(); });
  abrirDB().then(function () {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    return abrirLista();
  }).catch(function (e) {
    raiz.innerHTML = '<div class="corpo-lista"><div class="faixa erro">Não consegui abrir o banco do navegador (IndexedDB): ' + esc(e.message) + '. Use o Google Chrome.</div></div>';
  });
  // usado nos testes automáticos
  window.__admin = { A: A, validar: validar, paraConfig: paraConfig };
})();
