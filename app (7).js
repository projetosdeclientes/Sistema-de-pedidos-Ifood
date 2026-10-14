/* App de pedidos por WhatsApp — JavaScript puro, sem dependências.
   Tudo que muda de uma loja para outra vem de window.LOJA (config/loja.js). */
(function () {
  'use strict';

  var L = window.LOJA;
  var root = document.getElementById('app');
  if (!L) {
    root.innerHTML = '<div style="padding:48px 20px;text-align:center;font-size:15px">Não encontrei a configuração da loja (config/loja.js).</div>';
    return;
  }

  // ---------------------------------------------------------------- dados
  var G = L.grupos || {};
  var PRODUTOS = L.produtos || [];
  var BY_ID = {};
  PRODUTOS.forEach(function (p) { BY_ID[p.id] = p; });
  var FONE = String(L.whatsapp || '').replace(/\D/g, '');
  var FUSO = L.fuso || 'America/Sao_Paulo';
  var DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  var DIAS_NOME = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  var STORE_KEY = 'pedido-wa3-' + String(L.nome || 'loja').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  function isCombo(p) { return p.tipo === 'combo'; }
  function comboItens(p) { return (p.itens || []).filter(function (i) { return BY_ID[i.id]; }); }
  function comboPrecoCheio(p) {
    return comboItens(p).reduce(function (a, i) { return a + BY_ID[i.id].preco * (i.qtd || 1); }, 0);
  }
  function comboInclui(p) {
    return comboItens(p).map(function (i) { return (i.qtd > 1 ? i.qtd + 'x ' : '') + BY_ID[i.id].nome; }).join(' + ');
  }
  function estiloGrupo(g) { return g.estilo || (g.tipo === 'unico' ? 'escolha' : 'adicional'); }
  // Produto esgotado (disponivel: false) ou combo com algum item esgotado/removido
  function disponivel(p) {
    if (!p || p.disponivel === false) return false;
    return !isCombo(p) || (p.itens || []).every(function (i) { return BY_ID[i.id] && BY_ID[i.id].disponivel !== false; });
  }
  // Mínimo e máximo de escolhas de um grupo (máximo 0 = sem limite)
  function limites(g) {
    var min = g.min != null ? +g.min : (g.obrigatorio ? 1 : 0);
    if (g.obrigatorio && min < 1) min = 1;
    return { min: min, max: g.tipo === 'unico' ? 1 : (+g.max || 0) };
  }
  function textoLimite(g) {
    if (g.tipo === 'unico') return 'Escolha 1 opção';
    var l = limites(g);
    if (l.min && l.max) return l.min === l.max ? 'Escolha ' + l.min + (l.min === 1 ? ' opção' : ' opções') : 'Escolha de ' + l.min + ' a ' + l.max;
    if (l.max) return 'Escolha até ' + l.max;
    if (l.min) return 'Escolha pelo menos ' + l.min;
    return 'Escolha quantos quiser';
  }
  var PODE_ENTREGA = L.aceitaEntrega !== false, PODE_RETIRADA = L.aceitaRetirada !== false;
  if (!PODE_ENTREGA && !PODE_RETIRADA) PODE_ENTREGA = true;

  // ---------------------------------------------------------------- utilidades
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function r2(n) { return Math.round((n || 0) * 100) / 100; }
  function M(n) { return (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function centavosDe(txt) { var d = String(txt || '').replace(/\D/g, ''); return d ? parseInt(d, 10) : 0; }
  function mascaraReais(txt) { var c = centavosDe(txt); return c ? M(c / 100) : ''; }
  function pad(n) { return String(n).padStart(2, '0'); }

  // ---------------------------------------------------------------- horário
  var fmtAgora = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  function agora() {
    var o = {};
    fmtAgora.formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
    var h = parseInt(o.hour, 10) % 24;
    return {
      dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday),
      min: h * 60 + parseInt(o.minute, 10),
      ano: +o.year, mes: +o.month, d: +o.day, hora: pad(h) + ':' + o.minute
    };
  }
  function intervalos(dia) {
    var v = (L.horarios || {})[DIAS[dia]];
    if (!v || v === 'fechado') return [];
    if (!Array.isArray(v)) v = [v];
    return v.map(function (s) {
      var m = String(s).match(/^\s*(\d{1,2})(?:[:h](\d{2}))?\s*(?:-|–|às|as|a|até)\s*(\d{1,2})(?:[:h](\d{2}))?\s*$/i);
      return m ? { ini: +m[1] * 60 + +(m[2] || 0), fim: +m[3] * 60 + +(m[4] || 0) } : null;
    }).filter(Boolean).sort(function (a, b) { return a.ini - b.ini; });
  }
  function status() {
    var n = agora();
    var forcado = window.LOJA_PREVIEW_STATUS;   // usado só pela pré-visualização do admin
    if (forcado === 'aberto') return { aberto: true, n: n };
    var temHorario = L.horarios && Object.keys(L.horarios).length > 0;
    if (!temHorario && !L.fechadoManual && forcado !== 'fechado') return { aberto: true, n: n };
    var i, k;
    if (!L.fechadoManual && forcado !== 'fechado') {
      var hoje = intervalos(n.dia), ontem = intervalos((n.dia + 6) % 7);
      for (k = 0; k < hoje.length; k++) {
        i = hoje[k];
        if (i.ini === i.fim || (i.ini < i.fim ? n.min >= i.ini && n.min < i.fim : n.min >= i.ini)) return { aberto: true, atual: i, n: n };
      }
      for (k = 0; k < ontem.length; k++) {
        i = ontem[k];
        if (i.fim < i.ini && n.min < i.fim) return { aberto: true, atual: i, n: n };
      }
    }
    // Fechado: procura a próxima abertura. Com fechamento manual, a partir de amanhã.
    for (var off = L.fechadoManual ? 1 : 0; off <= 7; off++) {
      var dia = (n.dia + off) % 7, lista = intervalos(dia);
      for (k = 0; k < lista.length; k++) {
        if (off > 0 || lista[k].ini > n.min) return { aberto: false, n: n, prox: { off: off, dia: dia, ini: lista[k].ini } };
      }
    }
    return { aberto: false, n: n };
  }
  function hora(min) { var h = Math.floor(min / 60) % 24, m = min % 60; return h + 'h' + (m ? pad(m) : ''); }
  function quando(p) { return (p.off === 0 ? 'hoje' : p.off === 1 ? 'amanhã' : DIAS_NOME[p.dia]) + ' às ' + hora(p.ini); }
  function dataCurta(n, off) {
    var d = new Date(Date.UTC(n.ano, n.mes - 1, n.d + (off || 0)));
    return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1);
  }

  // ---------------------------------------------------------------- estado
  var S = {
    cat: 'Todos', q: '', lines: [], ultimo: [], detail: null, sel: {}, detQty: 1, detObs: '',
    cartOpen: false, toast: '', cupomIn: '', cupom: '', cupomErro: '', enviado: false, lastWa: '',
    form: { nome: '', tipo: 'entrega', endereco: '', pagamento: (L.pagamentos || [])[0] || '', troco: '', obs: '' }
  };
  (function carregar() {
    var sv = {};
    try { sv = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) {}
    if (Array.isArray(sv.lines)) S.lines = sv.lines.filter(function (l) { return disponivel(BY_ID[l.id]); });
    if (Array.isArray(sv.ultimo)) S.ultimo = sv.ultimo;
    if (sv.form) {
      Object.keys(S.form).forEach(function (k) { if (typeof sv.form[k] === 'string') S.form[k] = sv.form[k]; });
      if ((L.pagamentos || []).indexOf(S.form.pagamento) < 0) S.form.pagamento = (L.pagamentos || [])[0] || '';
    }
    if (sv.cupom && !erroCupom(sv.cupom, Infinity)) S.cupom = sv.cupom;
    if (!PODE_ENTREGA) S.form.tipo = 'retirada';
    if (!PODE_RETIRADA) S.form.tipo = 'entrega';
  })();
  function salvar() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ lines: S.lines, ultimo: S.ultimo, form: S.form, cupom: S.cupom }));
    } catch (e) {}
  }
  var agendado = false;
  function set(patch) {
    var p = typeof patch === 'function' ? patch(S) : patch;
    Object.keys(p || {}).forEach(function (k) { S[k] = p[k]; });
    salvar();
    if (!agendado) { agendado = true; requestAnimationFrame(function () { agendado = false; render(); }); }
  }
  function setForm(k, v) { var o = {}; o[k] = v; set({ form: Object.assign({}, S.form, o) }); }

  function L_(id, qty, sel, obs) { sel = sel || {}; obs = obs || ''; return { key: id + '|' + JSON.stringify(sel) + '|' + obs, id: id, qty: qty, sel: sel, obs: obs }; }
  function addLine(id, qty, sel, obs) {
    var n = L_(id, qty, sel, obs), lines = S.lines.slice();
    var i = lines.findIndex(function (l) { return l.key === n.key; });
    if (i >= 0) lines[i] = Object.assign({}, lines[i], { qty: lines[i].qty + qty }); else lines.push(n);
    set({ lines: lines });
  }
  function changeLine(key, d) {
    set({ lines: S.lines.map(function (l) { return l.key === key ? Object.assign({}, l, { qty: l.qty + d }) : l; }).filter(function (l) { return l.qty > 0; }) });
  }
  function decProduct(id) {
    var ls = S.lines.filter(function (l) { return l.id === id; });
    if (ls.length) changeLine(ls[ls.length - 1].key, -1);
  }
  function openDetail(p) {
    var sel = {};
    (p.grupos || []).forEach(function (gid) { var g = G[gid]; if (g) sel[gid] = g.tipo === 'unico' && g.padrao ? [g.padrao] : []; });
    set({ detail: p.id, sel: sel, detQty: 1, detObs: '' });
  }
  function unit(p, sel) {
    return p.preco + (p.grupos || []).reduce(function (a, gid) {
      return a + ((G[gid] || {}).opcoes || []).filter(function (o) { return (sel[gid] || []).indexOf(o.nome) >= 0; })
        .reduce(function (b, o) { return b + (o.preco || 0); }, 0);
    }, 0);
  }
  function desc(p, sel) {
    return (p.grupos || []).reduce(function (a, gid) {
      return a.concat((sel[gid] || []).map(function (v) { return ((G[gid] || {}).prefixo || '') + v; }));
    }, []).join(' · ');
  }
  function faltando(p, sel) {
    return (p.grupos || []).filter(function (gid) { var g = G[gid]; return g && (sel[gid] || []).length < limites(g).min; });
  }
  var toastT;
  function flash(t) { clearTimeout(toastT); set({ toast: t }); toastT = setTimeout(function () { set({ toast: '' }); }, 1600); }

  // ---------------------------------------------------------------- cálculo do pedido
  function isDinheiro(pg) { return /dinheiro/i.test(pg || ''); }
  function hojeISO() { var n = agora(); return n.ano + '-' + pad(n.mes) + '-' + pad(n.d); }
  // Retorna a mensagem de erro do cupom, ou '' se ele pode ser usado com esse subtotal
  function erroCupom(cod, subtotal) {
    var cp = (L.cupons || {})[cod];
    if (!cp || cp.ativo === false) return 'Cupom inválido ou expirado.';
    if (cp.validade && hojeISO() > cp.validade) return 'Este cupom expirou.';
    if (cp.minimo && subtotal < cp.minimo) return 'Válido para pedidos a partir de ' + M(cp.minimo) + '.';
    return '';
  }
  function calc() {
    var st = status(), f = S.form, entrega = PODE_ENTREGA && (f.tipo === 'entrega' || !PODE_RETIRADA);
    var itens = S.lines.filter(function (l) { return disponivel(BY_ID[l.id]); }).map(function (l) {
      var p = BY_ID[l.id], u = unit(p, l.sel);
      return { p: p, l: l, unitP: u, total: u * l.qty };
    });
    var count = itens.reduce(function (a, i) { return a + i.l.qty; }, 0);
    var subtotal = r2(itens.reduce(function (a, i) { return a + i.total; }, 0));
    var taxa = entrega ? (L.taxaEntrega || 0) : 0;
    var cupomAviso = S.cupom ? erroCupom(S.cupom, subtotal) : '';
    var cp = S.cupom && !cupomAviso ? (L.cupons || {})[S.cupom] : null;
    var desconto = cp ? Math.min(subtotal, r2(cp.tipo === 'percentual' ? subtotal * cp.valor / 100 : cp.valor)) : 0;
    var total = r2(subtotal + taxa - desconto);
    var dinheiro = isDinheiro(f.pagamento);
    var trocoPara = dinheiro ? centavosDe(f.troco) / 100 : 0;
    var trocoErro = dinheiro && trocoPara > 0 && trocoPara < total
      ? 'O valor precisa ser maior que o total (' + M(total) + ').' : '';
    var hint = '';
    if (!count) hint = '';
    else if (entrega && L.pedidoMinimo && subtotal < L.pedidoMinimo) hint = 'Pedido mínimo para entrega: ' + M(L.pedidoMinimo);
    else if (!f.nome.trim()) hint = 'Informe seu nome para continuar.';
    else if (entrega && !f.endereco.trim()) hint = 'Informe o endereço de entrega.';
    else if (trocoErro) hint = 'Confira o valor do troco.';
    return {
      st: st, f: f, entrega: entrega, cupomAviso: cupomAviso, itens: itens, count: count, subtotal: subtotal, taxa: taxa, cp: cp,
      desconto: desconto, total: total, dinheiro: dinheiro, trocoPara: trocoPara, trocoErro: trocoErro,
      hint: hint, canSend: count > 0 && !hint
    };
  }

  function mensagem(c) {
    var n = c.st.n, f = c.f, out = [];
    out.push('*' + L.nome + ' - ' + (c.st.aberto ? 'Novo pedido' : 'PEDIDO AGENDADO') + '*');
    out.push('Data: ' + pad(n.d) + '/' + pad(n.mes) + '/' + n.ano + ' às ' + n.hora);
    if (!c.st.aberto) {
      var pr = c.st.prox;
      out.push('Agendado para: ' + (pr
        ? (pr.off === 0 ? 'hoje' : pr.off === 1 ? 'amanhã' : DIAS_NOME[pr.dia]) + ', ' + dataCurta(n, pr.off) + ' às ' + hora(pr.ini)
        : 'próxima abertura'));
    }
    out.push('', '*Cliente:* ' + f.nome.trim(), '', '*Itens*');
    c.itens.forEach(function (i) {
      var p = i.p, l = i.l;
      out.push(l.qty + 'x ' + p.nome + ': ' + M(i.total));
      if (isCombo(p)) out.push('   Inclui: ' + comboInclui(p));
      (p.grupos || []).forEach(function (gid) {
        var g = G[gid], vals = (l.sel || {})[gid] || [];
        if (!g || !vals.length) return;
        var e = estiloGrupo(g);
        if (e === 'escolha') out.push('   ' + g.titulo + ': ' + vals.join(', '));
        else vals.forEach(function (v) {
          var o = (g.opcoes || []).find(function (x) { return x.nome === v; }) || {};
          out.push('   ' + (e === 'remocao' ? '- ' : '+ ') + v + (o.preco ? ' (' + M(o.preco) + ')' : ''));
        });
      });
      if (l.obs) out.push('   Obs: ' + l.obs);
    });
    out.push('');
    if (c.entrega) out.push('*Entrega*', f.endereco.trim());
    else out.push('*Retirada no local*', L.endereco);
    out.push('', '*Pagamento:* ' + f.pagamento);
    if (c.dinheiro) {
      out.push(c.trocoPara > c.total
        ? 'Troco para ' + M(c.trocoPara) + ' (levar ' + M(r2(c.trocoPara - c.total)) + ' de troco)'
        : 'Não precisa de troco');
    }
    if (f.obs.trim()) out.push('', '*Observações:* ' + f.obs.trim());
    out.push('', 'Subtotal: ' + M(c.subtotal));
    if (c.cp) out.push('Cupom ' + S.cupom + (c.cp.tipo === 'percentual' ? ' (' + c.cp.valor + '%)' : '') + ': - ' + M(c.desconto));
    if (c.entrega) out.push('Taxa de entrega: ' + (c.taxa ? M(c.taxa) : 'Grátis'));
    out.push('*Total: ' + M(c.total) + '*');
    return out.join('\n').replace(/\s*[—–]\s*/g, ' - ');   // sem travessões, nem nos textos da loja/cliente
  }
  function waLink(txt) { return 'https://wa.me/' + FONE + '?text=' + encodeURIComponent(txt); }

  // ---------------------------------------------------------------- aparência (cores e meta tags)
  (function aplicarMarca() {
    var cores = L.cores || {}, h = document.documentElement.style;
    if (cores.principal) h.setProperty('--cor', cores.principal);
    if (cores.secundaria) h.setProperty('--cor2', cores.secundaria);
    if (cores.escuro) h.setProperty('--escuro', cores.escuro);
    var seo = L.seo || {};
    document.title = seo.titulo || L.nome || document.title;
    function meta(sel, attr, val) { var el = document.querySelector(sel); if (el && val) el.setAttribute(attr, val); }
    meta('meta[name="description"]', 'content', seo.descricao);
    meta('meta[name="theme-color"]', 'content', '#F7F4F0');
    var ic = document.querySelector('link[rel="icon"]');
    if (!ic) { ic = document.createElement('link'); ic.rel = 'icon'; document.head.appendChild(ic); }
    var fav = L.favicon || L.logo;
    ic.href = fav || 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="' + (cores.principal || '#E8590C') +
      '"/><text x="32" y="42" font-family="Arial,sans-serif" font-weight="700" font-size="26" fill="#fff" text-anchor="middle">' + esc(iniciais()) + '</text></svg>');
  })();
  function iniciais() { return (L.nome || '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }

  // ---------------------------------------------------------------- ícones
  var WA_PATH = 'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z';
  var PLUS = function (sz, sw) { return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '"><path d="M12 5v14M5 12h14"></path></svg>'; };
  var X_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C1917" stroke-width="2.2"><path d="M6 6l12 12M18 6 6 18"></path></svg>';
  var ERR_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v5M12 16h.01"></path></svg>';

  function chip(on) { return { bg: on ? 'var(--cor2)' : '#fff', fg: on ? '#fff' : '#1C1917', bd: on ? 'var(--cor2)' : '#E0D9D1' }; }

  // ---------------------------------------------------------------- telas
  function render() {
    var c = calc(), st = c.st, f = c.f, aberto = st.aberto;
    var q = S.q.trim().toLowerCase();
    var match = function (p) { return !q || (p.nome + ' ' + (p.descricao || '') + ' ' + (isCombo(p) ? comboInclui(p) : '')).toLowerCase().indexOf(q) >= 0; };
    var qtyDe = function (id) { return S.lines.filter(function (l) { return l.id === id; }).reduce(function (a, l) { return a + l.qty; }, 0); };
    var noCat = function (p) { return S.cat === 'Todos' || p.categoria === S.cat; };
    var combos = PRODUTOS.filter(function (p) { return isCombo(p) && noCat(p) && match(p); });
    var lista = PRODUTOS.filter(function (p) { return !isCombo(p) && noCat(p) && match(p); });
    var destaques = PRODUTOS.filter(function (p) { return p.destaque && !isCombo(p) && disponivel(p); });
    var cats = ['Todos'];
    (L.categorias || []).forEach(function (nome) { if (PRODUTOS.some(function (p) { return p.categoria === nome; })) cats.push(nome); });
    PRODUTOS.forEach(function (p) { if (p.categoria && cats.indexOf(p.categoria) < 0) cats.push(p.categoria); });
    var ult = (S.ultimo || []).filter(function (l) { return disponivel(BY_ID[l.id]); });
    var detP = S.detail && BY_ID[S.detail];
    var logo = L.logo || '';
    var banner = L.banner || {};
    var layout = L.layout === 'grade' ? 'grade' : 'lista';
    var cartOpen = S.cartOpen && c.count > 0;
    var hasCart = c.count > 0 && !S.cartOpen && !detP && !S.enviado;
    var statusSub = aberto
      ? (st.atual ? (st.atual.ini === st.atual.fim ? '24 horas' : hora(st.atual.ini) + ' às ' + hora(st.atual.fim)) : 'Agora')
      : (!st.prox ? 'Sem previsão' : st.prox.off === 0 ? 'Abre às ' + hora(st.prox.ini)
        : st.prox.off === 1 ? 'Abre amanhã, ' + hora(st.prox.ini) : 'Abre ' + DIAS[st.prox.dia] + ', ' + hora(st.prox.ini));
    var h = '';

    if (!aberto) {
      h += '<div style="background:var(--cor2);color:#fff;font-size:13px;line-height:1.35;padding:10px 20px;display:flex;gap:10px;align-items:center">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>' +
        '<span style="text-wrap:pretty">Estamos fechados agora, mas você pode deixar seu pedido para quando abrirmos.</span></div>';
    }

    // Cabeçalho
    h += '<div style="padding:20px 20px 0;display:flex;align-items:center;gap:14px">' +
      '<div style="width:58px;height:58px;border-radius:18px;background:#fff;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 1px 2px rgba(0,0,0,.06),0 0 0 1px rgba(0,0,0,.04)">' +
      (logo ? '<img src="' + esc(logo) + '" alt="" style="width:100%;height:100%;object-fit:cover">'
        : '<span style="font-weight:700;font-size:20px;color:var(--cor)">' + esc(iniciais()) + '</span>') +
      '</div>' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:19px;font-weight:700;letter-spacing:-.01em;line-height:1.2">' + esc(L.nome) + '</div>' +
      '<div style="display:flex;align-items:center;gap:5px;font-size:13px;color:#6B635C;margin-top:3px;white-space:nowrap;overflow:hidden">' +
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M12 21s-7-6.2-7-12a7 7 0 1 1 14 0c0 5.8-7 12-7 12z"></path><circle cx="12" cy="9" r="2.5"></circle></svg>' +
      '<span style="overflow:hidden;text-overflow:ellipsis">' + esc(L.endereco) + '</span></div></div>' +
      '<a href="' + esc(waLink('Olá! Vim pelo cardápio da ' + (L.nome || '') + '.')) + '" target="_blank" rel="noopener" title="Fale conosco no WhatsApp" style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0">' +
      '<span style="width:46px;height:46px;border-radius:50%;background:var(--cor2);color:#fff;display:flex;align-items:center;justify-content:center">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="' + WA_PATH + '"></path></svg></span>' +
      '<span style="font-size:11px;font-weight:500;color:#57504A;white-space:nowrap">Fale conosco</span></a></div>';

    // Status / tempos / taxa
    var cel = function (a, b, borda) {
      return '<div style="display:flex;flex-direction:column;gap:3px;align-items:center;text-align:center;padding:0 4px' + (borda ? ';border-left:1px solid #DDD6CE' : '') + '">' +
        '<div style="' + (borda ? '' : 'display:flex;align-items:center;gap:5px;') + 'font-size:13px;font-weight:600">' + a + '</div>' +
        '<div style="font-size:11px;color:#6B635C">' + esc(b) + '</div></div>';
    };
    var cels = [cel('<span style="width:7px;height:7px;border-radius:50%;background:' + (aberto ? '#16A34A' : '#DC2626') + '"></span>' + (aberto ? 'Aberto' : 'Fechado'), statusSub, false)];
    if (PODE_ENTREGA) cels.push(cel(esc(L.tempoEntrega), 'Entrega', true));
    if (PODE_RETIRADA) cels.push(cel(esc(L.tempoRetirada), 'Retirada', true));
    if (PODE_ENTREGA) cels.push(cel(L.taxaEntrega ? M(L.taxaEntrega) : 'Grátis', 'Taxa', true));
    h += '<div style="margin:16px 20px 0;background:#EFEAE4;border-radius:18px;display:grid;grid-template-columns:repeat(' + cels.length + ',minmax(0,1fr));padding:12px 0">' + cels.join('') + '</div>';

    if (L.mostrarBanner !== false && banner.titulo) {
      h += '<div style="margin:16px 20px 0;height:150px;border-radius:22px;overflow:hidden;position:relative;background:#2A2320">' +
        (banner.imagem ? '<img src="' + esc(banner.imagem) + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">' : '') +
        '<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(20,14,10,.82) 0%,rgba(20,14,10,.35) 60%,rgba(20,14,10,0) 100%)"></div>' +
        '<div style="position:relative;padding:20px;display:flex;flex-direction:column;gap:6px;height:100%;justify-content:center;max-width:70%">' +
        '<div style="color:#fff;font-size:20px;font-weight:700;line-height:1.2;text-wrap:pretty">' + esc(banner.titulo) + '</div>' +
        '<div style="color:#F2E9E1;font-size:13px">' + esc(banner.subtitulo) + '</div></div></div>';
    }

    if (ult.length) {
      h += '<div style="margin:12px 20px 0;background:#fff;border-radius:18px;padding:12px 12px 12px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 0 0 1px rgba(0,0,0,.04)">' +
        '<span style="width:40px;height:40px;border-radius:50%;background:#EFEAE4;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C1917" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l3 2"></path></svg></span>' +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">' +
        '<div style="font-size:14px;font-weight:600">Repetir seu último pedido</div>' +
        '<div style="font-size:13px;color:#6B635C;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(ult.map(function (l) { return l.qty + 'x ' + BY_ID[l.id].nome; }).join(', ')) + '</div></div>' +
        '<button data-a="repetir" style="height:36px;padding:0 14px;border-radius:18px;border:0;background:var(--cor2);color:#fff;font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0">Adicionar</button></div>';
    }

    // Busca e categorias
    h += '<div style="margin:16px 20px 0;height:50px;background:#fff;border-radius:25px;display:flex;align-items:center;gap:10px;padding:0 18px;box-shadow:0 0 0 1px rgba(0,0,0,.05)">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A817A" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>' +
      '<input data-f="q" enterkeyhint="search" value="' + esc(S.q) + '" placeholder="Buscar no cardápio" style="flex:1;border:0;outline:0;background:transparent;font-size:15px;color:#1C1917;min-width:0"></div>';
    h += '<div style="display:flex;gap:8px;overflow-x:auto;padding:16px 20px 4px">' + cats.map(function (nome) {
      var k = chip(nome === S.cat);
      return '<button data-a="cat" data-v="' + esc(nome) + '" style="flex-shrink:0;height:38px;padding:0 16px;border-radius:19px;border:1px solid ' + k.bd + ';background:' + k.bg + ';color:' + k.fg + ';font-size:14px;font-weight:500;cursor:pointer">' + esc(nome) + '</button>';
    }).join('') + '</div>';

    var addBtn = function (p, sz, isz) {
      return '<button data-a="add" data-v="' + esc(p.id) + '" aria-label="Adicionar" style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;border:0;background:var(--cor);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer">' + PLUS(isz, 2.5) + '</button>';
    };
    var img = function (src) { return '<img src="' + esc(src) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block">'; };

    if (destaques.length && S.cat === 'Todos' && !q) {
      h += '<div style="padding:18px 20px 10px;font-size:18px;font-weight:700;letter-spacing:-.01em">Mais pedidos</div>' +
        '<div style="display:flex;gap:12px;overflow-x:auto;padding:0 20px 6px">' + destaques.map(function (p) {
          return '<div data-a="open" data-v="' + esc(p.id) + '" style="flex-shrink:0;width:168px;background:#fff;border-radius:20px;padding:8px;cursor:pointer;box-shadow:0 0 0 1px rgba(0,0,0,.04)">' +
            '<div style="height:120px;border-radius:14px;overflow:hidden;background:#EFEAE4">' + img(p.imagem) + '</div>' +
            '<div style="padding:10px 4px 4px;display:flex;flex-direction:column;gap:6px">' +
            '<div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.nome) + '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:14px;font-weight:600">' + M(p.preco) + '</span>' + addBtn(p, 32, 16) + '</div></div></div>';
        }).join('') + '</div>';
    }

    if (combos.length) {
      h += '<div style="padding:20px 20px 10px;font-size:18px;font-weight:700;letter-spacing:-.01em">' + esc(combos[0].categoria || 'Combos') + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:14px;padding:0 20px">' + combos.map(function (p) {
          var cheio = comboPrecoCheio(p), disp = disponivel(p), eco = disp && cheio > p.preco;
          return '<div style="background:#fff;border-radius:22px;padding:8px;box-shadow:0 0 0 1px rgba(0,0,0,.04)">' +
            '<div data-a="open" data-v="' + esc(p.id) + '" style="height:150px;border-radius:16px;overflow:hidden;background:#EFEAE4;position:relative;cursor:pointer">' + img(p.imagem) +
            (eco ? '<span style="position:absolute;top:10px;left:10px;height:28px;padding:0 12px;border-radius:14px;background:var(--cor);color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center">Economize ' + M(cheio - p.preco) + '</span>' : '') +
            '</div><div style="padding:12px 8px 6px;display:flex;flex-direction:column;gap:4px">' +
            '<div data-a="open" data-v="' + esc(p.id) + '" style="font-size:17px;font-weight:700;cursor:pointer">' + esc(p.nome) + '</div>' +
            '<div style="font-size:13px;color:#6B635C;line-height:1.4;text-wrap:pretty">' + esc(comboInclui(p)) + '</div>' +
            '<div style="display:flex;align-items:center;gap:10px;margin-top:8px">' +
            (eco ? '<span style="font-size:14px;color:#8A817A;text-decoration:line-through">' + M(cheio) + '</span>' : '') +
            '<span style="font-size:20px;font-weight:700;flex:1">' + M(p.preco) + '</span>' +
            (disp ? '<button data-a="add" data-v="' + esc(p.id) + '" style="height:44px;padding:0 18px;border-radius:22px;border:0;background:var(--cor);color:#fff;font-size:14px;font-weight:600;cursor:pointer">Adicionar</button>'
              : '<span style="height:44px;padding:0 18px;border-radius:22px;background:#DDD6CE;color:#6B635C;font-size:14px;font-weight:600;display:flex;align-items:center">Esgotado</span>') +
            '</div></div></div>';
        }).join('') + '</div>';
    }

    if (lista.length) {
      h += '<div style="padding:22px 20px 6px;font-size:18px;font-weight:700;letter-spacing:-.01em">' + esc(q ? 'Resultados' : (S.cat === 'Todos' ? 'Cardápio' : S.cat)) + '</div>';
    } else if (!combos.length) {
      h += '<div style="margin:24px 20px 0;padding:32px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px;background:#EFEAE4;border-radius:22px">' +
        '<span style="width:48px;height:48px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B635C" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg></span>' +
        '<div style="font-size:15px;font-weight:600">Nenhum item encontrado</div>' +
        '<div style="font-size:13px;color:#6B635C">Tente outra palavra ou categoria.</div></div>';
    }

    if (layout === 'lista') {
      h += '<div style="display:flex;flex-direction:column;padding:0 20px">' + lista.map(function (p) {
        var qty = qtyDe(p.id), disp = disponivel(p);
        return '<div data-k="l-' + esc(p.id) + '" style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid #E8E2DB;align-items:center">' +
          '<div data-a="open" data-v="' + esc(p.id) + '" style="width:88px;height:88px;border-radius:16px;overflow:hidden;background:#EFEAE4;flex-shrink:0;cursor:pointer' + (disp ? '' : ';opacity:.45') + '">' + img(p.imagem) + '</div>' +
          '<div data-a="open" data-v="' + esc(p.id) + '" style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;cursor:pointer">' +
          '<div style="font-size:15px;font-weight:600">' + esc(p.nome) + '</div>' +
          '<div style="font-size:13px;color:#6B635C;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc(p.descricao) + '</div>' +
          '<div style="font-size:15px;font-weight:600;margin-top:2px">' + (disp ? M(p.preco) : '<span style="height:24px;padding:0 10px;border-radius:12px;background:#EFEAE4;color:#6B635C;font-size:12px;font-weight:600;display:inline-flex;align-items:center">Esgotado</span>') + '</div></div>' +
          (!disp ? '' : qty === 0
            ? '<button data-a="add" data-v="' + esc(p.id) + '" aria-label="Adicionar" style="width:44px;height:44px;border-radius:50%;border:1px solid #E0D9D1;background:#fff;color:#1C1917;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0">' + PLUS(18, 2.2) + '</button>'
            : '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;background:var(--cor);border-radius:22px;padding:4px;flex-shrink:0">' +
              '<button data-a="inc" data-v="' + esc(p.id) + '" aria-label="Mais" style="width:36px;height:36px;border:0;background:transparent;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center">' + PLUS(16, 2.5) + '</button>' +
              '<span style="color:#fff;font-weight:700;font-size:14px">' + qty + '</span>' +
              '<button data-a="dec" data-v="' + esc(p.id) + '" aria-label="Menos" style="width:36px;height:36px;border:0;background:transparent;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"></path></svg></button></div>') +
          '</div>';
      }).join('') + '</div>';
    } else {
      h += '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:6px 20px 0">' + lista.map(function (p) {
        var qty = qtyDe(p.id), disp = disponivel(p);
        return '<div data-k="g-' + esc(p.id) + '" style="background:#fff;border-radius:20px;padding:8px;box-shadow:0 0 0 1px rgba(0,0,0,.04);display:flex;flex-direction:column">' +
          '<div data-a="open" data-v="' + esc(p.id) + '" style="aspect-ratio:1/1;border-radius:14px;overflow:hidden;background:#EFEAE4;cursor:pointer">' + img(p.imagem) + '</div>' +
          '<div data-a="open" data-v="' + esc(p.id) + '" style="padding:10px 4px 6px;font-size:14px;font-weight:600;cursor:pointer;flex:1">' + esc(p.nome) + '</div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 4px 4px">' +
          '<span style="font-size:14px;font-weight:600">' + (disp ? M(p.preco) : '<span style="height:24px;padding:0 10px;border-radius:12px;background:#EFEAE4;color:#6B635C;font-size:12px;font-weight:600;display:inline-flex;align-items:center">Esgotado</span>') + '</span>' +
          (!disp ? '' : qty === 0 ? addBtn(p, 36, 16)
            : '<span style="min-width:36px;height:36px;border-radius:18px;background:var(--cor);color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;padding:0 10px">' + qty + '×</span>') +
          '</div></div>';
      }).join('') + '</div>';
    }

    var insta = String(L.instagram || '').replace(/^@/, '').trim();
    if (insta) {
      h += '<a href="https://instagram.com/' + esc(encodeURIComponent(insta)) + '" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:6px;margin:28px 20px 0;font-size:13px;font-weight:500;color:#6B635C">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"></circle></svg>@' + esc(insta) + '</a>';
    }

    if (hasCart) {
      h += '<div style="position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;padding:12px 16px calc(16px + env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(247,244,240,0),#F7F4F0 35%);z-index:10">' +
        '<button data-a="openCart" style="width:100%;height:58px;border-radius:29px;border:0;background:var(--cor2);color:#fff;display:flex;align-items:center;gap:12px;padding:0 8px 0 22px;cursor:pointer;font-size:16px;font-weight:600">' +
        '<span style="flex:1;text-align:left">Ver sacola</span>' +
        '<span style="font-size:14px;color:#D6CFC8;font-weight:500">' + c.count + (c.count === 1 ? ' item' : ' itens') + '</span>' +
        '<span style="height:44px;padding:0 16px;border-radius:22px;background:var(--cor);display:flex;align-items:center">' + M(c.subtotal) + '</span></button></div>';
    }

    if (detP) h += renderDetalhe(detP);
    if (cartOpen) h += renderSacola(c);

    if (S.enviado) {
      h += '<div style="position:fixed;top:0;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:#F7F4F0;z-index:25;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 28px;text-align:center;gap:14px">' +
        '<span style="width:96px;height:96px;border-radius:50%;background:var(--cor);color:#fff;display:flex;align-items:center;justify-content:center;margin-bottom:8px"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 12.5 10 17 19 7"></path></svg></span>' +
        '<div style="font-size:26px;font-weight:700;letter-spacing:-.01em">' + (S.enviadoAgendado ? 'Pedido agendado!' : 'Pedido enviado!') + '</div>' +
        '<div style="font-size:15px;color:#57504A;line-height:1.5;max-width:300px;text-wrap:pretty">Confirme com a ' + esc(L.nome) + ' no WhatsApp para começarmos o preparo.</div>' +
        '<a href="' + esc(S.lastWa) + '" target="_blank" rel="noopener" style="margin-top:14px;width:100%;max-width:320px;height:56px;border-radius:28px;background:#128C4A;color:#fff;display:flex;align-items:center;justify-content:center;gap:10px;font-size:16px;font-weight:600">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"></path></svg>Abrir WhatsApp</a>' +
        '<button data-a="voltar" style="height:44px;padding:0 16px;border:0;background:transparent;color:#57504A;font-size:14px;font-weight:500;text-decoration:underline;text-underline-offset:3px;cursor:pointer">Voltar ao cardápio</button></div>';
    }

    if (S.toast) {
      h += '<div style="position:fixed;top:16px;left:50%;transform:translateX(-50%);background:var(--cor2);color:#fff;padding:12px 18px;border-radius:22px;font-size:14px;font-weight:500;z-index:30;white-space:nowrap">' + esc(S.toast) + '</div>';
    }

    patch(root, h);
  }

  function renderDetalhe(p) {
    var falta = faltando(p, S.sel), disp = disponivel(p), ok = !falta.length && disp;
    var h = '<div data-k="det-bg" data-a="closeDetail" style="position:fixed;inset:0;background:rgba(20,14,10,.5);z-index:20"></div>' +
      '<div data-k="det-' + esc(p.id) + '" style="position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;max-height:92%;overflow-y:auto;background:#F7F4F0;border-radius:28px 28px 0 0;z-index:21">' +
      '<div style="height:240px;position:relative;background:#EFEAE4">' +
      '<img src="' + esc(p.imagem) + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block">' +
      '<button data-a="closeDetail" aria-label="Fechar" style="position:absolute;top:14px;right:14px;width:44px;height:44px;border-radius:50%;border:0;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer">' + X_ICON + '</button></div>' +
      '<div style="padding:20px 20px 8px;display:flex;flex-direction:column;gap:8px">' +
      '<div style="font-size:12px;font-weight:600;color:var(--escuro);text-transform:uppercase;letter-spacing:.06em">' + esc(p.categoria) + '</div>' +
      '<div style="font-size:22px;font-weight:700;letter-spacing:-.01em">' + esc(p.nome) + '</div>' +
      '<div style="font-size:15px;color:#57504A;line-height:1.5;text-wrap:pretty">' + esc(isCombo(p) ? (p.descricao ? p.descricao + ' ' : '') + 'Inclui: ' + comboInclui(p) + '.' : p.descricao) + '</div>' +
      '<div style="font-size:20px;font-weight:700">' + M(p.preco) + '</div></div>';

    var grupos = (p.grupos || []).filter(function (gid) { return G[gid]; });
    if (grupos.length) {
      h += '<div style="padding:14px 20px 0;font-size:17px;font-weight:700">Monte do seu jeito</div>' +
        '<div style="padding:10px 20px 0;display:flex;flex-direction:column;gap:12px">' + grupos.map(function (gid) {
          var g = G[gid], cur = S.sel[gid] || [], semEscolha = falta.indexOf(gid) >= 0, lim = limites(g);
          return '<div id="grupo-' + esc(gid) + '" style="background:#fff;border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:12px' + (semEscolha ? ';box-shadow:0 0 0 1px #E6A5A5' : '') + '">' +
            '<div style="display:flex;align-items:center;gap:10px"><div style="flex:1;display:flex;flex-direction:column;gap:2px">' +
            '<div style="font-size:15px;font-weight:600">' + esc(g.titulo) + '</div>' +
            '<div style="font-size:12px;color:' + (semEscolha ? '#B91C1C' : '#6B635C') + '">' + (semEscolha ? (lim.min > 1 ? 'Escolha pelo menos ' + lim.min + ' opções para continuar' : 'Escolha uma opção para continuar') : textoLimite(g)) + '</div></div>' +
            (lim.min > 0 ? '<span style="height:24px;padding:0 10px;border-radius:12px;background:' + (semEscolha ? '#FDECEC' : '#EFEAE4') + ';font-size:11px;font-weight:600;display:flex;align-items:center;color:' + (semEscolha ? '#B91C1C' : '#57504A') + '">Obrigatório</span>' : '') +
            '</div><div style="display:flex;flex-wrap:wrap;gap:8px">' + (g.opcoes || []).map(function (o, oi) {
              var on = cur.indexOf(o.nome) >= 0, k = chip(on);
              return '<button data-a="opt" data-v="' + esc(gid) + '" data-o="' + oi + '" style="min-height:42px;padding:0 14px;border-radius:21px;border:1px solid ' + k.bd + ';background:' + k.bg + ';color:' + k.fg + ';font-size:14px;font-weight:500;display:flex;align-items:center;gap:6px;cursor:pointer">' +
                (on ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12.5 10 17 19 7"></path></svg>' : '') +
                '<span>' + esc(o.nome) + '</span>' +
                (o.preco ? '<span style="font-weight:600;color:' + (on ? '#D6CFC8' : '#57504A') + '">+ ' + M(o.preco) + '</span>' : '') + '</button>';
            }).join('') + '</div></div>';
        }).join('') + '</div>';
    }

    h += '<div style="padding:16px 20px 0;display:flex;flex-direction:column;gap:8px">' +
      '<label for="det-obs" style="font-size:15px;font-weight:600">Alguma observação?</label>' +
      '<textarea id="det-obs" data-f="detObs" rows="2" placeholder="Ex: pão sem gergelim, molho à parte…" style="border:1px solid #E0D9D1;border-radius:14px;padding:12px 14px;font-size:15px;background:#fff;resize:none;outline:0;color:#1C1917">' + esc(S.detObs) + '</textarea></div>' +
      '<div style="position:sticky;bottom:0;background:#F7F4F0;margin-top:16px;padding:12px 20px calc(16px + env(safe-area-inset-bottom));display:flex;gap:12px;align-items:center;box-shadow:0 -1px 0 #E8E2DB">' +
      '<div style="display:flex;align-items:center;gap:4px;background:#fff;border:1px solid #E0D9D1;border-radius:28px;height:56px;padding:0 6px">' +
      '<button data-a="detDec" aria-label="Menos" style="width:44px;height:44px;border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C1917" stroke-width="2.2"><path d="M5 12h14"></path></svg></button>' +
      '<span style="min-width:20px;text-align:center;font-weight:700;font-size:16px">' + S.detQty + '</span>' +
      '<button data-a="detInc" aria-label="Mais" style="width:44px;height:44px;border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C1917" stroke-width="2.2"><path d="M12 5v14M5 12h14"></path></svg></button></div>' +
      '<button data-a="detAdd" aria-disabled="' + (!ok) + '" style="flex:1;height:56px;border-radius:28px;border:0;background:' + (ok ? 'var(--cor)' : '#DDD6CE') + ';color:' + (ok ? '#fff' : '#6B635C') + ';font-size:16px;font-weight:600;cursor:pointer">' + (disp ? 'Adicionar • ' + M(unit(p, S.sel) * S.detQty) : 'Esgotado') + '</button></div></div>';
    return h;
  }

  function renderSacola(c) {
    var f = c.f, aberto = c.st.aberto;
    var h = '<div data-k="cart-bg" data-a="closeCart" style="position:fixed;inset:0;background:rgba(20,14,10,.5);z-index:20"></div>' +
      '<div data-k="cart" style="position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;max-height:94%;overflow-y:auto;background:#F7F4F0;border-radius:28px 28px 0 0;z-index:21">' +
      '<div style="position:sticky;top:0;background:#F7F4F0;padding:18px 20px 12px;display:flex;align-items:center;justify-content:space-between;z-index:1">' +
      '<div style="font-size:20px;font-weight:700">Sua sacola</div>' +
      '<button data-a="closeCart" aria-label="Fechar" style="width:44px;height:44px;border-radius:50%;border:0;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 0 0 1px rgba(0,0,0,.05)">' + X_ICON + '</button></div>' +
      '<div style="padding:0 20px;display:flex;flex-direction:column;gap:10px">';

    h += c.itens.map(function (i) {
      var p = i.p, l = i.l, d = desc(p, l.sel), k = esc(l.key);
      return '<div data-k="it-' + k + '" style="background:#fff;border-radius:18px;padding:12px;display:flex;gap:12px">' +
        '<div style="width:60px;height:60px;border-radius:12px;overflow:hidden;background:#EFEAE4;flex-shrink:0"><img src="' + esc(p.imagem) + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block"></div>' +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">' +
        '<div style="display:flex;align-items:flex-start;gap:6px"><div style="flex:1;font-size:15px;font-weight:600;padding-top:2px">' + esc(p.nome) + '</div>' +
        '<button data-a="lineDel" data-v="' + k + '" aria-label="Remover item" style="width:40px;height:40px;margin:-8px -8px 0 0;border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6B635C" stroke-width="2"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path></svg></button></div>' +
        (d ? '<div style="font-size:12px;color:#6B635C;line-height:1.4">' + esc(d) + '</div>' : '') +
        (l.obs ? '<div style="font-size:12px;color:#6B635C;line-height:1.4">Obs: ' + esc(l.obs) + '</div>' : '') +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px"><div style="font-size:15px;font-weight:600">' + M(i.total) + '</div>' +
        '<div style="display:flex;align-items:center;gap:2px;border:1px solid #E0D9D1;border-radius:22px;height:40px;padding:0 2px">' +
        '<button data-a="lineDec" data-v="' + k + '" aria-label="Menos" style="width:36px;height:36px;border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1C1917" stroke-width="2.4"><path d="M5 12h14"></path></svg></button>' +
        '<span style="min-width:16px;text-align:center;font-weight:700;font-size:14px">' + l.qty + '</span>' +
        '<button data-a="lineInc" data-v="' + k + '" aria-label="Mais" style="width:36px;height:36px;border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1C1917" stroke-width="2.4"><path d="M12 5v14M5 12h14"></path></svg></button>' +
        '</div></div></div></div>';
    }).join('');

    var tipo = function (t) { return (c.entrega ? 'entrega' : 'retirada') === t ? 'background:#fff;color:#1C1917' : 'background:transparent;color:#6B635C'; };
    if (PODE_ENTREGA && PODE_RETIRADA) h += '<div style="font-size:15px;font-weight:700;margin-top:14px">Como quer receber?</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;background:#EFEAE4;border-radius:26px;padding:4px;gap:4px">' +
      '<button data-a="tipo" data-v="entrega" style="height:44px;border-radius:22px;border:0;' + tipo('entrega') + ';font-size:14px;font-weight:600;cursor:pointer">Entrega</button>' +
      '<button data-a="tipo" data-v="retirada" style="height:44px;border-radius:22px;border:0;' + tipo('retirada') + ';font-size:14px;font-weight:600;cursor:pointer">Retirar no local</button></div>';

    else h += '<div style="font-size:15px;font-weight:700;margin-top:14px">' + (PODE_ENTREGA ? 'Entrega' : 'Retirada no local') + '</div>';
    if (!c.entrega) {
      h += '<div style="background:#fff;border-radius:18px;padding:14px;display:flex;gap:12px;align-items:flex-start">' +
        '<span style="width:40px;height:40px;border-radius:50%;background:#EFEAE4;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C1917" stroke-width="2"><path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"></path></svg></span>' +
        '<div style="display:flex;flex-direction:column;gap:3px;min-width:0">' +
        '<div style="font-size:14px;font-weight:600">Retirar em ' + esc(L.nome) + '</div>' +
        '<div style="font-size:13px;color:#57504A;line-height:1.4">' + esc(L.endereco) + '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;margin-top:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>Pronto em ' + esc(L.tempoRetirada) + '</div></div></div>';
    }

    h += '<input data-f="nome" value="' + esc(f.nome) + '" autocomplete="name" placeholder="Seu nome" style="height:52px;border:1px solid #E0D9D1;border-radius:14px;padding:0 14px;font-size:15px;background:#fff;outline:0;color:#1C1917;margin-top:4px">';
    if (c.entrega) {
      h += '<textarea data-f="endereco" autocomplete="street-address" rows="2" placeholder="Endereço completo (rua, número, bairro, complemento)" style="border:1px solid #E0D9D1;border-radius:14px;padding:14px;font-size:15px;background:#fff;resize:none;outline:0;color:#1C1917;width:100%">' + esc(f.endereco) + '</textarea>';
    }

    h += '<div style="font-size:15px;font-weight:700;margin-top:14px">Pagamento</div><div style="display:flex;flex-wrap:wrap;gap:8px">' +
      (L.pagamentos || []).map(function (nome) {
        var k = chip(nome === f.pagamento);
        return '<button data-a="pag" data-v="' + esc(nome) + '" style="height:42px;padding:0 16px;border-radius:21px;border:1px solid ' + k.bd + ';background:' + k.bg + ';color:' + k.fg + ';font-size:14px;font-weight:500;cursor:pointer">' + esc(nome) + '</button>';
      }).join('') + '</div>';
    if (c.dinheiro) {
      h += '<input data-f="troco" inputmode="numeric" value="' + esc(f.troco) + '" placeholder="Troco para quanto?" style="height:52px;border:1px solid ' + (c.trocoErro ? '#E6A5A5' : '#E0D9D1') + ';border-radius:14px;padding:0 14px;font-size:15px;background:#fff;outline:0;color:#1C1917">';
      if (c.trocoErro) h += '<div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#B91C1C;padding:0 4px">' + ERR_ICON + esc(c.trocoErro) + '</div>';
    }
    h += '<textarea data-f="obs" rows="2" placeholder="Observações do pedido (opcional)" style="border:1px solid #E0D9D1;border-radius:14px;padding:14px;font-size:15px;background:#fff;resize:none;outline:0;color:#1C1917;margin-top:6px">' + esc(f.obs) + '</textarea>';

    h += '<div style="font-size:15px;font-weight:700;margin-top:14px">Cupom de desconto</div>';
    if (!S.cupom) {
      h += '<div style="display:flex;gap:8px;height:52px;background:#fff;border:1px solid ' + (S.cupomErro ? '#E6A5A5' : '#E0D9D1') + ';border-radius:14px;padding:4px 4px 4px 14px;align-items:center">' +
        '<input data-f="cupomIn" value="' + esc(S.cupomIn) + '" autocapitalize="characters" enterkeyhint="done" placeholder="Digite o código" style="flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:15px;color:#1C1917;text-transform:uppercase;letter-spacing:.04em">' +
        '<button data-a="aplicarCupom" style="height:42px;padding:0 18px;border-radius:11px;border:0;background:var(--cor2);color:#fff;font-size:14px;font-weight:600;cursor:pointer">Aplicar</button></div>';
      if (S.cupomErro) h += '<div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#B91C1C;padding:0 4px">' + ERR_ICON + esc(S.cupomErro) + '</div>';
    } else {
      h += '<div style="display:flex;gap:10px;min-height:52px;background:#fff;border:1px solid ' + (c.cp ? '#BBDCC6' : '#E6A5A5') + ';border-radius:14px;padding:4px 4px 4px 14px;align-items:center">' +
        (c.cp ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2.4" style="flex-shrink:0"><path d="M5 12.5 10 17 19 7"></path></svg>' : '<span style="color:#B91C1C;display:flex">' + ERR_ICON + '</span>') +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px;font-weight:700;letter-spacing:.04em">' + esc(S.cupom) + '</span>' +
        (c.cp ? '<span style="font-size:12px;color:#15803D">' + (c.cp.tipo === 'percentual' ? c.cp.valor + '% de desconto aplicado' : M(c.cp.valor) + ' de desconto aplicado') + '</span>'
          : '<span style="font-size:12px;color:#B91C1C">' + esc(c.cupomAviso) + '</span>') + '</div>' +
        '<button data-a="removerCupom" style="height:42px;padding:0 14px;border-radius:11px;border:0;background:transparent;color:#57504A;font-size:13px;font-weight:600;cursor:pointer">Remover</button></div>';
    }

    h += '<div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;padding:16px;background:#fff;border-radius:18px;font-size:14px">' +
      '<div style="display:flex;justify-content:space-between;color:#57504A"><span>Subtotal</span><span>' + M(c.subtotal) + '</span></div>' +
      (c.entrega ? '<div style="display:flex;justify-content:space-between;color:#57504A"><span>Taxa de entrega</span><span>' + M(c.taxa) + '</span></div>' : '') +
      (c.cp ? '<div style="display:flex;justify-content:space-between;color:#15803D;font-weight:500"><span>Desconto</span><span>- ' + M(c.desconto) + '</span></div>' : '') +
      '<div style="display:flex;justify-content:space-between;font-size:17px;font-weight:700;padding-top:8px;border-top:1px solid #EFEAE4"><span>Total</span><span>' + M(c.total) + '</span></div></div></div>';

    var label = aberto ? 'Enviar pedido no WhatsApp' : (c.st.prox ? 'Agendar para ' + quando(c.st.prox) : 'Agendar pedido');
    h += '<div style="position:sticky;bottom:0;background:#F7F4F0;padding:14px 20px calc(16px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:8px;margin-top:6px">' +
      (c.hint ? '<div style="font-size:13px;color:var(--escuro);text-align:center">' + esc(c.hint) + '</div>' : '') +
      (c.canSend
        ? '<a data-a="enviar" href="' + esc(waLink(mensagem(c))) + '" target="_blank" rel="noopener" style="height:58px;border-radius:29px;background:#128C4A;color:#fff;display:flex;align-items:center;justify-content:center;gap:10px;font-size:16px;font-weight:600">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="' + WA_PATH + '"></path></svg>' + esc(label) + '</a>'
        : '<div style="height:58px;border-radius:29px;background:#DDD6CE;color:#6B635C;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600">' + esc(label) + '</div>') +
      '</div></div>';
    return h;
  }

  // ---------------------------------------------------------------- DOM: aplica o HTML novo sem perder foco nem cursor
  function mesmo(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (a.nodeType !== 1) return true;
    return a.tagName === b.tagName && a.getAttribute('data-k') === b.getAttribute('data-k');
  }
  function syncEl(a, b) {
    var i, at;
    for (i = a.attributes.length - 1; i >= 0; i--) { at = a.attributes[i].name; if (!b.hasAttribute(at)) a.removeAttribute(at); }
    for (i = 0; i < b.attributes.length; i++) { at = b.attributes[i]; if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value); }
    if (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') {
      var v = a.tagName === 'INPUT' ? (b.getAttribute('value') || '') : b.textContent;
      if (a !== document.activeElement && a.value !== v) a.value = v;
      return;
    }
    syncKids(a, b);
  }
  function syncKids(pa, pb) {
    var a = pa.firstChild, b = pb.firstChild;
    while (b) {
      var nb = b.nextSibling;
      if (!a) { pa.appendChild(b); }
      else if (mesmo(a, b)) {
        if (a.nodeType === 1) syncEl(a, b); else if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
        a = a.nextSibling;
      } else if (a.nextSibling && mesmo(a.nextSibling, b) && !(nb && mesmo(a, nb))) {
        var morto = a; a = a.nextSibling; pa.removeChild(morto); continue;
      } else if (nb && mesmo(a, nb)) {
        pa.insertBefore(b, a);
      } else {
        var velho = a; a = a.nextSibling; pa.replaceChild(b, velho);
      }
      b = nb;
    }
    while (a) { var n = a.nextSibling; pa.removeChild(a); a = n; }
  }
  var tpl = document.createElement('template');
  function patch(el, html) { tpl.innerHTML = html; syncKids(el, tpl.content); }

  // ---------------------------------------------------------------- eventos
  var acoes = {
    cat: function (v) { set({ cat: v }); },
    open: function (v) { openDetail(BY_ID[v]); },
    add: function (v) {
      var p = BY_ID[v];
      if (!disponivel(p)) return openDetail(p);
      if ((p.grupos || []).length) return openDetail(p);
      addLine(p.id, 1, {}, ''); flash(p.nome + ' adicionado');
    },
    inc: function (v) { var p = BY_ID[v]; if (!disponivel(p)) return; if ((p.grupos || []).length) openDetail(p); else addLine(p.id, 1, {}, ''); },
    dec: function (v) { decProduct(v); },
    repetir: function () {
      (S.ultimo || []).filter(function (l) { return disponivel(BY_ID[l.id]); }).forEach(function (l) { addLine(l.id, l.qty, l.sel, l.obs); });
      flash('Itens adicionados à sacola');
    },
    openCart: function () { set({ cartOpen: true }); },
    closeCart: function () { set({ cartOpen: false }); },
    closeDetail: function () { set({ detail: null }); },
    opt: function (gid, el) {
      var g = G[gid], o = g.opcoes[+el.getAttribute('data-o')], cur = S.sel[gid] || [], max = limites(g).max;
      if (g.tipo !== 'unico' && max && cur.indexOf(o.nome) < 0 && cur.length >= max) return flash('Máximo de ' + max + (max === 1 ? ' opção' : ' opções'));
      var nx = g.tipo === 'unico' ? [o.nome] : (cur.indexOf(o.nome) >= 0 ? cur.filter(function (x) { return x !== o.nome; }) : cur.concat(o.nome));
      var sel = Object.assign({}, S.sel); sel[gid] = nx; set({ sel: sel });
    },
    detInc: function () { set({ detQty: S.detQty + 1 }); },
    detDec: function () { set({ detQty: Math.max(1, S.detQty - 1) }); },
    detAdd: function () {
      var p = BY_ID[S.detail], falta = faltando(p, S.sel);
      if (!disponivel(p)) return;
      if (falta.length) {
        flash('Escolha: ' + G[falta[0]].titulo);
        var g = document.getElementById('grupo-' + falta[0]);
        if (g) g.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      addLine(p.id, S.detQty, S.sel, S.detObs.trim());
      set({ detail: null });
      flash(p.nome + ' adicionado');
    },
    lineInc: function (k) { changeLine(k, 1); },
    lineDec: function (k) { changeLine(k, -1); },
    lineDel: function (k) { var l = S.lines.find(function (x) { return x.key === k; }); if (l) changeLine(k, -l.qty); },
    tipo: function (v) { setForm('tipo', v); },
    pag: function (v) { setForm('pagamento', v); },
    aplicarCupom: function () {
      var cod = S.cupomIn.trim().toUpperCase();
      if (!cod) return;
      var erro = erroCupom(cod, calc().subtotal);
      if (!erro) set({ cupom: cod, cupomErro: '' });
      else set({ cupomErro: erro });
    },
    removerCupom: function () { set({ cupom: '', cupomIn: '' }); },
    enviar: function (v, el) {
      var c = calc();
      if (!c.canSend) return;
      el.setAttribute('href', waLink(mensagem(c)));   // horário da mensagem sempre atual
      var lines = S.lines, wa = el.getAttribute('href'), agend = !c.st.aberto;
      setTimeout(function () {
        set({ enviado: true, enviadoAgendado: agend, lastWa: wa, ultimo: lines, lines: [], cartOpen: false, cupom: '', cupomIn: '',
          form: Object.assign({}, S.form, { obs: '' }) });
      }, 300);
    },
    voltar: function () { set({ enviado: false }); }
  };

  root.addEventListener('click', function (e) {
    var el = e.target.closest('[data-a]');
    if (!el || !root.contains(el)) return;
    var fn = acoes[el.getAttribute('data-a')];
    if (fn) fn(el.getAttribute('data-v'), el, e);
  });
  root.addEventListener('input', function (e) {
    var el = e.target, k = el.getAttribute('data-f');
    if (!k) return;
    var v = el.value;
    if (k === 'q') set({ q: v });
    else if (k === 'detObs') set({ detObs: v });
    else if (k === 'cupomIn') set({ cupomIn: v, cupomErro: '' });
    else if (k === 'troco') {
      var m = mascaraReais(v);
      if (m !== v) { el.value = m; try { el.setSelectionRange(m.length, m.length); } catch (x) {} }
      setForm('troco', m);
    } else setForm(k, v);
  });
  root.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var k = e.target.getAttribute('data-f');
    if (k === 'cupomIn') { e.preventDefault(); acoes.aplicarCupom(); }
    else if (k === 'q' || k === 'nome' || k === 'troco') e.target.blur();
  });

  render();
  setInterval(render, 30000);   // mantém o status aberto/fechado em dia
  // Volta de outro app (ex.: WhatsApp/Instagram): recalcula horário
  document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
})();
