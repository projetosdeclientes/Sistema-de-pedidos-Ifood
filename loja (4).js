// ============================================================
//  CONFIGURAÇÃO DA LOJA — edite só este arquivo para cada cliente
// ============================================================
window.LOJA = {
  nome: "Brasa Burger",
  slug: "brasa-burger",           // nome do link: só letras minúsculas, números e hífen
  logo: "",                       // ex: "assets/logo.webp". Vazio = mostra as iniciais do nome
  favicon: "",                    // ícone da aba. Vazio = usa a logo ou as iniciais na cor principal
  whatsapp: "5511999999999",      // DDI + DDD + número, só dígitos
  endereco: "Rua das Palmeiras, 120 - Centro",

  cores: {
    principal: "#E8590C",         // botões de ação, preços em destaque, selos
    secundaria: "#1C1917",        // seleção (chips), barra da sacola, botões escuros — use um tom escuro
    escuro: "#8A3B12"             // detalhes: categoria do produto e avisos da sacola
  },
  layout: "lista",                // "lista" ou "grade"
  mostrarBanner: true,

  // ---------- Horário de funcionamento (horário de Brasília) ----------
  // Um ou mais intervalos por dia. [] = fechado o dia todo.
  // Passa da meia-noite? Basta pôr o fim menor que o início: "18:00-02:00".
  fuso: "America/Sao_Paulo",
  horarios: {
    dom: ["18:00-23:00"],
    seg: [],
    ter: ["18:00-23:00"],
    qua: ["18:00-23:00"],
    qui: ["18:00-23:00"],
    sex: ["18:00-01:00"],
    sab: ["18:00-01:00"]
  },
  fechadoManual: false,           // true = fecha agora (feriado, imprevisto). Pedidos viram agendados

  tempoEntrega: "30 a 45 min",
  tempoRetirada: "20 a 30 min",
  taxaEntrega: 6.9,               // 0 = "Grátis"
  pedidoMinimo: 25,               // só para entrega. 0 = sem mínimo
  pagamentos: ["Pix", "Dinheiro", "Crédito", "Débito"],   // "Dinheiro" mostra o campo de troco
  cupons: {                       // CÓDIGO: { tipo: "percentual" | "fixo", valor }
    PRIMEIRA10: { tipo: "percentual", valor: 10 },
    BRASA5: { tipo: "fixo", valor: 5 }
  },
  banner: {
    titulo: "Combo da casa com 15% off",
    subtitulo: "Toda terça e quarta",
    imagem: "assets/banner.webp"
  },

  // ---------- Compartilhamento e busca ----------
  seo: {
    titulo: "Brasa Burger - Peça pelo WhatsApp",
    descricao: "Burgers artesanais, combos e porções. Monte seu pedido e envie direto pelo WhatsApp.",
    imagem: "assets/compartilhar.jpg",   // 1200x630, JPG ou PNG
    url: ""                              // endereço final do site. Vazio = usa o urlPadrao abaixo
  },
  urlPadrao: "https://{slug}.netlify.app", // modelo de endereço; {slug} vira o slug da loja

  // ---------- Grupos de opções reutilizáveis ----------
  // Ligue a um produto pelo campo "grupos".
  // tipo: "unico" (escolhe 1) ou "multiplo" (quantos quiser)
  // estilo na mensagem: "escolha" (Título: opção), "adicional" (+ opção) ou "remocao" (- opção)
  // obrigatorio: true = o cliente precisa escolher antes de adicionar. padrao = já vem marcado
  grupos: {
    ponto: { titulo: "Ponto da carne", tipo: "unico", estilo: "escolha", obrigatorio: true, padrao: "Ao ponto",
      opcoes: [{ nome: "Mal passado" }, { nome: "Ao ponto" }, { nome: "Bem passado" }] },
    adicionais: { titulo: "Adicionais", tipo: "multiplo", estilo: "adicional", prefixo: "+ ",
      opcoes: [{ nome: "Bacon", preco: 4 }, { nome: "Dobro de queijo", preco: 5 }, { nome: "Ovo", preco: 3 }, { nome: "Cebola caramelizada", preco: 3.5 }] },
    remover: { titulo: "Remover", tipo: "multiplo", estilo: "remocao",
      opcoes: [{ nome: "Sem cebola" }, { nome: "Sem tomate" }, { nome: "Sem alface" }, { nome: "Sem molho" }] },
    refri: { titulo: "Sabor do refrigerante", tipo: "unico", estilo: "escolha", obrigatorio: true,
      opcoes: [{ nome: "Coca-Cola" }, { nome: "Guaraná" }, { nome: "Sprite" }] },
    suco: { titulo: "Sabor do suco", tipo: "unico", estilo: "escolha", obrigatorio: true,
      opcoes: [{ nome: "Laranja" }, { nome: "Limão" }, { nome: "Maracujá" }] }
  },

  // ---------- Cardápio ----------
  // Combo: tipo "combo" + "itens" (ids dos produtos incluídos).
  // O preço cheio riscado é a soma dos itens; "preco" é o valor do combo.
  // destaque: true = aparece em "Mais pedidos"
  produtos: [
    { id: "c1", tipo: "combo", categoria: "Combos", nome: "Combo Clássico", preco: 51.5,
      itens: [{ id: "b1" }, { id: "p1" }, { id: "d1" }], grupos: ["ponto", "remover", "refri"],
      descricao: "O mais pedido da casa, com batata e bebida.",
      imagem: "assets/produtos/combo-classico.webp" },
    { id: "c2", tipo: "combo", categoria: "Combos", nome: "Combo Duplo", preco: 59.9,
      itens: [{ id: "b2" }, { id: "p2" }, { id: "d2" }], grupos: ["ponto", "remover", "suco"],
      descricao: "Para quem chega com fome.",
      imagem: "assets/produtos/duplo-cheddar.webp" },
    { id: "b1", categoria: "Burgers", nome: "Clássico da Brasa", preco: 32.9, destaque: true, grupos: ["ponto", "adicionais", "remover"],
      descricao: "Blend 160g, queijo cheddar, alface, tomate e molho da casa no pão brioche.",
      imagem: "assets/produtos/classico-da-brasa.webp" },
    { id: "b2", categoria: "Burgers", nome: "Duplo Cheddar", preco: 41.9, destaque: true, grupos: ["ponto", "adicionais", "remover"],
      descricao: "Dois blends de 120g, cheddar duplo, cebola caramelizada e bacon crocante.",
      imagem: "assets/produtos/duplo-cheddar.webp" },
    { id: "b3", categoria: "Burgers", nome: "Smash Simples", preco: 24.9, grupos: ["ponto", "adicionais", "remover"],
      descricao: "Smash 90g, queijo prato e picles no pão de batata.",
      imagem: "assets/produtos/smash-simples.webp" },
    { id: "p1", categoria: "Porções", nome: "Batata Rústica", preco: 22.0, destaque: true,
      descricao: "Batatas com casca, alecrim e maionese defumada. Serve 2.",
      imagem: "assets/produtos/batata-rustica.webp" },
    { id: "p2", categoria: "Porções", nome: "Onion Rings", preco: 19.9,
      descricao: "Anéis de cebola empanados, acompanha molho barbecue.",
      imagem: "assets/produtos/onion-rings.webp" },
    { id: "d1", categoria: "Bebidas", nome: "Refrigerante lata", preco: 6.5, grupos: ["refri"],
      descricao: "Lata 350ml. Coca-Cola, Guaraná ou Sprite.",
      imagem: "assets/produtos/refrigerante-lata.webp" },
    { id: "d2", categoria: "Bebidas", nome: "Suco natural 500ml", preco: 11.0, grupos: ["suco"],
      descricao: "Laranja, limão ou maracujá.",
      imagem: "assets/produtos/suco-natural.webp" },
    { id: "s1", categoria: "Sobremesas", nome: "Brownie com sorvete", preco: 18.0,
      descricao: "Brownie de chocolate meio amargo com bola de sorvete de creme.",
      imagem: "assets/produtos/brownie.webp" }
  ]
};
