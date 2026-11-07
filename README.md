# 🚬 Fumódromo da Rita

Aplicação web interativa inspirada na mecânica do **Orelhômetro (`orelhometro.com.br`)**, projetada com estilo editorial **Contemporary Paper-Collage Zine** para monitorar e calcular o consumo de cigarros e gastos da professora Rita a partir do registro manual de maços comprados.

Desenvolvido com carinho por **BIG Solutions**.

---

## 🚀 Funcionalidades

- **Regra de Negócio Precisa:** `1 maço = 20 cigarros`.
- **Palco Visual Interativo:**
  - Cigarro em SVG com física elástica que cresce em escala conforme os maços acumulados no período.
  - Réguas de medição laterais graduadas a partir de `20 cig (1 maço)`.
  - Brasa reativa com partículas de fumaça ao clicar/arrastar.
  - Frases bem-humoradas de matemática no balão da Rita.
- **Visões de Período Obrigatórias:**
  - `Semanal (7d)`, `Quinzenal (15d)`, `Mensal (30d)`, `Trimestral (90d)`, `Semestral (180d)` e `Anual (365d)`.
  - Toggle de **Projeção no Ritmo Atual** baseada na média semanal.
- **Área Administrativa Segura:**
  - Apenas quem possui a senha do Admin pode cadastrar, editar e excluir maços.
  - Acesso público para visualização, simulação e cálculos.
- **Sincronização em Nuvem (Firebase Firestore):**
  - Dados salvos em tempo real: qualquer compra lançada pelo celular ou computador atualiza instantaneamente para todos os visitantes.
- **Gerador de Pôster / Print do Placar (`<canvas>`):**
  - Exportação nos formatos **Feed (1:1)** e **Story (9:16)**.
  - Botão de envio rápido com mensagem pronta para o **WhatsApp**.
- **Calculadora "O Que Virou Fumaça?":**
  - Conversão do valor financeiro gasto em pizzas, compras de supermercado, gasolina e livros de matemática.

---

## 🎨 Paleta de Cores e Estilo

- **Estilo:** Contemporary Zine Paper-Collage
- **Cores Principais:**
  - Base Papel Creme: `#f2e8d5` e `#faf3e3`
  - Vermelho Tomate: `#e04a2a`
  - Azul Piscina: `#2e7fa4`
  - Nanquim Escuro: `#1b1512`
  - Sombra Areia: `#d9c9a3`

---

## 📦 Estrutura dos Arquivos

```text
├── index.html              # Estrutura principal da página
├── style.css               # Estilização completa Zine Paper-Collage
├── script.js               # Lógica, física do cigarro, placar e Firestore
├── firebase-config.js      # Chaves de conexão com o Firebase
├── image-data.js           # Imagem base64 para renderização no Canvas sem CORS
├── fumodromo-rita.png      # Ilustração oficial da Rita com fundo transparente
├── big-solutions.png       # Logo oficial da BIG Solutions
├── .gitignore              # Arquivos ignorados pelo Git
└── README.md               # Documentação do projeto
```

---

## ☁️ Como rodar ou publicar (Vercel / GitHub)

1. Conecte este repositório no [Vercel](https://vercel.com).
2. O Vercel detectará automaticamente como um projeto estático (`HTML/JS/CSS`).
3. Clique em **Deploy** e pronto!
