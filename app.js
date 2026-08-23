import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
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

  "NÜRNBERG": "",
  "SCHALKE 04": "",
  "BARCELONA": "",
  "ATLETICO MADRID": "",
  "DORTMUND": "",
  "SNEAX | PSG": "",
  "FREIBURG": "",
  "STURM GRAZ": "",
  "JUVENTUS": "",
  "AL NASSR": ""
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
    logo: TEAM_LOGOS["REAL MADRID"],
    formManual: ""
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
    logo: TEAM_LOGOS["OSNABRÜCK"],
    formManual: ""
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
    logo: TEAM_LOGOS["NÜRNBERG"],
    formManual: ""
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
    logo: TEAM_LOGOS["SCHALKE 04"],
    formManual: ""
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
    logo: TEAM_LOGOS["BARCELONA"],
    formManual: ""
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
    logo: TEAM_LOGOS["ATLETICO MADRID"],
    formManual: ""
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
    logo: TEAM_LOGOS["DORTMUND"],
    formManual: ""
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
    logo: TEAM_LOGOS["SNEAX | PSG"],
    formManual: ""
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
    logo: TEAM_LOGOS["FREIBURG"],
    formManual: ""
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
    logo: TEAM_LOGOS["STURM GRAZ"],
    formManual: ""
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
    logo: TEAM_LOGOS["JUVENTUS"],
    formManual: ""
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
    logo: TEAM_LOGOS["AL NASSR"],
    formManual: ""
  }
];

let currentTeams = [...initialTeams];
let currentMatches = [];
let adminLoggedIn = false;
let db = null;
let teamsRef = null;
let matchesRef = null;
let selectedTeamName = null;
let selectedMatchday = 1;
let previousLiveScores = {};

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

function teamNameOf(value) {
  return typeof value === "object"
    ? String(value.team || "")
    : String(value || "");
}

function teamByName(name) {
  return currentTeams.find((t) => t.team === name);
}

function teamLogoUrl(team) {
  const name = teamNameOf(team);

  if (typeof team === "object" && team.logo) {
    return team.logo;
  }

  return TEAM_LOGOS[name] || "";
}

function teamLogo(team, large = false) {
  const name = teamNameOf(team);
  const logo = teamLogoUrl(team);

  if (logo) {
    return `
      <span class="team-logo team-logo-image ${
        large ? "team-logo-large" : ""
      }">
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
    name
      .replace(/[^A-Za-zÄÖÜäöüß0-9 ]/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0])
      .join("")
      .toUpperCase() || "VB";

  return `
    <span
      class="team-logo ${large ? "team-logo-large" : ""}"
      title="${esc(name)}"
    >
      ${esc(initials)}
    </span>
  `;
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

function parseGoals(value) {
  const match = String(value || "0:0").match(
    /(-?\d+)\s*:\s*(-?\d+)/
  );

  return match
    ? {
        for: Number(match[1]) || 0,
        against: Number(match[2]) || 0
      }
    : {
        for: 0,
        against: 0
      };
}

function getMatchday(match) {
  return Math.max(
    1,
    Number(match.matchday) || 1
  );
}

function matchTeamsMatch(match, teamName) {
  return (
    match.home === teamName ||
    match.away === teamName
  );
}

/* =========================================================
   DYNAMIC PUBLIC UI
   ========================================================= */

function createExtraPublicSections() {
  const page = document.querySelector(".page");
  if (!page) return;

  /* Team-Profil */
  if (!$("teamView")) {
    const teamSection =
      document.createElement("section");

    teamSection.id = "teamView";
    teamSection.className =
      "team-view-section hidden";

    const leaderCard =
      $("leaderCard");

    if (
      leaderCard &&
      leaderCard.parentNode === page
    ) {
      page.insertBefore(
        teamSection,
        leaderCard
      );
    } else {
      page.appendChild(teamSection);
    }
  }

  /* Spielplan */
  if (!$("scheduleSection")) {
    const scheduleSection =
      document.createElement("section");

    scheduleSection.id =
      "scheduleSection";

    scheduleSection.className =
      "schedule-section";

    const liveSection =
      page.querySelector(
        ".live-games-section"
      );

    if (liveSection) {
      page.insertBefore(
        scheduleSection,
        liveSection
      );
    } else {
      page.appendChild(
        scheduleSection
      );
    }
  }

  /* Inhalt Spielplan */
  if (
    $("scheduleSection") &&
    !$("scheduleView")
  ) {
    $("scheduleSection").innerHTML = `
      <div class="section-title-row">

        <div>
          <h2>Spielplan</h2>
          <p class="section-sub">
            Alle Spiele nach Spieltag
          </p>
        </div>

        <div class="schedule-controls">
          <label for="matchdaySelect">
            Spieltag
          </label>

          <select id="matchdaySelect"></select>
        </div>

      </div>

      <div id="scheduleView"></div>
    `;
  }
}

createExtraPublicSections();

/* =========================================================
   TEAM VIEW
   ========================================================= */

function calculateTeamOverview(team) {
  const teamName = team.team;

  const finished =
    currentMatches.filter(
      (m) =>
        m.status === "finished" &&
        matchTeamsMatch(m, teamName)
    );

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  finished.forEach((m) => {
    const hs =
      Number(m.homeScore) || 0;

    const as =
      Number(m.awayScore) || 0;

    if (m.home === teamName) {
      goalsFor += hs;
      goalsAgainst += as;

      if (hs > as) wins++;
      else if (hs === as) draws++;
      else losses++;
    } else {
      goalsFor += as;
      goalsAgainst += hs;

      if (as > hs) wins++;
      else if (as === hs) draws++;
      else losses++;
    }
  });

  if (finished.length) {
    return {
      games: finished.length,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      diff:
        goalsFor - goalsAgainst,
      points:
        wins * 3 + draws
    };
  }

  const goals =
    parseGoals(team.goals);

  return {
    games: Number(team.sp) || 0,
    wins: Number(team.s) || 0,
    draws: Number(team.u) || 0,
    losses: Number(team.n) || 0,
    goalsFor: goals.for,
    goalsAgainst: goals.against,
    diff:
      Number(team.diff) || 0,
    points:
      Number(team.points) || 0
  };
}

function resultForTeam(
  match,
  teamName
) {
  const hs =
    Number(match.homeScore) || 0;

  const as =
    Number(match.awayScore) || 0;

  const isHome =
    match.home === teamName;

  const gf =
    isHome ? hs : as;

  const ga =
    isHome ? as : hs;

  return {
    gf,
    ga,
    result:
      gf > ga
        ? "S"
        : gf < ga
        ? "N"
        : "U"
  };
}

function formMarkup(teamName) {
  const finished =
    currentMatches
      .filter(
        (m) =>
          m.status === "finished" &&
          matchTeamsMatch(
            m,
            teamName
          )
      )
      .sort((a, b) =>
        String(
          b.date || ""
        ).localeCompare(
          String(a.date || "")
        )
      )
      .slice(0, 5);

  const team =
    teamByName(teamName);

  if (
    !finished.length &&
    team?.formManual
  ) {
    return String(
      team.formManual
    )
      .toUpperCase()
      .slice(0, 5)
      .split("")
      .map(
        (c) =>
          `<span class="big-form-dot ${
            c === "W"
              ? "win"
              : c === "L"
              ? "loss"
              : "draw"
          }">${c}</span>`
      )
      .join("");
  }

  if (!finished.length) {
    return `
      <span class="form-placeholder">
        Noch keine Ergebnisse
      </span>
    `;
  }

  return finished
    .reverse()
    .map((m) => {
      const r =
        resultForTeam(
          m,
          teamName
        );

      return `
        <span
          class="big-form-dot ${
            r.result === "S"
              ? "win"
              : r.result === "N"
              ? "loss"
              : "draw"
          }"
          title="${esc(
            m.home
          )} ${r.gf}:${r.ga} ${esc(
            m.away
          )}"
        >
          ${r.result}
        </span>
      `;
    })
    .join("");
}

function teamResultCard(
  match,
  teamName,
  upcoming = false
) {
  const r =
    upcoming
      ? null
      : resultForTeam(
          match,
          teamName
        );

  return `
    <article
      class="team-match-item ${
        upcoming ? "upcoming" : ""
      }"
    >

      <div class="team-match-day">
        SPIELTAG ${getMatchday(match)}
        ${
          upcoming
            ? ` · ${esc(
                match.kickoff || ""
              )}`
            : ""
        }
      </div>

      <div class="team-match-main">

        <button
          class="team-match-team team-match-click"
          data-team-link="${esc(
            match.home
          )}"
          type="button"
        >
          ${teamLogo(
            teamByName(match.home) ||
              match.home
          )}
          <span>
            ${esc(match.home)}
          </span>
        </button>

        <strong class="team-match-score">
          ${
            upcoming
              ? "– : –"
              : `${
                  Number(
                    match.homeScore
                  ) || 0
                } : ${
                  Number(
                    match.awayScore
                  ) || 0
                }`
          }
        </strong>

        <button
          class="team-match-team team-match-click"
          data-team-link="${esc(
            match.away
          )}"
          type="button"
        >
          <span>
            ${esc(match.away)}
          </span>

          ${teamLogo(
            teamByName(match.away) ||
              match.away
          )}
        </button>

      </div>

      ${
        !upcoming
          ? `
            <div class="team-match-result ${
              r.result === "S"
                ? "win"
                : r.result === "N"
                ? "loss"
                : "draw"
            }">
              ${
                r.result === "S"
                  ? "SIEG"
                  : r.result === "N"
                  ? "NIEDERLAGE"
                  : "UNENTSCHIEDEN"
              }
            </div>
          `
          : ""
      }

    </article>
  `;
}

function renderTeamView(
  teamName
) {
  const view =
    $("teamView");

  if (!view) return;

  const team =
    teamByName(teamName);

  if (!team) {
    view.classList.add(
      "hidden"
    );
    return;
  }

  selectedTeamName =
    teamName;

  const stats =
    calculateTeamOverview(
      team
    );

  const lastFive =
    currentMatches
      .filter(
        (m) =>
          m.status === "finished" &&
          matchTeamsMatch(
            m,
            teamName
          )
      )
      .sort((a, b) =>
        String(
          b.date || ""
        ).localeCompare(
          String(
            a.date || ""
          )
        )
      )
      .slice(0, 5);

  const upcoming =
    currentMatches
      .filter(
        (m) =>
          m.status === "next" &&
          matchTeamsMatch(
            m,
            teamName
          )
      )
      .sort((a, b) =>
        String(
          a.date || ""
        ).localeCompare(
          String(
            b.date || ""
          )
        )
      )
      .slice(0, 8);

  view.innerHTML = `
    <div class="team-profile-header">

      <button
        type="button"
        id="closeTeamView"
        class="team-back-button"
      >
        ← Zurück zur Tabelle
      </button>

      <div class="team-profile-main">

        <div class="team-profile-logo">
          ${teamLogo(
            team,
            true
          )}
        </div>

        <div class="team-profile-title">

          <span class="eyebrow">
            TEAM-PROFIL
          </span>

          <h2>
            ${esc(team.team)}
          </h2>

          <p>
            Trainer:
            <strong>
              ${esc(
                team.trainer ||
                  "–"
              )}
            </strong>
          </p>

        </div>

      </div>

      <div class="team-profile-form">

        <span>
          AKTUELLE FORM
        </span>

        <div>
          ${formMarkup(
            teamName
          )}
        </div>

      </div>

    </div>

    <div class="team-stat-grid">

      <div class="team-stat-card">
        <span>SPIELE</span>
        <strong>${stats.games}</strong>
      </div>

      <div class="team-stat-card">
        <span>SIEGE</span>
        <strong>${stats.wins}</strong>
      </div>

      <div class="team-stat-card">
        <span>UNENTSCHIEDEN</span>
        <strong>${stats.draws}</strong>
      </div>

      <div class="team-stat-card">
        <span>NIEDERLAGEN</span>
        <strong>${stats.losses}</strong>
      </div>

      <div class="team-stat-card">
        <span>TORE</span>
        <strong>
          ${stats.goalsFor}:${stats.goalsAgainst}
        </strong>
      </div>

      <div class="team-stat-card">
        <span>DIFFERENZ</span>
        <strong>
          ${formatDiff(
            stats.diff
          )}
        </strong>
      </div>

      <div class="team-stat-card featured">
        <span>PUNKTE</span>
        <strong>${stats.points}</strong>
      </div>

    </div>

    <div class="team-profile-columns">

      <div class="team-profile-box">

        <div class="team-box-header">
          <h3>
            LETZTE 5 SPIELE
          </h3>

          <span>
            ${lastFive.length}/5
          </span>
        </div>

        ${
          lastFive.length
            ? `
              <div class="team-match-list">
                ${lastFive
                  .map(
                    (m) =>
                      teamResultCard(
                        m,
                        teamName
                      )
                  )
                  .join("")}
              </div>
            `
            : `
              <div class="team-empty">
                Noch keine Spiele beendet.
              </div>
            `
        }

      </div>

      <div class="team-profile-box">

        <div class="team-box-header">
          <h3>
            KOMMENDE SPIELE
          </h3>

          <span>
            ${upcoming.length}
          </span>
        </div>

        ${
          upcoming.length
            ? `
              <div class="team-match-list">
                ${upcoming
                  .map(
                    (m) =>
                      teamResultCard(
                        m,
                        teamName,
                        true
                      )
                  )
                  .join("")}
              </div>
            `
            : `
              <div class="team-empty">
                Keine kommenden Spiele.
              </div>
            `
        }

      </div>

    </div>
  `;

  view.classList.remove(
    "hidden"
  );

  const closeButton =
    $("closeTeamView");

  if (closeButton) {
    closeButton.onclick = () => {
      view.classList.add(
        "hidden"
      );

      selectedTeamName =
        null;

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    };
  }

  view.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

/* =========================================================
   FORM / TABLE
   ========================================================= */

function getForm(
  teamName
) {
  const teamObj =
    currentTeams.find(
      (t) =>
        t.team === teamName
    );

  if (
    teamObj?.formManual
  ) {
    const chars =
      String(
        teamObj.formManual
      )
        .toUpperCase()
        .slice(0, 5)
        .split("");

    return `
      <span class="form">

        ${chars
          .map(
            (c) =>
              `<span class="form-dot ${
                c === "W"
                  ? "win"
                  : c === "L"
                  ? "loss"
                  : "draw"
              }">
                ${
                  c === "W"
                    ? "🟢"
                    : c === "L"
                    ? "🔴"
                    : "🟡"
                }
              </span>`
          )
          .join("")}

        ${Array(
          Math.max(
            0,
            5 - chars.length
          )
        )
          .fill(
            '<span class="form-dot empty">⚪</span>'
          )
          .join("")}

      </span>
    `;
  }

  const games =
    currentMatches
      .filter(
        (m) =>
          m.status ===
            "finished" &&
          matchTeamsMatch(
            m,
            teamName
          )
      )
      .sort((a, b) =>
        String(
          b.date || ""
        ).localeCompare(
          String(
            a.date || ""
          )
        )
      )
      .slice(0, 5);

  return `
    <span class="form">

      ${[...games]
        .reverse()
        .map((m) => {
          const result =
            resultForTeam(
              m,
              teamName
            );

          return `
            <span
              class="form-dot ${
                result.result === "S"
                  ? "win"
                  : result.result === "N"
                  ? "loss"
                  : "draw"
              }"
              title="${esc(
                m.home
              )} ${
                Number(
                  m.homeScore
                ) || 0
              }:${
                Number(
                  m.awayScore
                ) || 0
              } ${esc(
                m.away
              )}"
            >
              ${
                result.result ===
                "S"
                  ? "🟢"
                  : result.result ===
                    "N"
                  ? "🔴"
                  : "🟡"
              }
            </span>
          `;
        })
        .join("")}

      ${Array(
        Math.max(
          0,
          5 - games.length
        )
      )
        .fill(
          '<span class="form-dot empty">⚪</span>'
        )
        .join("")}

    </span>
  `;
}

/* =========================================================
   TABLE RENDER
   ========================================================= */

function renderTable(
  list
) {
  const sorted =
    sortTeams(list);

  body.innerHTML =
    sorted
      .map(
        (t, i) => `
          <tr
            class="${
              i === 0
                ? "leader-row"
                : ""
            }"
            data-team-row="${esc(
              t.team
            )}"
          >

            <td class="place">
              ${i + 1}.
            </td>

            <td class="left team-name">

              <button
                type="button"
                class="team-link-button"
                data-team-link="${esc(
                  t.team
                )}"
              >
                <div class="team-cell">

                  ${teamLogo(t)}

                  <span>
                    ${esc(
                      t.team
                    )}
                  </span>

                </div>
              </button>

            </td>

            <td class="left">
              ${esc(
                t.trainer
              )}
            </td>

            <td>
              ${getForm(
                t.team
              )}
            </td>

            <td>
              ${Number(t.sp) || 0}
            </td>

            <td>
              ${Number(t.s) || 0}
            </td>

            <td>
              ${Number(t.u) || 0}
            </td>

            <td>
              ${Number(t.n) || 0}
            </td>

            <td>
              ${esc(
                t.goals
              )}
            </td>

            <td
              class="${
                Number(
                  t.diff
                ) > 0
                  ? "positive"
                  : ""
              }"
            >
              ${formatDiff(
                Number(
                  t.diff
                ) || 0
              )}
            </td>

            <td class="points">
              ${
                Number(
                  t.points
                ) || 0
              }
            </td>

          </tr>
        `
      )
      .join("");

  renderLeader(
    sorted[0]
  );

  if (
    selectedTeamName
  ) {
    renderTeamView(
      selectedTeamName
    );
  }
}

function renderLeader(
  leader
) {
  if (!leader) {
    $("leaderCard").innerHTML =
      "";
    return;
  }

  $("leaderCard").innerHTML = `
    <div class="leader-label">
      TABELLENFÜHRER
    </div>

    <button
      type="button"
      class="leader-clickable"
      data-team-link="${esc(
        leader.team
      )}"
    >

      <div class="leader-main">

        ${teamLogo(
          leader
        )}

        <div>

          <div class="leader-team">
            ${esc(
              leader.team
            )}
          </div>

          <div class="leader-trainer">
            ${esc(
              leader.trainer ||
                ""
            )}
          </div>

        </div>

        <div class="leader-points">

          <strong>
            ${
              Number(
                leader.points
              ) || 0
            }
          </strong>

          <span>
            PUNKTE
          </span>

        </div>

      </div>

    </button>
  `;
}

/* =========================================================
   SCHEDULE
   ========================================================= */

function availableMatchdays() {
  const numbers =
    currentMatches.map(
      getMatchday
    );

  if (!numbers.length) {
    return [1];
  }

  return [
    ...new Set(numbers)
  ].sort(
    (a, b) => a - b
  );
}

function renderScheduleControls() {
  const select =
    $("matchdaySelect");

  if (!select) return;

  const days =
    availableMatchdays();

  if (
    !days.includes(
      Number(
        selectedMatchday
      )
    )
  ) {
    selectedMatchday =
      days[0] || 1;
  }

  select.innerHTML =
    days
      .map(
        (day) =>
          `<option
            value="${day}"
            ${
              day ===
              Number(
                selectedMatchday
              )
                ? "selected"
                : ""
            }
          >
            Spieltag ${day}
          </option>`
      )
      .join("");

  select.onchange = () => {
    selectedMatchday =
      Number(
        select.value
      ) || 1;

    renderSchedule();
  };
}

function scheduleCard(
  match
) {
  const status =
    match.status ||
    "next";

  return `
    <article
      class="schedule-match-card ${status}"
    >

      <div class="schedule-match-meta">

        <span class="schedule-status">

          ${
            status === "live"
              ? "🔴 LIVE"
              : status ===
                "finished"
              ? "BEENDET"
              : "NÄCHSTES SPIEL"
          }

        </span>

        <span>
          ${
            status === "finished"
              ? "Endstand"
              : esc(
                  match.kickoff ||
                    ""
                )
          }
        </span>

      </div>

      <div class="schedule-match-teams">

        <button
          type="button"
          class="schedule-team"
          data-team-link="${esc(
            match.home
          )}"
        >

          ${teamLogo(
            teamByName(
              match.home
            ) ||
              match.home,
            true
          )}

          <span>
            ${esc(
              match.home
            )}
          </span>

        </button>

        <div class="schedule-score">

          ${
            status === "next"
              ? "– : –"
              : `${
                  Number(
                    match.homeScore
                  ) || 0
                } : ${
                  Number(
                    match.awayScore
                  ) || 0
                }`
          }

        </div>

        <button
          type="button"
          class="schedule-team"
          data-team-link="${esc(
            match.away
          )}"
        >

          <span>
            ${esc(
              match.away
            )}
          </span>

          ${teamLogo(
            teamByName(
              match.away
            ) ||
              match.away,
            true
          )}

        </button>

      </div>

      ${
        match.scorers
          ? `
            <div class="schedule-scorers">
              ⚽ ${esc(
                match.scorers
              )}
            </div>
          `
          : ""
      }

      ${
        status === "live"
          ? `
            <div class="schedule-live-minute">
              ${esc(
                match.minute ||
                  "LIVE"
              )}′
            </div>
          `
          : ""
      }

    </article>
  `;
}

function renderSchedule() {
  const scheduleView =
    $("scheduleView");

  if (!scheduleView) return;

  renderScheduleControls();

  const matches =
    currentMatches
      .filter(
        (m) =>
          getMatchday(
            m
          ) ===
          Number(
            selectedMatchday
          )
      )
      .sort((a, b) =>
        String(
          a.date || ""
        ).localeCompare(
          String(
            b.date || ""
          )
        )
      );

  scheduleView.innerHTML = `
    <div class="schedule-day-heading">

      <div>
        <span>
          SPIELTAG
        </span>

        <strong>
          ${selectedMatchday}
        </strong>
      </div>

      <small>
        ${matches.length}
        ${
          matches.length === 1
            ? "Spiel"
            : "Spiele"
        }
      </small>

    </div>

    ${
      matches.length
        ? `
          <div class="schedule-grid">
            ${matches
              .map(
                scheduleCard
              )
              .join("")}
          </div>
        `
        : `
          <div class="schedule-empty">
            Für diesen Spieltag sind noch keine Spiele eingetragen.
          </div>
        `
    }
  `;
}

/* =========================================================
   MATCH CARDS / LIVE
   ========================================================= */

function matchLabel(
  status
) {
  return status === "live"
    ? "LIVE"
    : status ===
      "finished"
    ? "BEENDET"
    : "NÄCHSTE";
}

function matchScore(m) {
  return m.status ===
    "next"
    ? "– : –"
    : `${
        Number(
          m.homeScore
        ) || 0
      } : ${
        Number(
          m.awayScore
        ) || 0
      }`;
}

function scorerHtml(m) {
  if (!m.scorers)
    return "";

  return `
    <div class="scorers">
      <b>⚽</b>
      ${esc(
        m.scorers
      )}
    </div>
  `;
}

function matchCard(
  m,
  compact = false
) {
  const status =
    m.status || "next";

  const extra =
    status === "live"
      ? `${esc(
          m.minute || ""
        )}′`
      : status ===
        "next"
      ? esc(
          m.kickoff || ""
        )
      : "Endstand";

  return `
    <article
      data-match-card="${esc(
        m.id ||
          `${m.home}-${m.away}`
      )}"
      class="match-card match-${esc(
        status
      )} ${
        compact
          ? "compact"
          : ""
      }"
    >

      <div class="match-top">

        <span class="match-badge">
          ${matchLabel(
            status
          )}
        </span>

        <span class="match-extra">
          ${extra}
        </span>

      </div>

      <div class="matchday-small">
        SPIELTAG ${getMatchday(
          m
        )}
      </div>

      <div class="match-teams">

        <button
          type="button"
          class="match-team-button"
          data-team-link="${esc(
            m.home
          )}"
        >

          ${teamLogo(
            teamByName(
              m.home
            ) ||
              m.home
          )}

          <em>
            ${esc(
              m.home
            )}
          </em>

        </button>

        <strong>
          ${matchScore(
            m
          )}
        </strong>

        <button
          type="button"
          class="match-team-button away"
          data-team-link="${esc(
            m.away
          )}"
        >

          <em>
            ${esc(
              m.away
            )}
          </em>

          ${teamLogo(
            teamByName(
              m.away
            ) ||
              m.away
          )}

        </button>

      </div>

      ${scorerHtml(m)}

    </article>
  `;
}

function renderMatches(
  list
) {
  const sorted =
    [...list].sort(
      (a, b) =>
        String(
          a.date || ""
        ).localeCompare(
          String(
            b.date || ""
          )
        )
    );

  liveMatches.innerHTML =
    sorted.length
      ? sorted
          .map(
            (m) =>
              matchCard(m)
          )
          .join("")
      : `
          <div class="empty-matches">
            Noch keine Spiele eingetragen.
          </div>
        `;

  const live =
    sorted.filter(
      (m) =>
        m.status === "live"
    );

  const next =
    sorted
      .filter(
        (m) =>
          m.status === "next"
      )
      .slice(0, 3);

  const finished =
    sorted
      .filter(
        (m) =>
          m.status ===
          "finished"
      )
      .sort((a, b) =>
        String(
          b.date || ""
        ).localeCompare(
          String(
            a.date || ""
          )
        )
      )
      .slice(0, 3);

  $("featuredLive").innerHTML =
    live.length
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
          <strong>
            Kein Spiel live
          </strong>
          <small>
            Die nächsten Partien stehen bereit.
          </small>
        </div>
      `;

  $("nextMatches").innerHTML =
    next.length
      ? next
          .map((m) =>
            matchCard(
              m,
              true
            )
          )
          .join("")
      : `
        <div class="mini-empty">
          Keine nächsten Spiele
        </div>
      `;

  $("recentMatches").innerHTML =
    finished.length
      ? finished
          .map((m) =>
            matchCard(
              m,
              true
            )
          )
          .join("")
      : `
        <div class="mini-empty">
          Noch keine Ergebnisse
        </div>
      `;

  $("heroLiveText").textContent =
    live.length
      ? `${live.length} SPIEL${
          live.length > 1
            ? "E"
            : ""
        } LIVE`
      : "LIVE";

  live.forEach((m) => {
    const key =
      m.id ||
      `${m.home}-${m.away}`;

    const score =
      (Number(
        m.homeScore
      ) || 0) +
      (Number(
        m.awayScore
      ) || 0);

    if (
      previousLiveScores[
        key
      ] !== undefined &&
      score >
        previousLiveScores[
          key
        ]
    ) {
      setTimeout(() => {
        document
          .querySelectorAll(
            `[data-match-card="${CSS.escape(
              key
            )}"]`
          )
          .forEach((el) =>
            el.classList.add(
              "goal-flash"
            )
          );
      }, 0);
    }

    previousLiveScores[key] =
      score;
  });

  $("heroLivePill").classList.toggle(
    "active",
    Boolean(live.length)
  );

  renderSchedule();
}

/* =========================================================
   ADMIN - TEAMS
   ========================================================= */

function editorHtml(
  list
) {
  editorWrap.innerHTML = `
    <div class="admin-team-editor">

      ${list
        .map(
          (t, i) => `
            <div
              class="admin-team-card"
              data-index="${i}"
            >

              <div class="admin-team-card-head">

                <div class="admin-team-preview">

                  ${teamLogo(
                    t,
                    true
                  )}

                  <div>
                    <strong>
                      ${esc(
                        t.team
                      )}
                    </strong>

                    <small>
                      Team #${
                        Number(
                          t.id
                        ) || 0
                      }
                    </small>
                  </div>

                </div>

                <button
                  class="delete"
                  data-action="delete"
                  type="button"
                >
                  ×
                </button>

              </div>

              <div class="admin-team-fields">

                <label>
                  Team

                  <input
                    data-k="team"
                    value="${esc(
                      t.team
                    )}"
                  >
                </label>

                <label>
                  Trainer

                  <input
                    data-k="trainer"
                    value="${esc(
                      t.trainer
                    )}"
                  >
                </label>

                <label class="wide">
                  Logo-URL

                  <input
                    data-k="logo"
                    value="${esc(
                      t.logo ||
                        TEAM_LOGOS[
                          t.team
                        ] ||
                        ""
                    )}"
                    placeholder="https://..."
                  >
                </label>

                <label>
                  Form

                  <input
                    data-k="formManual"
                    value="${esc(
                      t.formManual ||
                        ""
                    )}"
                    placeholder="WWDLW"
                    maxlength="5"
                  >
                </label>

                <label>
                  Spiele

                  <input
                    data-k="sp"
                    type="number"
                    min="0"
                    value="${
                      Number(
                        t.sp
                      ) || 0
                    }"
                  >
                </label>

                <label>
                  Siege

                  <input
                    data-k="s"
                    type="number"
                    min="0"
                    value="${
                      Number(
                        t.s
                      ) || 0
                    }"
                  >
                </label>

                <label>
                  Unentschieden

                  <input
                    data-k="u"
                    type="number"
                    min="0"
                    value="${
                      Number(
                        t.u
                      ) || 0
                    }"
                  >
                </label>

                <label>
                  Niederlagen

                  <input
                    data-k="n"
                    type="number"
                    min="0"
                    value="${
                      Number(
                        t.n
                      ) || 0
                    }"
                  >
                </label>

                <label>
                  Tore

                  <input
                    data-k="goals"
                    value="${esc(
                      t.goals ||
                        "0:0"
                    )}"
                  >
                </label>

                <label>
                  Differenz

                  <input
                    data-k="diff"
                    type="number"
                    value="${
                      Number(
                        t.diff
                      ) || 0
                    }"
                  >
                </label>

                <label>
                  Punkte

                  <input
                    data-k="points"
                    type="number"
                    min="0"
                    value="${
                      Number(
                        t.points
                      ) || 0
                    }"
                  >
                </label>

              </div>

            </div>
          `
        )
        .join("")}

    </div>
  `;
}

function readEditor() {
  return [
    ...editorWrap.querySelectorAll(
      ".admin-team-card"
    )
  ].map((card, index) => {
    const t = {
      id:
        Number(
          card.dataset.index
        ) + 1
    };

    card
      .querySelectorAll(
        "[data-k]"
      )
      .forEach((input) => {
        const k =
          input.dataset.k;

        t[k] = [
          "sp",
          "s",
          "u",
          "n",
          "diff",
          "points"
        ].includes(k)
          ? Number(
              input.value || 0
            )
          : input.value;
      });

    if (!t.logo) {
      t.logo =
        TEAM_LOGOS[
          t.team
        ] || "";
    }

    return t;
  });
}

/* =========================================================
   ADMIN - MATCHES
   ========================================================= */

function makeMatchId() {
  return `match-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
    .replace(
      /[.#$\/[\]]/g,
      "_"
    );
}

function cleanKey(key) {
  return (
    String(key || "")
      .replace(
        /[.#$\/[\]]/g,
        "_"
      ) ||
    makeMatchId()
  );
}

function matchEditorHtml(
  list
) {
  matchesEditorWrap.innerHTML = `
    <div class="admin-match-editor">

      ${list
        .map(
          (m, i) => `
            <div
              class="admin-match-card"
              data-index="${i}"
              data-match-id="${esc(
                m.id ||
                  makeMatchId()
              )}"
            >

              <div class="admin-match-top">

                <strong>
                  SPIELTAG
                  ${getMatchday(m)}
                </strong>

                <button
                  class="delete"
                  data-action="delete-match"
                  type="button"
                >
                  ×
                </button>

              </div>

              <div class="admin-match-fields">

                <label>
                  Spieltag

                  <input
                    data-k="matchday"
                    type="number"
                    min="1"
                    value="${getMatchday(
                      m
                    )}"
                  >
                </label>

                <label>
                  Status

                  <select
                    data-k="status"
                  >
                    <option
                      value="next"
                      ${
                        m.status ===
                        "next"
                          ? "selected"
                          : ""
                      }
                    >
                      NÄCHSTE
                    </option>

                    <option
                      value="live"
                      ${
                        m.status ===
                        "live"
                          ? "selected"
                          : ""
                      }
                    >
                      LIVE
                    </option>

                    <option
                      value="finished"
                      ${
                        m.status ===
                        "finished"
                          ? "selected"
                          : ""
                      }
                    >
                      BEENDET
                    </option>
                  </select>
                </label>

                <label>
                  Heimteam

                  <input
                    data-k="home"
                    value="${esc(
                      m.home ||
                        ""
                    )}"
                    placeholder="Real Madrid"
                  >
                </label>

                <label>
                  Auswärtsteam

                  <input
                    data-k="away"
                    value="${esc(
                      m.away ||
                        ""
                    )}"
                    placeholder="Barcelona"
                  >
                </label>

                <label>
                  Anpfiff

                  <input
                    data-k="kickoff"
                    value="${esc(
                      m.kickoff ||
                        ""
                    )}"
                    placeholder="19:30"
                  >
                </label>

                <label>
                  Heim-Tore

                  <input
                    data-k="homeScore"
                    type="number"
                    min="0"
                    value="${
                      Number(
                        m.homeScore
                      ) || 0
                    }"
                  >
                </label>

                <label>
                  Auswärts-Tore

                  <input
                    data-k="awayScore"
                    type="number"
                    min="0"
                    value="${
                      Number(
                        m.awayScore
                      ) || 0
                    }"
                  >
                </label>

                <label>
                  Live-Minute

                  <input
                    data-k="minute"
                    value="${esc(
                      m.minute ||
                        ""
                    )}"
                    placeholder="67"
                  >
                </label>

                <label class="wide">
                  Torschützen

                  <input
                    data-k="scorers"
                    value="${esc(
                      m.scorers ||
                        ""
                    )}"
                    placeholder="Mbappé, Vinícius"
                  >
                </label>

                <label class="wide">
                  Datum / Sortierung

                  <input
                    data-k="date"
                    value="${esc(
                      m.date ||
                        ""
                    )}"
                    placeholder="2026-08-23 19:30"
                  >
                </label>

              </div>

            </div>
          `
        )
        .join("")}

    </div>
  `;
}

function readMatchEditor() {
  return [
    ...matchesEditorWrap.querySelectorAll(
      ".admin-match-card"
    )
  ].map((card) => {
    const m = {
      id:
        card.dataset.matchId ||
        makeMatchId()
    };

    card
      .querySelectorAll(
        "[data-k]"
      )
      .forEach((input) => {
        const k =
          input.dataset.k;

        m[k] = [
          "homeScore",
          "awayScore",
          "matchday"
        ].includes(k)
          ? Number(
              input.value || 0
            )
          : input.value;
      });

    m.matchday = Math.max(
      1,
      Number(
        m.matchday
      ) || 1
    );

    return m;
  });
}

/* =========================================================
   ADMIN
   ========================================================= */

function showAdmin() {
  adminLoggedIn = true;

  loginView.classList.add(
    "hidden"
  );

  editorView.classList.remove(
    "hidden"
  );

  editorHtml(
    currentTeams
  );

  matchEditorHtml(
    currentMatches
  );
}

function hideAdmin() {
  adminLoggedIn = false;

  loginView.classList.remove(
    "hidden"
  );

  editorView.classList.add(
    "hidden"
  );

  $("adminCode").value =
    "";
}

/* =========================================================
   TEAM CLICKS
   ========================================================= */

document.addEventListener(
  "click",
  (event) => {
    const button =
      event.target.closest(
        "[data-team-link]"
      );

    if (!button) return;

    const teamName =
      button.dataset
        .teamLink;

    if (!teamName)
      return;

    renderTeamView(
      teamName
    );
  }
);

/* =========================================================
   CLOCK / STATUS
   ========================================================= */

function updateClock() {
  $("updatedAt").textContent =
    `Stand: ${new Date().toLocaleTimeString(
      "de-DE"
    )}`;
}

function updateStatus(
  online,
  text
) {
  $("liveDot").classList.toggle(
    "live",
    online
  );

  $("liveText").textContent =
    text;

  updateClock();
}

/* =========================================================
   INITIAL
   ========================================================= */

renderTable(
  currentTeams
);

renderMatches(
  currentMatches
);

renderSchedule();

updateStatus(
  false,
  "Verbinde mit der Live-Tabelle …"
);

updateClock();

setInterval(
  updateClock,
  1000
);

/* =========================================================
   ADMIN BUTTONS
   ========================================================= */

$("adminToggle").onclick =
  () => {
    adminPanel.classList.remove(
      "hidden"
    );

    adminPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };

$("closeAdmin").onclick =
  () =>
    adminPanel.classList.add(
      "hidden"
    );

$("loginBtn").onclick =
  () => {
    $("loginError").textContent =
      "";

    if (
      $("adminCode")
        .value ===
      ADMIN_CODE
    ) {
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

$("logoutBtn").onclick =
  hideAdmin;

/* =========================================================
   TEAM ADMIN
   ========================================================= */

$("addTeam").onclick =
  () => {
    if (!adminLoggedIn)
      return;

    const list =
      readEditor();

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
      logo: "",
      formManual: ""
    });

    editorHtml(list);
  };

editorWrap.addEventListener(
  "click",
  (e) => {
    if (
      e.target.dataset
        .action ===
      "delete"
    ) {
      e.target
        .closest(
          ".admin-team-card"
        )
        ?.remove();
    }
  }
);

$("loadCurrent").onclick =
  () => {
    if (!adminLoggedIn)
      return;

    editorHtml(
      currentTeams
    );

    matchEditorHtml(
      currentMatches
    );
  };

$("saveTable").onclick =
  async () => {
    if (!adminLoggedIn) {
      return alert(
        "Bitte zuerst Admin-Code eingeben."
      );
    }

    if (!teamsRef) {
      return alert(
        "Firebase ist nicht verbunden."
      );
    }

    try {
      const list =
        readEditor();

      list.forEach(
        (team, index) => {
          if (
            !team.id ||
            team.id <= 0
          ) {
            team.id =
              index + 1;
          }
        }
      );

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
        "Teams gespeichert. Alle Besucher sehen die Änderung."
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
   MATCH ADMIN
   ========================================================= */

$("addMatch").onclick =
  () => {
    if (!adminLoggedIn)
      return;

    const list =
      readMatchEditor();

    list.push({
      id: makeMatchId(),
      matchday:
        selectedMatchday ||
        1,
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

    matchEditorHtml(
      list
    );
  };

matchesEditorWrap.addEventListener(
  "click",
  (e) => {
    if (
      e.target.dataset
        .action ===
      "delete-match"
    ) {
      e.target
        .closest(
          ".admin-match-card"
        )
        ?.remove();
    }
  }
);

$("saveMatches").onclick =
  async () => {
    if (!adminLoggedIn) {
      return alert(
        "Bitte zuerst Admin-Code eingeben."
      );
    }

    if (!matchesRef) {
      return alert(
        "Firebase ist nicht verbunden."
      );
    }

    try {
      const list =
        readMatchEditor()
          .map((m) => {
            const id =
              cleanKey(
                m.id
              );

            delete m.id;

            return {
              id,
              data: m
            };
          });

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
        "Spiele gespeichert. Alle Besucher sehen die Änderung."
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
    initializeApp(
      firebaseConfig
    );

  db =
    getDatabase(app);

  teamsRef =
    ref(
      db,
      "liga/teams"
    );

  matchesRef =
    ref(
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
          ).map(
            (team) => ({
              ...team,

              logo:
                team.logo ||
                TEAM_LOGOS[
                  team.team
                ] ||
                "",

              formManual:
                team.formManual ||
                ""
            })
          );
      } else {
        currentTeams =
          [
            ...initialTeams
          ];
      }

      renderTable(
        currentTeams
      );

      if (
        adminLoggedIn
      ) {
        editorHtml(
          currentTeams
        );
      }

      updateStatus(
        true,
        "● LIVE – Tabelle synchronisiert"
      );
    },
    (err) => {
      console.error(
        err
      );

      updateStatus(
        false,
        "Verbindung zur Live-Tabelle fehlt"
      );
    }
  );

  onValue(
    matchesRef,
    (snap) => {
      currentMatches =
        snap.exists()
          ? Object.entries(
              snap.val()
            ).map(
              ([id, data]) => ({
                id,
                ...data,
                matchday:
                  Math.max(
                    1,
                    Number(
                      data.matchday
                    ) || 1
                  )
              })
            )
          : [];

      renderMatches(
        currentMatches
      );

      if (
        adminLoggedIn
      ) {
        matchEditorHtml(
          currentMatches
        );
      }
    },
    (err) => {
      console.error(
        err
      );
    }
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

setInterval(
  () => {
    if (!adminLoggedIn) {
      location.reload();
    }
  },
  10000
);