/* ============================================================
   Sparks Dinheiro – app.js
   Lógica principal: frases, favoritos, export, premium, UI
   ============================================================ */

'use strict';

/* ─── Estado global ─── */
const State = {
  frases:      [],
  currentId:   null,
  history:     [],
  favorites:   [],
  username:    '',
  isPremium:   false,
  view:        'home',
  toastTimer:  null,
};

/* ─── Seletores de DOM ─── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

/* ─── Inicialização ─── */
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  loadFrases();
  registerServiceWorker();
});

/* ─── Service Worker ─── */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .then(() => console.log('[SW] Registrado com sucesso.'))
      .catch((err) => console.warn('[SW] Falha:', err));
  }
}

/* ─── LocalStorage — prefixo sd_ (Spark Dinheiro) ─── */
function loadFromStorage() {
  State.username  = localStorage.getItem('sd_username')  || '';
  State.isPremium = localStorage.getItem('sd_premium') === 'true';
  State.favorites = JSON.parse(localStorage.getItem('sd_favorites') || '[]');
  State.history   = JSON.parse(localStorage.getItem('sd_history')   || '[]');
}

function saveUsername(name) {
  localStorage.setItem('sd_username', name);
  State.username = name;
}

function saveFavorites() {
  localStorage.setItem('sd_favorites', JSON.stringify(State.favorites));
}

function saveHistory() {
  localStorage.setItem('sd_history', JSON.stringify(State.history));
}

function activatePremium(bool) {
  State.isPremium = bool;
  localStorage.setItem('sd_premium', bool ? 'true' : 'false');
}

/* ─── Carregar frases do JSON ─── */
async function loadFrases() {
  try {
    const base = window.location.pathname.endsWith('/')
      ? window.location.pathname
      : window.location.pathname.replace(/\/[^/]*$/, '/');
    const res = await fetch(`${base}frases.json`);
    if (!res.ok) throw new Error('Falha ao carregar frases.');
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('JSON vazio.');
    State.frases = data;
  } catch (err) {
    console.error('[Sparks Dinheiro] Erro ao carregar frases.json:', err);
    State.frases = [
      { id: 1, text: "Foco não é fazer muitas coisas.\nÉ o que você guarda e multiplica.\nComece hoje." },
      { id: 2, text: "Dívida é escravidão voluntária.\nLiberdade financeira é uma decisão.\nEscolha agora." },
      { id: 3, text: "O rico investe primeiro, gasta o resto.\nO pobre gasta primeiro, investe o resto.\nMude a ordem." }
    ];
  }

  showScreen('app');
  setupAppScreen();

  if (!State.username) {
    showScreen('welcome');
    setupWelcomeScreen();
  } else {
    showRandomFrase();
  }
}

/* ─── Telas ─── */
function showScreen(screen) {
  const welcome = $('#screen-welcome');
  const app     = $('#screen-app');
  if (screen === 'welcome') {
    welcome.style.display = 'flex';
    app.style.display     = 'none';
  } else {
    welcome.style.display = 'none';
    app.style.display     = 'flex';
  }
}

/* ─── Tela de Boas-vindas ─── */
function setupWelcomeScreen() {
  const input    = $('#welcome-input');
  const btnStart = $('#btn-start');

  input.focus();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleStart();
  });

  btnStart.addEventListener('click', handleStart);

  function handleStart() {
    const name = input.value.trim();
    if (!name) {
      input.focus();
      input.style.borderColor = '#E53E3E';
      setTimeout(() => { input.style.borderColor = ''; }, 1200);
      return;
    }
    saveUsername(name);
    showScreen('app');
    setupAppScreen();
    showRandomFrase();
  }
}

/* ─── Tela Principal ─── */
let appScreenReady = false;

function setupAppScreen() {
  updateGreeting();

  if (appScreenReady) return;
  appScreenReady = true;

  $('#btn-next').addEventListener('click', showRandomFrase);
  $('#btn-fav').addEventListener('click', toggleFavorite);
  $('#btn-share').addEventListener('click', handleShare);
  $('#btn-export').addEventListener('click', handleExport);

  $('#nav-home').addEventListener('click', () => switchView('home'));
  $('#nav-favs').addEventListener('click', () => switchView('favorites'));
  $('#nav-premium').addEventListener('click', openPremiumModal);

  $('#modal-close').addEventListener('click', closePremiumModal);
  $('#btn-buy').addEventListener('click', handleBuyPremium);
  $('#btn-demo-premium').addEventListener('click', handleDemoPremium);
  $('#modal-overlay').addEventListener('click', (e) => {
    if (e.target === $('#modal-overlay')) closePremiumModal();
  });

  const bannerBtn = $('#btn-banner-premium');
  if (bannerBtn) bannerBtn.addEventListener('click', openPremiumModal);

  updatePremiumUI();
}

/* ─── Saudação ─── */
function updateGreeting() {
  const el = $('#greeting-name');
  if (el) el.textContent = `Prospere, ${State.username}.`;
}

/* ─── Exibir frase aleatória ─── */
function showRandomFrase() {
  if (!State.frases.length) return;

  let available = State.frases.filter(f => !State.history.includes(f.id));

  if (available.length === 0) {
    State.history = [];
    available = State.frases.slice();
    saveHistory();
  }

  const pool = available.length > 1
    ? available.filter(f => f.id !== State.currentId)
    : available;

  const frase = pool[Math.floor(Math.random() * pool.length)];

  State.currentId = frase.id;
  State.history.push(frase.id);
  saveHistory();

  renderFrase(frase);
  updateFavButton();
}

/* ─── Renderizar frase no card ─── */
function renderFrase(frase) {
  const raw   = frase.text || '';
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const sparkEl = $('#spark-text');

  sparkEl.innerHTML = lines
    .map((line, i) => `<p class="line line-${i + 1}">${escapeHtml(line)}</p>`)
    .join('');

  const idEl = $('#spark-id');
  if (idEl) idEl.textContent = `#${String(frase.id).padStart(3, '0')} de ${State.frases.length}`;
}

/* ─── Favoritar ─── */
function toggleFavorite() {
  if (State.currentId === null) return;
  const idx = State.favorites.indexOf(State.currentId);
  if (idx === -1) {
    State.favorites.push(State.currentId);
    showToast('⭐ Adicionado aos favoritos');
  } else {
    State.favorites.splice(idx, 1);
    showToast('Removido dos favoritos');
  }
  saveFavorites();
  updateFavButton();
  if (State.view === 'favorites') renderFavoritesList();
}

function updateFavButton() {
  const btn = $('#btn-fav');
  if (!btn) return;
  const isFav = State.favorites.includes(State.currentId);
  btn.classList.toggle('active', isFav);
  const svg = btn.querySelector('svg');
  if (svg) svg.style.fill = isFav ? 'var(--fav-active)' : 'none';
}

/* ─── Compartilhar ─── */
async function handleShare() {
  if (State.currentId === null) return;
  const frase = State.frases.find(f => f.id === State.currentId);
  if (!frase) return;

  const text = `✨ Spark do dia:\n\n${frase.text}\n\n— Sparks Dinheiro`;

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Sparks Dinheiro', text });
    } catch (_) {}
  } else {
    try {
      await navigator.clipboard.writeText(text);
      showToast('📋 Copiado para a área de transferência');
    } catch (_) {
      showToast('Compartilhamento não suportado');
    }
  }
}

/* ─── Exportar como imagem (Canvas) ─── */
function handleExport() {
  if (State.currentId === null) return;
  const frase = State.frases.find(f => f.id === State.currentId);
  if (!frase) return;
  exportToCanvas(frase, State.isPremium);
}

function exportToCanvas(frase, premium) {
  const W      = 1080;
  const H      = 1080;
  const MARGIN = 120;
  const MAX_W  = W - MARGIN * 2;
  const FONT   = 'Arial, sans-serif';

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  function wrapText(text, fontSize, weight, italic) {
    const italicStr = italic ? 'italic ' : '';
    ctx.font = `${italicStr}${weight} ${fontSize}px ${FONT}`;
    const words = text.split(' ');
    const rows  = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width > MAX_W && current) {
        rows.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) rows.push(current);
    return rows;
  }

  /* ── Fundo branco ── */
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  /* ── Borda gradiente laranja topo ── */
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#B8972A');
  grad.addColorStop(1, '#D4B84A');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 12);

  /* ── Logo ── */
  ctx.font      = `bold 34px ${FONT}`;
  ctx.fillStyle = '#B8972A';
  ctx.textAlign = 'left';
  ctx.fillText('Sparks Dinheiro', MARGIN, 88);

  /* ── Linha divisória ── */
  ctx.strokeStyle = '#FFF0CC';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN, 112);
  ctx.lineTo(W - MARGIN, 112);
  ctx.stroke();

  /* ── Calcular linhas para centralizar verticalmente ── */
  const rawLines   = frase.text.split('\n').map(l => l.trim()).filter(Boolean);
  const lineStyles = [
    { size: 64, weight: 'bold',   color: '#B8972A', gap: 40, italic: false },
    { size: 48, weight: '400',    color: '#6B7280', gap: 36, italic: false },
    { size: 54, weight: 'bold',   color: '#1A1A2E', gap: 0,  italic: true  },
  ];

  const allRows = [];
  rawLines.forEach((line, i) => {
    const st   = lineStyles[i] || lineStyles[2];
    const rows = wrapText(line, st.size, st.weight, st.italic);
    rows.forEach((row, ri) => {
      allRows.push({ text: row, style: st, isLast: ri === rows.length - 1 });
    });
  });

  const totalH = allRows.reduce((acc, r, idx) => {
    const lineH = r.style.size * 1.35;
    const gap   = (r.isLast && idx < allRows.length - 1) ? r.style.gap : 0;
    return acc + lineH + gap;
  }, 0);

  const areaTop = 160;
  const areaBot = H - 180;
  const areaH   = areaBot - areaTop;
  let y = areaTop + (areaH - totalH) / 2 + lineStyles[0].size;
  if (y < areaTop + 60) y = areaTop + 60;

  /* ── Renderizar linhas ── */
  allRows.forEach((r, idx) => {
    const italic = r.style.italic ? 'italic ' : '';
    ctx.font      = `${italic}${r.style.weight} ${r.style.size}px ${FONT}`;
    ctx.fillStyle = r.style.color;
    ctx.textAlign = 'center';
    ctx.fillText(r.text, W / 2, y);
    const lineH = r.style.size * 1.35;
    const gap   = (r.isLast && idx < allRows.length - 1) ? r.style.gap : 0;
    y += lineH + gap;
  });

  /* ── Rodapé ── */
  if (premium) {
    const name = State.username || 'Próspero';

    ctx.strokeStyle = '#FFF0CC';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 140, H - 138);
    ctx.lineTo(W / 2 + 140, H - 138);
    ctx.stroke();

    ctx.font      = `400 24px ${FONT}`;
    ctx.fillStyle = '#B0BEC5';
    ctx.textAlign = 'center';
    ctx.fillText('compartilhado por', W / 2, H - 98);

    ctx.font      = `bold 46px ${FONT}`;
    ctx.fillStyle = '#C9963A';
    ctx.fillText(name, W / 2, H - 46);

  } else {
    ctx.font      = `400 24px ${FONT}`;
    ctx.fillStyle = '#CBD5E0';
    ctx.textAlign = 'center';
    ctx.fillText('Gerado no Sparks Dinheiro', W / 2, H - 60);
  }

  /* ── Download ── */
  const link = document.createElement('a');
  link.download = `sparks-dinheiro-${frase.id}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();

  showToast(premium ? '🖼️ Imagem exportada!' : '🖼️ Imagem exportada (free)');
}

/* ─── Navegação entre views ─── */
function switchView(view) {
  State.view = view;

  const homeSection = $('#home-section');
  const favsSection = $('#favorites-section');
  const navHome     = $('#nav-home');
  const navFavs     = $('#nav-favs');

  if (view === 'home') {
    homeSection.style.display = 'contents';
    favsSection.classList.remove('visible');
    navHome.classList.add('active');
    navFavs.classList.remove('active');
  } else {
    homeSection.style.display = 'none';
    favsSection.classList.add('visible');
    navFavs.classList.add('active');
    navHome.classList.remove('active');
    renderFavoritesList();
  }
}

/* ─── Lista de favoritos ─── */
function renderFavoritesList() {
  const list    = $('#favorites-list');
  const counter = $('#favorites-count');
  if (!list) return;

  const total = State.favorites.length;
  if (counter) counter.textContent = `${total} spark${total !== 1 ? 's' : ''}`;

  if (!total) {
    list.innerHTML = `<p class="empty-favorites">Nenhum spark favoritado ainda.<br>Toque em ⭐ para salvar.</p>`;
    return;
  }

  list.innerHTML = State.favorites
    .map(id => {
      const frase = State.frases.find(f => f.id === id);
      if (!frase) return '';
      const lines = frase.text.split('\n').map(l => l.trim()).filter(Boolean);
      const linesHtml = lines
        .map((line, i) => `<p class="line line-${i + 1}">${escapeHtml(line)}</p>`)
        .join('');
      return `
        <div class="fav-card">
          <div class="fav-card-header">
            <span class="fav-card-id">#${String(id).padStart(3, '0')} de ${State.frases.length}</span>
          </div>
          <div class="fav-card-text">${linesHtml}</div>
          <button class="fav-card-remove" title="Remover" onclick="removeFavorite(${id})">
            ${svgTrash()}
          </button>
        </div>`;
    })
    .join('');
}

window.removeFavorite = function(id) {
  const idx = State.favorites.indexOf(id);
  if (idx !== -1) {
    State.favorites.splice(idx, 1);
    saveFavorites();
    renderFavoritesList();
    showToast('Removido dos favoritos');
  }
};

/* ─── Modal Premium ─── */
function openPremiumModal()  { $('#modal-overlay').classList.add('open'); }
function closePremiumModal() { $('#modal-overlay').classList.remove('open'); }

function handleBuyPremium() {
  activatePremium(true);
  updatePremiumUI();
  closePremiumModal();
  showToast('🎉 Premium ativado! Obrigado!');
}

function handleDemoPremium() {
  const newStatus = !State.isPremium;
  activatePremium(newStatus);
  updatePremiumUI();
  closePremiumModal();
  showToast(newStatus ? '⚡ Modo Premium ativado (demo)' : 'Modo free ativado');
}

/* ─── Atualiza UI com base no status premium ─── */
function updatePremiumUI() {
  const adsContainer    = $('#ads-container');
  const premiumBanner   = $('#premium-banner');
  const navPremiumLabel = $('#nav-premium-label');
  const demoBtn         = $('#btn-demo-premium');

  if (State.isPremium) {
    if (adsContainer)    adsContainer.style.display    = 'none';
    if (premiumBanner)   premiumBanner.style.display   = 'none';
    if (navPremiumLabel) navPremiumLabel.textContent   = '★ Pro';
    if (demoBtn)         demoBtn.textContent           = 'Desativar Premium (demo)';
  } else {
    if (adsContainer)    adsContainer.style.display    = 'flex';
    if (premiumBanner)   premiumBanner.style.display   = 'flex';
    if (navPremiumLabel) navPremiumLabel.textContent   = 'Premium';
    if (demoBtn)         demoBtn.textContent           = 'Ativar Premium (modo demo)';
  }
}

/* ─── Toast ─── */
function showToast(msg, duration = 2400) {
  const toast = $('#toast');
  if (!toast) return;
  if (State.toastTimer) clearTimeout(State.toastTimer);
  toast.textContent = msg;
  toast.classList.add('show');
  State.toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

/* ─── Utilitários ─── */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svgTrash() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>`;
}

/* ─── AdMob ─── */
function initAdMob() {
  if (typeof adsbygoogle !== 'undefined') {
    try {
      (adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.warn('[AdMob] Erro:', e);
    }
  } else {
    setTimeout(initAdMob, 1000);
  }
}

if (!State.isPremium) {
  window.addEventListener('load', initAdMob);
}
