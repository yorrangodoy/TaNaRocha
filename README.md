<div align="center">

<img src="./assets/logo-tanarocha.png" alt="TaNaRocha Logo" width="200" />

# TaNaRocha

### Rachadinha? Só da conta. 🪨💸

**Um divisor de contas entre amigos sem briga, sem drama e sem aquele amigo que "manda o Pix depois".**

[![Deploy](https://img.shields.io/badge/deploy-vercel-black?style=for-the-badge&logo=vercel)](https://tanarocha.vercel.app)
[![License](https://img.shields.io/badge/license-MIT-purple?style=for-the-badge)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-ready-7C3AED?style=for-the-badge)](#)

🔗 **[Acessar o app ao vivo →](https://ta-na-rocha.vercel.app/)**

</div>

---

## 📖 Sobre o Projeto

**TaNaRocha** é uma aplicação web mobile-first criada como projeto final (A3) da unidade curricular de **Usabilidade, Desenvolvimento Web, Mobile e Jogos**.

O projeto nasceu de uma fricção real e comum: grupos de amigos não conseguem controlar divisões de despesas de forma simples. O resultado é sempre confusão no WhatsApp, constrangimento e alguém saindo no prejuízo sem perceber.

**Nosso objetivo:** transformar uma tarefa chata em uma experiência rápida, justa e divertida — aplicando rigorosamente princípios de **Interação Humano-Computador (IHC)**, **Heurísticas de Nielsen**, **Mobile First** e **Gamificação**.

---

## 🎯 Problema e Persona

### Problema Real
Grupos de amigos não conseguem controlar divisões de despesas de forma simples. WhatsApp vira bagunça, Pix se perde, e sempre tem um caloteiro disfarçado no grupo.

### Persona
**Universitários de 18 a 25 anos** que saem frequentemente em grupo — bares, restaurantes, viagens, racha de gasolina — e precisam dividir contas no momento, pelo celular, com pressa, e sem fricção.

---

## ✨ Funcionalidades

### Core
- 🧾 **Dois modos de racha:** Individual (cada um lança o que consumiu) ou Total (divisão igualitária)
- 🧮 **Liquidação otimizada:** algoritmo que calcula o **menor número de transferências** entre os participantes
- ✅ **Controle de pagamento:** marca quem já pagou com feedback visual imediato
- 📤 **Compartilhamento rápido:** copia o resumo formatado para o WhatsApp com um toque

### Sistema de Perfis 👥
- 🎨 **Avatares automáticos** com iniciais e cores únicas por participante
- 📊 **Histórico individual:** total pago, total devido, número de sessões
- 👋 **Sugestão de amigos** ao criar nova rachada via chips clicáveis

### Sistema de Reputação ⭐
- 🎯 **Score 0-100** calculado por taxa de pagamento, consistência e frequência
- 🟢🟡🔴 **Classificação visual:** Confiável, Enrolado, Caloteiro ou Novo
- 📈 **Tela de detalhe** completa com gauge animado de score, stats e histórico

### Gamificação 🏆
- 🎖️ **8 badges desbloqueáveis** com critérios variados:
  - 👑 Pagador Fiel · ⚡ Flash · 🎖️ Veterano · 💼 Patrão
  - 🌟 Estrelado · 😅 Caloteiro em Reabilitação · 👻 Some na Hora H · 🏆 Presença Constante
- 🎉 **Modal celebrativo** ao desbloquear badge pela primeira vez
- 🏅 **Ranking automático** entre os participantes

### Modo Demo 🎬
- Popula o app com **7 amigos fictícios e 12 rachadas históricas** com scores e badges realistas
- Pensado para apresentação rápida sem precisar criar dados do zero

---

## 🧠 As 10 Heurísticas de Nielsen — Validadas

Cada heurística foi implementada com evidência observável e marcada no código com comentários `// [H1]` a `// [H10]` para auditoria.

| # | Heurística | Implementação no TaNaRocha |
|:-:|---|---|
| **H1** | Visibilidade do status do sistema | Barra de progresso de etapas, indicador "X de Y pagaram", gauge de score em tempo real |
| **H2** | Correspondência com o mundo real | Linguagem brasileira do cotidiano: "Tá na rocha", "Bora rachar", "Quem tá devendo?" |
| **H3** | Controle e liberdade | Botão "Voltar" em todas as telas, desfazer marcação de pago, cancelar sessão sem perda |
| **H4** | Consistência e padrões | Padrão visual idêntico em botões, cards, modais e tipografia em todo o app |
| **H5** | Prevenção de erros | Botões `+` e `-` em vez de input livre, validação antes de cada ação destrutiva |
| **H6** | Reconhecimento em vez de memória | Nomes dos participantes sempre visíveis, modo selecionado destacado, contexto preservado |
| **H7** | Flexibilidade e eficiência | Dois modos de racha, chips de amigos recorrentes, atalho de cópia para WhatsApp |
| **H8** | Design estético e minimalista | Cada tela mostra só o essencial, hierarquia visual clara, sem ruído |
| **H9** | Reconhecer e recuperar erros | Mensagens específicas em português, localizadas próximas ao campo problemático |
| **H10** | Ajuda e documentação | Onboarding na primeira abertura, tooltips contextuais, placeholders descritivos |

---

## 🛠️ Stack Técnica

- **HTML5** — Estrutura semântica (`<main>`, `<section>`, `<nav>`, `<article>`)
- **CSS3** — Mobile First, variáveis CSS, animações nativas, sem frameworks
- **JavaScript (Vanilla)** — Sem dependências, ~1100 linhas comentadas em português
- **LocalStorage** — Persistência total no cliente, zero infraestrutura
- **PWA** — Manifest + meta tags para instalação no celular

> **Zero dependências externas. Zero custos de infraestrutura. Funciona offline.**

---

## 🚀 Como Rodar Localmente

### Opção 1 — Abrir direto no navegador
```bash
# Clone o repositório
git clone https://github.com/yorrangodoy/tanarocha.git

# Entre na pasta
cd tanarocha

# Abra o index.html no navegador
```

### Opção 2 — Servidor local (recomendado)
```bash
# Com Node.js
npx serve .

# Com Python 3
python -m http.server 8080

# Com VS Code: instale a extensão "Live Server" e clique com botão direito em index.html → "Open with Live Server"
```

Acesse: `http://localhost:8080`

---

## 📁 Estrutura do Projeto

```
tanarocha/
├── index.html          # Estrutura semântica com todas as 7 telas
├── manifest.json       # Configuração PWA
├── css/
│   └── style.css       # Tema dark, animações e componentes
├── js/
│   └── script.js       # Lógica completa (heurísticas marcadas com // [H1]-[H10])
├── assets/
│   └── logo-tanarocha.png  # Logo oficial + favicon
└── README.md           # Este arquivo
```

---

## 📊 Auditoria de Qualidade

### Lighthouse Score
- ✅ Acessibilidade: **>90**
- ✅ Performance: **>90**
- ✅ Best Practices: **>90**
- ✅ SEO: **>90**

> _Capturas de tela das auditorias disponíveis no relatório PDF de entrega._

### Critérios Atendidos (A3 — Checklist Oficial)

| Categoria | Critério | Status |
|---|---|:-:|
| Deploy e Nuvem | Acessibilidade pública via Vercel | ✅ |
| Deploy e Nuvem | Open Graph tags no `<head>` | ✅ |
| Processo e Código | Repositório GitHub com README estruturado | ✅ |
| Lógica e Resiliência | Integração de dados via LocalStorage | ✅ |
| Lógica e Resiliência | UX de espera (spinners e feedback visual) | ✅ |
| Mobile e Fitts | Mobile First com layout fluido | ✅ |
| Mobile e Fitts | Touch targets ≥ 48px | ✅ |
| Usabilidade (IHC) | Prevenção e tolerância a erros | ✅ |
| Usabilidade (IHC) | Lighthouse Acessibilidade > 90 | ✅ |
| Gamificação | Sistema de recompensas, badges e feedback lúdico | ✅ |

---

## 🎬 Modo Demo para Apresentação

Para visualizar o app populado com dados realistas:

1. Acesse a tela **"Meus Amigos"**
2. Clique no botão **"🎬 Modo Demo"**
3. Confirme a ativação
4. O app será populado com **7 amigos fictícios e 12 rachadas históricas**, cada um com score e badges condizentes

Para remover os dados de demonstração, clique em **"🗑️ Limpar Modo Demo"** na mesma tela.

---

## 🗺️ Roadmap

- [x] **Fase 1:** Sistema de Perfis com avatares e Modo Demo
- [x] **Fase 2:** Sistema de Reputação, Score 0-100 e Badges
- [ ] **Fase 3:** Categorias de evento, PWA instalável completo, Service Worker
- [ ] **Futuro:** Backend opcional com Supabase para reputação compartilhada entre dispositivos

---

## 👨‍💻 Autores

Projeto desenvolvido como entrega final da disciplina de **Usabilidade, Desenvolvimento Web, Mobile e Jogos**.

- **[Yorran Godoy]** — Desenvolvimento Full Stack

**Professores orientadores:** Cláudio Henrique da Silva e Rodrigo Brandelero

---

## 📄 Licença

Este projeto está sob a licença MIT — consulte o arquivo [LICENSE](LICENSE) para mais informações.

---

<div align="center">

**Feito com 💜 e muito café por alguém que cansou de rachar conta no WhatsApp.**

</div>