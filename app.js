import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const ADMIN_CODE = "Stikeli";

/* =========================================================
   LOGOS
   ========================================================= */

const TEAM_LOGOS = {
  "REAL MADRID":
    "https://logos-world.net/wp-content/uploads/2020/06/Real-Madrid-symbol.png",

  "OSNABRÜCK":
    "https://www.tus-rotweiss-emden.de/wp-content/uploads/2019/07/VFL-Osnabrueck-e1564413193948.png",

  "NÜRNBERG":
    "",

  "SCHALKE 04":
    "",

  "BARCELONA":
    "",

  "ATLETICO MADRID":
    "",

  "DORTMUND":
    "",

  "SNEAX | PSG":
    "",

  "FREIBURG":
    "",

  "STURM GRAZ":
    "",

  "JUVENTUS":
    "",

  "AL NASSR":
    ""
};

/* =========================================================
   TEAMS
   ========================================================= */

const initialTeams = [
  {
    id: 1,
    team: "REAL MADRID",
    trainer: "Scotty",
    sp: 1,
    s: 1,
    u: 0,
    n: 0,
    goals: "6:3",
    diff: 3,
    points: 3,
    logo: TEAM_LOGOS["REAL MADRID"]
  },
  {
    id: 2,
    team: "OSNABRÜCK",
    trainer: "Philipp",
    sp: 1,
    s: 1,
    u: 0,
    n: 0,
    goals: "7:5",
    diff: 2,
    points: 3,
    logo: TEAM_LOGOS["OSNABRÜCK"]
  },
  {
    id: 3,
    team: "NÜRNBERG",
    trainer: "Stikerpo",
    sp: 1,
    s: 1,
    u: 0,
    n: 0,
    goals: "4:2",
    diff: 2,
    points: 3,
    logo: TEAM_LOGOS["NÜRNBERG"]
  },
  {
    id: 4,
    team: "SCHALKE 04",
    trainer: "Antik",
    sp: 1,
    s: 1,
    u: 0,
    n: 0,
    goals: "2:1",
    diff: 1,
    points: 3,
    logo: TEAM_LOGOS["SCHALKE 04"]
  },
  {
    id: 5,
    team: "BARCELONA",
    trainer: "Kenny",
    sp: 0,
    s: 0,
    u: 0,
    n: 0,
    goals: "0:0",
    diff: 0,
    points: 0,
    logo: TEAM_LOGOS["BARCELONA"]
  },
  {
    id: 6,
    team: "ATLETICO MADRID",
    trainer: "Ben",
    sp: 0,
    s: 0,
    u: 0,
    n: 0,
    goals: "0:0",
    diff: 0,
    points: 0,
    logo: TEAM_LOGOS["ATLETICO MADRID"]
  },
  {
    id: 7,
    team: "DORTMUND",
    trainer: "Julien",
    sp: 0,
    s: 0,
    u: 0,
    n: 0,
    goals: "0:0",
    diff: 0,
    points: 0,
    logo: TEAM_LOGOS["DORTMUND"]
  },
  {
    id: 8,
    team: "SNEAX | PSG",
    trainer: "Sneax",
    sp: 0,
    s: 0,
    u: 0,
    n: 0,
    goals: "0:0",
    diff: 0,
    points: 0,
    logo: TEAM_LOGOS["SNEAX | PSG"]
  },
  {
    id: 9,
    team: "FREIBURG",
    trainer: "Raphael",
    sp: 1,
    s: 1,
    u: 0,
    n: 0,
    goals: "1:2",
    diff: -1,
    points: 0,
    logo: TEAM_LOGOS["FREIBURG"]
  },
  {
    id: 10,
    team: "STURM GRAZ",
    trainer: "Trululu",
    sp: 1,
    s: 0,
    u: 0,
    n: 1,
    goals: "2:4",
    diff: -2,
    points: 0,
    logo: TEAM_LOGOS["STURM GRAZ"]
  },
  {
    id: 11,
    team: "JUVENTUS",
    trainer: "clpz_king",
    sp: 1,
    s: 0,
    u: 0,
    n: 1,
    goals: "5:7",
    diff: -2,
    points: 0,
    logo: TEAM_LOGOS["JUVENTUS"]
  },
  {
    id: 12,
    team: "AL NASSR",
    trainer: "Peter",
    sp: 1,
    s: 0,
    u: 0,
    n: 1,
    goals: "3:6",
    diff: -3,
    points: 0,
    logo: TEAM_LOGOS["AL NASSR"]
  }
];

/* =========================================================
   STATE
   ========================================================= */

let currentTeams = [...initialTeams];
let currentMatches = [];
let adminLoggedIn = false;

let db = null;
let teamsRef = null;
let matchesRef = null;

/* =========================================================
   ELEMENTS
   ========================================================= */

const $ = (id) => document.getElementById(id);

const body = $("standingsBody");
const adminPanel = $("adminPanel");
const loginView = $("loginView");
const editorView = $("editorView");
const editorWrap = $("editorWrap");
const matchesEditorWrap = $("matchesEditorWrap");
const liveMatches = $("liveMatches");

/* =========================================================
   HELPERS
   ========================================================= */

function esc(s) {
  return String(s ?? "").replace(
    /[&<>\"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[m]
  );
}

function sortTeams(list) {
  return [...list].sort(
    (a, b) =>
      Number(b.points) - Number(a.points) ||
      Number(b.diff) - Number(a.diff) ||
      Number(b.s) - Number(a.s) ||
      String(a.team).localeCompare(String(b.team))
  );
}

function formatDiff(v) {
  return Number(v) > 0 ? `+${v}` : String(v);
}

/* =========================================================
   LOGO SYSTEM
   ========================================================= */

function getTeamLogo(team) {
  const name = typeof team === "object" ? team.team : team;

  /*
   Firebase-Logo hat Vorrang.
   Wenn dort kein Logo vorhanden ist,
   nehmen wir automatisch das Logo aus TEAM_LOGOS.
  */

  if (typeof team === "object" && team.logo) {
    return team.logo;
  }

  return TEAM_LOGOS[name] || "";
}

function teamLogo(team) {
  const name = typeof team === "object" ? team.team : team;
  const logo = getTeamLogo(team);

  if (logo) {
    return `
      <span class="team-logo team-logo-image">
        <img
          src="${esc(logo)}"
          alt="${esc(name)}"
          loading="lazy"
          onerror="this.style.display='none';this.parentElement.classList.add('logo-error');"
        >
      </span>
    `;
  }

  const initials =
    String(name || "VB")
      .replace(/[^A-Za-zÄÖÜäöüß0-9 ]/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0])
      .join("")
      .toUpperCase() || "VB";

  return `
    <span class="team-logo" title="${esc(name)}">
      ${esc(initials)}
    </span>
  `;
}

/* =========================================================
   FORM
   ========================================================= */

function getForm(teamName) {
  const teamObj = currentTeams.find((t) => t.team === teamName);

  if (teamObj?.formManual) {
    const chars = String(teamObj.formManual)
      .toUpperCase()
      .slice(0, 5)
      .split("");

    return `
      <span class="form">
        ${chars
          .map(
            (c) =>
              `<span class="form-dot ${
                c === "W" ? "win" : c === "L" ? "loss" : "draw"
              }">
                ${c === "W" ? "🟢" : c === "L" ? "🔴" : "🟡"}
              </span>`
          )
          .join("")}
        ${Array(Math.max(0, 5 - chars.length))
          .fill('<span class="form-dot empty">⚪</span>')
          .join("")}
      </span>
    `;
  }

  const games = currentMatches
    .filter(
      (m) =>
        m.status === "finished" &&
        (m.home === teamName || m.away === teamName)
    )
    .sort((a, b) =>
      String(b.date || "").localeCompare(String(a.date || ""))
    )
    .slice(0, 5);

  return `
    <span class="form">
      ${[...games]
        .reverse()
        .map((m) => {
          const hs = Number(m.homeScore) || 0;
          const as = Number(m.awayScore) || 0;

          const isHome = m.home === teamName;
          const diff = isHome ? hs - as : as - hs;

          return `
            <span
              class="form-dot ${
                diff > 0 ? "win" : diff < 0 ? "loss" : "draw"
              }"
              title="${esc(m.home)} ${hs}:${as} ${esc(m.away)}"
            >
              ${diff > 0 ? "🟢" : diff < 0 ? "🔴" : "🟡"}
            </span>
          `;
        })
        .join("")}

      ${Array(Math.max(0, 5 - games.length))
        .fill('<span class="form-dot empty">⚪</span>')
        .join("")}
    </span>
  `;
}

/* =========================================================
   TABLE
   ========================================================= */

function renderTable(list) {
  const sorted = sortTeams(list);

  body.innerHTML = sorted
    .map(
      (t, i) => `
      <tr class="${i === 0 ? "leader-row" : ""}">
        <td class="place">${i + 1}.</td>

        <td class="left team-name">
          <div class="team-cell">
            ${teamLogo(t)}
            <span>${esc(t.team)}</span>
          </div>
        </td>

        <td class="left">${esc(t.trainer)}</td>

        <td>${getForm(t.team)}</td>

        <td>${Number(t.sp) || 0}</td>
        <td>${Number(t.s) || 0}</td>
        <td>${Number(t.u) || 0}</td>
        <td>${Number(t.n) || 0}</td>

        <td>${esc(t.goals)}</td>

        <td class="${Number(t.diff) > 0 ? "positive" : ""}">
          ${formatDiff(Number(t.diff) || 0)}
        </td>

        <td class="points">
          ${Number(t.points) || 0}
        </td>
      </tr>
    `
    )
    .join("");

  renderLeader(sorted[0]);
}

function renderLeader(leader) {
  if (!leader) {
    $("leaderCard").innerHTML = "";
    return;
  }

  $("leaderCard").innerHTML = `
    <div class="leader-label">TABELLENFÜHRER</div>

    <div class="leader-main">
      ${teamLogo(leader)}

      <div>
        <div class="leader-team">
          ${esc(leader.team)}
        </div>

        <div class="leader-trainer">
          ${esc(leader.trainer || "")}
        </div>
      </div>

      <div class="leader-points">
        <strong>${Number(leader.points) || 0}</strong>
        <span>PUNKTE</span>
      </div>
    </div>
  `;
}

/* =========================================================
   STATUS / CLOCK
   ========================================================= */

function updateClock() {
  $("updatedAt").textContent =
    `Stand: ${new Date().toLocaleTimeString("de-DE")}`;
}

function updateStatus(online, text) {
  $("liveDot").classList.toggle("live", online);
  $("liveText").textContent = text;
  updateClock();
}

/* =========================================================
   ADMIN EDITOR
   ========================================================= */

function editorHtml(list) {
  const rows = list
    .map(
      (t, i) => `
      <div class="editor-row" data-index="${i}">

        <input data-k="id"
          type="number"
          value="${Number(t.id) || 0}">

        <input data-k="team"
          value="${esc(t.team)}">

        <input data-k="trainer"
          value="${esc(t.trainer)}">

        <input data-k="sp"
          type="number"
          min="0"
          value="${Number(t.sp) || 0}">

        <input data-k="s"
          type="number"
          min="0"
          value="${Number(t.s) || 0}">

        <input data-k="u"
          type="number"
          min="0"
          value="${Number(t.u) || 0}">

        <input data-k="n"
          type="number"
          min="0"
          value="${Number(t.n) || 0}">

        <input data-k="goals"
          value="${esc(t.goals)}">

        <input data-k="diff"
          type="number"
          value="${Number(t.diff) || 0}">

        <input data-k="points"
          type="number"
          min="0"
          value="${Number(t.points) || 0}">

        <input data-k="logo"
          value="${esc(t.logo || getTeamLogo(t))}"
          placeholder="Logo-URL">

        <button
          class="delete"
          data-action="delete"
          type="button">
          ×
        </button>

      </div>
    `
    )
    .join("");

  editorWrap.innerHTML = `
    <div class="editor-grid">

      <div class="editor-head">
        <div>ID</div>
        <div>TEAM</div>
        <div>TRAINER</div>
        <div>SP</div>
        <div>S</div>
        <div>U</div>
        <div>N</div>
        <div>TORE</div>
        <div>DIFF</div>
        <div>PUNKTE</div>
        <div>LOGO-URL</div>
        <div></div>
      </div>

      ${rows}

    </div>
  `;
}

function readEditor() {
  return [...editorWrap.querySelectorAll(".editor-row")].map((row) => {
    const t = {};

    row.querySelectorAll("[data-k]").forEach((input) => {
      const k = input.dataset.k;

      t[k] = [
        "id",
        "sp",
        "s",
        "u",
        "n",
        "diff",
        "points"
      ].includes(k)
        ? Number(input.value || 0)
        : input.value;
    });

    /*
     * Wenn Logo-Feld leer ist,
     * automatisch das feste Team-Logo verwenden.
     */

    if (!t.logo) {
      t.logo = TEAM_LOGOS[t.team] || "";
    }

    return t;
  });
}

/* =========================================================
   MATCHES
   ========================================================= */

function matchLabel(status) {
  return status === "live"
    ? "LIVE"
    : status === "finished"
    ? "BEENDET"
    : "NÄCHSTE";
}

function matchScore(m) {
  return m.status === "next"
    ? "– : –"
    : `${Number(m.homeScore) || 0} : ${Number(m.awayScore) || 0}`;
}

function scorerHtml(m) {
  if (m.status !== "live" || !m.scorers) return "";

  const scorers = String(m.scorers)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return scorers.length
    ? `<div class="scorers"><b>⚽</b> ${scorers
        .map(esc)
        .join(" · ")}</div>`
    : "";
}

function matchCard(m, compact = false) {
  const status = m.status || "next";

  const extra =
    status === "live"
      ? `${esc(m.minute || "")}′`
      : status === "next"
      ? esc(m.kickoff || "")
      : "Endstand";

  return `
    <article
      data-match-card="${esc(
        m.id || `${m.home}-${m.away}`
      )}"
      class="match-card match-${esc(status)} ${
        compact ? "compact" : ""
      }">

      <div class="match-top">
        <span class="match-badge">
          ${matchLabel(status)}
        </span>

        <span class="match-extra">
          ${extra}
        </span>
      </div>

      <div class="match-teams">

        <span>
          ${teamLogo(m.home)}
          <em>${esc(m.home)}</em>
        </span>

        <strong>
          ${matchScore(m)}
        </strong>

        <span>
          <em>${esc(m.away)}</em>
          ${teamLogo(m.away)}
        </span>

      </div>

      ${scorerHtml(m)}

    </article>
  `;
}

let previousLiveScores = {};

function renderMatches(list) {
  const sorted = [...list].sort((a, b) =>
    String(a.date || "").localeCompare(String(b.date || ""))
  );

  liveMatches.innerHTML = sorted.length
    ? sorted.map((m) => matchCard(m)).join("")
    : '<div class="empty-matches">Noch keine Spiele eingetragen.</div>';

  const live = sorted.filter((m) => m.status === "live");

  const next = sorted
    .filter((m) => m.status === "next")
    .slice(0, 3);

  const finished = sorted
    .filter((m) => m.status === "finished")
    .sort((a, b) =>
      String(b.date || "").localeCompare(String(a.date || ""))
    )
    .slice(0, 3);

  $("featuredLive").innerHTML = live.length
    ? live
        .map(
          (m) => `
            <div class="featured-label">
              <span class="pulse"></span>
              LIVE-SPIEL
            </div>
            ${matchCard(m)}
          `
        )
        .join("")
    : `
      <div class="no-live">
        <span>●</span>
        <strong>Kein Spiel live</strong>
        <small>Die nächsten Partien stehen bereit.</small>
      </div>
    `;

  $("nextMatches").innerHTML = next.length
    ? next.map((m) => matchCard(m, true)).join("")
    : '<div class="mini-empty">Keine nächsten Spiele</div>';

  $("recentMatches").innerHTML = finished.length
    ? finished.map((m) => matchCard(m, true)).join("")
    : '<div class="mini-empty">Noch keine Ergebnisse</div>';

  $("heroLiveText").textContent = live.length
    ? `${live.length} SPIEL${live.length > 1 ? "E" : ""} LIVE`
    : "LIVE";

  live.forEach((m) => {
    const key = m.id || `${m.home}-${m.away}`;

    const score =
      (Number(m.homeScore) || 0) +
      (Number(m.awayScore) || 0);

    if (
      previousLiveScores[key] !== undefined &&
      score > previousLiveScores[key]
    ) {
      setTimeout(() => {
        document
          .querySelectorAll(
            `[data-match-card="${CSS.escape(key)}"]`
          )
          .forEach((el) =>
            el.classList.add("goal-flash")
          );
      }, 0);
    }

    previousLiveScores[key] = score;
  });

  $("heroLivePill").classList.toggle(
    "active",
    !!live.length
  );

  renderTable(currentTeams);
}

/* =========================================================
   MATCH EDITOR
   ========================================================= */

function matchEditorHtml(list) {
  const rows = list
    .map(
      (m, i) => `
      <div
        class="match-editor-row"
        data-index="${i}"
        data-match-id="${esc(
          m.id || makeMatchId()
        )}">

        <select data-k="status">
          <option value="next" ${
            m.status === "next" ? "selected" : ""
          }>NÄCHSTE</option>

          <option value="live" ${
            m.status === "live" ? "selected" : ""
          }>LIVE</option>

          <option value="finished" ${
            m.status === "finished" ? "selected" : ""
          }>BEENDET</option>
        </select>

        <input
          data-k="home"
          value="${esc(m.home || "")}"
          placeholder="Heimteam">

        <input
          data-k="away"
          value="${esc(m.away || "")}"
          placeholder="Auswärtsteam">

        <input
          data-k="kickoff"
          value="${esc(m.kickoff || "")}"
          placeholder="19:30">

        <input
          data-k="homeScore"
          type="number"
          min="0"
          value="${Number(m.homeScore) || 0}">

        <input
          data-k="awayScore"
          type="number"
          min="0"
          value="${Number(m.awayScore) || 0}">

        <input
          data-k="minute"
          value="${esc(m.minute || "")}"
          placeholder="67">

        <input
          data-k="scorers"
          value="${esc(m.scorers || "")}"
          placeholder="Torschützen">

        <input
          data-k="date"
          value="${esc(m.date || "")}"
          placeholder="2026-08-19 19:30">

        <button
          class="delete"
          data-action="delete-match"
          type="button">
          ×
        </button>

      </div>
    `
    )
    .join("");

  matchesEditorWrap.innerHTML = `
    <div class="editor-grid match-editor-grid">

      <div class="editor-head">
        <div>STATUS</div>
        <div>HEIM</div>
        <div>AUSWÄRTS</div>
        <div>ANPFIFF</div>
        <div>HEIM</div>
        <div>AUSW.</div>
        <div>MIN.</div>
        <div>TORE/TORSCH.</div>
        <div>DATUM</div>
        <div></div>
      </div>

      ${rows}

    </div>
  `;
}

function readMatchEditor() {
  return [
    ...matchesEditorWrap.querySelectorAll(
      ".match-editor-row"
    )
  ].map((row) => {
    const m = {
      id:
        row.dataset.matchId ||
        makeMatchId()
    };

    row
      .querySelectorAll("[data-k]")
      .forEach((input) => {
        const k = input.dataset.k;

        m[k] = [
          "homeScore",
          "awayScore"
        ].includes(k)
          ? Number(input.value || 0)
          : input.value;
      });

    return m;
  });
}

function makeMatchId() {
  return `match-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
    .replace(/[.#$\/[\]]/g, "_");
}

function cleanKey(key) {
  return (
    String(key || "").replace(
      /[.#$\/[\]]/g,
      "_"
    ) || makeMatchId()
  );
}

/* =========================================================
   ADMIN
   ========================================================= */

function showAdmin() {
  adminLoggedIn = true;

  loginView.classList.add("hidden");
  editorView.classList.remove("hidden");

  editorHtml(currentTeams);
  matchEditorHtml(currentMatches);
}

function hideAdmin() {
  adminLoggedIn = false;

  loginView.classList.remove("hidden");
  editorView.classList.add("hidden");

  $("adminCode").value = "";
}

/* =========================================================
   START
   ========================================================= */

renderTable(currentTeams);
renderMatches(currentMatches);

updateStatus(
  false,
  "Verbinde mit der Live-Tabelle …"
);

updateClock();

setInterval(updateClock, 1000);

/* =========================================================
   ADMIN BUTTONS
   ========================================================= */

$("adminToggle").onclick = () => {
  adminPanel.classList.remove("hidden");

  adminPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
};

$("closeAdmin").onclick = () =>
  adminPanel.classList.add("hidden");

$("loginBtn").onclick = () => {
  $("loginError").textContent = "";

  if ($("adminCode").value === ADMIN_CODE) {
    showAdmin();
  } else {
    $("loginError").textContent =
      "Falscher Admin-Code.";
  }
};

$("adminCode").addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Enter") {
      $("loginBtn").click();
    }
  }
);

$("logoutBtn").onclick = hideAdmin;

/* =========================================================
   TEAM HINZUFÜGEN
   ========================================================= */

$("addTeam").onclick = () => {
  if (!adminLoggedIn) return;

  const list = readEditor();

  list.push({
    id: Date.now(),
    team: "NEUES TEAM",
    trainer: "",
    sp: 0,
    s: 0,
    u: 0,
    n: 0,
    goals: "0:0",
    diff: 0,
    points: 0,
    logo: ""
  });

  editorHtml(list);
};

editorWrap.addEventListener("click", (e) => {
  if (e.target.dataset.action === "delete") {
    e.target
      .closest(".editor-row")
      ?.remove();
  }
});

$("loadCurrent").onclick = () => {
  if (adminLoggedIn) {
    editorHtml(currentTeams);
  }
};

/* =========================================================
   TABELLE SPEICHERN
   ========================================================= */

$("saveTable").onclick = async () => {
  if (!adminLoggedIn)
    return alert(
      "Bitte zuerst Admin-Code Stikeli eingeben."
    );

  if (!teamsRef)
    return alert(
      "Firebase ist nicht verbunden."
    );

  try {
    const list = readEditor();

    await set(
      teamsRef,
      Object.fromEntries(
        list.map((t) => [
          String(t.id),
          t
        ])
      )
    );

    alert(
      "Tabelle gespeichert. Alle sehen die Änderung."
    );
  } catch (e) {
    console.error(e);

    alert(
      "Speichern fehlgeschlagen: " +
        e.message
    );
  }
};

/* =========================================================
   SPIEL HINZUFÜGEN
   ========================================================= */

$("addMatch").onclick = () => {
  if (!adminLoggedIn) return;

  const list = readMatchEditor();

  list.push({
    id: makeMatchId(),
    status: "next",
    home: "",
    away: "",
    kickoff: "",
    homeScore: 0,
    awayScore: 0,
    minute: "",
    scorers: "",
    date: ""
  });

  matchEditorHtml(list);
};

matchesEditorWrap.addEventListener(
  "click",
  (e) => {
    if (
      e.target.dataset.action ===
      "delete-match"
    ) {
      e.target
        .closest(".match-editor-row")
        ?.remove();
    }
  }
);

/* =========================================================
   SPIELE SPEICHERN
   ========================================================= */

$("saveMatches").onclick = async () => {
  if (!adminLoggedIn)
    return alert(
      "Bitte zuerst Admin-Code Stikeli eingeben."
    );

  if (!matchesRef)
    return alert(
      "Firebase ist nicht verbunden."
    );

  try {
    const list = readMatchEditor().map(
      (m) => {
        const id = cleanKey(m.id);

        delete m.id;

        return {
          id,
          data: m
        };
      }
    );

    await set(
      matchesRef,
      Object.fromEntries(
        list.map((x) => [
          x.id,
          x.data
        ])
      )
    );

    alert(
      "Spiele gespeichert. Alle sehen die Änderung."
    );
  } catch (e) {
    console.error(e);

    alert(
      "Speichern fehlgeschlagen: " +
        e.message
    );
  }
};

/* =========================================================
   FIREBASE
   ========================================================= */

try {
  const app =
    initializeApp(firebaseConfig);

  db = getDatabase(app);

  teamsRef = ref(
    db,
    "liga/teams"
  );

  matchesRef = ref(
    db,
    "liga/matches"
  );

  onValue(
    teamsRef,
    (snap) => {
      if (snap.exists()) {
        currentTeams =
          Object.values(
            snap.val()
          ).map((team) => ({
            ...team,

            /*
             * Falls Firebase kein Logo gespeichert hat,
             * wird automatisch das passende Logo aus
             * TEAM_LOGOS genommen.
             */

            logo:
              team.logo ||
              TEAM_LOGOS[team.team] ||
              ""
          }));
      } else {
        currentTeams =
          [...initialTeams];
      }

      renderTable(currentTeams);

      if (adminLoggedIn) {
        editorHtml(currentTeams);
      }

      updateStatus(
        true,
        "● LIVE – Tabelle synchronisiert"
      );
    },
    (err) => {
      console.error(err);

      updateStatus(
        false,
        "Verbindung zur Live-Tabelle fehlt"
      );
    }
  );

  onValue(
    matchesRef,
    (snap) => {
      currentMatches = snap.exists()
        ? Object.entries(
            snap.val()
          ).map(
            ([id, data]) => ({
              id,
              ...data
            })
          )
        : [];

      renderMatches(
        currentMatches
      );

      if (adminLoggedIn) {
        matchEditorHtml(
          currentMatches
        );
      }
    },
    (err) =>
      console.error(err)
  );
} catch (err) {
  console.error(
    "Firebase konnte nicht gestartet werden:",
    err
  );

  updateStatus(
    false,
    "Live-Verbindung derzeit nicht verfügbar"
  );
}

/* =========================================================
   AUTO REFRESH
   ========================================================= */

setInterval(() => {
  if (!adminLoggedIn) {
    location.reload();
  }
}, 10000);