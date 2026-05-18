/* ==============================================
   TaNaRocha — Lógica Principal
   Divisor de contas entre amigos
   Stack: HTML + CSS + JS puro + Tailwind CDN
   Estado: LocalStorage
   ============================================== */

'use strict';

// [CACHE_BUST] Força service worker a checar atualização ao carregar
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.update());
  });
}

// -----------------------------------------------
// ESTADO GLOBAL DA APLICAÇÃO
// -----------------------------------------------
const AppState = {
  // Sessão em andamento
  session: {
    eventName: '',
    participants: [],  // [{ id, name, profileId, items: [{ id, name, value }] }]
    mode: null,        // 'individual' | 'total'
    totalValue: 0,
    paidStatus: {},    // { participantId: boolean }
    categoria: 'outro',// ID da categoria selecionada
  },
  // Filtro ativo no histórico
  historicoCategoriaFiltro: 'todas',
  // Histórico persistido
  history: [],         // [ SessionRecord ]
  // Perfis de participantes persistentes
  friends: [],         // [ Participante ]
  // Flag para badge modal
  pendingBadgeUnlock: null,
};

// Tela de retorno para o modo de lançamento
let launchBackTarget = 'screen-modo';

// -----------------------------------------------
// CHAVES DE LOCALSTORE
// -----------------------------------------------
const LS_HISTORY  = 'tanarocha_history';
const LS_ONBOARD  = 'tanarocha_onboarded';
const LS_SESSION  = 'tanarocha_session';
const LS_BADGES   = 'tanarocha_badges_unlocked';
const LS_FRIENDS  = 'tanarocha_friends';

// Paleta de cores para avatares — hash determinístico pelo nome
const AVATAR_COLORS = [
  '#7C3AED', '#A855F7', '#EC4899', '#F59E0B',
  '#10B981', '#3B82F6', '#EF4444', '#14B8A6',
];

// [H5] Categorias de evento — sempre tem padrão "outro"
const CATEGORIES = [
  { id: 'bar',      icon: '🍺', nome: 'Bar',      cor: '#F59E0B' },
  { id: 'comida',   icon: '🍕', nome: 'Comida',   cor: '#EF4444' },
  { id: 'viagem',   icon: '✈️', nome: 'Viagem',   cor: '#3B82F6' },
  { id: 'gasolina', icon: '⛽', nome: 'Gasolina', cor: '#10B981' },
  { id: 'mercado',  icon: '🛒', nome: 'Mercado',  cor: '#A855F7' },
  { id: 'festa',    icon: '🎉', nome: 'Festa',    cor: '#EC4899' },
  { id: 'lazer',    icon: '🎬', nome: 'Lazer',    cor: '#14B8A6' },
  { id: 'outro',    icon: '📦', nome: 'Outro',    cor: '#6B7280' },
];

function getCategoryById(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

// -----------------------------------------------
// UTILITÁRIOS
// -----------------------------------------------

/** Formata número em moeda BRL. [H2] R$ com vírgula */
function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Gera ID único simples */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Mostra toast de feedback. [H1] Feedback imediato */
function showToast(msg, type = 'info', duration = 2800) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  // Força reflow para reiniciar animação
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// -----------------------------------------------
// BOTTOM SHEETS — [H4] padrão mobile-native
// -----------------------------------------------

function openSheet(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeSheet(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
    document.body.style.overflow = '';
  }
}

/** Exibe bottom sheet de confirmação. [H5] Confirma antes de ação destrutiva */
function confirmModal(title, body) {
  return new Promise(resolve => {
    const sheet = document.getElementById('confirm-modal');
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-body').textContent  = body;
    openSheet('confirm-modal');

    const btnOk     = document.getElementById('confirm-modal-confirm');
    const btnCancel = document.getElementById('confirm-modal-cancel');

    function cleanup(result) {
      closeSheet('confirm-modal');
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      sheet.removeEventListener('click', onBackdrop);
      resolve(result);
    }

    const onOk       = () => cleanup(true);
    const onCancel   = () => cleanup(false);
    const onBackdrop = (e) => { if (e.target === sheet) cleanup(false); };

    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    sheet.addEventListener('click', onBackdrop);
  });
}

// -----------------------------------------------
// NAVEGAÇÃO ENTRE TELAS
// -----------------------------------------------

/** Mostra uma tela com transição direcional. [H4] Consistência — todas as navegações usam o mesmo padrão */
function showScreen(screenId, direction = 'forward') {
  const target  = document.getElementById(screenId);
  if (!target) return;

  const current = document.querySelector('.screen:not(.hidden)');

  // Anima saída da tela atual
  if (current && current !== target) {
    const exitClass = direction === 'back' ? 'screen-exit-right' : 'screen-exit-left';
    current.classList.add(exitClass);
    setTimeout(() => {
      current.classList.add('hidden');
      current.classList.remove(exitClass);
      current.style.animation = '';
    }, 210);
  }

  // Remove animação anterior para forçar reinício
  target.style.animation = 'none';
  target.classList.remove('hidden');
  void target.offsetWidth; // reflow

  // [H4] Slide direcional — avançar entra da direita, voltar entra da esquerda
  const animClass = direction === 'back' ? 'screen-slide-back' : 'screen-slide-forward';
  target.classList.add(animClass);
  target.addEventListener('animationend', () => {
    target.classList.remove(animClass);
    target.style.animation = '';
  }, { once: true });

  // Esconde eventuais telas residuais que não eram a "current" detectada
  requestAnimationFrame(() => {
    document.querySelectorAll('.screen').forEach(s => {
      if (s !== target && s !== current) s.classList.add('hidden');
    });
  });

  window.scrollTo({ top: 0, behavior: 'instant' });
  updateProgressBar(screenId);
}

// Mapa de progresso das etapas. [H1] Barra de progresso de etapas
const PROGRESS_MAP = {
  'screen-home':        { step: 0, label: 'Início',                            pct: 0   },
  'screen-nova-sessao': { step: 1, label: 'Etapa 1 de 4 — Configurando sessão', pct: 25  },
  'screen-modo':        { step: 2, label: 'Etapa 2 de 4 — Escolhendo modo',     pct: 50  },
  'screen-individual':  { step: 3, label: 'Etapa 3 de 4 — Lançando itens',      pct: 75  },
  'screen-total':       { step: 3, label: 'Etapa 3 de 4 — Informando total',     pct: 75  },
  'screen-resultado':   { step: 4, label: 'Etapa 4 de 4 — Resultado',            pct: 100 },
  'screen-historico':   { step: 0, label: 'Histórico & Ranking',                 pct: 0   },
  'screen-amigos':      { step: 0, label: 'Meus Amigos',                         pct: 0   },
  'screen-podio':       { step: 0, label: 'Pódio da Galera',                     pct: 0   },
  'screen-confronto':   { step: 0, label: 'Confronto Direto',                    pct: 0   },
};

function updateProgressBar(screenId) {
  const bar       = document.getElementById('progress-bar-container');
  const fill      = document.getElementById('progress-fill');
  const label     = document.getElementById('progress-label');
  const stepLabel = document.getElementById('progress-step');

  const info = PROGRESS_MAP[screenId];
  if (!info || info.pct === 0) {
    bar.classList.add('hidden');
    return;
  }

  bar.classList.remove('hidden');
  fill.style.width  = info.pct + '%';
  label.textContent = info.label;
  stepLabel.textContent = `${info.pct}%`;
}

// -----------------------------------------------
// PERSISTÊNCIA — [H7] Autosave a cada alteração
// -----------------------------------------------

function saveSession() {
  localStorage.setItem(LS_SESSION, JSON.stringify(AppState.session));
}

function loadSession() {
  try {
    const raw = localStorage.getItem(LS_SESSION);
    if (raw) {
      const s = JSON.parse(raw);
      Object.assign(AppState.session, s);
    }
  } catch { /* ignora sessão corrompida */ }
}

function saveHistory() {
  localStorage.setItem(LS_HISTORY, JSON.stringify(AppState.history));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_HISTORY);
    if (raw) AppState.history = JSON.parse(raw);
  } catch { AppState.history = []; }
}

function clearSession() {
  AppState.session = {
    eventName: '',
    participants: [],
    mode: null,
    totalValue: 0,
    paidStatus: {},
    categoria: 'outro',
  };
  localStorage.removeItem(LS_SESSION);
}

// -----------------------------------------------
// CÁLCULO DE RACHADA
// -----------------------------------------------

/** Calcula saldo de cada participante (quanto cada um deve ao grupo) */
function calcBalances() {
  const { participants, mode, totalValue } = AppState.session;

  if (mode === 'total') {
    const share = totalValue / participants.length;
    return participants.map(p => ({ id: p.id, name: p.name, spent: share, share, balance: 0 }));
  }

  // Modo individual
  const totals = participants.map(p => ({
    id: p.id,
    name: p.name,
    spent: p.items.reduce((sum, i) => sum + i.value, 0),
  }));

  const grandTotal = totals.reduce((s, t) => s + t.spent, 0);
  const share      = grandTotal / participants.length;

  return totals.map(t => ({
    ...t,
    share,
    balance: t.spent - share, // positivo = recebe, negativo = deve
  }));
}

/**
 * Algoritmo de liquidação otimizada (greedy).
 * Minimiza o número de transferências.
 * Retorna lista de { from, to, amount }.
 */
function calcTransfers(balances) {
  const eps = 0.001; // tolerância de centavo

  let creditors = balances.filter(b => b.balance >  eps).map(b => ({ ...b, rem: b.balance  }));
  let debtors   = balances.filter(b => b.balance < -eps).map(b => ({ ...b, rem: -b.balance }));

  const transfers = [];

  // [H2] greedy — quem deve paga pra quem recebe
  while (debtors.length > 0 && creditors.length > 0) {
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d.rem, c.rem);

    if (amount > eps) {
      transfers.push({ from: d.name, to: c.name, amount: Math.round(amount * 100) / 100 });
    }

    d.rem -= amount;
    c.rem -= amount;

    if (d.rem < eps) debtors.shift();
    if (c.rem < eps) creditors.shift();
  }

  return transfers;
}

// -----------------------------------------------
// TELA 1 — HOME
// -----------------------------------------------

function initHome() {
  // [H10] Onboarding na primeira abertura
  if (!localStorage.getItem(LS_ONBOARD)) {
    document.getElementById('onboarding-overlay').classList.remove('hidden');
  }

  // Atualiza hint da home
  const hint = document.getElementById('home-hint');
  hint.textContent = AppState.history.length > 0
    ? `${AppState.history.length} rachada${AppState.history.length > 1 ? 's' : ''} no histórico`
    : 'Nenhuma rachada ainda. Bora sair? 🍺';

  // Preenche contadores dos cards de navegação
  const elegiveisParaPodio = AppState.friends.filter(f => f.estatisticas.totalSessoes > 0);
  const podioPreview = document.getElementById('podio-count-preview');
  if (podioPreview) {
    podioPreview.textContent = elegiveisParaPodio.length >= 2
      ? `${elegiveisParaPodio.length} ranqueados`
      : 'sem dados';
  }

  const amigosPreview = document.getElementById('amigos-count-preview');
  if (amigosPreview) {
    const n = AppState.friends.length;
    amigosPreview.textContent = n > 0 ? `${n} cadastrado${n !== 1 ? 's' : ''}` : 'nenhum ainda';
  }

  const historicoPreview = document.getElementById('historico-count-preview');
  if (historicoPreview) {
    const n = AppState.history.length;
    historicoPreview.textContent = n > 0 ? `${n} rachada${n !== 1 ? 's' : ''}` : 'vazio';
  }
}

// -----------------------------------------------
// TELA 2 — NOVA SESSÃO
// -----------------------------------------------

/** Reseta os campos visuais da tela 2 e re-renderiza lista e chips */
function initNovaSessao() {
  const inputEvent       = document.getElementById('input-event-name');
  const inputParticipant = document.getElementById('input-participant-name');

  // Reseta campos e erros ao entrar na tela
  inputEvent.value = AppState.session.eventName || '';
  inputParticipant.value = '';
  document.getElementById('error-event-name').classList.add('hidden');
  document.getElementById('error-participant').classList.add('hidden');
  inputEvent.classList.remove('error');

  renderParticipantList();
  renderCategoryGrid();  // [H5] Grid de categorias com padrão selecionado
  renderChipsSugestao(); // [H7] Chips de sugestão
  updateAvancarButton();
}

function addParticipant(nameOverride) {
  // [FIX] Garante que nameOverride é string — chips passam string, btn passa Event
  const input  = document.getElementById('input-participant-name');
  const errEl  = document.getElementById('error-participant');
  const nomeRaw = (typeof nameOverride === 'string') ? nameOverride : input.value;
  const name   = nomeRaw.trim();

  const viaChip = (typeof nameOverride === 'string');

  // [H9] Mensagens de erro específicas e em português
  if (!name) {
    errEl.textContent = '⚠️ Escreve o nome do participante';
    errEl.classList.remove('hidden');
    if (!viaChip) input.focus();
    return;
  }

  // [H5] Mínimo 2 caracteres
  if (name.length < 2) {
    errEl.textContent = '⚠️ O nome precisa ter pelo menos 2 caracteres';
    errEl.classList.remove('hidden');
    if (!viaChip) input.focus();
    return;
  }

  // [H5] Sem nomes duplicados na sessão
  const isDuplicate = AppState.session.participants.some(
    p => p.name.toLowerCase() === name.toLowerCase()
  );
  if (isDuplicate) {
    errEl.textContent = '⚠️ Esse nome já foi adicionado';
    errEl.classList.remove('hidden');
    if (!viaChip) input.focus();
    return;
  }

  errEl.classList.add('hidden');

  // [FASE 6] Chip de amigo "voa" antes de ser removido da lista — [H1] feedback imediato
  if (viaChip) {
    const chips = document.querySelectorAll('.chip-amigo');
    for (const chip of chips) {
      if (chip.querySelector('span:last-child')?.textContent === name) {
        chip.classList.add('adding');
        break;
      }
    }
  }

  // Busca ou cria perfil persistente — [H7] Eficiência
  const friend = upsertFriend(name);

  AppState.session.participants.push({ id: uid(), name, profileId: friend.id, items: [] });
  saveSession(); // [H7] Autosave
  if (!viaChip) {
    input.value = '';
    input.focus();
  }

  // Aguarda animação do chip antes de re-renderizar (350ms < 420ms da animação)
  const renderDelay = viaChip ? 320 : 0;
  setTimeout(() => {
    renderParticipantList();
    renderChipsSugestao();
    updateAvancarButton();
  }, renderDelay);
}

function removeParticipant(id) {
  AppState.session.participants = AppState.session.participants.filter(p => p.id !== id);
  saveSession();
  renderParticipantList();
  renderChipsSugestao();
  updateAvancarButton();
}

function renderParticipantList() {
  const list  = document.getElementById('participant-list');
  const badge = document.getElementById('participant-count-badge');
  const hint  = document.getElementById('min-participants-hint');
  const count = AppState.session.participants.length;

  badge.textContent = `${count} adicionado${count !== 1 ? 's' : ''}`;

  // [H5] Hint de mínimo
  hint.classList.toggle('hidden', count >= 2);

  list.innerHTML = AppState.session.participants.map(p => `
    <li class="flex items-center gap-2 bg-bg-surface rounded-xl px-3 py-2" role="listitem" style="min-height:48px;">
      ${buildAvatarHTML(p.name, 'sm')}
      <span class="text-sm font-medium flex-1">${escapeHTML(p.name)}</span>
      <!-- [H3] Remover participante antes de avançar -->
      <button
        class="btn-remove-item"
        onclick="removeParticipant('${p.id}')"
        aria-label="Remover participante ${escapeHTML(p.name)}"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </li>
  `).join('');
}

/** Renderiza grid de categorias na tela de nova sessão
 * [H5] Sempre há uma categoria padrão selecionada ("outro") */
function renderCategoryGrid() {
  const container = document.getElementById('category-grid');
  if (!container) return;

  container.innerHTML = CATEGORIES.map(cat => {
    const selected = AppState.session.categoria === cat.id;
    return `
      <button
        class="cat-card ${selected ? 'selected' : ''}"
        onclick="setCategoria('${cat.id}')"
        aria-pressed="${selected}"
        aria-label="Categoria ${cat.nome}"
        style="${selected ? `--cat-color:${cat.cor};` : ''}"
      >
        <span class="text-xl cat-icon-animate" aria-hidden="true">${cat.icon}</span>
        <span class="text-xs font-semibold mt-0.5">${cat.nome}</span>
      </button>
    `;
  }).join('');
}

function setCategoria(id) {
  AppState.session.categoria = id;
  saveSession();
  renderCategoryGrid();
}

/** [H7] Chips de sugestão de amigos cadastrados, com filtro por digitação */
function renderChipsSugestao(filter = '') {
  const container = document.getElementById('chips-sugestao');
  if (!container) return;

  // Exclui já adicionados e filtra por texto digitado
  const alreadyAdded = new Set(AppState.session.participants.map(p => p.name.toLowerCase()));
  const filterLower  = filter.toLowerCase();

  const suggestions = [...AppState.friends]
    .sort((a, b) => b.estatisticas.totalSessoes - a.estatisticas.totalSessoes)
    .filter(f =>
      !alreadyAdded.has(f.nome.toLowerCase()) &&
      (filterLower === '' || f.nome.toLowerCase().includes(filterLower))
    );

  if (suggestions.length === 0) {
    container.innerHTML = '';
    return;
  }

  // [H7] Eficiência — atalho de seleção de amigos recorrentes via chips
  container.innerHTML = suggestions.map(f => `
    <button
      class="chip-amigo"
      onclick="addParticipant('${escapeHTML(f.nome)}')"
      aria-label="Adicionar ${escapeHTML(f.nome)} à sessão"
    >
      ${buildAvatarHTML(f.nome, 'sm')}
      <span>${escapeHTML(f.nome)}</span>
    </button>
  `).join('');
}

function updateAvancarButton() {
  const btn = document.getElementById('btn-avancar-modo');
  btn.disabled = AppState.session.participants.length < 2;
}

/** Sanitização básica para prevenir XSS */
function escapeHTML(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// -----------------------------------------------
// ENTIDADE PARTICIPANTE — Sistema de Perfis
// -----------------------------------------------

/** Calcula iniciais a partir do nome */
function getInitials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Hash determinístico do nome → cor do avatar */
function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Retorna HTML de um círculo de avatar */
function buildAvatarHTML(name, sizeClass = '') {
  const initials = getInitials(name);
  const color    = getAvatarColor(name);
  return `<div class="avatar-circle ${sizeClass}" style="background-color:${color};" aria-hidden="true">${escapeHTML(initials)}</div>`;
}

/** Encontra amigo pelo nome (case-insensitive) */
function findFriendByName(name) {
  return AppState.friends.find(f => f.nome.toLowerCase() === name.toLowerCase());
}

/** Encontra ou cria perfil de participante, retorna o objeto */
function upsertFriend(name) {
  let friend = findFriendByName(name);
  if (!friend) {
    friend = {
      id:        uid(),
      nome:      name.trim(),
      criadoEm: new Date().toISOString(),
      isDemo:   false,
      estatisticas: {
        totalSessoes: 0,
        totalPago:    0,
        totalDevido:  0,
        sessoesPagouTudo:      0,
        sessoesFicouDevendo:   0,
      },
      badgesDesbloqueados: [],
    };
    AppState.friends.push(friend);
    saveFriends();
  }
  return friend;
}

/** Persiste lista de amigos */
function saveFriends() {
  localStorage.setItem(LS_FRIENDS, JSON.stringify(AppState.friends));
}

/** Carrega lista de amigos do LocalStorage */
function loadFriends() {
  try {
    const raw = localStorage.getItem(LS_FRIENDS);
    if (raw) AppState.friends = JSON.parse(raw);
  } catch { AppState.friends = []; }
}

/** Verifica se algum amigo fake do demo existe */
function hasDemo() {
  return AppState.friends.some(f => f.isDemo) || AppState.history.some(h => h.isDemo);
}

// -----------------------------------------------
// TELA 3 — ESCOLHA DO MODO
// -----------------------------------------------

function initModo() {
  document.getElementById('modo-event-label').textContent = AppState.session.eventName;

  // Reset seleção visual
  document.getElementById('btn-modo-individual').classList.remove('selected');
  document.getElementById('btn-modo-total').classList.remove('selected');

  document.getElementById('btn-modo-individual').setAttribute('aria-checked', 'false');
  document.getElementById('btn-modo-total').setAttribute('aria-checked', 'false');

  document.getElementById('btn-modo-individual').onclick = () => {
    AppState.session.mode = 'individual';
    saveSession();
    // Inicializa itens vazios
    AppState.session.participants.forEach(p => { p.items = p.items || []; });
    launchBackTarget = 'screen-modo';
    initIndividual();
    showScreen('screen-individual');
  };

  document.getElementById('btn-modo-total').onclick = () => {
    AppState.session.mode = 'total';
    saveSession();
    launchBackTarget = 'screen-modo';
    initTotal();
    showScreen('screen-total');
  };
}

// -----------------------------------------------
// TELA 4 — LANÇAMENTO INDIVIDUAL
// -----------------------------------------------

function initIndividual() {
  document.getElementById('individual-event-label').textContent = AppState.session.eventName;
  renderIndividualParticipants();
  updateIndividualTotal();

  // [H3] Cancelar com confirmação
  document.getElementById('btn-cancelar-individual').onclick = async () => {
    const ok = await confirmModal(
      'Cancelar sessão?',
      'Todos os itens lançados serão perdidos. Tem certeza?'
    );
    if (ok) {
      clearSession();
      initHome();
      showScreen('screen-home', 'back');
    }
  };

  document.getElementById('btn-fechar-individual').onclick = () => {
    // [H5] Não fechar com total zero
    const total = calcGrandTotal();
    if (total === 0) {
      showToast('⚠️ Lance pelo menos um item antes de fechar', 'error');
      return;
    }
    AppState.session.paidStatus = {};
    saveSession();
    renderResultado();
    showScreen('screen-resultado');
  };
}

function calcGrandTotal() {
  if (AppState.session.mode === 'total') return AppState.session.totalValue;
  return AppState.session.participants.reduce(
    (sum, p) => sum + p.items.reduce((s, i) => s + i.value, 0), 0
  );
}

/** [H6] Renderiza todos os participantes com seus itens visíveis */
function renderIndividualParticipants() {
  const container = document.getElementById('individual-participants-list');
  container.innerHTML = AppState.session.participants.map(p => buildParticipantCard(p)).join('');
}

function buildParticipantCard(participant) {
  const total = participant.items.reduce((s, i) => s + i.value, 0);
  const itemsHTML = participant.items.map(item => buildItemRow(participant.id, item)).join('');

  return `
    <div class="participant-card" id="card-${participant.id}" role="listitem">
      <div class="participant-card-header" onclick="toggleCard('${participant.id}')" aria-expanded="true" aria-controls="body-${participant.id}">
        <div class="flex items-center gap-2">
          ${buildAvatarHTML(participant.name, 'sm')}
          <span class="text-base font-bold">${escapeHTML(participant.name)}</span>
          <!-- [H1] Total lançado por participante em tempo real -->
          <span class="text-xs text-primary-light font-semibold" id="ptotal-${participant.id}">${formatBRL(total)}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-white/40 text-xs">${participant.items.length} item${participant.items.length !== 1 ? 's' : ''}</span>
          <svg id="chevron-${participant.id}" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white/30 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </div>

      <!-- [H8] Itens colapsáveis — só o essencial em tela -->
      <div class="participant-card-body" id="body-${participant.id}">
        <div id="items-${participant.id}" class="mb-3">
          ${itemsHTML || '<p class="text-white/30 text-xs py-2 text-center">Nenhum item ainda. Adicione abaixo! 👇</p>'}
        </div>

        <!-- Formulário de novo item -->
        <div class="flex gap-2 mt-2">
          <input
            type="text"
            id="item-name-${participant.id}"
            class="input-field flex-1 text-sm py-2"
            placeholder="🍺 O que consumiu?"
            maxlength="40"
            aria-label="Nome do item de ${escapeHTML(participant.name)}"
            onkeydown="handleItemEnter(event, '${participant.id}')"
          />
          <!-- [H5] Botões +/- em vez de input numérico livre -->
          <button class="btn-item-value" onclick="changeItemValueDraft('${participant.id}', -5)" aria-label="Diminuir valor em R$ 5,00">−</button>
          <span id="item-val-${participant.id}" class="text-sm font-bold text-white w-16 text-center flex items-center justify-center">R$ 0</span>
          <button class="btn-item-value" onclick="changeItemValueDraft('${participant.id}', +5)" aria-label="Aumentar valor em R$ 5,00">+</button>
          <button class="btn-icon-add" onclick="addItem('${participant.id}')" aria-label="Adicionar item para ${escapeHTML(participant.name)}" style="width:40px;height:40px;min-width:40px;">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

function buildItemRow(participantId, item) {
  return `
    <div class="item-row" id="item-row-${item.id}">
      <span class="flex-1 text-sm text-white/80 truncate">${escapeHTML(item.name)}</span>
      <!-- [H5] Botões +/- para ajuste -->
      <button class="btn-item-value" onclick="changeItemValue('${participantId}','${item.id}',-5)" aria-label="Diminuir ${escapeHTML(item.name)} em R$ 5,00" style="width:28px;height:28px;min-width:28px;font-size:0.9rem;">−</button>
      <span class="text-sm font-bold text-primary-light w-20 text-center" id="ival-${item.id}">${formatBRL(item.value)}</span>
      <button class="btn-item-value" onclick="changeItemValue('${participantId}','${item.id}',+5)" aria-label="Aumentar ${escapeHTML(item.name)} em R$ 5,00" style="width:28px;height:28px;min-width:28px;font-size:0.9rem;">+</button>
      <!-- [H3] Remover item lançado -->
      <button class="btn-remove-item" onclick="removeItem('${participantId}','${item.id}')" aria-label="Remover item ${escapeHTML(item.name)}">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `;
}

/** Rascunho de valor para novo item por participante */
const itemValueDraft = {};

function changeItemValueDraft(participantId, delta) {
  if (!itemValueDraft[participantId]) itemValueDraft[participantId] = 0;
  itemValueDraft[participantId] = Math.max(0, itemValueDraft[participantId] + delta);
  const el = document.getElementById(`item-val-${participantId}`);
  if (el) el.textContent = formatBRL(itemValueDraft[participantId]);
}

function handleItemEnter(event, participantId) {
  if (event.key === 'Enter') { event.preventDefault(); addItem(participantId); }
}

function addItem(participantId) {
  const input = document.getElementById(`item-name-${participantId}`);
  const name  = input ? input.value.trim() : '';
  const value = itemValueDraft[participantId] || 0;

  if (!name) {
    showToast('⚠️ Coloca o nome do item', 'error');
    if (input) input.focus();
    return;
  }

  if (value <= 0) {
    showToast('⚠️ O valor precisa ser maior que R$ 0,00', 'error');
    return;
  }

  const participant = AppState.session.participants.find(p => p.id === participantId);
  if (!participant) return;

  participant.items.push({ id: uid(), name, value });
  itemValueDraft[participantId] = 0;
  saveSession(); // [H7] Autosave

  // Re-render apenas este card para performance
  const card = document.getElementById(`card-${participantId}`);
  if (card) {
    const newHTML = buildParticipantCard(participant);
    card.outerHTML = newHTML;
  }

  updateIndividualTotal();
}

function removeItem(participantId, itemId) {
  const participant = AppState.session.participants.find(p => p.id === participantId);
  if (!participant) return;
  participant.items = participant.items.filter(i => i.id !== itemId);
  saveSession();

  const row = document.getElementById(`item-row-${itemId}`);
  if (row) {
    row.style.opacity = '0';
    row.style.transition = 'opacity 200ms';
    setTimeout(() => {
      const card = document.getElementById(`card-${participantId}`);
      if (card) card.outerHTML = buildParticipantCard(participant);
      updateIndividualTotal();
    }, 200);
  }
}

function changeItemValue(participantId, itemId, delta) {
  const participant = AppState.session.participants.find(p => p.id === participantId);
  if (!participant) return;
  const item = participant.items.find(i => i.id === itemId);
  if (!item) return;
  item.value = Math.max(0, item.value + delta);
  saveSession();

  const valEl = document.getElementById(`ival-${itemId}`);
  if (valEl) valEl.textContent = formatBRL(item.value);

  const totalEl = document.getElementById(`ptotal-${participantId}`);
  const pTotal = participant.items.reduce((s, i) => s + i.value, 0);
  if (totalEl) totalEl.textContent = formatBRL(pTotal);

  updateIndividualTotal();
}

function toggleCard(participantId) {
  const body    = document.getElementById(`body-${participantId}`);
  const chevron = document.getElementById(`chevron-${participantId}`);
  const header  = body?.previousElementSibling;

  if (!body) return;
  const isOpen = !body.classList.contains('hidden');
  body.classList.toggle('hidden', isOpen);
  if (chevron) chevron.style.transform = isOpen ? 'rotate(-90deg)' : '';
  if (header) header.setAttribute('aria-expanded', (!isOpen).toString());
}

/** [H1] Atualiza total lançado em tempo real */
function updateIndividualTotal() {
  const total = AppState.session.participants.reduce(
    (sum, p) => sum + p.items.reduce((s, i) => s + i.value, 0), 0
  );
  const el = document.getElementById('individual-total-display');
  if (el) el.textContent = formatBRL(total);
}

// -----------------------------------------------
// TELA 5 — LANÇAMENTO TOTAL
// -----------------------------------------------

function initTotal() {
  document.getElementById('total-event-label').textContent = AppState.session.eventName;

  const input   = document.getElementById('input-total-value');
  const btnMinus = document.getElementById('btn-total-minus');
  const btnPlus  = document.getElementById('btn-total-plus');

  input.value = AppState.session.totalValue || 0;
  updateTotalPreview();

  input.addEventListener('input', () => {
    AppState.session.totalValue = parseFloat(input.value) || 0;
    saveSession();
    updateTotalPreview();
    document.getElementById('error-total-value').classList.add('hidden');
  });

  // [H5] Botões +/- para controle preciso
  btnMinus.addEventListener('click', () => {
    const current = parseFloat(input.value) || 0;
    input.value = Math.max(0, current - 5).toFixed(2);
    AppState.session.totalValue = parseFloat(input.value);
    saveSession();
    updateTotalPreview();
  });

  btnPlus.addEventListener('click', () => {
    const current = parseFloat(input.value) || 0;
    input.value = (current + 5).toFixed(2);
    AppState.session.totalValue = parseFloat(input.value);
    saveSession();
    updateTotalPreview();
  });

  document.getElementById('btn-cancelar-total').onclick = async () => {
    const ok = await confirmModal('Cancelar sessão?', 'Tem certeza? Os dados serão perdidos.');
    if (ok) { clearSession(); initHome(); showScreen('screen-home', 'back'); }
  };

  document.getElementById('btn-fechar-total').onclick = () => {
    const val = parseFloat(input.value) || 0;
    if (val <= 0) {
      // [H9] Erro localizado
      document.getElementById('error-total-value').classList.remove('hidden');
      input.focus();
      return;
    }
    AppState.session.totalValue = val;
    AppState.session.paidStatus = {};
    saveSession();
    renderResultado();
    showScreen('screen-resultado');
  };
}

/** [H1] Atualiza preview de divisão em tempo real */
function updateTotalPreview() {
  const val   = parseFloat(document.getElementById('input-total-value').value) || 0;
  const count = AppState.session.participants.length;
  const per   = count > 0 ? val / count : 0;

  document.getElementById('total-per-person').textContent = formatBRL(per);
  document.getElementById('total-participants-count').textContent =
    `entre ${count} pessoa${count !== 1 ? 's' : ''}`;
}

// -----------------------------------------------
// TELA 6 — RESULTADO
// -----------------------------------------------

function renderResultado() {
  const { eventName, paidStatus, mode } = AppState.session;

  document.getElementById('resultado-event-title').textContent = eventName;

  // Botão voltar do resultado
  document.getElementById('btn-back-resultado').onclick = () => {
    showScreen(mode === 'individual' ? 'screen-individual' : 'screen-total', 'back');
  };

  const balances  = calcBalances();
  const transfers = calcTransfers(balances);
  const grandTotal = balances.reduce((s, b) => s + b.spent, 0);

  // [H1] Contador animado — percepção de cálculo em tempo real
  const totalEl = document.getElementById('resultado-total');
  totalEl.textContent = formatBRL(0);
  animateNumber(totalEl, 0, grandTotal, 700, true);

  renderBalances(balances);
  renderTransfers(transfers);
  updatePaidStatus();

  // [H7] Atalho de compartilhamento para WhatsApp
  document.getElementById('btn-copiar-whatsapp').onclick = () => copyWhatsApp(balances, transfers);

  document.getElementById('btn-nova-rachada-resultado').onclick = () => {
    finalizeSession(balances, grandTotal);
    clearSession();
    initHome();
    showScreen('screen-home', 'back');
  };
}

function renderBalances(balances) {
  const container = document.getElementById('resultado-balances');
  const { paidStatus } = AppState.session;

  container.innerHTML = balances.map(b => {
    const paid      = paidStatus[b.id] || false;
    const isDebtor  = b.balance < -0.01;
    const statusTxt = paid ? 'Limpo! ✅' : (isDebtor ? 'Tá na rocha 🪨' : 'Recebe 💰');
    const valueTxt  = formatBRL(Math.abs(b.balance < -0.01 ? b.balance : b.spent));

    return `
      <div class="balance-card ${paid ? 'paid' : ''}" id="bc-${b.id}" role="listitem" aria-label="${escapeHTML(b.name)}: ${statusTxt}, ${valueTxt}">
        ${buildAvatarHTML(b.name, 'sm')}
        <div class="flex-1 min-w-0">
          <p class="font-bold text-sm truncate">${escapeHTML(b.name)}</p>
          <!-- [H2] "Tá na rocha", "Limpo!", "Recebe" — linguagem natural -->
          <p class="text-xs mt-0.5 ${paid ? 'text-success' : isDebtor ? 'text-danger' : 'text-green-400'}">${statusTxt}</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="font-black text-sm ${paid ? 'text-white/30 line-through' : 'text-white'}">${valueTxt}</span>
          <!-- [H3] Desfazer marcação de pago -->
          <button
            class="btn-toggle-paid ${paid ? 'paid-state' : 'unpaid'}"
            onclick="togglePaid('${b.id}')"
            aria-label="${paid ? 'Desmarcar pagamento de' : 'Marcar como pago'} ${escapeHTML(b.name)}"
            aria-pressed="${paid}"
          >
            ${paid
              ? '<span class="check-pop">✓</span> Pago'
              : 'Marcar pago'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderTransfers(transfers) {
  const container = document.getElementById('resultado-transfers');

  if (transfers.length === 0) {
    container.innerHTML = '<p class="text-white/30 text-sm text-center py-3">Ninguém deve nada pra ninguém! 🎉</p>';
    return;
  }

  container.innerHTML = transfers.map(t => `
    <div class="transfer-card" role="listitem" aria-label="${escapeHTML(t.from)} paga ${formatBRL(t.amount)} para ${escapeHTML(t.to)}">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold truncate">${escapeHTML(t.from)}</p>
        <p class="text-xs text-white/40">paga para ${escapeHTML(t.to)}</p>
      </div>
      <span class="font-black text-primary-light text-sm flex-shrink-0">${formatBRL(t.amount)}</span>
    </div>
  `).join('');
}

/** [H3] Desfazer marcação de pago + feedback visual imediato */
function togglePaid(participantId) {
  const current = AppState.session.paidStatus[participantId] || false;
  AppState.session.paidStatus[participantId] = !current;
  saveSession();

  const balances = calcBalances();
  renderBalances(balances);
  updatePaidStatus();

  if (!current) {
    showToast('✅ Marcado como pago!', 'success');
  } else {
    showToast('↩️ Pagamento desfeito', 'info');
  }
}

/** [H1] Atualiza badge de status geral */
function updatePaidStatus() {
  const { participants, paidStatus } = AppState.session;
  const total = participants.length;
  const paid  = Object.values(paidStatus).filter(Boolean).length;
  const badge = document.getElementById('resultado-pagos-badge');

  badge.textContent  = `${paid} de ${total} pagaram`;
  badge.className    = `badge-status ${paid === total && total > 0 ? 'badge-paid' : 'badge-pending badge-pulse'}`;
  badge.setAttribute('aria-label', `${paid} de ${total} participantes pagaram`);
}

// -----------------------------------------------
// COPIAR PARA WHATSAPP — [H7] Atalho de compartilhamento
// -----------------------------------------------

function copyWhatsApp(balances, transfers) {
  const { eventName } = AppState.session;
  const lines = [
    `🪨 *TaNaRocha — ${eventName}*`,
    '',
    '💸 *Quem tá devendo:*',
    ...balances.map(b => {
      const paid = AppState.session.paidStatus[b.id];
      const sym  = paid ? '✅' : '🪨';
      return `${sym} ${b.name}: ${formatBRL(b.spent)}`;
    }),
    '',
    '➡️ *Pix pra quem?*',
    ...transfers.map(t => `• ${t.from} → ${t.to}: ${formatBRL(t.amount)}`),
    '',
    '_Calculado pelo TaNaRocha 🪨_',
  ];

  const text = lines.join('\n');

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('📱 Copiado! Cola no WhatsApp 🎉', 'success');
    }).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity  = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast('📱 Copiado! Cola no WhatsApp 🎉', 'success');
}

// -----------------------------------------------
// FINALIZAR SESSÃO + SALVAR NO HISTÓRICO
// -----------------------------------------------

function finalizeSession(balances, grandTotal) {
  const record = {
    id:          uid(),
    eventName:   AppState.session.eventName,
    date:        new Date().toLocaleDateString('pt-BR'),
    dateISO:     new Date().toISOString(),
    mode:        AppState.session.mode,
    categoria:   AppState.session.categoria || 'outro',
    grandTotal,
    isDemo:      false,
    participants: balances.map(b => ({
      id:        b.id,
      name:      b.name,
      profileId: AppState.session.participants.find(p => p.id === b.id)?.profileId || null,
      spent:     b.spent,
      balance:   b.balance,
      paid:      AppState.session.paidStatus[b.id] || false,
    })),
    status: Object.values(AppState.session.paidStatus).every(Boolean) ? 'quitada' : 'pendente',
  };

  AppState.history.unshift(record);
  saveHistory();

  // [STAT] Atualiza estatísticas de cada participante cadastrado
  record.participants.forEach(p => {
    const friend = AppState.friends.find(f => f.id === p.profileId)
                || findFriendByName(p.name);
    if (!friend) return;

    friend.estatisticas.totalSessoes++;
    friend.estatisticas.totalDevido += p.spent;
    if (p.paid) {
      friend.estatisticas.totalPago += p.spent;
      friend.estatisticas.sessoesPagouTudo++;
    } else {
      friend.estatisticas.sessoesFicouDevendo++;
    }
  });
  saveFriends();

  // Verifica badges
  checkBadges();
}

// -----------------------------------------------
// TELA 7 — HISTÓRICO + RANKING
// -----------------------------------------------

function renderHistorico() {
  const list      = document.getElementById('historico-list');
  const emptyEl   = document.getElementById('historico-empty');
  const badgesList = document.getElementById('badges-list');
  const badgesEmpty = document.getElementById('badges-empty');

  // [H7] Filtro de categorias — chips com scroll horizontal
  // [H10] Dica visual de drag na primeira visita ao histórico
  const filtroEl = document.getElementById('historico-categoria-filtro');
  const LS_HINT_DRAG = 'tanarocha:hintDragScroll';
  if (filtroEl && !localStorage.getItem(LS_HINT_DRAG)) {
    setTimeout(() => {
      filtroEl.classList.add('hint-once');
      setTimeout(() => filtroEl.classList.remove('hint-once'), 2200);
    }, 400);
    localStorage.setItem(LS_HINT_DRAG, '1');
  }

  const categoriasFiltroEl = filtroEl;
  if (categoriasFiltroEl) {
    const countAll = AppState.history.length;
    const chipsHTML = [
      `<button class="cat-filter-chip ${AppState.historicoCategoriaFiltro === 'todas' ? 'active' : ''}"
        onclick="setHistoricoFiltro('todas')" aria-pressed="${AppState.historicoCategoriaFiltro === 'todas'}">
        Todas (${countAll})
      </button>`,
      ...CATEGORIES.map(cat => {
        const count = AppState.history.filter(h => (h.categoria || 'outro') === cat.id).length;
        if (count === 0) return '';
        return `<button class="cat-filter-chip ${AppState.historicoCategoriaFiltro === cat.id ? 'active' : ''}"
          onclick="setHistoricoFiltro('${cat.id}')" aria-pressed="${AppState.historicoCategoriaFiltro === cat.id}"
          style="${AppState.historicoCategoriaFiltro === cat.id ? `--cat-color:${cat.cor};` : ''}">
          ${cat.icon} ${cat.nome} (${count})
        </button>`;
      }),
    ].filter(Boolean).join('');
    categoriasFiltroEl.innerHTML = chipsHTML;
  }

  // Filtra registros pela categoria ativa
  const registrosFiltrados = AppState.historicoCategoriaFiltro === 'todas'
    ? AppState.history
    : AppState.history.filter(h => (h.categoria || 'outro') === AppState.historicoCategoriaFiltro);

  // Histórico
  if (registrosFiltrados.length === 0) {
    list.innerHTML = '';
    emptyEl.classList.remove('hidden');
  } else {
    emptyEl.classList.add('hidden');
    list.innerHTML = registrosFiltrados.map((record, i) => {
      const cat = getCategoryById(record.categoria || 'outro');
      return `
        <div class="history-card list-item-stagger" role="article" aria-label="${escapeHTML(record.eventName)}, ${record.date}" style="animation-delay:${i * 55}ms">
          <div class="flex items-center gap-3">
            <!-- Ícone de categoria -->
            <div class="cat-icon-circle" style="background-color:${cat.cor}20; color:${cat.cor};" aria-hidden="true">${cat.icon}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-0.5">
                <span class="font-bold text-sm truncate">${escapeHTML(record.eventName)}</span>
                <span class="text-xs text-white/40 ml-2 flex-shrink-0">${record.date}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-white/50">${record.participants.length} pessoas · ${record.mode === 'total' ? 'Modo Total' : 'Individual'}</span>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="font-bold text-primary-light text-sm">${formatBRL(record.grandTotal)}</span>
                  <span class="badge-status ${record.status === 'quitada' ? 'badge-paid' : 'badge-pending'}" style="font-size:0.65rem;">
                    ${record.status === 'quitada' ? '✅ Quitada' : '⏳ Pendente'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Badges / Ranking
  const badges = computeBadges();
  if (badges.length === 0) {
    badgesEmpty.classList.remove('hidden');
    badgesList.innerHTML = '';
  } else {
    badgesEmpty.classList.add('hidden');
    badgesList.innerHTML = badges.map(b => `
      <div class="badge-rank-card" role="listitem" aria-label="Badge ${b.title} para ${escapeHTML(b.person)}">
        <div class="badge-rank-emoji" aria-hidden="true">${b.emoji}</div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-sm">${b.title}</p>
          <p class="text-white/60 text-xs mt-0.5">${escapeHTML(b.person)}</p>
          <!-- [H10] Tooltip de humor -->
          <p class="text-white/30 text-xs mt-0.5 italic">${b.tooltip}</p>
        </div>
      </div>
    `).join('');
  }

  // Limpar histórico
  document.getElementById('btn-limpar-historico').onclick = async () => {
    if (AppState.history.length === 0) return;
    // [H5] Confirmação antes de ação destrutiva
    const ok = await confirmModal('Limpar todo o histórico?', 'Essa ação não pode ser desfeita. Todos os dados serão apagados.');
    if (ok) {
      AppState.history = [];
      saveHistory();
      localStorage.removeItem(LS_BADGES);
      renderHistorico();
      showToast('🗑️ Histórico apagado', 'info');
    }
  };
}

function setHistoricoFiltro(categoriaId) {
  AppState.historicoCategoriaFiltro = categoriaId;
  renderHistorico();
}

// -----------------------------------------------
// GAMIFICAÇÃO — BADGES
// -----------------------------------------------

const BADGE_DEFINITIONS = [
  {
    key:     'pagador_fiel',
    emoji:   '👑',
    title:   'Pagador Fiel',
    tooltip: 'Esse aí nunca falha. Respeito! 🫡',
    desc:    'Quem mais pagou no histórico de rachadas.',
  },
  {
    key:     'caloteiro',
    emoji:   '😅',
    title:   'Caloteiro em Reabilitação',
    tooltip: 'Esse aí some na hora de pagar 👻',
    desc:    'Quem menos pagou no histórico. A jornada de redenção começa aqui.',
  },
  {
    key:     'presenca_constante',
    emoji:   '🏆',
    title:   'Presença Constante',
    tooltip: 'Tá em tudo quanto é rolê. Ícone social! 🌟',
    desc:    'Quem aparece em mais sessões do histórico.',
  },
];

/** Calcula quem ganhou cada badge */
function computeBadges() {
  if (AppState.history.length === 0) return [];

  // Agrega stats por nome de participante (case-insensitive)
  const stats = {};

  AppState.history.forEach(record => {
    record.participants.forEach(p => {
      const key = p.name.toLowerCase();
      if (!stats[key]) stats[key] = { name: p.name, totalPaid: 0, sessions: 0, paid: 0 };
      stats[key].sessions++;
      stats[key].totalPaid += p.spent;
      if (p.paid) stats[key].paid++;
    });
  });

  const people = Object.values(stats);
  if (people.length < 2) return [];

  const sorted = [...people].sort((a, b) => b.paid - a.paid);

  return [
    { ...BADGE_DEFINITIONS[0], person: sorted[0].name },
    { ...BADGE_DEFINITIONS[1], person: sorted[sorted.length - 1].name },
    {
      ...BADGE_DEFINITIONS[2],
      person: [...people].sort((a, b) => b.sessions - a.sessions)[0].name,
    },
  ];
}

/** Verifica novos badges e exibe modal na primeira vez */
function checkBadges() {
  const unlocked = JSON.parse(localStorage.getItem(LS_BADGES) || '{}');
  const badges   = computeBadges();

  for (const badge of badges) {
    const badgeKey = `${badge.key}_${badge.person.toLowerCase()}`;
    if (!unlocked[badgeKey]) {
      unlocked[badgeKey] = true;
      localStorage.setItem(LS_BADGES, JSON.stringify(unlocked));
      showBadgeModal(badge);
      break; // Mostra um de cada vez
    }
  }
}

function showBadgeModal(badge) {
  const emojiEl = document.getElementById('badge-modal-emoji');
  emojiEl.textContent = badge.emoji;
  // [FASE 6] Spring reveal no emoji — reset antes de re-aplicar animação
  emojiEl.classList.remove('badge-emoji-reveal');
  void emojiEl.offsetWidth;
  emojiEl.classList.add('badge-emoji-reveal');

  document.getElementById('badge-modal-title').textContent = `${badge.title} — ${badge.person}`;
  document.getElementById('badge-modal-desc').textContent  = badge.desc;

  // [H1] Feedback visual imediato — confete ao desbloquear badge
  showConfetti();
  openSheet('badge-modal');

  document.getElementById('btn-close-badge').onclick = () => {
    closeSheet('badge-modal');
    stopConfetti();
  };
}

/** Animação de confete em CSS puro — 12 elementos absolutamente posicionados
 *  [H1] Feedback visual imediato pra cada ação relevante */
function showConfetti() {
  const container = document.getElementById('confetti-container');
  if (!container) return;

  const colors = ['#7C3AED','#A855F7','#EC4899','#F59E0B','#10B981','#3B82F6','#EF4444','#14B8A6'];
  container.innerHTML = Array.from({ length: 14 }, (_, i) => {
    const color = colors[i % colors.length];
    const left  = 5 + (i / 13) * 90; // distribuídos em 5%..95% da largura
    const delay = (i * 0.12).toFixed(2);
    const size  = 6 + (i % 3) * 3;
    return `<div class="confetti-piece" style="left:${left}%;background:${color};width:${size}px;height:${size}px;animation-delay:${delay}s;"></div>`;
  }).join('');
}

function stopConfetti() {
  const container = document.getElementById('confetti-container');
  if (container) container.innerHTML = '';
}

// -----------------------------------------------
// TELA 8 — MEUS AMIGOS
// -----------------------------------------------

/** Renderiza a tela de amigos ordenada por frequência de uso */
function renderAmigos() {
  const list     = document.getElementById('amigos-list');
  const emptyEl  = document.getElementById('amigos-empty');
  const btnLimpa = document.getElementById('btn-limpar-demo');

  // Mostra botão de limpar demo somente se existirem dados demo
  if (btnLimpa) btnLimpa.classList.toggle('hidden', !hasDemo());

  // Ordena por número de sessões (mais usados primeiro) — [H6]
  const sorted = [...AppState.friends].sort(
    (a, b) => b.estatisticas.totalSessoes - a.estatisticas.totalSessoes
  );

  if (sorted.length === 0) {
    list.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  list.innerHTML = sorted.map((f, i) => `
    <div class="amigo-card list-item-stagger" role="listitem" aria-label="${escapeHTML(f.nome)}, ${f.estatisticas.totalSessoes} sessões" style="animation-delay:${i * 55}ms">
      ${buildAvatarHTML(f.nome, 'lg')}
      <div class="flex-1 min-w-0">
        <p class="font-bold text-sm">${escapeHTML(f.nome)}</p>
        <p class="text-xs text-white/40 mt-0.5">
          ${f.estatisticas.totalSessoes} sessão${f.estatisticas.totalSessoes !== 1 ? 'ões' : ''}
          · pago ${formatBRL(f.estatisticas.totalPago)}
          ${f.isDemo ? '<span class="text-primary-light/50 ml-1">· demo</span>' : ''}
        </p>
      </div>
      <!-- [H3] Botão de remover amigo -->
      <button
        class="btn-remove-item"
        onclick="removeAmigo('${f.id}', event)"
        aria-label="Remover ${escapeHTML(f.nome)} dos amigos"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `).join('');
}

/** Remove amigo com confirmação — [H5] */
async function removeAmigo(id, event) {
  event.stopPropagation();
  const friend = AppState.friends.find(f => f.id === id);
  if (!friend) return;
  const ok = await confirmModal(
    `Remover ${friend.nome}?`,
    'O histórico de rachadas não será afetado, mas o perfil e as estatísticas serão removidos.'
  );
  if (!ok) return;
  AppState.friends = AppState.friends.filter(f => f.id !== id);
  saveFriends();
  renderAmigos();
  showToast(`👋 ${friend.nome} removido`, 'info');
}

/** Abre sheet de adicionar amigo */
function openAddAmigoModal() {
  const inputNome = document.getElementById('input-amigo-nome');
  const errEl    = document.getElementById('error-amigo-nome');
  const preview  = document.getElementById('preview-avatar');
  const previewNome = document.getElementById('preview-nome');

  inputNome.value = '';
  errEl.classList.add('hidden');
  preview.textContent  = '?';
  preview.style.backgroundColor = '#2e2e2e';
  previewNome.textContent = '—';
  openSheet('modal-amigo');
  setTimeout(() => inputNome.focus(), 120);

  // Atualiza preview em tempo real
  inputNome.oninput = () => {
    const name = inputNome.value.trim();
    if (name.length >= 1) {
      preview.textContent = getInitials(name);
      preview.style.backgroundColor = getAvatarColor(name);
      previewNome.textContent = name;
    } else {
      preview.textContent = '?';
      preview.style.backgroundColor = '#2e2e2e';
      previewNome.textContent = '—';
    }
  };

  inputNome.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveNewAmigo(); }
  };

  document.getElementById('btn-salvar-amigo').onclick  = saveNewAmigo;
  document.getElementById('btn-cancelar-amigo').onclick = closeAddAmigoModal;
}

function closeAddAmigoModal() {
  closeSheet('modal-amigo');
}

function saveNewAmigo() {
  const inputNome = document.getElementById('input-amigo-nome');
  const errEl     = document.getElementById('error-amigo-nome');
  const name      = inputNome.value.trim();

  if (!name) {
    errEl.textContent = '⚠️ Digite um nome';
    errEl.classList.remove('hidden');
    inputNome.focus();
    return;
  }
  if (name.length < 2) {
    errEl.textContent = '⚠️ O nome precisa ter pelo menos 2 caracteres';
    errEl.classList.remove('hidden');
    return;
  }
  if (findFriendByName(name)) {
    errEl.textContent = '⚠️ Esse amigo já está cadastrado';
    errEl.classList.remove('hidden');
    return;
  }

  upsertFriend(name);
  closeAddAmigoModal();
  renderAmigos();
  showToast(`✅ ${name} adicionado aos amigos!`, 'success');
}

// -----------------------------------------------
// [DEMO] MODO DEMO — Dados fictícios para apresentação
// -----------------------------------------------

const DEMO_FRIENDS = [
  { nome: 'João Silva',    payRate: 1.0  },
  { nome: 'Maria Santos',  payRate: 1.0  },
  { nome: 'Pedro Costa',   payRate: 0.7  },
  { nome: 'Carla Souza',   payRate: 0.4  },
  { nome: 'Lucas Oliveira',payRate: 1.0  },
];

// [DEMO] Categorias distribuídas de forma realista (mais bar e comida, menos viagem)
const DEMO_SESSIONS = [
  { nome: 'Bar da Sexta',        modo: 'total',      total: 148,  participantes: [0,1,2,3],   diasAtras: 3,   categoria: 'bar'      },
  { nome: 'Churrasco do João',   modo: 'individual', total: 320,  participantes: [0,1,2,3,4], diasAtras: 10,  categoria: 'comida'   },
  { nome: 'Viagem Floripa',      modo: 'total',      total: 380,  participantes: [0,1,2,3],   diasAtras: 22,  categoria: 'viagem'   },
  { nome: 'Pizza domingo',       modo: 'total',      total: 96,   participantes: [0,1,4],     diasAtras: 35,  categoria: 'comida'   },
  { nome: 'Gasolina Curitiba',   modo: 'individual', total: 180,  participantes: [0,2,3],     diasAtras: 45,  categoria: 'gasolina' },
  { nome: 'Aniversário Maria',   modo: 'total',      total: 215,  participantes: [0,1,2,3,4], diasAtras: 58,  categoria: 'festa'    },
  { nome: 'Boteco quarta',       modo: 'total',      total: 75,   participantes: [1,2,3],     diasAtras: 70,  categoria: 'bar'      },
  { nome: 'Hamburgueria',        modo: 'individual', total: 132,  participantes: [0,1,3],     diasAtras: 85,  categoria: 'comida'   },
  { nome: 'Mercado do mês',      modo: 'total',      total: 245,  participantes: [0,1,2],     diasAtras: 95,  categoria: 'mercado'  },
  { nome: 'Show de Rock',        modo: 'total',      total: 160,  participantes: [1,2,3,4],   diasAtras: 108, categoria: 'lazer'    },
  { nome: 'Racha da gasolina',   modo: 'individual', total: 90,   participantes: [0,2,4],     diasAtras: 115, categoria: 'gasolina' },
  { nome: 'Festa junina',        modo: 'total',      total: 188,  participantes: [0,1,2,3,4], diasAtras: 120, categoria: 'festa'    },
];

async function activateDemoMode() {
  const ok = await confirmModal(
    '🎬 Ativar Modo Demo?',
    'Isso vai popular o app com 5 amigos fictícios e 8 rachadas históricas. Os dados atuais serão preservados.'
  );
  if (!ok) return;

  // Skeleton visual durante geração — [H1] carregamento percebido
  const btn = document.getElementById('btn-modo-demo');
  const amigosList = document.getElementById('amigos-list');
  const original = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Gerando...';
  btn.disabled = true;

  if (amigosList) {
    amigosList.innerHTML = Array.from({ length: 4 }, () => `
      <div class="skeleton-card skeleton flex items-center gap-3 px-4 py-3">
        <div class="skeleton avatar-circle lg" style="background:none;border:none;"></div>
        <div class="flex-1">
          <div class="skeleton skeleton-line medium mb-2"></div>
          <div class="skeleton skeleton-line short"></div>
        </div>
      </div>
    `).join('');
  }

  // Simula processamento (~1.5s) para parecer real — [DEMO]
  await new Promise(r => setTimeout(r, 1500));

  // Cria amigos fake
  const demoFriendObjs = DEMO_FRIENDS.map(df => {
    const existing = findFriendByName(df.nome);
    if (existing) return existing;
    const f = {
      id:        uid(),
      nome:      df.nome,
      criadoEm: new Date().toISOString(),
      isDemo:    true,
      estatisticas: { totalSessoes:0, totalPago:0, totalDevido:0, sessoesPagouTudo:0, sessoesFicouDevendo:0 },
      badgesDesbloqueados: [],
    };
    AppState.friends.push(f);
    return f;
  });

  // Cria rachadas históricas
  DEMO_SESSIONS.forEach(ds => {
    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() - ds.diasAtras);

    const sessionParticipants = ds.participantes.map((idx, i) => {
      const df      = DEMO_FRIENDS[idx];
      const friend  = demoFriendObjs[idx];
      const share   = Math.round((ds.total / ds.participantes.length) * 100) / 100;
      const paid    = Math.random() < df.payRate;
      return {
        id:        uid(),
        name:      friend.nome,
        profileId: friend.id,
        spent:     share,
        balance:   0,
        paid,
      };
    });

    const record = {
      id:          uid(),
      eventName:   ds.nome,
      date:        dateObj.toLocaleDateString('pt-BR'),
      dateISO:     dateObj.toISOString(),
      mode:        ds.modo,
      categoria:   ds.categoria,
      grandTotal:  ds.total,
      isDemo:      true,
      participants: sessionParticipants,
      status:      sessionParticipants.every(p => p.paid) ? 'quitada' : 'pendente',
    };

    AppState.history.push(record);

    // Atualiza stats dos amigos demo
    sessionParticipants.forEach(p => {
      const f = demoFriendObjs.find(d => d.id === p.profileId);
      if (!f) return;
      f.estatisticas.totalSessoes++;
      f.estatisticas.totalDevido += p.spent;
      if (p.paid) { f.estatisticas.totalPago += p.spent; f.estatisticas.sessoesPagouTudo++; }
      else        { f.estatisticas.sessoesFicouDevendo++; }
    });
  });

  // Ordena histórico por data (mais recente primeiro)
  AppState.history.sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));

  saveFriends();
  saveHistory();

  btn.innerHTML = original;
  btn.disabled  = false;

  renderAmigos();
  initHome();
  showToast('✅ Modo Demo ativado! Confere o histórico.', 'success', 3500);
}

async function clearDemoMode() {
  const ok = await confirmModal('Limpar dados demo?', 'Remove apenas os amigos e rachadas marcados como demo.');
  if (!ok) return;

  AppState.friends = AppState.friends.filter(f => !f.isDemo);
  AppState.history = AppState.history.filter(h => !h.isDemo);
  saveFriends();
  saveHistory();

  renderAmigos();
  initHome();
  showToast('🗑️ Dados demo removidos', 'info');
}

// -----------------------------------------------
// BANNER DE INSTALAÇÃO PWA — beforeinstallprompt
// -----------------------------------------------

function initInstallBanner() {
  let deferredPrompt = null;
  const banner  = document.getElementById('install-banner');
  const btnInstall = document.getElementById('btn-install-pwa');
  if (!banner || !btnInstall) return;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    banner.classList.remove('hidden');
  });

  btnInstall.onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    banner.classList.add('hidden');
    if (outcome === 'accepted') showToast('📲 App instalado com sucesso!', 'success');
  };

  window.addEventListener('appinstalled', () => {
    banner.classList.add('hidden');
    deferredPrompt = null;
  });
}

// -----------------------------------------------
// TOQUE LONGO NO LOGO — Ativa Modo Demo [DEMO]
// -----------------------------------------------

function initLogoLongPress() {
  const logo = document.getElementById('logo-home-img');
  if (!logo) return;
  let timer = null;

  const start = () => { timer = setTimeout(() => activateDemoMode(), 3000); };
  const cancel = () => { clearTimeout(timer); };

  logo.addEventListener('touchstart',  start,  { passive: true });
  logo.addEventListener('touchend',    cancel);
  logo.addEventListener('touchmove',   cancel, { passive: true });
  logo.addEventListener('mousedown',   start);
  logo.addEventListener('mouseup',     cancel);
  logo.addEventListener('mouseleave',  cancel);
}

// -----------------------------------------------
// BOTÕES DE VOLTAR GENÉRICOS — [H3]
// -----------------------------------------------

function initBackButtons() {
  document.querySelectorAll('.btn-back[data-target]').forEach(btn => {
    // Usa onclick para evitar duplicatas em chamadas repetidas
    btn.onclick = () => {
      const target = btn.getAttribute('data-target');
      if (target === 'screen-home') initHome();
      showScreen(target, 'back'); // [H4] voltar = slide da esquerda
    };
  });
}

// -----------------------------------------------
// ANIMAÇÃO DE NÚMERO — [H1] contadores com easing
// -----------------------------------------------

/** Anima contagem de um valor até outro com easing out cubic */
function animateNumber(element, start, end, duration = 650, isCurrency = false) {
  const startTime = performance.now();
  const range = end - start;

  element.classList.add('animated-value', 'ticking');

  function update(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3); // cubic ease-out
    const current  = start + range * eased;

    if (isCurrency) {
      element.textContent = new Intl.NumberFormat('pt-BR', {
        style: 'currency', currency: 'BRL',
      }).format(current);
    } else {
      element.textContent = Math.round(current).toString();
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.classList.remove('ticking');
    }
  }

  requestAnimationFrame(update);
}

// -----------------------------------------------
// RIPPLE EFFECT — [H1] feedback tátil visual
// -----------------------------------------------

function attachRipple(el) {
  if (el._rippleAttached) return;
  el._rippleAttached = true;
  el.addEventListener('click', (e) => {
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width  = ripple.style.height = `${size}px`;
    ripple.style.left   = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top    = `${e.clientY - rect.top  - size / 2}px`;
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 620);
  });
}

function initRipple() {
  document.querySelectorAll('button').forEach(attachRipple);
  // Aplica a botões gerados dinamicamente
  new MutationObserver(mutations => {
    mutations.forEach(m => m.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.tagName === 'BUTTON') attachRipple(node);
      node.querySelectorAll?.('button').forEach(attachRipple);
    }));
  }).observe(document.body, { childList: true, subtree: true });
}

// -----------------------------------------------
// [FASE 5] SISTEMA DE PONTUAÇÃO
// -----------------------------------------------

function calcularScore(friend) {
  const { totalSessoes, sessoesPagouTudo } = friend.estatisticas;
  if (totalSessoes === 0) return 0;
  return Math.round((sessoesPagouTudo / totalSessoes) * 100);
}

function getScoreInfo(score) {
  if (score >= 80) return { color: '#22C55E', emoji: '🟢', label: 'Confiável' };
  if (score >= 50) return { color: '#F59E0B', emoji: '🟡', label: 'Regular' };
  return { color: '#EF4444', emoji: '🔴', label: 'Caloteiro' };
}

function getCategoriaMaisFrequente(friend) {
  const contagem = {};
  AppState.history.forEach(record => {
    const participou = record.participants.some(
      p => p.profileId === friend.id || p.name.toLowerCase() === friend.nome.toLowerCase()
    );
    if (!participou) return;
    const cat = record.categoria || 'outro';
    contagem[cat] = (contagem[cat] || 0) + 1;
  });
  const entries = Object.entries(contagem);
  if (entries.length === 0) return getCategoryById('outro');
  return getCategoryById(entries.sort((a, b) => b[1] - a[1])[0][0]);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// -----------------------------------------------
// [FASE 5] TELA 9 — PÓDIO DA GALERA
// -----------------------------------------------

function initPodio() {
  renderPodio();
}

function renderPodio() {
  const container = document.getElementById('podio-container');
  const emptyEl   = document.getElementById('podio-empty');
  const rankList  = document.getElementById('ranking-list');
  if (!container) return;

  const elegiveis = AppState.friends
    .filter(f => f.estatisticas.totalSessoes > 0)
    .map(f => ({ friend: f, score: calcularScore(f), sessoes: f.estatisticas.totalSessoes }))
    .sort((a, b) => b.score - a.score || b.sessoes - a.sessoes);

  if (elegiveis.length < 2) {
    container.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    rankList.innerHTML = '';
    return;
  }

  emptyEl.classList.add('hidden');
  container.classList.remove('hidden');

  renderPodiumVisual(container, elegiveis.slice(0, 3));

  const resto = elegiveis.slice(3);
  if (resto.length === 0) {
    rankList.innerHTML = '<p class="text-white/30 text-sm text-center py-3">Apenas o pódio por enquanto. Faça mais rachadas! 🍺</p>';
    return;
  }

  rankList.innerHTML = resto.map((item, idx) => {
    const info = getScoreInfo(item.score);
    const pos  = idx + 4;
    const cat  = getCategoriaMaisFrequente(item.friend);
    return `
      <div class="ranking-row list-item-stagger" role="listitem" aria-label="${pos}º lugar: ${escapeHTML(item.friend.nome)}, score ${item.score}%" style="animation-delay:${idx * 55}ms">
        <span class="ranking-pos">${pos}º</span>
        ${buildAvatarHTML(item.friend.nome, 'sm')}
        <div class="flex-1 min-w-0">
          <p class="font-bold text-sm truncate">${escapeHTML(item.friend.nome)}</p>
          <p class="text-xs text-white/40">${item.sessoes} sessão${item.sessoes !== 1 ? 'ões' : ''} · ${cat.icon} ${cat.nome}</p>
        </div>
        <div class="flex flex-col items-end gap-1">
          <span class="text-sm font-black" style="color:${info.color};">${item.score}%</span>
          <span class="text-xs text-white/40">${info.emoji} ${info.label}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderPodiumVisual(container, top3) {
  // Ordem visual clássica: 2º — 1º — 3º
  const ordem      = [top3[1], top3[0], top3[2]];
  const medals     = ['🥈', '🥇', '🥉'];
  const posLabels  = ['2º', '1º', '3º'];
  const spotClass  = ['second', 'first', 'third'];

  const spots = ordem.map((item, vi) => {
    if (!item) return '';
    const info = getScoreInfo(item.score);
    const cat  = getCategoriaMaisFrequente(item.friend);
    return `
      <div class="podium-spot podium-${spotClass[vi]}"
           role="listitem"
           aria-label="${posLabels[vi]} lugar: ${escapeHTML(item.friend.nome)}, score ${item.score}%">
        <div class="podium-info">
          <div class="podium-avatar-wrap ${spotClass[vi]}">
            ${buildAvatarHTML(item.friend.nome, 'lg')}
            <span class="podium-medal" aria-hidden="true">${medals[vi]}</span>
          </div>
          <p class="podium-name">${escapeHTML(item.friend.nome)}</p>
          <span class="podium-score-badge" style="color:${info.color};">${item.score}%</span>
          <span class="text-xs text-white/30">${cat.icon} ${cat.nome}</span>
        </div>
        <div class="podium-degrau" aria-hidden="true">
          <span class="text-xs font-bold text-white/60">${posLabels[vi]}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="podium-wrapper" role="list" aria-label="Pódio dos três primeiros">
      ${spots.join('')}
    </div>
  `;
}

// -----------------------------------------------
// [FASE 5] TELA 10 — CONFRONTO DIRETO
// -----------------------------------------------

const ConfrontoState = { p1: null, p2: null };

function initConfronto() {
  ConfrontoState.p1 = null;
  ConfrontoState.p2 = null;
  showConfrontoStep(1);
  renderGuerreiroGrid('confronto-grid-1', null);
}

function showConfrontoStep(step) {
  [1, 2, 3].forEach(n => {
    const el = document.getElementById(`confronto-step${n}`);
    if (el) el.classList.toggle('hidden', n !== step);
  });
}

function renderGuerreiroGrid(containerId, disabledId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const elegiveis = AppState.friends.filter(f => f.estatisticas.totalSessoes > 0);

  if (elegiveis.length < 2) {
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">Poucos guerreiros</p>
        <p class="empty-text">Você precisa de pelo menos 2 amigos com sessões para o confronto. Faça mais rachadas! ⚔️</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="guerreiro-grid">
      ${elegiveis.map(f => {
        const score     = calcularScore(f);
        const info      = getScoreInfo(score);
        const isDisabled = disabledId === f.id;
        return `
          <button
            class="guerreiro-card ${isDisabled ? 'disabled' : ''}"
            onclick="selectGuerreiro('${f.id}')"
            ${isDisabled ? 'disabled aria-disabled="true"' : ''}
            aria-label="${escapeHTML(f.nome)}, score ${score}%${isDisabled ? ', já selecionado' : ''}"
          >
            ${buildAvatarHTML(f.nome, 'sm')}
            <p class="guerreiro-nome">${escapeHTML(f.nome)}</p>
            <span class="text-xs font-bold" style="color:${info.color};">${score}% ${info.emoji}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function selectGuerreiro(friendId) {
  const friend = AppState.friends.find(f => f.id === friendId);
  if (!friend) return;

  if (!ConfrontoState.p1) {
    ConfrontoState.p1 = friend;

    // Prévia do p1 no step 2
    const preview = document.getElementById('confronto-p1-preview');
    if (preview) {
      const score = calcularScore(friend);
      const info  = getScoreInfo(score);
      preview.innerHTML = `
        <div class="flex items-center gap-3 bg-bg-surface rounded-xl px-4 py-3 mb-4 border border-primary/30">
          ${buildAvatarHTML(friend.nome, 'sm')}
          <div class="flex-1 min-w-0">
            <p class="text-xs text-white/40 font-medium">Guerreiro 1 selecionado</p>
            <p class="font-bold truncate">${escapeHTML(friend.nome)}</p>
          </div>
          <span class="text-sm font-black" style="color:${info.color};">${score}%</span>
        </div>
      `;
    }

    renderGuerreiroGrid('confronto-grid-2', friend.id);
    showConfrontoStep(2);
    return;
  }

  if (friendId === ConfrontoState.p1.id) return;
  ConfrontoState.p2 = friend;

  const cmp    = compararParticipantes(ConfrontoState.p1, ConfrontoState.p2);
  const pontos = calcularVencedorConfronto(cmp);

  renderConfrontoArena(ConfrontoState.p1, ConfrontoState.p2);
  renderConfrontoCards(ConfrontoState.p1, ConfrontoState.p2, cmp);
  renderVeredito(ConfrontoState.p1, ConfrontoState.p2, pontos);

  document.getElementById('btn-copiar-confronto').onclick = () =>
    copyConfrontoWhatsApp(ConfrontoState.p1, ConfrontoState.p2, cmp, pontos);
  document.getElementById('btn-trocar-combatentes').onclick = initConfronto;

  showConfrontoStep(3);

  // [FASE 6] Partículas no VS ao entrar na arena — [H1] momento vibrante
  const vsEl = document.getElementById('arena-vs');
  if (vsEl) setTimeout(() => spawnVsParticles(vsEl), 600);
}

function renderConfrontoArena(p1, p2) {
  const score1 = calcularScore(p1);
  const score2 = calcularScore(p2);
  const info1  = getScoreInfo(score1);
  const info2  = getScoreInfo(score2);

  const a1 = document.getElementById('arena-p1-avatar');
  const a2 = document.getElementById('arena-p2-avatar');
  const n1 = document.getElementById('arena-p1-nome');
  const n2 = document.getElementById('arena-p2-nome');
  const s1 = document.getElementById('arena-p1-score');
  const s2 = document.getElementById('arena-p2-score');

  if (a1) a1.innerHTML = buildAvatarHTML(p1.nome, 'lg');
  if (a2) a2.innerHTML = buildAvatarHTML(p2.nome, 'lg');
  if (n1) n1.textContent = p1.nome;
  if (n2) n2.textContent = p2.nome;
  if (s1) { s1.textContent = `${score1}%`; s1.style.color = info1.color; }
  if (s2) { s2.textContent = `${score2}%`; s2.style.color = info2.color; }
}

function compararParticipantes(p1, p2) {
  const score1 = calcularScore(p1);
  const score2 = calcularScore(p2);
  const cat1   = getCategoriaMaisFrequente(p1);
  const cat2   = getCategoriaMaisFrequente(p2);
  const media1 = p1.estatisticas.totalSessoes > 0
    ? p1.estatisticas.totalPago / p1.estatisticas.totalSessoes : 0;
  const media2 = p2.estatisticas.totalSessoes > 0
    ? p2.estatisticas.totalPago / p2.estatisticas.totalSessoes : 0;

  const w = (v1, v2, lowerBetter = false) => {
    if (v1 === v2) return 'draw';
    if (lowerBetter) return v1 < v2 ? 'p1' : 'p2';
    return v1 > v2 ? 'p1' : 'p2';
  };

  return {
    totalPago: { v1: p1.estatisticas.totalPago,           v2: p2.estatisticas.totalPago,           winner: w(p1.estatisticas.totalPago, p2.estatisticas.totalPago) },
    score:     { v1: score1,                              v2: score2,                              winner: w(score1, score2) },
    sessoes:   { v1: p1.estatisticas.totalSessoes,        v2: p2.estatisticas.totalSessoes,        winner: w(p1.estatisticas.totalSessoes, p2.estatisticas.totalSessoes) },
    devendo:   { v1: p1.estatisticas.sessoesFicouDevendo, v2: p2.estatisticas.sessoesFicouDevendo, winner: w(p1.estatisticas.sessoesFicouDevendo, p2.estatisticas.sessoesFicouDevendo, true) },
    badges:    { v1: p1.badgesDesbloqueados?.length || 0, v2: p2.badgesDesbloqueados?.length || 0, winner: w(p1.badgesDesbloqueados?.length || 0, p2.badgesDesbloqueados?.length || 0) },
    mediaPago: { v1: media1,                              v2: media2,                              winner: w(media1, media2) },
    categoria: { v1: cat1,                               v2: cat2,                               winner: 'draw' },
  };
}

function calcularVencedorConfronto(cmp) {
  let pts1 = 0, pts2 = 0;
  Object.values(cmp).forEach(({ winner }) => {
    if (winner === 'p1')   pts1++;
    else if (winner === 'p2') pts2++;
    else { pts1 += 0.5; pts2 += 0.5; }
  });
  return { pts1, pts2, winner: pts1 > pts2 ? 'p1' : pts2 > pts1 ? 'p2' : 'draw' };
}

function renderConfrontoCards(p1, p2, cmp) {
  const container = document.getElementById('confronto-cards');
  if (!container) return;

  const cards = [
    {
      icon: '💰', titulo: 'Maior Gastador',
      data: cmp.totalPago,
      r1: () => formatBRL(cmp.totalPago.v1), r2: () => formatBRL(cmp.totalPago.v2),
      txt: {
        p1: ['Esse aí não poupa no rolê 💸', 'Bankzão no bar 👑', 'Tira foto do extrato e chora no banheiro 😂'],
        p2: ['Gastou mais — e agora? 💸', 'Generoso demais pro próprio bolso 😅', 'Gastou mais que aluguel'],
        draw: ['Dois falidos na mesma conta 😂', 'Empataram no rombo do mês 💸'],
      },
    },
    {
      icon: '⭐', titulo: 'Score de Confiança',
      data: cmp.score,
      r1: () => `${cmp.score.v1}%`, r2: () => `${cmp.score.v2}%`,
      txt: {
        p1: ['Esse não some na hora de pagar 🫡', 'Palavra de honra no Pix 💪', 'Referência de pagador'],
        p2: ['Score superior, humildade também 🏆', 'Mais confiável no histórico', 'Paga em dia ou na pressão'],
        draw: ['Dois suspeitos com o mesmo score 👀', 'Quem vai pagar? 🤡'],
      },
    },
    {
      icon: '📅', titulo: 'Presenças no Rolê',
      data: cmp.sessoes,
      r1: () => `${cmp.sessoes.v1} sessão${cmp.sessoes.v1 !== 1 ? 'ões' : ''}`,
      r2: () => `${cmp.sessoes.v2} sessão${cmp.sessoes.v2 !== 1 ? 'ões' : ''}`,
      txt: {
        p1: ['Ícone do rolê 🌟', 'Nunca falta, nunca falha 🏆', 'Tá em tudo quanto é festinha'],
        p2: ['Mais presença, mais responsabilidade 💪', 'Participou mais — sofreu mais 😂', 'O mais fiel da turma'],
        draw: ['Dois viciados em rolê 🎉', 'Empataram na participação'],
      },
    },
    {
      icon: '😅', titulo: 'Calotes no Histórico',
      data: cmp.devendo,
      r1: () => `${cmp.devendo.v1} vez${cmp.devendo.v1 !== 1 ? 'es' : ''}`,
      r2: () => `${cmp.devendo.v2} vez${cmp.devendo.v2 !== 1 ? 'es' : ''}`,
      txt: {
        p1: ['Menos calote, mais respeito 🫡', 'Honrou mais a dívida', 'O mais limpo do confronto!'],
        p2: ['Deve menos, ou pelo menos finge 😅', 'Menos caloteiro por enquanto', 'Tá em reabilitação'],
        draw: ['Dois caloteiros na mesma conta 💀', 'A gangue do Pix que não vai'],
      },
    },
    {
      icon: '🎖️', titulo: 'Conquistas',
      data: cmp.badges,
      r1: () => `${cmp.badges.v1} badge${cmp.badges.v1 !== 1 ? 's' : ''}`,
      r2: () => `${cmp.badges.v2} badge${cmp.badges.v2 !== 1 ? 's' : ''}`,
      txt: {
        p1: ['Mais conquistas que o rival 🏅', 'Colecionador de glórias 🌟', 'Museu de badges'],
        p2: ['Mais títulos no currículo 🎖️', 'Parede de troféus 🏆', 'Invicto no ranking'],
        draw: ['Mesma quantidade de glória — ou de vergonha 😅', 'Empataram nos títulos 🏅'],
      },
    },
    {
      icon: '💸', titulo: 'Gasto Médio por Rolê',
      data: cmp.mediaPago,
      r1: () => formatBRL(cmp.mediaPago.v1), r2: () => formatBRL(cmp.mediaPago.v2),
      txt: {
        p1: ['Por sessão, esse aí não brinca 💸', 'Média impressionante pro cartão 😬', 'Gasta bem, sofre bem'],
        p2: ['Mais pesado por saída 💰', 'O custo médio desse é salgado', 'Fatura toda mês por causa desse'],
        draw: ['Mesma média de destruição do salário 😂', 'Empataram no custo por rolê'],
      },
    },
    {
      icon: '🍕', titulo: 'Rolê Favorito',
      data: cmp.categoria,
      r1: () => `${cmp.categoria.v1.icon} ${cmp.categoria.v1.nome}`,
      r2: () => `${cmp.categoria.v2.icon} ${cmp.categoria.v2.nome}`,
      txt: {
        p1: null, p2: null,
        draw: ['Cada um no seu estilo 🎭', 'Gostos diferentes, conta igual 😅', 'Rolês distintos, Pix igual'],
      },
    },
  ];

  container.innerHTML = cards.map(card => {
    const { winner } = card.data;
    const w1 = winner === 'p1';
    const w2 = winner === 'p2';

    let zoeira;
    if (!card.txt.p1 || winner === 'draw') {
      zoeira = pickRandom(card.txt.draw);
    } else if (w1) {
      zoeira = pickRandom(card.txt.p1);
    } else {
      zoeira = pickRandom(card.txt.p2);
    }

    const dirLabel = w1 ? '← vence' : w2 ? 'vence →' : 'empate';

    return `
      <div class="confronto-card ${w1 ? 'winner-left' : w2 ? 'winner-right' : 'draw'}" role="listitem">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-lg" aria-hidden="true">${card.icon}</span>
          <span class="font-bold text-sm">${card.titulo}</span>
          <span class="text-xs text-white/40 ml-auto">${dirLabel}</span>
        </div>
        <div class="flex justify-between items-center gap-3">
          <span class="text-sm font-black ${w1 ? 'text-primary-light' : 'text-white/50'}">${card.r1()}</span>
          <span class="text-xs text-white/30">VS</span>
          <span class="text-sm font-black ${w2 ? 'text-primary-light' : 'text-white/50'}">${card.r2()}</span>
        </div>
        <p class="text-xs text-white/40 italic mt-2 text-center">${zoeira}</p>
      </div>
    `;
  }).join('');
}

function renderVeredito(p1, p2, pontos) {
  const container = document.getElementById('confronto-veredito');
  if (!container) return;

  const { pts1, pts2, winner } = pontos;

  const txtVencedor = [
    'Destruiu na comparação 💀',
    'Sem apelação, levou tudo 👑',
    'Não foi nem difícil 😌',
    'Quem tem moral fala 🎤',
  ];
  const txtEmpate = [
    'Dois lados, mesma rocha 🪨',
    'Empate digno entre dois suspeitos 😅',
    'Tecnicamente, os dois estão devendo pra vida',
  ];

  if (winner === 'draw') {
    container.innerHTML = `
      <div class="veredito-card draw">
        <div class="text-4xl mb-2" aria-hidden="true">🤝</div>
        <p class="font-black text-xl mb-1">Empate épico!</p>
        <p class="veredito-placar">${pts1} × ${pts2}</p>
        <p class="text-sm text-white/60 mt-2">${pickRandom(txtEmpate)}</p>
      </div>
    `;
    return;
  }

  const vencedor = winner === 'p1' ? p1 : p2;
  const perdedor = winner === 'p1' ? p2 : p1;
  const wPts     = winner === 'p1' ? pts1 : pts2;
  const lPts     = winner === 'p1' ? pts2 : pts1;
  const wInfo    = getScoreInfo(calcularScore(vencedor));

  container.innerHTML = `
    <div class="veredito-card winner">
      <div class="text-4xl mb-2" aria-hidden="true">🏆</div>
      <p class="text-xs text-white/50 mb-1 font-semibold uppercase tracking-widest">Vencedor</p>
      <p class="font-black text-2xl mb-1" style="color:${wInfo.color};">${escapeHTML(vencedor.nome)}</p>
      <p class="veredito-placar">${wPts} × ${lPts}</p>
      <p class="text-xs text-white/50 mt-1">${escapeHTML(perdedor.nome)} ficou pra trás</p>
      <p class="text-sm text-white/60 mt-2 italic">${pickRandom(txtVencedor)}</p>
    </div>
  `;
}

function copyConfrontoWhatsApp(p1, p2, cmp, pontos) {
  const { pts1, pts2, winner } = pontos;
  const vencedorNome = winner === 'draw' ? null
    : winner === 'p1' ? p1.nome : p2.nome;

  const lines = [
    `⚔️ *TaNaRocha — Confronto Direto*`,
    ``,
    `*${p1.nome}* vs *${p2.nome}*`,
    ``,
    `💰 Total pago: ${formatBRL(cmp.totalPago.v1)} × ${formatBRL(cmp.totalPago.v2)}`,
    `⭐ Score: ${cmp.score.v1}% × ${cmp.score.v2}%`,
    `📅 Sessões: ${cmp.sessoes.v1} × ${cmp.sessoes.v2}`,
    `😅 Calotes: ${cmp.devendo.v1} × ${cmp.devendo.v2}`,
    ``,
    winner === 'draw'
      ? `🤝 *Empate! ${pts1} × ${pts2}* — dois suspeitos iguais 😂`
      : `🏆 *Vencedor: ${vencedorNome}!* (${Math.max(pts1, pts2)} × ${Math.min(pts1, pts2)})`,
    ``,
    `_Calculado pelo TaNaRocha 🪨_`,
  ];

  const text = lines.join('\n');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('📱 Confronto copiado! Cola no grupo 🔥', 'success'))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

// -----------------------------------------------
// [FASE 6] LOGO EASTER EGG — 5 toques rápidos
// [H10] Deleite oculto — descoberta natural, não documentada
// -----------------------------------------------

function setupLogoEasterEgg() {
  const logo = document.getElementById('logo-home-img');
  if (!logo) return;
  let taps = 0;
  let timer = null;

  logo.addEventListener('click', () => {
    taps++;
    clearTimeout(timer);
    timer = setTimeout(() => { taps = 0; }, 3000);

    if (taps >= 5) {
      taps = 0;
      showConfetti();
      setTimeout(stopConfetti, 2200);
      showToast('🎉 Easter egg desbloqueado! Bora rachar?', 'success', 3000);
    }
  });
}

// -----------------------------------------------
// [FASE 6] DRAG-TO-SCROLL — filtros horizontais
// [H7] Flexibilidade — drag, swipe touch ou clique
// -----------------------------------------------

function setupDragScroll(el) {
  if (el._dragAttached) return;
  el._dragAttached = true;

  let isDown = false;
  let startX, scrollLeft, velocity, lastX, lastTime, rafId;
  const container = el.closest('.drag-scroll-container');

  function updateOverflow() {
    if (!container) return;
    container.classList.toggle('has-overflow-left',  el.scrollLeft > 4);
    container.classList.toggle('has-overflow-right', el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }

  el.addEventListener('mousedown', (e) => {
    isDown = true;
    el.classList.add('dragging');
    startX    = e.pageX - el.offsetLeft;
    scrollLeft = el.scrollLeft;
    velocity  = 0;
    lastX     = e.pageX;
    lastTime  = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
  });

  el.addEventListener('mouseleave', () => { if (isDown) finishDrag(); });
  el.addEventListener('mouseup',    () => { if (isDown) finishDrag(); });

  el.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    el.scrollLeft = scrollLeft - (x - startX) * 1.2;
    const now = performance.now();
    const dt  = now - lastTime;
    if (dt > 0) velocity = (e.pageX - lastX) / dt;
    lastX    = e.pageX;
    lastTime = now;
  });

  function finishDrag() {
    isDown = false;
    el.classList.remove('dragging');
    function inertia() {
      if (Math.abs(velocity) < 0.05) { rafId = null; updateOverflow(); return; }
      el.scrollLeft -= velocity * 8;
      velocity *= 0.92;
      rafId = requestAnimationFrame(inertia);
    }
    inertia();
  }

  el.addEventListener('scroll', updateOverflow, { passive: true });
  updateOverflow();
  window.addEventListener('resize', updateOverflow);
}

function initDragScrolls() {
  document.querySelectorAll('.drag-scroll').forEach(setupDragScroll);
}

// -----------------------------------------------
// [FASE 6] PARTÍCULAS VS — Confronto Direto
// -----------------------------------------------

function spawnVsParticles(vsEl) {
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('span');
    p.className = 'vs-particle';
    p.style.left = `${Math.random() * 90}%`;
    p.style.animationDelay = `${(Math.random() * 0.35).toFixed(2)}s`;
    vsEl.appendChild(p);
    setTimeout(() => p.remove(), 1800);
  }
}

// -----------------------------------------------
// INICIALIZAÇÃO DO APP — listeners one-time
// -----------------------------------------------

function init() {
  // [H1] Remove splash após animação (1.7s = 1.2s delay + 0.5s exit)
  setTimeout(() => document.getElementById('splash-screen')?.remove(), 1700);

  loadFriends();  // carrega perfis de participantes
  loadHistory();
  loadSession();

  // [H10] Onboarding
  if (!localStorage.getItem(LS_ONBOARD)) {
    document.getElementById('onboarding-overlay').classList.remove('hidden');
  }
  document.getElementById('btn-close-onboarding').onclick = () => {
    localStorage.setItem(LS_ONBOARD, '1');
    document.getElementById('onboarding-overlay').classList.add('hidden');
  };

  // Botões da home
  document.getElementById('btn-nova-rachada').onclick = () => {
    clearSession();
    initNovaSessao();
    showScreen('screen-nova-sessao');
  };
  document.getElementById('btn-amigos').onclick = () => {
    renderAmigos();
    showScreen('screen-amigos');
  };
  document.getElementById('btn-historico').onclick = () => {
    renderHistorico();
    showScreen('screen-historico');
  };
  document.getElementById('btn-podio').onclick = () => {
    initPodio();
    showScreen('screen-podio');
  };
  document.getElementById('btn-confronto').onclick = () => {
    initConfronto();
    showScreen('screen-confronto');
  };

  // Nova sessão
  const inputEvent       = document.getElementById('input-event-name');
  const inputParticipant = document.getElementById('input-participant-name');

  inputEvent.addEventListener('input', () => {
    AppState.session.eventName = inputEvent.value.trim();
    saveSession();
    document.getElementById('error-event-name').classList.add('hidden');
    inputEvent.classList.remove('error');
  });

  inputParticipant.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addParticipant(); }
  });

  // Filtra chips ao digitar — [H7] autocompletar por correspondência
  inputParticipant.addEventListener('input', () => {
    renderChipsSugestao(inputParticipant.value.trim());
  });

  // [FIX] Wrapper evita que o MouseEvent seja passado como nameOverride
  document.getElementById('btn-add-participant').onclick = () => addParticipant();

  document.getElementById('btn-avancar-modo').onclick = () => {
    if (!AppState.session.eventName) {
      const errEl = document.getElementById('error-event-name');
      errEl.classList.remove('hidden');
      inputEvent.classList.add('error');
      inputEvent.focus();
      return;
    }
    if (AppState.session.participants.length < 2) {
      showToast('⚠️ Adicione pelo menos 2 participantes para continuar', 'error');
      return;
    }
    initModo();
    showScreen('screen-modo');
  };

  // Tela Meus Amigos — FAB e botões
  document.getElementById('btn-fab-add-amigo').onclick    = openAddAmigoModal;
  document.getElementById('btn-add-amigo-empty').onclick  = openAddAmigoModal;
  document.getElementById('btn-modo-demo').onclick        = activateDemoMode;
  document.getElementById('btn-limpar-demo').onclick      = clearDemoMode;

  initBackButtons();
  initLogoLongPress();  // toque longo para Modo Demo
  setupLogoEasterEgg(); // [FASE 6] [EASTER_EGG] 5 toques rápidos
  initInstallBanner();  // [PWA] banner de instalação
  initRipple();         // [H1] ripple feedback em botões
  initDragScrolls();    // [FASE 6] drag-to-scroll nos filtros horizontais
  initHome();
  showScreen('screen-home');
}

// Expõe funções globais necessárias pelos handlers inline no HTML
window.removeParticipant    = removeParticipant;
window.addItem              = addItem;
window.removeItem           = removeItem;
window.changeItemValue      = changeItemValue;
window.changeItemValueDraft = changeItemValueDraft;
window.handleItemEnter      = handleItemEnter;
window.toggleCard           = toggleCard;
window.togglePaid           = togglePaid;
window.showScreen           = showScreen;
window.addParticipant       = addParticipant;
window.removeAmigo          = removeAmigo;
window.setCategoria         = setCategoria;
window.setHistoricoFiltro   = setHistoricoFiltro;
window.selectGuerreiro      = selectGuerreiro;
window.initConfronto        = initConfronto;

document.addEventListener('DOMContentLoaded', init);
