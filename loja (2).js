// ============================================================
//  CONFIGURAÇÃO DA LOJA — edite só este arquivo para cada cliente
// ============================================================
window.LOJA = {
  nome: "Brasa Burger",
  logo: "",                       // URL da logo (ex: "logo.png"). Vazio = iniciais
  whatsapp: "5511999999999",      // DDI + DDD + número, só dígitos
  endereco: "Rua das Palmeiras, 120 — Centro",
  horario: "18h às 23h",
  aberto: true,                   // false = mostra estado "Fechado" e permite agendar
  abreAs: "18h",
  cor: "#E8590C",                 // cor de destaque da marca
  tempoEntrega: "30 a 45 min",
  tempoRetirada: "20 a 30 min",
  taxaEntrega: 6.9,
  pedidoMinimo: 25,
  pagamentos: ["Pix", "Dinheiro", "Crédito", "Débito"],
  cupons: {                       // código: { tipo: "percentual" | "fixo", valor }
    PRIMEIRA10: { tipo: "percentual", valor: 10 },
    BRASA5: { tipo: "fixo", valor: 5 }
  },
  banner: {
    titulo: "Combo da casa com 15% off",
    subtitulo: "Toda terça e quarta",
    imagem: "https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=900&q=70"
  },
  // Grupos de opções reutilizáveis — ligue a um produto pelo campo "grupos"
  grupos: {
    ponto: { titulo: "Ponto da carne", tipo: "unico", obrigatorio: true, padrao: "Ao ponto",
      opcoes: [{ nome: "Mal passado" }, { nome: "Ao ponto" }, { nome: "Bem passado" }] },
    adicionais: { titulo: "Adicionais", tipo: "multiplo", prefixo: "+ ",
      opcoes: [{ nome: "Bacon", preco: 4 }, { nome: "Dobro de queijo", preco: 5 }, { nome: "Ovo", preco: 3 }, { nome: "Cebola caramelizada", preco: 3.5 }] },
    remover: { titulo: "Remover", tipo: "multiplo",
      opcoes: [{ nome: "Sem cebola" }, { nome: "Sem tomate" }, { nome: "Sem alface" }, { nome: "Sem molho" }] }
  },
  produtos: [
    { id: "c1", categoria: "Combos", nome: "Combo Clássico", preco: 51.5, precoOriginal: 61.4,
      inclui: "Clássico da Brasa + Batata Rústica + Refrigerante lata", grupos: ["ponto", "remover"],
      descricao: "O mais pedido da casa, com batata e bebida.",
      imagem: "https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=900&q=70" },
    { id: "c2", categoria: "Combos", nome: "Combo Duplo", preco: 59.9, precoOriginal: 72.8,
      inclui: "Duplo Cheddar + Onion Rings + Suco natural 500ml", grupos: ["ponto", "remover"],
      descricao: "Para quem chega com fome.",
      imagem: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=900&q=70" },
    { id: "b1", categoria: "Burgers", nome: "Clássico da Brasa", preco: 32.9, destaque: true, grupos: ["ponto", "adicionais", "remover"],
      descricao: "Blend 160g, queijo cheddar, alface, tomate e molho da casa no pão brioche.",
      imagem: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=70" },
    { id: "b2", categoria: "Burgers", nome: "Duplo Cheddar", preco: 41.9, destaque: true, grupos: ["ponto", "adicionais", "remover"],
      descricao: "Dois blends de 120g, cheddar duplo, cebola caramelizada e bacon crocante.",
      imagem: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&q=70" },
    { id: "b3", categoria: "Burgers", nome: "Smash Simples", preco: 24.9, grupos: ["ponto", "adicionais", "remover"],
      descricao: "Smash 90g, queijo prato e picles no pão de batata.",
      imagem: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600&q=70" },
    { id: "p1", categoria: "Porções", nome: "Batata Rústica", preco: 22.0, destaque: true,
      descricao: "Batatas com casca, alecrim e maionese defumada. Serve 2.",
      imagem: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=70" },
    { id: "p2", categoria: "Porções", nome: "Onion Rings", preco: 19.9,
      descricao: "Anéis de cebola empanados, acompanha molho barbecue.",
      imagem: "https://images.unsplash.com/photo-1639024471283-03518883512d?w=600&q=70" },
    { id: "d1", categoria: "Bebidas", nome: "Refrigerante lata", preco: 6.5,
      descricao: "Coca-Cola, Guaraná ou Sprite. Informe o sabor na observação.",
      imagem: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&q=70" },
    { id: "d2", categoria: "Bebidas", nome: "Suco natural 500ml", preco: 11.0,
      descricao: "Laranja, limão ou maracujá.",
      imagem: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&q=70" },
    { id: "s1", categoria: "Sobremesas", nome: "Brownie com sorvete", preco: 18.0,
      descricao: "Brownie de chocolate meio amargo com bola de sorvete de creme.",
      imagem: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&q=70" }
  ]
};
