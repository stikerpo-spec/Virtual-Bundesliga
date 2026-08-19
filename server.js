const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const session = require('express-session');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT || 3000);
const ADMIN_CODE = process.env.ADMIN_CODE || 'Stikeli';
const SESSION_SECRET = process.env.SESSION_SECRET || 'virtual-bundesliga-dev-secret-change-me';
const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { leagueName: 'VIRTUAL BUNDESLIGA', updatedAt: new Date().toISOString(), teams: [], matches: [] };
  }
}

let league = loadData();
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '1mb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 12
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

function persist() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(league, null, 2));
}

function isAdmin(req) {
  return req.session && req.session.isAdmin === true;
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Nicht autorisiert' });
  next();
}

function normalizeTeam(team) {
  return {
    id: String(team.id || '').trim(),
    team: String(team.team || '').trim(),
    coach: String(team.coach || '').trim(),
    sp: Number(team.sp) || 0,
    s: Number(team.s) || 0,
    u: Number(team.u) || 0,
    n: Number(team.n) || 0,
    goals: String(team.goals || '0:0').trim(),
    diff: Number(team.diff) || 0,
    points: Number(team.points) || 0
  };
}

function sortTeams(teams) {
  return [...teams].sort((a, b) =>
    b.points - a.points ||
    b.diff - a.diff ||
    b.goals.localeCompare(a.goals, undefined, { numeric: true }) ||
    a.team.localeCompare(b.team, 'de')
  );
}

app.get('/api/league', (req, res) => {
  res.json({ ...league, teams: sortTeams(league.teams), isAdmin: isAdmin(req) });
});

app.post('/api/admin/login', (req, res) => {
  const code = String(req.body?.code || '');
  if (code !== ADMIN_CODE) return res.status(403).json({ error: 'Falscher Admin-Code' });
  req.session.isAdmin = true;
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.put('/api/admin/league', requireAdmin, (req, res) => {
  const teams = Array.isArray(req.body?.teams) ? req.body.teams.map(normalizeTeam) : null;
  if (!teams || teams.length === 0) return res.status(400).json({ error: 'Keine Teams übergeben' });

  const ids = new Set();
  for (const team of teams) {
    if (!team.id || !team.team) return res.status(400).json({ error: 'Team-ID und Teamname sind Pflichtfelder' });
    if (ids.has(team.id)) return res.status(400).json({ error: 'Doppelte Team-ID' });
    ids.add(team.id);
  }

  league = {
    ...league,
    teams,
    matches: Array.isArray(req.body.matches) ? req.body.matches : league.matches,
    updatedAt: new Date().toISOString()
  };
  persist();
  const publicPayload = { ...league, teams: sortTeams(league.teams) };
  io.emit('league:update', publicPayload);
  res.json({ ok: true, league: publicPayload });
});

io.on('connection', (socket) => {
  socket.emit('league:update', { ...league, teams: sortTeams(league.teams) });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).end();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Virtual Bundesliga läuft auf http://localhost:${PORT}`);
});
