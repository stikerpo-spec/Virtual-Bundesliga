import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const ADMIN_EMAIL = "admin@virtual-bundesliga.local";
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const teamsRef = ref(db, "liga/teams");

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

const $ = (id)=>document.getElementById(id);
const body = $("standingsBody");
const adminPanel = $("adminPanel");
const loginView = $("loginView");
const editorView = $("editorView");
const editorWrap = $("editorWrap");

function esc(s){return String(s ?? "").replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
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
    const t={};
    row.querySelectorAll("[data-k]").forEach(input=>{const k=input.dataset.k;t[k]=["id","sp","s","u","n","diff","points"].includes(k)?Number(input.value||0):input.value;});
    return t;
  });
}

function openAdmin(){adminPanel.classList.remove("hidden");adminPanel.scrollIntoView({behavior:"smooth",block:"start"});}
$("adminToggle").onclick=openAdmin;
$("closeAdmin").onclick=()=>adminPanel.classList.add("hidden");

$("loginBtn").onclick=async()=>{
  $("loginError").textContent="";
  const code=$("adminCode").value;
  if(!code){$("loginError").textContent="Bitte den Admin-Code eingeben.";return;}
  try{await signInWithEmailAndPassword(auth, ADMIN_EMAIL, code);$("adminCode").value="";}
  catch(e){$("loginError").textContent="Falscher Admin-Code.";}
};
$("logoutBtn").onclick=()=>signOut(auth);
$("addTeam").onclick=()=>{const list=readEditor();list.push({id:Date.now(),team:"NEUES TEAM",trainer:"",sp:0,s:0,u:0,n:0,goals:"0:0",diff:0,points:0});editorHtml(list);};
editorWrap.addEventListener("click",e=>{if(e.target.dataset.action==="delete"){e.target.closest(".editor-row")?.remove();}});
$("loadCurrent").onclick=()=>editorHtml(currentTeams);
$("saveTable").onclick=async()=>{
  const list=readEditor();
  try{await set(teamsRef,Object.fromEntries(list.map(t=>[String(t.id),t])));alert("Tabelle gespeichert.");}
  catch(e){alert("Speichern fehlgeschlagen: "+e.message);}
};

onAuthStateChanged(auth,user=>{
  if(user){loginView.classList.add("hidden");editorView.classList.remove("hidden");editorHtml(currentTeams);}
  else{loginView.classList.remove("hidden");editorView.classList.add("hidden");}
});

onValue(teamsRef,snap=>{
  if(snap.exists()) currentTeams=Object.values(snap.val());
  else currentTeams=[...initialTeams];
  renderTable(currentTeams);
  if(auth.currentUser) editorHtml(currentTeams);
  updateStatus(true,"● LIVE – Tabelle synchronisiert");
},err=>{
  console.error(err);
  renderTable(currentTeams);
  updateStatus(false,"Verbindung zur Live-Tabelle fehlt");
});

renderTable(currentTeams);
