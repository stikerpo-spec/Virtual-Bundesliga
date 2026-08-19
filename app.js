const bodyEl = document.getElementById('standingsBody');
const updatedAtEl = document.getElementById('updatedAt');
const statusPill = document.getElementById('statusPill');
const adminEntry = document.getElementById('adminEntry');
const adminPanel = document.getElementById('adminPanel');
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const editorEl = document.getElementById('editor');
const saveStatus = document.getElementById('saveStatus');

let league = { teams: [], matches: [] };
let socket;

function formatDate(value) {
  if (!value) return '–';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function renderTable(teams) {
  bodyEl.innerHTML = teams.map((t, i) => {
    const diffClass = t.diff > 0 ? 'diff-positive' : t.diff < 0 ? 'diff-negative' : '';
    return `<tr>
      <td class="place">${i + 1}.</td>
      <td class="team">${escapeHtml(t.team)}</td>
      <td>${escapeHtml(t.coach)}</td>
      <td class="center">${t.sp}</td>
      <td class="center">${t.s}</td>
      <td class="center">${t.u}</td>
      <td class="center">${t.n}</td>
      <td class="center">${escapeHtml(t.goals)}</td>
      <td class="center ${diffClass}">${t.diff > 0 ? '+' : ''}${t.diff}</td>
      <td class="center points">${t.points}</td>
    </tr>`;
  }).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function applyLeague(next) {
  league = next;
  renderTable(league.teams || []);
  updatedAtEl.textContent = formatDate(league.updatedAt);
}

function renderEditor() {
  editorEl.innerHTML = (league.teams || []).map((t, idx) => `
    <div class="editor-row" data-index="${idx}">
      ${field('TEAM', 'team', t.team, true)}
      ${field('TRAINER', 'coach', t.coach, true)}
      ${field('TORE', 'goals', t.goals, true)}
      ${field('SP', 'sp', t.sp)}
      ${field('S', 's', t.s)}
      ${field('U', 'u', t.u)}
      ${field('N', 'n', t.n)}
      ${field('DIFF', 'diff', t.diff)}
      ${field('PUNKTE', 'points', t.points)}
    </div>`).join('');
}

function field(label, key, value, wide=false) {
  return `<div class="field ${wide ? 'wide' : ''}"><label>${label}</label><input data-key="${key}" value="${escapeHtml(value)}" ${wide ? '' : 'inputmode="numeric"'}></div>`;
}

function setOnline(online) {
  statusPill.style.borderColor = online ? 'rgba(93,245,138,.35)' : 'rgba(255,110,110,.35)';
  statusPill.style.background = online ? 'rgba(93,245,138,.08)' : 'rgba(255,0,0,.08)';
  statusPill.style.color = online ? '#b9ffcd' : '#ffb9b9';
  statusPill.innerHTML = `<i style="background:${online ? 'var(--green)' : '#ff6b6b'}; box-shadow:0 0 8px ${online ? 'var(--green)' : '#ff6b6b'}"></i> ${online ? 'LIVE' : 'OFFLINE'}`;
}

async function loadLeague() {
  const res = await fetch('/api/league');
  const data = await res.json();
  applyLeague(data);
  if (data.isAdmin) showAdmin();
}

function showAdmin() {
  adminEntry.classList.add('hidden');
  adminPanel.classList.remove('hidden');
  renderEditor();
}

function openModal() {
  loginError.textContent = '';
  loginModal.classList.remove('hidden');
  loginModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('adminCode').focus(), 50);
}

function closeModal() {
  loginModal.classList.add('hidden');
  loginModal.setAttribute('aria-hidden', 'true');
}

document.getElementById('openAdmin').addEventListener('click', openModal);
document.getElementById('closeModal').addEventListener('click', closeModal);
loginModal.addEventListener('click', e => { if (e.target === loginModal) closeModal(); });

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const code = new FormData(loginForm).get('adminCode');
  const res = await fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ code }) });
  const data = await res.json();
  if (!res.ok) {
    loginError.textContent = data.error || 'Login fehlgeschlagen';
    return;
  }
  closeModal();
  showAdmin();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method:'POST' });
  adminPanel.classList.add('hidden');
  adminEntry.classList.remove('hidden');
  saveStatus.textContent = '';
});

document.getElementById('resetBtn').addEventListener('click', renderEditor);

document.getElementById('saveBtn').addEventListener('click', async () => {
  saveStatus.textContent = 'Speichere…';
  const rows = [...editorEl.querySelectorAll('.editor-row')];
  const teams = rows.map((row, idx) => {
    const original = league.teams[idx];
    const out = { id: original.id };
    row.querySelectorAll('input').forEach(input => {
      const key = input.dataset.key;
      const value = input.value.trim();
      out[key] = ['sp','s','u','n','diff','points'].includes(key) ? Number(value || 0) : value;
    });
    return out;
  });

  const res = await fetch('/api/admin/league', {
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ teams })
  });
  const data = await res.json();
  if (!res.ok) {
    saveStatus.textContent = data.error || 'Speichern fehlgeschlagen.';
    saveStatus.style.color = '#ff7b7b';
    return;
  }
  applyLeague(data.league);
  renderEditor();
  saveStatus.textContent = 'Veröffentlicht. Alle verbundenen Zuschauer sehen die Änderung jetzt live.';
  saveStatus.style.color = '#9ff7b4';
});

loadLeague().catch(() => setOnline(false));

try {
  socket = io();
  socket.on('connect', () => setOnline(true));
  socket.on('disconnect', () => setOnline(false));
  socket.on('league:update', (data) => {
    applyLeague(data);
    if (!adminPanel.classList.contains('hidden')) renderEditor();
  });
} catch {
  setOnline(false);
}
