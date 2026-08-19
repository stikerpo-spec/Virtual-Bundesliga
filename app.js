import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const ADMIN_CODE = "Stikeli";
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const teamsRef = ref(db, "liga/teams");
const matchesRef = ref(db, "liga/matches");

const initialTeams = [
  {id:1,team:"REAL MADRID",trainer:"Scotty",sp:1,s:1,u:0,n:0,goals:"6:3",diff:3,points:3},
  {id:2,team:"OSNABRÜCK",trainer:"Philipp",sp:1,s:1,u:0,n:0,goals:"7:5",diff:2,points:3},
  {id:3,team:"NÜRNBERG",trainer:"Stikerpo",sp:1,s:1,u:0,n:0,goals:"4:2",diff:2,points:3},
  {id:4,team:"SCHALKE 04",trainer:"Antik",sp:1,s:1,u:0,n:0,goals:"2:1",diff:1,points:3},
  {id:5,team:"BARCELONA",trainer:"Kenny",sp:0,s:0,u:0,n:0,goals:"0:0",diff:0,points:0},
  {id:6,team:"ATLETICO MADRID",trainer:"Ben",sp:0,s:0,u:0,n:0,goals:"0:0",diff:0,points:0},
  {id:7,team:"DORTMUND",trainer:"Julien",sp:0,s:0,u:0,n:0,goals:"0:0",diff:0,points:0},
  {id:8,team:"SNEAX | PSG",trainer:"Sneax",sp:0,s:0,u:0,n:0,goals:"0:0",diff:0,points:0},
  {id:9,team:"FREIBURG",trainer:"Raphael",sp:1,s:1,u:0,n:0,goals:"1:2",diff:-1,points:0},
  {id:10,team:"STURM GRAZ",trainer:"Trululu",sp:1,s:0,u:0,n:1,goals:"2:4",diff:-2,points:0},
  {id:11,team:"JUVENTUS",trainer:"clpz_king",sp:1,s:0,u:0,n:1,goals:"5:7",diff:-2,points:0},
  {id:12,team:"AL NASSR",trainer:"Peter",sp:1,s:0,u:0,n:1,goals:"3:6",diff:-3,points:0}
];

let currentTeams = [...initialTeams];
let currentMatches = [];
let adminUnlocked = false;

const $ = (id)=>document.getElementById(id);
const body = $("standingsBody");
const adminPanel = $("adminPanel");
const loginView = $("loginView");
const editorView = $("editorView");
const editorWrap = $("editorWrap");
const matchesEditorWrap = $("matchesEditorWrap");
const liveMatches = $("liveMatches");

function esc(s){return String(s ?? "").replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#039;"}[m]));}
function sortTeams(list){return [...list].sort((a,b)=>b.points-a.points || b.diff-a.diff || b.s-a.s || String(a.team).localeCompare(String(b.team)));}
function formatDiff(v){return v>0?`+${v}`:String(v);}
function renderTable(list){
  body.innerHTML = sortTeams(list).map((t,i)=>`<tr>
    <td class="place">${i+1}.</td>
    <td class="left team-name">${esc(t.team)}</td>
    <td class="left">${esc(t.trainer)}</td>
    <td>${t.sp}</td><td>${t.s}</td><td>${t.u}</td><td>${t.n}</td>
    <td>${esc(t.goals)}</td><td class="${t.diff>0?'positive':''}">${formatDiff(t.diff)}</td><td class="points">${t.points}</td>
  </tr>`).join("");
}
function updateStatus(online, text){$("liveDot").classList.toggle("live",online);$("liveText").textContent=text;$("updatedAt").textContent=online?`Stand: ${new Date().toLocaleString("de-DE")}`:"–";}

function matchStatusClass(status){
  const s = String(status || "").toUpperCase();
  if(s === "LIVE") return "match-live";
  if(s === "ENDE") return "match-ended";
  return "match-next";
}

function renderLiveMatches(list){
  if(!list.length){
    liveMatches.innerHTML = `<div class="empty-matches">Noch keine Spiele eingetragen.</div>`;
    return;
  }
  const order = {LIVE:0,NÄCHSTE:1,ENDE:2};
  const sorted = [...list].sort((a,b)=>(order[String(a.status||"").toUpperCase()] ?? 9) - (order[String(b.status||"").toUpperCase()] ?? 9));
  liveMatches.innerHTML = sorted.map(m=>{
    const status = String(m.status || "NÄCHSTE").toUpperCase();
    const score = `${Number(m.homeScore)||0}:${Number(m.awayScore)||0}`;
    const extra = status === "LIVE" ? (m.minute ? `${esc(m.minute)}'` : "LIVE") : (status === "NÄCHSTE" ? esc(m.time || "") : "Beendet");
    return `<article class="match-card ${matchStatusClass(status)}">
      <div class="match-top"><span class="match-badge">${esc(status)}</span><span class="match-extra">${extra}</span></div>
      <div class="match-teams"><span>${esc(m.home)}</span><strong>${score}</strong><span>${esc(m.away)}</span></div>
    </article>`;
  }).join("");
}

function editorHtml(list){
  const rows = list.map((t)=>`<div class="editor-row" data-index="${t.id}">
    <input data-k="id" type="number" value="${Number(t.id)||0}">
    <input data-k="team" value="${esc(t.team)}">
    <input data-k="trainer" value="${esc(t.trainer)}">
    <input data-k="sp" type="number" min="0" value="${Number(t.sp)||0}">
    <input data-k="s" type="number" min="0" value="${Number(t.s)||0}">
    <input data-k="u" type="number" min="0" value="${Number(t.u)||0}">
    <input data-k="n" type="number" min="0" value="${Number(t.n)||0}">
    <input data-k="goals" value="${esc(t.goals)}">
    <input data-k="diff" type="number" value="${Number(t.diff)||0}">
    <input data-k="points" type="number" min="0" value="${Number(t.points)||0}">
    <button class="delete" data-action="delete-team" type="button">×</button>
  </div>`).join("");
  editorWrap.innerHTML = `<div class="editor-grid"><div class="editor-head"><div>ID</div><div>TEAM</div><div>TRAINER</div><div>SP</div><div>S</div><div>U</div><div>N</div><div>TORE</div><div>DIFF</div><div>PUNKTE</div><div></div></div>${rows}</div>`;
}
function readEditor(){
  return [...editorWrap.querySelectorAll(".editor-row")].map(row=>{
    const t={};
    row.querySelectorAll("[data-k]").forEach(input=>{const k=input.dataset.k;t[k]=["id","sp","s","u","n","diff","points"].includes(k)?Number(input.value||0):input.value;});
    return t;
  });
}

function matchesEditorHtml(list){
  const rows = list.map((m)=>`<div class="match-editor-row" data-id="${esc(m.id)}">
    <input data-k="id" value="${esc(m.id)}">
    <input data-k="home" value="${esc(m.home)}">
    <input data-k="away" value="${esc(m.away)}">
    <select data-k="status">
      <option value="NÄCHSTE" ${String(m.status).toUpperCase()==='NÄCHSTE'?'selected':''}>NÄCHSTE</option>
      <option value="LIVE" ${String(m.status).toUpperCase()==='LIVE'?'selected':''}>LIVE</option>
      <option value="ENDE" ${String(m.status).toUpperCase()==='ENDE'?'selected':''}>ENDE</option>
    </select>
    <input data-k="homeScore" type="number" min="0" value="${Number(m.homeScore)||0}">
    <input data-k="awayScore" type="number" min="0" value="${Number(m.awayScore)||0}">
    <input data-k="minute" placeholder="z. B. 67" value="${esc(m.minute||'')}">
    <input data-k="time" placeholder="z. B. 20:30" value="${esc(m.time||'')}">
    <button class="delete" data-action="delete-match" type="button">×</button>
  </div>`).join("");
  matchesEditorWrap.innerHTML = `<div class="match-editor-grid"><div class="editor-head"><div>ID</div><div>HEIMTEAM</div><div>AUSWÄRTS</div><div>STATUS</div><div>HEIM</div><div>AUSW.</div><div>MINUTE</div><div>UHRZEIT</div><div></div></div>${rows}</div>`;
}
function readMatchesEditor(){
  return [...matchesEditorWrap.querySelectorAll(".match-editor-row")].map(row=>{
    const m={};
    row.querySelectorAll("[data-k]").forEach(input=>{
      const k=input.dataset.k;
      m[k]=["homeScore","awayScore"].includes(k)?Number(input.value||0):input.value;
    });
    return m;
  });
}

function showAdmin(){
  adminUnlocked=true;
  loginView.classList.add("hidden");
  editorView.classList.remove("hidden");
  editorHtml(currentTeams);
  matchesEditorHtml(currentMatches);
}
function hideAdmin(){
  adminUnlocked=false;
  loginView.classList.remove("hidden");
  editorView.classList.add("hidden");
  $("adminCode").value="";
  $("loginError").textContent="";
}

$("adminToggle").onclick=()=>{adminPanel.classList.remove("hidden");adminPanel.scrollIntoView({behavior:"smooth",block:"start"});};
$("closeAdmin").onclick=()=>adminPanel.classList.add("hidden");

$("loginBtn").onclick=()=>{
  const code=$("adminCode").value;
  if(code === ADMIN_CODE){showAdmin();return;}
  $("loginError").textContent="Falscher Admin-Code.";
};
$("logoutBtn").onclick=hideAdmin;

$("addTeam").onclick=()=>{const list=readEditor();list.push({id:Date.now(),team:"NEUES TEAM",trainer:"",sp:0,s:0,u:0,n:0,goals:"0:0",diff:0,points:0});editorHtml(list);};
editorWrap.addEventListener("click",e=>{if(e.target.dataset.action==="delete-team")e.target.closest(".editor-row")?.remove();});
$("loadCurrent").onclick=()=>editorHtml(currentTeams);
$("saveTable").onclick=async()=>{
  const list=readEditor();
  try{await set(teamsRef,Object.fromEntries(list.map(t=>[String(t.id),t])));alert("Tabelle gespeichert.");}
  catch(e){alert("Speichern fehlgeschlagen: "+e.message);}
};

$("addMatch").onclick=()=>{
  const list=readMatchesEditor();
  list.push({id:String(Date.now()),home:"TEAM 1",away:"TEAM 2",status:"NÄCHSTE",homeScore:0,awayScore:0,minute:"",time:""});
  matchesEditorHtml(list);
};
matchesEditorWrap.addEventListener("click",e=>{if(e.target.dataset.action==="delete-match")e.target.closest(".match-editor-row")?.remove();});
$("saveMatches").onclick=async()=>{
  const list=readMatchesEditor();
  try{await set(matchesRef,Object.fromEntries(list.map(m=>[String(m.id),m])));alert("Spiele gespeichert.");}
  catch(e){alert("Spiele konnten nicht gespeichert werden: "+e.message);}
};

onValue(teamsRef,snap=>{
  if(snap.exists()) currentTeams=Object.values(snap.val());
  else currentTeams=[...initialTeams];
  renderTable(currentTeams);
  if(adminUnlocked) editorHtml(currentTeams);
  updateStatus(true,"● LIVE – Tabelle synchronisiert");
},err=>{
  console.error(err);
  renderTable(currentTeams);
  updateStatus(false,"Verbindung zur Live-Tabelle fehlt");
});

onValue(matchesRef,snap=>{
  currentMatches=snap.exists()?Object.values(snap.val()):[];
  renderLiveMatches(currentMatches);
  if(adminUnlocked) matchesEditorHtml(currentMatches);
},err=>{
  console.error(err);
  currentMatches=[];
  renderLiveMatches(currentMatches);
});

renderTable(currentTeams);
renderLiveMatches(currentMatches);
