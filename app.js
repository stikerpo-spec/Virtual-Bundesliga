import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const ADMIN_CODE = "Stikeli";

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
let adminLoggedIn = false;
let db = null;
let teamsRef = null;
let matchesRef = null;

const $ = (id) => document.getElementById(id);
const body = $("standingsBody");
const adminPanel = $("adminPanel");
const loginView = $("loginView");
const editorView = $("editorView");
const editorWrap = $("editorWrap");
const matchesEditorWrap = $("matchesEditorWrap");
const liveMatches = $("liveMatches");

function esc(s){return String(s ?? "").replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function sortTeams(list){return [...list].sort((a,b)=>Number(b.points)-Number(a.points)||Number(b.diff)-Number(a.diff)||Number(b.s)-Number(a.s)||String(a.team).localeCompare(String(b.team)));}
function formatDiff(v){return Number(v)>0?`+${v}`:String(v);}
function renderTable(list){
  body.innerHTML = sortTeams(list).map((t,i)=>`<tr>
    <td class="place">${i+1}.</td><td class="left team-name">${esc(t.team)}</td><td class="left">${esc(t.trainer)}</td>
    <td>${Number(t.sp)||0}</td><td>${Number(t.s)||0}</td><td>${Number(t.u)||0}</td><td>${Number(t.n)||0}</td>
    <td>${esc(t.goals)}</td><td class="${Number(t.diff)>0?'positive':''}">${formatDiff(Number(t.diff)||0)}</td><td class="points">${Number(t.points)||0}</td>
  </tr>`).join("");
}
function updateClock(){
  $("updatedAt").textContent = `Stand: ${new Date().toLocaleTimeString("de-DE")}`;
}
function updateStatus(online,text){
  $("liveDot").classList.toggle("live",online);
  $("liveText").textContent=text;
  updateClock();
}

function editorHtml(list){
  const rows = list.map((t,i)=>`<div class="editor-row" data-index="${i}">
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
    <button class="delete" data-action="delete" type="button">×</button>
  </div>`).join("");
  editorWrap.innerHTML = `<div class="editor-grid"><div class="editor-head"><div>ID</div><div>TEAM</div><div>TRAINER</div><div>SP</div><div>S</div><div>U</div><div>N</div><div>TORE</div><div>DIFF</div><div>PUNKTE</div><div></div></div>${rows}</div>`;
}
function readEditor(){
  return [...editorWrap.querySelectorAll(".editor-row")].map(row=>{
    const t={}; row.querySelectorAll("[data-k]").forEach(input=>{const k=input.dataset.k;t[k]=["id","sp","s","u","n","diff","points"].includes(k)?Number(input.value||0):input.value;}); return t;
  });
}
function matchLabel(status){return status === "live" ? "LIVE" : status === "finished" ? "BEENDET" : "NÄCHSTE";}
function renderMatches(list){
  const sorted=[...list].sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));
  if(!sorted.length){ liveMatches.innerHTML='<div class="empty-matches">Noch keine Spiele eingetragen.</div>'; return; }
  liveMatches.innerHTML=sorted.map(m=>{
    const status=m.status||"next";
    const score = status === "next" ? "– : –" : `${Number(m.homeScore)||0} : ${Number(m.awayScore)||0}`;
    const extra = status === "live" ? `${esc(m.minute||"")}′` : status === "next" ? esc(m.kickoff||"") : "Endstand";
    return `<article class="match-card match-${esc(status)}"><div class="match-top"><span class="match-badge">${matchLabel(status)}</span><span class="match-extra">${extra}</span></div><div class="match-teams"><span>${esc(m.home)}</span><strong>${score}</strong><span>${esc(m.away)}</span></div></article>`;
  }).join("");
}
function matchEditorHtml(list){
  const rows=list.map((m,i)=>`<div class="match-editor-row" data-index="${i}" data-match-id="${esc(m.id || makeMatchId())}">
    <select data-k="status"><option value="next" ${m.status==="next"?'selected':''}>NÄCHSTE</option><option value="live" ${m.status==="live"?'selected':''}>LIVE</option><option value="finished" ${m.status==="finished"?'selected':''}>BEENDET</option></select>
    <input data-k="home" value="${esc(m.home||"")}" placeholder="Heimteam">
    <input data-k="away" value="${esc(m.away||"")}" placeholder="Auswärtsteam">
    <input data-k="kickoff" value="${esc(m.kickoff||"")}" placeholder="19:30">
    <input data-k="homeScore" type="number" min="0" value="${Number(m.homeScore)||0}">
    <input data-k="awayScore" type="number" min="0" value="${Number(m.awayScore)||0}">
    <input data-k="minute" value="${esc(m.minute||"")}" placeholder="67">
    <input data-k="date" value="${esc(m.date||"")}" placeholder="2026-08-19 19:30">
    <button class="delete" data-action="delete-match" type="button">×</button>
  </div>`).join("");
  matchesEditorWrap.innerHTML=`<div class="editor-grid match-editor-grid"><div class="editor-head"><div>STATUS</div><div>HEIM</div><div>AUSWÄRTS</div><div>ANPFIFF</div><div>HEIM</div><div>AUSW.</div><div>MIN.</div><div>DATUM</div><div></div></div>${rows}</div>`;
}
function readMatchEditor(){
  return [...matchesEditorWrap.querySelectorAll(".match-editor-row")].map(row=>{
    const m={id: row.dataset.matchId || makeMatchId()};
    row.querySelectorAll("[data-k]").forEach(input=>{const k=input.dataset.k;m[k]=["homeScore","awayScore"].includes(k)?Number(input.value||0):input.value;});
    return m;
  });
}
function makeMatchId(){return `match-${Date.now()}-${Math.random().toString(36).slice(2,8)}`.replace(/[.#$\/[\]]/g,"_");}
function cleanKey(key){return String(key || "").replace(/[.#$\/[\]]/g,"_") || makeMatchId();}
function showAdmin(){
  adminLoggedIn=true;
  loginView.classList.add("hidden");
  editorView.classList.remove("hidden");
  editorHtml(currentTeams);
  matchEditorHtml(currentMatches);
}
function hideAdmin(){
  adminLoggedIn=false;
  loginView.classList.remove("hidden");
  editorView.classList.add("hidden");
  $("adminCode").value="";
}

// Die Tabelle und Live-Spiele sind immer öffentlich sichtbar.
renderTable(currentTeams);
renderMatches(currentMatches);
updateStatus(false,"Verbinde mit der Live-Tabelle …");
updateClock();
setInterval(updateClock,1000);

$("adminToggle").onclick=()=>{adminPanel.classList.remove("hidden");adminPanel.scrollIntoView({behavior:"smooth",block:"start"});};
$("closeAdmin").onclick=()=>adminPanel.classList.add("hidden");
$("loginBtn").onclick=()=>{
  $("loginError").textContent="";
  if($("adminCode").value===ADMIN_CODE){showAdmin();}
  else $("loginError").textContent="Falscher Admin-Code.";
};
$("adminCode").addEventListener("keydown",e=>{if(e.key==="Enter") $("loginBtn").click();});
$("logoutBtn").onclick=hideAdmin;
$("addTeam").onclick=()=>{if(!adminLoggedIn)return;const list=readEditor();list.push({id:Date.now(),team:"NEUES TEAM",trainer:"",sp:0,s:0,u:0,n:0,goals:"0:0",diff:0,points:0});editorHtml(list);};
editorWrap.addEventListener("click",e=>{if(e.target.dataset.action==="delete") e.target.closest(".editor-row")?.remove();});
$("loadCurrent").onclick=()=>{if(adminLoggedIn)editorHtml(currentTeams);};
$("saveTable").onclick=async()=>{
  if(!adminLoggedIn)return alert("Bitte zuerst Admin-Code Stikeli eingeben.");
  if(!teamsRef)return alert("Firebase ist nicht verbunden.");
  try{const list=readEditor();await set(teamsRef,Object.fromEntries(list.map(t=>[String(t.id),t])));alert("Tabelle gespeichert. Alle sehen die Änderung.");}
  catch(e){console.error(e);alert("Speichern fehlgeschlagen: "+e.message);}
};
$("addMatch").onclick=()=>{if(!adminLoggedIn)return;const list=readMatchEditor();list.push({id:makeMatchId(),status:"next",home:"",away:"",kickoff:"",homeScore:0,awayScore:0,minute:"",date:""});matchEditorHtml(list);};
matchesEditorWrap.addEventListener("click",e=>{if(e.target.dataset.action==="delete-match")e.target.closest(".match-editor-row")?.remove();});
$("saveMatches").onclick=async()=>{
  if(!adminLoggedIn)return alert("Bitte zuerst Admin-Code Stikeli eingeben.");
  if(!matchesRef)return alert("Firebase ist nicht verbunden.");
  try{
    const list=readMatchEditor().map(m=>{const id=cleanKey(m.id);delete m.id;return {id,data:m};});
    await set(matchesRef,Object.fromEntries(list.map(x=>[x.id,x.data])));
    alert("Spiele gespeichert. Alle sehen die Änderung.");
  }catch(e){console.error(e);alert("Speichern fehlgeschlagen: "+e.message);}
};

// Firebase ist für die gemeinsame Speicherung zuständig. Wenn die Verbindung einmal nicht klappt,
// bleibt die öffentliche Tabelle trotzdem sichtbar.
try {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  teamsRef = ref(db,"liga/teams");
  matchesRef = ref(db,"liga/matches");

  onValue(teamsRef,snap=>{
    currentTeams=snap.exists()?Object.values(snap.val()):[...initialTeams];
    renderTable(currentTeams);
    if(adminLoggedIn) editorHtml(currentTeams);
    updateStatus(true,"● LIVE – Tabelle synchronisiert");
  },err=>{
    console.error(err);
    updateStatus(false,"Verbindung zur Live-Tabelle fehlt");
  });

  onValue(matchesRef,snap=>{
    currentMatches=snap.exists()?Object.entries(snap.val()).map(([id,data])=>({id,...data})):[];
    renderMatches(currentMatches);
    if(adminLoggedIn) matchEditorHtml(currentMatches);
  },err=>console.error(err));
} catch (err) {
  console.error("Firebase konnte nicht gestartet werden:",err);
  updateStatus(false,"Live-Verbindung derzeit nicht verfügbar");
}

// Öffentliche Seite alle 10 Sekunden aktualisieren. Während der Admin-Bearbeitung bleibt sie offen.
setInterval(()=>{if(!adminLoggedIn)location.reload();},10000);
