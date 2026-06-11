<div align="center">

<img src="./assets/logo-tanarocha.png" alt="TaNaRocha Logo" width="200" />

# TaNaRocha

### Rachadinha? Só da conta. 🪨💸

**Divida contas entre amigos sem briga, sem drama e sem aquele que "manda o Pix depois".**

[![Deploy](https://img.shields.io/badge/deploy-vercel-black?style=for-the-badge&logo=vercel)](https://tanarocha.vercel.app)
[![PWA](https://img.shields.io/badge/PWA-instalável-7C3AED?style=for-the-badge)](https://tanarocha.vercel.app)
[![Lighthouse](https://img.shields.io/badge/Lighthouse-96%2F100-green?style=for-the-badge&logo=lighthouse)](https://tanarocha.vercel.app)

🔗 **[Acessar o app →](https://tanarocha.vercel.app)**

</div>

---

## 📖 Sobre o Projeto

**TaNaRocha** é uma aplicação web mobile-first desenvolvida como projeto final (A3) da disciplina de **Usabilidade, Desenvolvimento Web, Mobile e Jogos** — Unisul.

O projeto nasceu de uma fricção real: grupos de amigos não conseguem dividir despesas de forma simples. O resultado é sempre confusão no WhatsApp, constrangimento e alguém saindo no prejuízo sem perceber.

**Objetivo:** transformar uma tarefa chata em uma experiência rápida, justa e divertida — aplicando princípios de **IHC**, **Mobile First** e **Gamificação**.

---

## 🎯 Problema e Persona

**Problema:** Divisão de contas em grupo gera confusão, constrangimento e calotes silenciosos.

**Persona:** Universitários de 18 a 25 anos que saem frequentemente em grupo — bares, restaurantes, viagens, racha de gasolina — e precisam dividir contas no momento, pelo celular, sem fricção.

---

## ✨ Funcionalidades

### Core
- 🧾 **Dois modos de divisão:** Individual (cada um lança o que consumiu) ou Total (divisão igualitária)
- 🧮 **Liquidação otimizada:** algoritmo que calcula o menor número de transferências necessárias
- ✅ **Controle de pagamento:** marca quem já pagou com feedback visual imediato
- 📤 **Compartilhamento:** copia resumo formatado para o WhatsApp com um toque

### Sistema de Perfis
- 🎨 **Avatares automáticos** com iniciais e cores únicas por participante
- 📊 **Histórico individual** por participante
- 👋 **Sugestão de amigos** ao criar nova rachada

### Sistema de Reputação
- 🎯 **Score 0-100** calculado por taxa de pagamento, consistência e frequência
- 🟢🟡🔴 **Classificação visual:** Confiável, Regular, Caloteiro ou Novo
- 📈 **Tela de detalhe** com gauge animado de score e histórico

### Gamificação
- 🏆 **8 badges desbloqueáveis** com critérios variados
- 🥇 **Pódio do grupo** com ranking visual e animação de coroa
- ⚔️ **Confronto Direto** — compare dois participantes em 7 métricas com textos de zoeira

### Modo Demo
- Popula o app com **5 amigos fictícios e 12 rachadas históricas** prontas para demonstração

---

## 🧠 As 10 Heurísticas de Nielsen

| # | Heurística | Implementação |
|:-:|---|---|
| H1 | Visibilidade do Status | Indicadores em tempo real, gauge animado, progresso visível |
| H2 | Mundo Real | Linguagem brasileira: "Tá na rocha", "Bora rachar", "Quem tá devendo?" |
| H3 | Controle e Liberdade | Botão voltar em todas as telas, desfazer, sair sem perda |
| H4 | Consistência e Padrões | Design system unificado em todo o app |
| H5 | Prevenção de Erros | Botões + e − para valores, validações em tempo real, confirmações |
| H6 | Reconhecimento > Memória | Contexto preservado, chips de sugestão, nomes sempre visíveis |
| H7 | Flexibilidade e Eficiência | 2 modos de divisão, atalhos, drag-to-scroll |
| H8 | Design Minimalista | Cada tela mostra só o essencial |
| H9 | Recuperação de Erros | Mensagens específicas em português, localizadas próximas ao campo |
| H10 | Ajuda e Documentação | Onboarding na primeira abertura, tooltips contextuais |

---

## ✅ Critérios da Auditoria Técnica

| Critério | Evidência |
|---|---|
| ☁️ Deploy público | [tanarocha.vercel.app](https://tanarocha.vercel.app) |
| 💬 Open Graph | Meta tags og:title, og:description e og:image no head |
| 📦 GitHub + README | Este repositório público com documentação completa |
| 💾 Integração de dados | LocalStorage persiste sessões, perfis, badges e histórico |
| ⏳ UX de espera | Skeleton screens, spinners e pull-to-refresh em todas as operações |
| 📱 Mobile First | Layout fluido, bottom navigation, header adaptativo no desktop |
| 👍 Lei de Fitts | Touch targets maiores que 48px, FAB central, zona do polegar respeitada |
| 🛡️ Prevenção de erros | Botões + e −, validação em tempo real, confirmação antes de excluir |
| ♿ Lighthouse > 90 | 96/100 em Acessibilidade (ARIA, contraste, tags semânticas) |
| 🎮 Gamificação | Score 0-100, 8 badges, pódio, confronto direto com zoeira |

---

## 🛠️ Stack Técnica

| Tecnologia | Uso |
|---|---|
| **HTML5** | Estrutura semântica (main, section, nav, article) |
| **CSS3** | Design system com variáveis, animações nativas, Mobile First |
| **JavaScript Vanilla** | Lógica completa sem dependências externas |
| **LocalStorage** | Persistência total no cliente |
| **PWA** | Manifest + Service Worker + cache offline |
| **Vercel** | Deploy contínuo |

Zero dependências externas. Zero custos de infraestrutura. Funciona offline.

---

## 🚀 Como Rodar Localmente

```bash
# Clone o repositório
git clone https://github.com/yorrangodoy/TaNaRocha.git

# Entre na pasta
cd TaNaRocha

# Abra o index.html no navegador
# Ou use um servidor local:
npx serve .
# ou
python -m http.server 8080
```

Recomendado: instale a extensão Live Server no VS Code e clique com botão direito em index.html e selecione "Open with Live Server".

---

## 📁 Estrutura do Projeto

```
TaNaRocha/
├── index.html              # Estrutura semântica com todas as telas
├── manifest.json           # Configuração PWA
├── sw.js                   # Service Worker com cache offline
├── css/
│   └── style.css           # Design system e animações
├── js/
│   └── script.js           # Lógica completa da aplicação
├── assets/
│   ├── logo-tanarocha.png  # Logo oficial
│   └── icons/              # Ícones 3D customizados da navegação
└── README.md
```

---

## 📲 Como Instalar o App (PWA)

**Android (Chrome):** Menu (3 pontinhos) → "Instalar app" ou "Adicionar à tela inicial"

**iOS (Safari):** Botão Compartilhar → "Adicionar à Tela de Início"

**Desktop:** Ícone de instalação na barra de endereço do Chrome ou Edge

---

## 👨‍💻 Equipe

Projeto desenvolvido para a disciplina de **Usabilidade, Desenvolvimento Web, Mobile e Jogos** — Unisul.

| Nome | RA |
|---|---|
| Yorran Luzzi de Godoy | 10723112338 |
| Levi Pfleger dos Santos | 1072310761 |
| Leonardo Augusto Welter Goulart | 1072311129 |

**Desenvolvimento:** Yorran Luzzi de Godoy

**Professores:** Cláudio Henrique da Silva & Rodrigo Brandelero

---

<div align="center">

**Feito com 💜 pra quem cansa de resolver conta no WhatsApp.**

</div>