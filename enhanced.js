import { ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

(() => {
  const state = {
    players: [],
    news: [],
    seasons: [],
    settings: {},
    audit: [],
    matchdays: [],
    selectedSection: "home",
    selectedSeason: "current",
    notificationEnabled: false,
    lastScores: {},
    lastEventIds: new Set(),
    role: localStorage.getItem("vblAdminRole") || "Super Admin"
  };

  const APP = () => window.VBL_APP || {};
  const teams = () => APP().getTeams ? APP().getTeams() : [];
  const matches = () => APP().getMatches ? APP().getMatches() : [];
  const db = () => APP().getDb ? APP().getDb() : null;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>\"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const slug = (s) => String(s || "").toLowerCase().trim().replace(/[^a-z0-9äöüß]+/gi,"-").replace(/^-|-$/g,"");

  const getTeam = name => teams().find(t => t.team === name);
  const statusLabel = s => ({live:"LIVE", paused:"PAUSIERT", halftime:"HALBZEIT", finished:"BEENDET", postponed:"VERSCHOBEN", next:"GEPLANT"}[s || "next"] || "GEPLANT");
  const parseScore = m => ({h:Number(m.homeScore)||0,a:Number(m.awayScore)||0});

  function liveMinute(m) {
    if ((m.status || "next") === "paused") return "PAUSE";
    if ((m.status || "next") === "halftime") return "HALBZEIT";
    if ((m.status || "next") !== "live") return statusLabel(m.status);
    if (m.autoClock === false) return m.minute || "LIVE";
    if (m.kickoffAt) {
      const start = Date.parse(m.kickoffAt);
      if (!Number.isNaN(start)) {
        const mins = Math.max(0, Math.floor((Date.now() - start) / 60000));
        const cap = Number(m.matchLength) || 90;
        return `${Math.min(mins + 1, cap)}′`;
      }
    }
    return m.minute ? `${m.minute}`.replace(/′?$/,"′") : "LIVE";
  }

  function eventsOf(m) {
    if (Array.isArray(m.events)) return m.events.filter(Boolean);
    if (typeof m.events === "string") {
      try { const parsed = JSON.parse(m.events); return Array.isArray(parsed) ? parsed : []; } catch (_) {}
    }
    return [];
  }

  function eventTypeLabel(type) {
    return ({goal:"TOR", yellow:"GELB", red:"ROT", substitution:"WECHSEL", info:"INFO"}[type] || "EVENT");
  }

  function teamLogo(team, large=false) {
    const t = typeof team === "object" ? team : getTeam(team);
    const name = typeof team === "object" ? team.team : String(team || "");
    const logo = t?.logo;
    if (logo) return `<span class="x-logo ${large ? "large" : ""}"><img src="${esc(logo)}" alt="${esc(name)}"></span>`;
    const initials = name.replace(/[^A-Za-zÄÖÜäöüß0-9 ]/g," ").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "VB";
    return `<span class="x-logo ${large ? "large" : ""}">${esc(initials)}</span>`;
  }

  function injectShell() {
    if ($("portalNav")) return;
    const header = document.querySelector("header.hero");
    const nav = document.createElement("nav");
    nav.id = "portalNav";
    nav.className = "portal-nav";
    nav.innerHTML = `
      <div class="portal-nav-inner">
        <div class="nav-scroll">
          <button data-section="home">ÜBERSICHT</button>
          <button data-section="teams">TEAMS</button>
          <button data-section="players">SPIELER</button>
          <button data-section="stats">STATISTIKEN</button>
          <button data-section="news">NEWS</button>
          <button data-section="archive">ARCHIV</button>
          <button data-section="rules">REGELWERK</button>
          <button data-section="info">INFO</button>
        </div>
        <div class="nav-tools">
          <button id="themeToggle" class="nav-icon" title="Dark/Light">☀</button>
          <button id="notifyToggle" class="nav-icon" title="Live-Benachrichtigungen">🔔</button>
          <button id="searchOpen" class="nav-search">⌕ Suche</button>
        </div>
      </div>
    `;
    header?.after(nav);

    const page = document.querySelector("main.page");
    const portal = document.createElement("div");
    portal.id = "portalContent";
    portal.innerHTML = `
      <section id="portalTeams" class="portal-section hidden"><div class="portal-head"><div><span class="section-kicker">KADER & MANAGER</span><h2>Teams</h2><p>Alle Mannschaften mit Profil, Trainer und Saisonbilanz.</p></div><div class="search-mini"><input id="teamFilter" placeholder="Team suchen…"></div></div><div id="teamGrid" class="team-grid-pro"></div></section>
      <section id="portalPlayers" class="portal-section hidden"><div class="portal-head"><div><span class="section-kicker">SPIELERDATENBANK</span><h2>Spieler</h2><p>Torschützen, Assists und Einsatzdaten auf einen Blick.</p></div><div class="season-filter"><label>Saison<select id="playersSeason"></select></label></div></div><div class="stat-board"><div><strong id="playerCount">0</strong><span>SPIELER</span></div><div><strong id="goalLeaderCount">0</strong><span>TORE</span></div><div><strong id="assistLeaderCount">0</strong><span>ASSISTS</span></div></div><div id="playerGrid" class="player-grid"></div></section>
      <section id="portalStats" class="portal-section hidden"><div class="portal-head"><div><span class="section-kicker">LIGA-DATEN</span><h2>Statistiken</h2><p>Automatisch aus Ergebnissen und eingetragenen Spielereignissen berechnet.</p></div></div><div id="leagueStats" class="stats-grid-pro"></div><div class="stats-columns"><div class="portal-box"><h3>Torschützenliste</h3><div id="scorerTable"></div></div><div class="portal-box"><h3>Assists</h3><div id="assistTable"></div></div></div><div class="portal-box"><h3>Weitere Liga-Statistiken</h3><div id="teamStatsTable"></div></div></section>
      <section id="portalNews" class="portal-section hidden"><div class="portal-head"><div><span class="section-kicker">VBL NEWS</span><h2>News & Meldungen</h2><p>Alle Neuigkeiten rund um die Liga.</p></div><div class="news-tools"><input id="newsFilter" placeholder="News suchen…"></div></div><div id="newsGrid" class="news-grid"></div></section>
      <section id="portalArchive" class="portal-section hidden"><div class="portal-head"><div><span class="section-kicker">HISTORIE</span><h2>Saisonarchiv & Rekorde</h2><p>Vergangene Spielzeiten, Champions und Liga-Bestmarken.</p></div><div class="season-filter"><label>Saison<select id="seasonSelect"></select></label></div></div><div id="archiveGrid" class="archive-grid"></div><div class="portal-box"><h3>Liga-Rekorde</h3><div id="recordsGrid" class="records-grid"></div></div></section>
      <section id="portalRules" class="portal-section hidden"><div class="portal-head"><div><span class="section-kicker">FAIR PLAY</span><h2>Regelwerk</h2><p>Klare Regeln für Spieler, Teams und Spielleitung.</p></div></div><div class="rules-grid"><article><strong>1. Spielbetrieb</strong><p>Spiele werden nach dem offiziellen Spielplan ausgetragen. Statusänderungen müssen im Admin-Bereich sauber dokumentiert werden.</p></article><article><strong>2. Fairness</strong><p>Kein Cheating, kein absichtliches Disconnecten und respektvoller Umgang mit allen Teilnehmern.</p></article><article><strong>3. Ergebnisse</strong><p>Nur bestätigte Ergebnisse zählen für Tabelle, Torschützen und Rekorde.</p></article><article><strong>4. Proteste</strong><p>Unklare Situationen werden mit Zeitstempel und Belegen an die Ligaleitung gemeldet.</p></article></div></section>
      <section id="portalInfo" class="portal-section hidden"><div class="info-grid"><article class="portal-box"><span class="section-kicker">ÜBER DIE LIGA</span><h2>Virtual Bundesliga</h2><p>Die zentrale Plattform für Tabelle, Spielplan, Live-Spiele, Statistiken und Meldungen deiner Liga.</p><div class="info-actions"><button class="red-btn" id="sharePortal">Liga teilen</button><button class="ghost" id="copyPortal">Link kopieren</button></div></article><article class="portal-box"><span class="section-kicker">KONTAKT</span><h3>Ligaleitung</h3><p id="contactText">Kontaktinformationen können im Admin-Bereich hinterlegt werden.</p><div id="socialLinks" class="social-links"></div></article></div></section>
      <section id="portalAdminPlus" class="portal-section admin-plus hidden"><div class="portal-head"><div><span class="section-kicker">ERWEITERTE VERWALTUNG</span><h2>Admin Management</h2><p>Spieler, News, Saisons, Backups, Rollen und Spielereignisse verwalten.</p></div><div class="role-box"><label>Rolle<select id="adminRole"><option>Super Admin</option><option>Match Operator</option><option>News Editor</option><option>Stats Editor</option><option>Viewer</option></select></label></div></div><div class="admin-management-grid"><article><h3>Spieler</h3><div id="playerAdminList"></div><div class="admin-buttons"><button id="savePlayersBtn" class="red-btn">Spieler speichern</button><button id="addPlayerBtn" class="ghost">+ Spieler</button></div></article><article><h3>News</h3><div id="newsAdminList"></div><div class="admin-buttons"><button id="saveNewsBtn" class="red-btn">News speichern</button><button id="addNewsBtn" class="ghost">+ News</button></div></article><article><h3>Saisons & Spieltage</h3><div id="seasonAdminList"></div><div id="matchdayAdminList" class="admin-small"></div><div class="admin-buttons"><button id="saveSeasonsBtn" class="red-btn">Saisons speichern</button><button id="addSeasonBtn" class="ghost">+ Saison</button><button id="addMatchdayBtn" class="ghost">+ Spieltag</button></div></article><article><h3>Spielstatus & Events</h3><div id="matchAdminList"></div></article><article><h3>Backup & Wiederherstellung</h3><p class="admin-small">Exportiert Teams, Spiele, Spieler, News, Saisons und Einstellungen als JSON.</p><button id="exportBtn" class="ghost">Backup exportieren</button><label class="file-btn">Backup importieren<input id="importInput" type="file" accept="application/json"></label><button id="restoreDefaultBtn" class="delete">Standards zurücksetzen</button></article><article><h3>Kontakt & Social Media</h3><div class="admin-settings"><input id="adminContact" placeholder="Kontakt / E-Mail"><input id="adminDiscord" placeholder="Discord URL"><input id="adminInstagram" placeholder="Instagram URL"><input id="adminYoutube" placeholder="YouTube URL"><input id="adminTiktok" placeholder="TikTok URL"></div><button id="saveSettingsBtn" class="red-btn">Einstellungen speichern</button></article><article><h3>Änderungsverlauf</h3><div id="auditList" class="audit-list"></div></article></div></section>
      <div id="searchOverlay" class="search-overlay hidden"><div class="search-modal"><div class="search-modal-top"><input id="globalSearch" autofocus placeholder="Teams, Spieler, Spiele, News suchen…"><button id="searchClose" class="ghost">Schließen</button></div><div id="searchResults"></div></div></div>
      <div id="matchModal" class="modal-overlay hidden"><div class="match-modal"><button id="matchModalClose" class="modal-close">×</button><div id="matchDetail"></div></div></div>
    `;
    page.appendChild(portal);
  }

  function section(id) { return $(id); }
  function showSection(name) {
    const map = {home:"home",teams:"portalTeams",players:"portalPlayers",stats:"portalStats",news:"portalNews",archive:"portalArchive",rules:"portalRules",info:"portalInfo"};
    const target = map[name] || "home";
    document.querySelectorAll(".portal-section:not(.admin-plus)").forEach(s=>s.classList.add("hidden"));
    if (target !== "home" && $(target)) {
      $(target).classList.remove("hidden");
      $(target).scrollIntoView({behavior:"smooth", block:"start"});
    } else {
      window.scrollTo({top:0,behavior:"smooth"});
    }
    state.selectedSection=name;
    document.querySelectorAll("#portalNav [data-section]").forEach(b=>b.classList.toggle("active",b.dataset.section===name));
    if (name === "teams") renderTeams();
    if (name === "players") renderPlayers();
    if (name === "stats") renderStats();
    if (name === "news") renderNews();
    if (name === "archive") renderArchive();
  }

  function renderTeams() {
    const filter = ($("teamFilter")?.value || "").toLowerCase();
    const data = teams().filter(t=>String(t.team).toLowerCase().includes(filter) || String(t.trainer||"").toLowerCase().includes(filter));
    $("teamGrid").innerHTML = data.length ? data.map(t=>`<button class="team-pro-card" data-team-link="${esc(t.team)}"><div>${teamLogo(t,true)}</div><span>${esc(t.team)}</span><small>Trainer: ${esc(t.trainer||"–")}</small><strong>${Number(t.points)||0} P</strong></button>`).join("") : `<div class="portal-empty">Keine Teams gefunden.</div>`;
  }

  function derivedPlayers() {
    const map = new Map(state.players.map(p=>[String(p.id), {...p}]));
    matches().forEach(m=>eventsOf(m).forEach((e, idx)=>{
      if (!e.player) return;
      const key = String(e.player).toLowerCase();
      let p = [...map.values()].find(x=>String(x.name||x.player).toLowerCase()===key);
      if (!p) { p={id:`event-${idx}-${slug(e.player)}`,name:e.player,team:e.team||m.home,goals:0,assists:0,apps:0}; map.set(String(p.id),p); }
      if (e.type === "goal") p.goals=(Number(p.goals)||0)+1;
      if (e.type === "assist") p.assists=(Number(p.assists)||0)+1;
    }));
    return [...map.values()].map(p=>({...p, name:p.name||p.player||"Unbekannt", goals:Number(p.goals)||0, assists:Number(p.assists)||0, apps:Number(p.apps)||0}));
  }

  function renderPlayers() {
    const list = derivedPlayers().sort((a,b)=>b.goals-a.goals || b.assists-a.assists || a.name.localeCompare(b.name));
    $("playerCount").textContent=list.length;
    $("goalLeaderCount").textContent=list[0]?.goals||0;
    $("assistLeaderCount").textContent=[...list].sort((a,b)=>b.assists-a.assists)[0]?.assists||0;
    $("playerGrid").innerHTML = list.length ? list.map(p=>`<article class="player-card"><div class="player-avatar">${esc((p.name||"?").slice(0,1).toUpperCase())}</div><div class="player-info"><h3>${esc(p.name)}</h3><p>${esc(p.team||"Ohne Team")}</p></div><div class="player-metrics"><span><b>${p.goals}</b> Tore</span><span><b>${p.assists}</b> Assists</span><span><b>${p.apps}</b> Einsätze</span></div><button class="ghost player-detail" data-player="${esc(p.name)}">Profil</button></article>`).join("") : `<div class="portal-empty">Noch keine Spieler eingetragen. Im Admin-Bereich kannst du Spieler mit Team, Position, Nummer, Toren und Assists anlegen.</div>`;
    fillSeasonSelects();
  }

  function statEvents() {
    const arr=[];
    matches().forEach(m=>eventsOf(m).forEach((e,i)=>arr.push({...e,match:m,eventId:e.id||`${m.id}-${i}`})));
    return arr;
  }

  function renderStats() {
    const ms=matches(); const finished=ms.filter(m=>m.status==="finished");
    const goals=finished.reduce((s,m)=>s+parseScore(m).h+parseScore(m).a,0);
    const avg=finished.length?(goals/finished.length).toFixed(2):"0.00";
    const live=ms.filter(m=>m.status==="live"||m.status==="paused"||m.status==="halftime").length;
    const events=statEvents();
    const cards=[['SPIELE',ms.length],['BEENDET',finished.length],['TORE',goals],['Ø TORE / SPIEL',avg],['LIVE',live],['EVENTS',events.length]];
    $("leagueStats").innerHTML=cards.map(c=>`<div class="big-stat"><span>${c[0]}</span><strong>${c[1]}</strong></div>`).join("");
    const players=derivedPlayers();
    const scorers=[...players].sort((a,b)=>b.goals-a.goals).slice(0,10);
    const assists=[...players].sort((a,b)=>b.assists-a.assists).slice(0,10);
    $("scorerTable").innerHTML=renderStatRows(scorers,"goals");
    $("assistTable").innerHTML=renderStatRows(assists,"assists");
    const tm=teams().map(t=>{const games=finished.filter(m=>m.home===t.team||m.away===t.team); const gs=games.reduce((s,m)=>s+(m.home===t.team?parseScore(m).h:parseScore(m).a),0); return {team:t.team,games:games.length,goals:gs,avg:games.length?(gs/games.length).toFixed(2):"0.00"};}).sort((a,b)=>b.goals-a.goals);
    $("teamStatsTable").innerHTML=`<div class="data-table"><div class="data-row head"><span>TEAM</span><span>SPIELE</span><span>TORE</span><span>Ø</span></div>${tm.map(x=>`<div class="data-row"><span>${esc(x.team)}</span><span>${x.games}</span><span>${x.goals}</span><span>${x.avg}</span></div>`).join("")}</div>`;
  }
  function renderStatRows(list,key){return list.length?`<div class="data-table">${list.map((p,i)=>`<div class="data-row"><span><b>${i+1}.</b> ${esc(p.name)}</span><span>${esc(p.team||"")}</span><strong>${p[key]||0}</strong></div>`).join("")}</div>`:`<div class="portal-empty">Noch keine Daten.</div>`;}

  function renderNews() {
    const q=($("newsFilter")?.value||"").toLowerCase();
    const items=[...state.news].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).filter(n=>`${n.title} ${n.text} ${n.category}`.toLowerCase().includes(q));
    $("newsGrid").innerHTML=items.length?items.map(n=>`<article class="news-card"><div class="news-meta"><span>${esc(n.category||"NEWS")}</span><time>${esc(n.date||"")}</time></div><h3>${esc(n.title||"Meldung")}</h3><p>${esc(n.text||"")}</p><button class="ghost share-news" data-news="${esc(n.id)}">Teilen</button></article>`).join(""):`<div class="portal-empty">Noch keine Meldungen vorhanden.</div>`;
  }

  function fillSeasonSelects(){
    const seasons=state.seasons.length?state.seasons:[{id:"current",name:"Aktuelle Saison",current:true}];
    [$("seasonSelect"),$("playersSeason")].forEach(sel=>{if(!sel)return;sel.innerHTML=seasons.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");sel.value=state.selectedSeason;});
  }

  function renderArchive() {
    fillSeasonSelects();
    const seasons=state.seasons.length?state.seasons:[{id:"current",name:"Aktuelle Saison",current:true}];
    $("archiveGrid").innerHTML=seasons.map(s=>`<article class="archive-card ${s.current?'current':''}"><span>${s.current?'AKTIV':'ARCHIV'}</span><h3>${esc(s.name)}</h3><p>${esc(s.description||"Saison der Virtual Bundesliga")}</p><strong>${esc(s.champion||"Champion noch offen")}</strong><small>${Number(s.matchdays)||availableDays()} Spieltage</small></article>`).join("");
    renderRecords();
  }
  const availableDays=()=>new Set(matches().map(m=>Number(m.matchday)||1)).size;

  function renderRecords() {
    const ms=matches().filter(m=>m.status==="finished");
    const highest=ms.map(m=>({m,total:parseScore(m).h+parseScore(m).a})).sort((a,b)=>b.total-a.total)[0]?.m;
    const biggest=ms.map(m=>{const s=parseScore(m);return {m,diff:Math.abs(s.h-s.a)}}).sort((a,b)=>b.diff-a.diff)[0]?.m;
    const top=teams().sort((a,b)=>(Number(b.points)||0)-(Number(a.points)||0))[0];
    $("recordsGrid").innerHTML=`<div class="record-card"><span>MEISTE TORE IN EINEM SPIEL</span><strong>${highest?`${esc(highest.home)} ${parseScore(highest).h}:${parseScore(highest).a} ${esc(highest.away)}`:"–"}</strong></div><div class="record-card"><span>GRÖSSTER SIEG</span><strong>${biggest?`${esc(biggest.m.home)} ${parseScore(biggest.m).h}:${parseScore(biggest.m).a} ${esc(biggest.m.away)}`:"–"}</strong></div><div class="record-card"><span>AKTUELLER PUNKTEKÖNIG</span><strong>${top?`${esc(top.team)} · ${Number(top.points)||0} P`:"–"}</strong></div>`;
  }

  function matchDetail(m) {
    const ev=eventsOf(m).sort((a,b)=>(Number(a.minute)||0)-(Number(b.minute)||0)); const s=parseScore(m);
    const stats=m.stats||{};
    $("matchDetail").innerHTML=`<div class="match-detail-head"><div><span class="section-kicker">SPIEL-DETAIL</span><h2>${esc(m.home)} <span>${s.h}:${s.a}</span> ${esc(m.away)}</h2><p>Spieltag ${Number(m.matchday)||1} · ${statusLabel(m.status)} · ${esc(liveMinute(m))}</p></div><button id="shareMatch" class="red-btn">Teilen</button></div><div class="match-detail-grid"><div class="detail-events"><h3>Ereignisverlauf</h3>${ev.length?ev.map(e=>`<div class="event-line"><b>${esc(e.minute||"")}′</b><span class="event-icon">${e.type==='goal'?'⚽':e.type==='yellow'?'🟨':e.type==='red'?'🟥':e.type==='substitution'?'🔄':'ℹ️'}</span><div><strong>${esc(eventTypeLabel(e.type))}</strong><p>${esc(e.player||e.text||"")}${e.assist?` · Assist: ${esc(e.assist)}`:""}</p></div></div>`).join(""):`<div class="portal-empty">Noch keine Ereignisse erfasst.</div>`}</div><div class="detail-stats"><h3>Live-Statistiken</h3>${statLine('Torschüsse',stats.homeShots,stats.awayShots)}${statLine('Ballbesitz',stats.homePossession,stats.awayPossession,'%')} ${statLine('Ecken',stats.homeCorners,stats.awayCorners)}${statLine('Gelbe Karten',stats.homeYellow,stats.awayYellow)}</div></div><div class="share-row"><button id="shareMatch2" class="ghost">Spiel teilen</button><button id="copyMatch" class="ghost">Link kopieren</button></div>`;
    $("matchModal").classList.remove("hidden");
    const share=()=>shareUrl(`${m.home} vs ${m.away}`); $("shareMatch").onclick=share; $("shareMatch2").onclick=share; $("copyMatch").onclick=()=>copyText(location.href);
  }
  function statLine(label,a,b,suffix=""){return `<div class="stat-line"><span>${Number(a)||0}${suffix}</span><b>${esc(label)}</b><span>${Number(b)||0}${suffix}</span></div>`;}

  async function shareUrl(title="Virtual Bundesliga") {
    const url=location.href;
    if (navigator.share) { try { await navigator.share({title:title,text:title,url}); return; } catch(_){} }
    await copyText(url);
    alert("Link wurde kopiert.");
  }
  async function copyText(text){try{await navigator.clipboard.writeText(text);}catch(_){const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();}}

  function showPlayer(name){const p=derivedPlayers().find(x=>String(x.name).toLowerCase()===String(name).toLowerCase());if(!p)return;$("matchDetail").innerHTML=`<div class="match-detail-head"><div><span class="section-kicker">SPIELERPROFIL</span><h2>${esc(p.name)}</h2><p>${esc(p.team||"Ohne Team")} · ${esc(p.position||"Position offen")} · Nr. ${esc(p.number||"–")}</p></div><button class="red-btn" id="sharePlayer">Teilen</button></div><div class="stat-board"><div><strong>${p.goals||0}</strong><span>TORE</span></div><div><strong>${p.assists||0}</strong><span>ASSISTS</span></div><div><strong>${p.apps||0}</strong><span>EINSÄTZE</span></div></div><div class="portal-box"><h3>Spieler-Notizen</h3><p>${esc(p.note||"Noch keine zusätzlichen Informationen hinterlegt.")}</p></div>`;$("matchModal").classList.remove("hidden");$("sharePlayer").onclick=()=>shareUrl(p.name);}

  function showMatchById(id){const m=matches().find(x=>String(x.id)===String(id));if(!m)return;matchDetail(m);}

  function renderAdminPlus() {
    const list=state.players; $("playerAdminList").innerHTML=list.length?list.map(p=>`<div class="admin-inline"><input data-player-id="${esc(p.id)}" data-key="name" value="${esc(p.name||"")}" placeholder="Name"><input data-player-id="${esc(p.id)}" data-key="team" value="${esc(p.team||"")}" placeholder="Team"><input data-player-id="${esc(p.id)}" data-key="goals" type="number" min="0" value="${Number(p.goals)||0}"><input data-player-id="${esc(p.id)}" data-key="assists" type="number" min="0" value="${Number(p.assists)||0}"><button class="delete" data-delete-player="${esc(p.id)}">×</button></div>`).join(""):"<div class='admin-small'>Noch keine Spieler.</div>";
    $("newsAdminList").innerHTML=state.news.length?state.news.map(n=>`<div class="admin-list-row"><input data-news-id="${esc(n.id)}" data-key="title" value="${esc(n.title||"")}"><input data-news-id="${esc(n.id)}" data-key="date" value="${esc(n.date||"")}"><button class="delete" data-delete-news="${esc(n.id)}">×</button></div>`).join(""):"<div class='admin-small'>Noch keine News.</div>";
    $("seasonAdminList").innerHTML=(state.seasons.length?state.seasons:[{id:"current",name:"Aktuelle Saison",current:true}]).map(s=>`<div class="admin-list-row"><input data-season-id="${esc(s.id)}" data-key="name" value="${esc(s.name||"")}"><input data-season-id="${esc(s.id)}" data-key="champion" value="${esc(s.champion||"")}" placeholder="Champion"><button class="delete" data-delete-season="${esc(s.id)}">×</button></div>`).join("");
    $("matchdayAdminList").innerHTML=state.matchdays.length?`Spieltage: ${state.matchdays.map(x=>esc(x.name||`Spieltag ${x.number}`)).join(" · ")}`:"Noch keine expliziten Spieltage angelegt.";
    $("matchAdminList").innerHTML=matches().map(m=>`<div class="admin-match-mini"><div><b>${esc(m.home)} – ${esc(m.away)}</b><small>${statusLabel(m.status)} · ${esc(liveMinute(m))}</small></div><select data-match-status="${esc(m.id)}"><option value="next" ${m.status==='next'?'selected':''}>GEPLANT</option><option value="live" ${m.status==='live'?'selected':''}>LIVE</option><option value="paused" ${m.status==='paused'?'selected':''}>PAUSIERT</option><option value="halftime" ${m.status==='halftime'?'selected':''}>HALBZEIT</option><option value="finished" ${m.status==='finished'?'selected':''}>BEENDET</option><option value="postponed" ${m.status==='postponed'?'selected':''}>VERSCHOBEN</option></select><button class="ghost" data-match-open="${esc(m.id)}">Details</button><button class="ghost" data-match-event="${esc(m.id)}">+ Event</button></div>`).join("")||"<div class='admin-small'>Noch keine Spiele.</div>";
    if($("adminContact")){$("adminContact").value=state.settings.contact||"";$("adminDiscord").value=state.settings.discord||"";$("adminInstagram").value=state.settings.instagram||"";$("adminYoutube").value=state.settings.youtube||"";$("adminTiktok").value=state.settings.tiktok||"";}
    $("auditList").innerHTML=state.audit.length?state.audit.slice(-10).reverse().map(a=>`<div><b>${esc(a.action)}</b><span>${esc(a.by||"")} · ${esc(a.at||"")}</span></div>`).join(""):"<div class='admin-small'>Noch keine Änderungen geloggt.</div>";
    $("adminRole").value=state.role;
  }

  function hasRole(...roles){return roles.includes(state.role);}
  async function write(path,value,action){if(!db()) throw new Error("Firebase nicht verbunden"); await set(ref(db(),path),value); if(action) await audit(action);}
  async function audit(action){if(!db())return;const item={id:Date.now(),action,by:state.role,at:new Date().toLocaleString('de-DE')}; await set(ref(db(),`liga/auditLog/${item.id}`),item);}
  async function syncPlayerInputs(){if(!hasRole("Super Admin","Stats Editor"))return alert("Diese Rolle darf Spielerstatistiken nicht ändern.");const out={};$("playerAdminList").querySelectorAll(".admin-inline").forEach(row=>{const id=row.querySelector('[data-player-id]')?.dataset.playerId;if(!id)return;const p={id,name:row.querySelector('[data-key="name"]').value.trim(),team:row.querySelector('[data-key="team"]').value.trim(),goals:Number(row.querySelector('[data-key="goals"]').value)||0,assists:Number(row.querySelector('[data-key="assists"]').value)||0,apps:Number(row.querySelector('[data-key="apps"]')?.value)||0};if(!p.name) return;out[id]=p;}); await write('liga/players',out,'Spieler aktualisiert');}
  async function syncNewsInputs(){if(!hasRole("Super Admin","News Editor"))return alert("Diese Rolle darf News nicht ändern.");const out={};$("newsAdminList").querySelectorAll(".admin-list-row").forEach(row=>{const id=row.querySelector('[data-news-id]')?.dataset.newsId;if(!id)return;out[id]={id,title:row.querySelector('[data-key="title"]').value.trim(),date:row.querySelector('[data-key="date"]').value.trim(),text:state.news.find(n=>String(n.id)===String(id))?.text||"",category:state.news.find(n=>String(n.id)===String(id))?.category||"NEWS"};});await write('liga/news',out,'News aktualisiert');}
  async function syncSeasons(){if(!hasRole("Super Admin"))return alert("Nur Super Admin darf Saisons ändern.");const out={};$("seasonAdminList").querySelectorAll(".admin-list-row").forEach(row=>{const id=row.querySelector('[data-season-id]')?.dataset.seasonId;if(!id)return;out[id]={...(state.seasons.find(s=>String(s.id)===String(id))||{}),id,name:row.querySelector('[data-key="name"]').value.trim(),champion:row.querySelector('[data-key="champion"]').value.trim()};});await write('liga/seasons',out,'Saisons aktualisiert');}
  async function updateMatchStatus(id,status){if(!hasRole("Super Admin","Match Operator"))return alert("Diese Rolle darf Spielstatus nicht ändern.");await update(ref(db(),`liga/matches/${id}`),{status});await audit(`Spielstatus: ${status}`);}

  function openSearch(){$("searchOverlay").classList.remove("hidden");$("globalSearch").focus();renderSearch("");}
  function renderSearch(q){q=String(q||"").toLowerCase();const result=[];teams().filter(t=>String(t.team).toLowerCase().includes(q)).slice(0,5).forEach(t=>result.push({type:"TEAM",title:t.team,sub:`Trainer: ${t.trainer||"–"}`,fn:()=>{$("searchOverlay").classList.add("hidden");showSection("teams");renderTeams();renderTeamFromTable(t.team);}}));derivedPlayers().filter(p=>`${p.name} ${p.team}`.toLowerCase().includes(q)).slice(0,5).forEach(p=>result.push({type:"SPIELER",title:p.name,sub:p.team||"–",fn:()=>{$("searchOverlay").classList.add("hidden");showSection("players");}}));matches().filter(m=>`${m.home} ${m.away}`.toLowerCase().includes(q)).slice(0,7).forEach(m=>result.push({type:"SPIEL",title:`${m.home} – ${m.away}`,sub:`${statusLabel(m.status)} · ${liveMinute(m)}`,fn:()=>{$("searchOverlay").classList.add("hidden");showMatchById(m.id);}}));state.news.filter(n=>`${n.title} ${n.text}`.toLowerCase().includes(q)).slice(0,5).forEach(n=>result.push({type:"NEWS",title:n.title,sub:n.date||"",fn:()=>{$("searchOverlay").classList.add("hidden");showSection("news");}}));$("searchResults").innerHTML=result.length?result.map((r,i)=>`<button class="search-result" data-search-index="${i}"><span>${r.type}</span><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></button>`).join(""):`<div class="portal-empty">Keine Treffer.</div>`;$("searchResults")._results=result;}
  function renderTeamFromTable(name){const el=document.querySelector(`[data-team-link="${CSS.escape(name)}"]`);if(el)el.click();}

  function refreshLiveMinuteDom(){
    matches().filter(m=>m.status==='live').forEach(m=>{
      const key=m.id||`${m.home}-${m.away}`;
      document.querySelectorAll(`[data-live-minute="${CSS.escape(String(key))}"]`).forEach(el=>el.textContent=liveMinute(m));
    });
  }

  function updateConnectivity(){const online=navigator.onLine;const el=$("liveText");if(!el)return;if(!online){el.textContent="⚠ OFFLINE – zuletzt bekannte Daten";el.classList.add("offline");}else{el.classList.remove("offline");if(el.textContent.includes("Verbinde"))el.textContent="● LIVE – Verbindung wird geprüft";}}
  function notify(text){if(!state.notificationEnabled || !('Notification' in window) || Notification.permission!=="granted")return;try{new Notification("Virtual Bundesliga",{body:text,icon:"favicon.png"});}catch(_) {}}

  async function addMatchEvent(id){
    if(!hasRole("Super Admin","Match Operator"))return alert("Keine Berechtigung.");
    const m=matches().find(x=>String(x.id)===String(id)); if(!m)return;
    const type=prompt("Event-Typ: goal / yellow / red / substitution / info", "goal"); if(!type)return;
    const cleanType=type.trim().toLowerCase(); if(!["goal","yellow","red","substitution","info"].includes(cleanType))return alert("Ungültiger Event-Typ.");
    const minute=prompt("Spielminute", liveMinute(m).replace("′","")); if(minute===null)return;
    const player=prompt("Spieler / Beschreibung", ""); if(player===null)return;
    const team=prompt("Team (bei Toren wichtig)", m.home || "");
    const assist=cleanType==='goal'?prompt("Assist (optional)", ""):"";
    const events=eventsOf(m); events.push({id:`evt-${Date.now()}`,type:cleanType,minute,player,team,assist});
    const payload={events};
    if(cleanType==='goal' && team){const score=parseScore(m); if(team===m.home)score.h++; else if(team===m.away)score.a++; payload.homeScore=score.h; payload.awayScore=score.a;}
    await update(ref(db(),`liga/matches/${id}`),payload); await audit(`Event: ${cleanType}`);
  }

  function addPlayer(){if(!hasRole("Super Admin","Stats Editor"))return alert("Keine Berechtigung.");const id=String(Date.now());write('liga/players/'+id,{id,name:"Neuer Spieler",team:teams()[0]?.team||"",goals:0,assists:0,apps:0,position:"",number:""},'Spieler angelegt').catch(e=>alert(e.message));}
  function addNews(){if(!hasRole("Super Admin","News Editor"))return alert("Keine Berechtigung.");const id=String(Date.now());write('liga/news/'+id,{id,title:"Neue Meldung",date:new Date().toISOString().slice(0,10),category:"NEWS",text:"Text hier eintragen"},'News angelegt').catch(e=>alert(e.message));}
  function addSeason(){if(!hasRole("Super Admin"))return alert("Keine Berechtigung.");const id=String(Date.now());write('liga/seasons/'+id,{id,name:"2026/27",current:false,champion:"",matchdays:0,description:"Neue Saison"},'Saison angelegt').catch(e=>alert(e.message));}
  async function addMatchday(){if(!hasRole("Super Admin","Match Operator"))return alert("Keine Berechtigung.");const max=Math.max(0,...matches().map(m=>Number(m.matchday)||0),...state.matchdays.map(x=>Number(x.number)||0))+1;await set(ref(db(),`liga/matchdays/${max}`),{number:max,name:`Spieltag ${max}`,status:"planned"});await audit(`Spieltag ${max} angelegt`);}

  async function saveSettings(){if(!hasRole("Super Admin"))return alert("Nur Super Admin darf Einstellungen ändern.");const value={contact:$("adminContact").value.trim(),discord:$("adminDiscord").value.trim(),instagram:$("adminInstagram").value.trim(),youtube:$("adminYoutube").value.trim(),tiktok:$("adminTiktok").value.trim()};await write('liga/settings',value,'Kontakt/Social Einstellungen aktualisiert');}

  async function exportBackup(){const data={version:2,exportedAt:new Date().toISOString(),teams:teams(),matches:matches(),players:state.players,news:state.news,seasons:state.seasons,settings:state.settings,matchdays:state.matchdays};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`vbl-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);await audit('Backup exportiert');}
  async function importBackup(file){if(!hasRole("Super Admin"))return alert("Nur Super Admin darf Backups importieren.");const text=await file.text();let data;try{data=JSON.parse(text);}catch(e){return alert("Ungültige JSON-Datei.");}if(!confirm("Backup wirklich wiederherstellen? Vorhandene Daten werden überschrieben."))return;try{if(data.teams)await set(ref(db(),'liga/teams'),Object.fromEntries(data.teams.map(t=>[String(t.id),t])));if(data.matches)await set(ref(db(),'liga/matches'),Object.fromEntries(data.matches.map(m=>[String(m.id),Object.fromEntries(Object.entries(m).filter(([k])=>k!=='id'))])));for(const key of ['players','news','seasons','settings','matchdays'])if(data[key])await set(ref(db(),'liga/'+key),data[key]);await audit('Backup importiert');alert('Backup wiederhergestellt.');}catch(e){alert('Wiederherstellung fehlgeschlagen: '+e.message);}}

  function bind() {
    document.querySelectorAll("#portalNav [data-section]").forEach(b=>b.onclick=()=>showSection(b.dataset.section));
    document.addEventListener("click",e=>{const b=e.target.closest("[data-share-team]");if(b)shareUrl(b.dataset.shareTeam);});
    $("teamFilter").oninput=renderTeams; $("newsFilter").oninput=renderNews;
    $("themeToggle").onclick=()=>{const light=document.documentElement.classList.toggle("light-theme");localStorage.setItem("vblTheme",light?'light':'dark');};
    if(localStorage.getItem("vblTheme")==="light")document.documentElement.classList.add("light-theme");
    $("searchOpen").onclick=openSearch; $("searchClose").onclick=()=>$("searchOverlay").classList.add("hidden");
    $("globalSearch").oninput=e=>renderSearch(e.target.value); $("searchResults").onclick=e=>{const b=e.target.closest(".search-result");if(!b)return;const fn=$("searchResults")._results?.[Number(b.dataset.searchIndex)]?.fn;fn?.();};
    $("matchModalClose").onclick=()=>$("matchModal").classList.add("hidden"); $("matchModal").addEventListener('click',e=>{if(e.target.id==='matchModal')$("matchModal").classList.add("hidden");});
    $("sharePortal").onclick=()=>shareUrl('Virtual Bundesliga'); $("copyPortal").onclick=()=>copyText(location.href);
    $("adminRole").onchange=e=>{state.role=e.target.value;localStorage.setItem('vblAdminRole',state.role);};
    $("addPlayerBtn").onclick=async()=>{await addPlayer();}; $("savePlayersBtn").onclick=syncPlayerInputs; $("addNewsBtn").onclick=async()=>{await addNews();}; $("saveNewsBtn").onclick=syncNewsInputs; $("addSeasonBtn").onclick=async()=>{await addSeason();}; $("saveSeasonsBtn").onclick=syncSeasons; $("addMatchdayBtn").onclick=addMatchday; $("saveSettingsBtn").onclick=saveSettings;
    $("exportBtn").onclick=exportBackup; $("importInput").onchange=e=>e.target.files[0]&&importBackup(e.target.files[0]); $("restoreDefaultBtn").onclick=()=>{if(confirm('Nur lokale Anzeige zurücksetzen? Firebase-Daten bleiben erhalten.'))location.reload();};
    $("notifyToggle").onclick=async()=>{if(!('Notification' in window))return alert('Dieser Browser unterstützt keine Live-Benachrichtigungen.');if(Notification.permission==='denied')return alert('Benachrichtigungen sind im Browser blockiert.');const p=await Notification.requestPermission();state.notificationEnabled=p==='granted';$("notifyToggle").classList.toggle('active',state.notificationEnabled);if(state.notificationEnabled)notify('Live-Benachrichtigungen sind aktiviert.');};
    $("portalContent").addEventListener('click',async e=>{
      const team=e.target.closest('[data-team-link]'); if(team && !team.closest('#portalNav')){const n=team.dataset.teamLink;const original=document.querySelector(`[data-team-link="${CSS.escape(n)}"]`);if(original)original.click();}
      const match=e.target.closest('[data-match-card]'); if(match){showMatchById(match.dataset.matchCard);}
      const open=e.target.closest('[data-match-open]');if(open)showMatchById(open.dataset.matchOpen); const evt=e.target.closest('[data-match-event]'); if(evt) addMatchEvent(evt.dataset.matchEvent);
      const delP=e.target.closest('[data-delete-player]');if(delP&&confirm('Spieler wirklich löschen?')){await set(ref(db(),`liga/players/${delP.dataset.deletePlayer}`),null);await audit('Spieler gelöscht');}
      const delN=e.target.closest('[data-delete-news]');if(delN&&confirm('News wirklich löschen?')){await set(ref(db(),`liga/news/${delN.dataset.deleteNews}`),null);await audit('News gelöscht');}
      const delS=e.target.closest('[data-delete-season]');if(delS&&confirm('Saison wirklich löschen?')){await set(ref(db(),`liga/seasons/${delS.dataset.deleteSeason}`),null);await audit('Saison gelöscht');}
      const shareN=e.target.closest('.share-news');if(shareN){const n=state.news.find(x=>String(x.id)===String(shareN.dataset.news));shareUrl(n?.title||'VBL News');}
      const teamShare=e.target.closest('[data-share-team]'); if(teamShare){shareUrl(teamShare.dataset.shareTeam);}
      const p=e.target.closest('.player-detail');if(p){showPlayer(p.dataset.player);}
      const st=e.target.closest('[data-match-status]');if(st){await updateMatchStatus(st.dataset.matchStatus,st.value);}
    });
    setInterval(()=>{updateConnectivity();refreshLiveMinuteDom();if(state.selectedSection==='players')renderPlayers();},1000);
    window.addEventListener('online',updateConnectivity);window.addEventListener('offline',updateConnectivity);
  }

  function setupFirebase() {
    const database=db();if(!database)return;
    const listen=(path,key,cb)=>onValue(ref(database,path),snap=>{state[key]=snap.exists()?(key==='players'||key==='news'||key==='seasons'||key==='audit'?Object.values(snap.val()):snap.val()):[];cb?.();},err=>console.error(path,err));
    listen('liga/players','players',()=>{renderPlayers();renderAdminPlus();});
    listen('liga/news','news',()=>{renderNews();renderAdminPlus();});
    listen('liga/seasons','seasons',()=>{renderArchive();renderAdminPlus();});
    listen('liga/auditLog','audit',()=>renderAdminPlus());
    listen('liga/matchdays','matchdays',()=>renderAdminPlus());
    listen('liga/settings','settings',()=>renderInfo());
    setInterval(()=>{if(state.selectedSection==='stats'||state.selectedSection==='archive')renderStats();},5000);
  }

  function renderInfo(){const s=state.settings||{};if($("contactText"))$("contactText").textContent=s.contact||"Kontaktinformationen können im Admin-Bereich hinterlegt werden.";if($("socialLinks"))$("socialLinks").innerHTML=[['Discord',s.discord],['Instagram',s.instagram],['YouTube',s.youtube],['TikTok',s.tiktok]].filter(x=>x[1]).map(x=>`<a href="${esc(x[1])}" target="_blank" rel="noopener">${x[0]}</a>`).join('')||'<span class="admin-small">Noch keine Social-Media-Links hinterlegt.</span>';}

  function bindExistingMatchClicks() {
    document.addEventListener('click',e=>{const card=e.target.closest('.match-card[data-match-card]');if(!card)return;if(e.target.closest('[data-team-link]'))return;showMatchById(card.dataset.matchCard);});
  }

  function start() {
    injectShell();
    bind();
    setupFirebase();
    renderTeams();renderPlayers();renderStats();renderNews();renderArchive();renderInfo();renderAdminPlus();updateConnectivity();
    bindExistingMatchClicks();
    const syncAdminVisibility=()=>{const open=$('editorView') && !$('editorView').classList.contains('hidden'); $('portalAdminPlus')?.classList.toggle('hidden',!open);};
    const observer=new MutationObserver(syncAdminVisibility);
    observer.observe(document.body,{attributes:true,subtree:true,attributeFilter:['class']});
    syncAdminVisibility();
  }

  // Public hook consumed by this add-on and future extensions.
  window.VBL_ENHANCED={refresh:()=>{renderTeams();renderPlayers();renderStats();renderNews();renderArchive();renderInfo();renderAdminPlus();}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
