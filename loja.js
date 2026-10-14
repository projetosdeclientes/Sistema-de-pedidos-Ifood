// ============================================================
//  CONFIGURAÇÃO DA LOJA — gerada pelo Admin em 29/09/2026 às 18:01
//  Para mudar, edite a loja no admin e exporte de novo.
// ============================================================
window.LOJA = {
  "nome": "Hamburguer da tia",
  "slug": "hamburguer-da-tia",
  "logo": "assets/logo.webp",
  "favicon": "assets/icone.png",
  "whatsapp": "5511987463637",
  "endereco": "rua 10",
  "cores": {
    "principal": "#E8590C",
    "secundaria": "#1C1917",
    "escuro": "#8A3B12"
  },
  "layout": "lista",
  "mostrarBanner": true,
  "fuso": "America/Sao_Paulo",
  "horarios": {
    "dom": [
      "18:00-23:00"
    ],
    "seg": [],
    "ter": [
      "18:00-23:00"
    ],
    "qua": [
      "18:00-23:00"
    ],
    "qui": [
      "18:00-23:00"
    ],
    "sex": [
      "18:00-23:00"
    ],
    "sab": [
      "18:00-23:00"
    ]
  },
  "fechadoManual": false,
  "tempoEntrega": "30 a 45 min",
  "tempoRetirada": "20 a 30 min",
  "aceitaEntrega": true,
  "aceitaRetirada": true,
  "taxaEntrega": 0,
  "pedidoMinimo": 0,
  "pagamentos": [
    "Pix",
    "Dinheiro",
    "Crédito",
    "Débito"
  ],
  "cupons": {},
  "banner": {
    "titulo": "",
    "subtitulo": "",
    "imagem": ""
  },
  "seo": {
    "titulo": "Hamburguer da tia",
    "descricao": "",
    "imagem": "assets/compartilhar.jpg",
    "url": ""
  },
  "urlPadrao": "https://{slug}.netlify.app",
  "categorias": [
    "Burgers",
    "Bebidas"
  ],
  "grupos": {
    "ponto": {
      "titulo": "Ponto da carne",
      "tipo": "unico",
      "estilo": "escolha",
      "obrigatorio": true,
      "padrao": "Ao ponto",
      "opcoes": [
        {
          "nome": "Mal passado"
        },
        {
          "nome": "Ao ponto"
        },
        {
          "nome": "Bem passado"
        }
      ]
    },
    "adicionais": {
      "titulo": "Adicionais",
      "tipo": "multiplo",
      "estilo": "adicional",
      "prefixo": "+ ",
      "opcoes": [
        {
          "nome": "Bacon",
          "preco": 4
        },
        {
          "nome": "Queijo extra",
          "preco": 4
        }
      ]
    },
    "remover": {
      "titulo": "Remover",
      "tipo": "multiplo",
      "estilo": "remocao",
      "opcoes": [
        {
          "nome": "Sem cebola"
        },
        {
          "nome": "Sem tomate"
        },
        {
          "nome": "Sem molho"
        }
      ]
    }
  },
  "produtos": [
    {
      "id": "pphtag1",
      "categoria": "Burgers",
      "nome": "Hamburguer grande",
      "preco": 35.97,
      "grupos": [
        "ponto",
        "adicionais",
        "remover"
      ],
      "descricao": "teste",
      "imagem": "assets/produtos/hamburguer-grande.webp"
    },
    {
      "id": "pprlhlm",
      "categoria": "Bebidas",
      "nome": "Refrigerante",
      "preco": 16.99,
      "descricao": "sadfadf",
      "imagem": "assets/produtos/hamburguer-grande.webp"
    }
  ]
};
