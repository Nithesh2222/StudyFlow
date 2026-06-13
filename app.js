// ====================== FIREBASE CONFIG ======================
const firebaseConfig = {
  apiKey: "AIzaSyBU0Ar3peadtN3jvd1zskBgdR-6LlcdooQ",
  authDomain: "studyflow-8b4ee.firebaseapp.com",
  projectId: "studyflow-8b4ee",
  storageBucket: "studyflow-8b4ee.firebasestorage.app",
  messagingSenderId: "473571856475",
  appId: "1:473571856475:web:a238fd98aeef01813b6f7e",
  measurementId: "G-4RKKMHW2QN"
};
// =============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ====================== STATE ======================
let user = null;
let subjects = [];   // {id,name,exam,credits,color,progress}
let tasks = [];      // {id,text,subjectId,color,due,done,completedDate}
let sessions = [];   // {date,subjectId,minutes}
let streak = { count: 0, lastDate: null };
let schedule = {};   // { Mon:[subjectId,...], ... }
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

let pickedColor = 'violet';
let authMode = 'login';
let aiIdx = 0;
let timer = { secs: 25*60, running: false, int: null, phase: 'focus', subjectId: null };
const FOCUS_SECS = 25*60, BREAK_SECS = 5*60;

const $ = id => document.getElementById(id);
const todayStr = () => new Date().toISOString().slice(0,10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

// ====================== PERSISTENCE ======================
let saveT = null;
function persist(){
  if(!user) return;
  clearTimeout(saveT);
  saveT = setTimeout(async ()=>{
    try{ await setDoc(doc(db,'users',user.uid),{subjects,tasks,sessions,streak,schedule}); }
    catch(e){ toast('Could not save'); console.error(e); }
  }, 350);
}
async function loadData(){
  try{
    const snap = await getDoc(doc(db,'users',user.uid));
    if(snap.exists()){
      const d = snap.data();
      subjects = d.subjects||[]; tasks = d.tasks||[]; sessions = d.sessions||[];
      streak = d.streak||{count:0,lastDate:null}; schedule = d.schedule||{};
    } else {
      subjects=[];tasks=[];sessions=[];streak={count:0,lastDate:null};schedule={};
      await setDoc(doc(db,'users',user.uid),{subjects,tasks,sessions,streak,schedule});
    }
  }catch(e){ toast('Could not load your data'); console.error(e); }
  renderAll();
}

// ====================== AUTH ======================
function showLoader(b){ $('loader').hidden = !b; }
function showAuth(){ window.__SF_READY=true; $('loader').hidden=true; $('auth').hidden=false; $('app').hidden=true; }
function showApp(){ window.__SF_READY=true; $('loader').hidden=true; $('auth').hidden=true; $('app').hidden=false; }
function alertAuth(msg, ok){
  const el=$('auth-alert'); el.textContent=msg; el.className='auth-alert show'+(ok?' ok':'');
}
function clearAuthAlert(){ $('auth-alert').className='auth-alert'; }

function switchAuth(){
  clearAuthAlert();
  authMode = authMode==='login' ? 'signup' : 'login';
  const signup = authMode==='signup';
  $('auth-h').textContent = signup ? 'Create your account' : 'Welcome back';
  $('auth-p').textContent = signup ? 'Start your calm, organised study space' : 'Sign in to pick up where you left off';
  $('auth-submit').textContent = signup ? 'Create account' : 'Sign in';
  $('confirm-field').hidden = !signup;
  $('forgot-link').hidden = signup;
  $('f-pass').autocomplete = signup ? 'new-password' : 'current-password';
  $('auth-switch').innerHTML = signup
    ? 'Already have an account? <a data-action="switch-auth">Sign in</a>'
    : 'New to StudyFlow? <a data-action="switch-auth">Create an account</a>';
}

const AUTH_ERR = {
  'auth/invalid-email':'That email address looks invalid.',
  'auth/user-not-found':'No account found with that email. Try creating one.',
  'auth/wrong-password':'Incorrect password. Try again.',
  'auth/invalid-credential':'Email or password is incorrect.',
  'auth/email-already-in-use':'An account with this email already exists. Sign in instead.',
  'auth/weak-password':'Use a password with at least 6 characters.',
  'auth/popup-closed-by-user':'Google sign-in was cancelled.',
  'auth/popup-blocked':'Your browser blocked the popup. Allow popups and retry.',
  'auth/unauthorized-domain':'This site is not authorised in Firebase yet. Add it under Authentication > Settings > Authorized domains.',
  'auth/network-request-failed':'Network error. Check your connection.'
};

async function authSubmit(){
  clearAuthAlert();
  const email=$('f-email').value.trim(), pass=$('f-pass').value;
  if(!email||!pass){ alertAuth('Please enter your email and password.'); return; }
  if(pass.length<6){ alertAuth('Password must be at least 6 characters.'); return; }
  if(authMode==='signup' && pass!==$('f-pass2').value){ alertAuth('Passwords do not match.'); return; }
  const btn=$('auth-submit'); btn.disabled=true; const old=btn.textContent; btn.textContent='Please wait...';
  try{
    if(authMode==='signup') await createUserWithEmailAndPassword(auth,email,pass);
    else await signInWithEmailAndPassword(auth,email,pass);
  }catch(e){ alertAuth(AUTH_ERR[e.code]||('Something went wrong ('+e.code+').')); btn.disabled=false; btn.textContent=old; }
}
async function googleLogin(){
  clearAuthAlert();
  try{ await signInWithPopup(auth, googleProvider); }
  catch(e){ alertAuth(AUTH_ERR[e.code]||('Google sign-in failed ('+e.code+').')); }
}
async function forgotPassword(){
  const email=$('f-email').value.trim();
  if(!email){ alertAuth('Enter your email above first, then tap Forgot password.'); return; }
  try{ await sendPasswordResetEmail(auth,email); alertAuth('Password reset email sent to '+email+'.', true); }
  catch(e){ alertAuth(AUTH_ERR[e.code]||'Could not send reset email.'); }
}
async function logout(){ try{ await signOut(auth); }catch(e){ console.error(e); } }

onAuthStateChanged(auth, async u=>{
  if(u){
    user=u;
    const name = u.displayName || u.email || 'You';
    $('avatar').textContent = name[0].toUpperCase();
    $('avatar').title = u.email||'';
    showApp();
    await loadData();
  } else {
    user=null; showAuth();
    const btn=$('auth-submit'); btn.disabled=false; btn.textContent = authMode==='signup'?'Create account':'Sign in';
  }
});

// ====================== STREAK ======================
function bumpStreak(){
  const t=todayStr(), y=new Date(Date.now()-864e5).toISOString().slice(0,10);
  if(streak.lastDate===t) return;
  streak.count = (streak.lastDate===y) ? streak.count+1 : 1;
  streak.lastDate=t;
  $('streak-count').textContent=streak.count;
  persist();
}

// ====================== RENDER ======================
function renderAll(){
  $('streak-count').textContent = streak.count;
  setHello(); renderStats(); renderSubjects(); renderTasks();
  renderWeek(); renderExams(); renderFocusSubjects(); renderInsights();
  fillSubjectSelects(); $('ai-text').textContent = aiSuggestion();
}

function setHello(){
  const h=new Date().getHours();
  const g = h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  $('hello-eyebrow').textContent = new Date().toLocaleDateString('en',{weekday:'long',month:'long',day:'numeric'});
  $('hello-h').textContent = (user&&user.displayName) ? `${g}, ${user.displayName.split(' ')[0]} 👋` : `${g} 👋`;
  const pend = tasks.filter(t=>!t.done).length;
  $('hello-sub').textContent = subjects.length===0 ? "Add your subjects to get started."
    : pend>0 ? `You have ${pend} task${pend>1?'s':''} to go. You've got this.` : "All caught up. Nice work!";
}

function fmtMins(m){ if(m<60) return m+'m'; const h=Math.floor(m/60); return h+'h'+(m%60?` ${m%60}m`:''); }

function renderStats(){
  countUp($('s-subjects'), subjects.length);
  const totalMin = sessions.reduce((a,s)=>a+(s.minutes||0),0);
  $('s-time').textContent = fmtMins(totalMin);
  countUp($('s-done'), tasks.filter(t=>t.done).length);
  const avg = subjects.length ? Math.round(subjects.reduce((a,s)=>a+s.progress,0)/subjects.length) : 0;
  $('s-ready').textContent = avg+'%';
}

function aiSuggestion(){
  if(!subjects.length) return "Add a subject and I'll tell you what to focus on first.";
  const sorted=[...subjects].sort((a,b)=>{
    const da=Math.max(Math.ceil((new Date(a.exam)-new Date())/864e5),1);
    const dbb=Math.max(Math.ceil((new Date(b.exam)-new Date())/864e5),1);
    return ((100-b.progress)/dbb)-((100-a.progress)/da);
  });
  const s=sorted[0], days=Math.ceil((new Date(s.exam)-new Date())/864e5);
  const opts=[
    `Focus on ${s.name} first today. Exam in ${days} days and you're ${s.progress}% ready.`,
    `${s.name} is your priority. Close the ${100-s.progress}% gap with two 25-minute focus sessions.`,
    `Start with ${s.name}. ${days} days left, so a solid session today pushes you toward ${Math.min(s.progress+15,100)}%.`,
    `Begin with the hardest part of ${s.name} while your focus is fresh, then take a break.`
  ];
  return opts[aiIdx%opts.length];
}
function refreshAI(){ aiIdx++; const el=$('ai-text'); el.style.opacity=0; setTimeout(()=>{el.textContent=aiSuggestion();el.style.opacity=1;},250); }

function subjById(id){ return subjects.find(s=>s.id===id); }

function renderSubjects(){
  const el=$('subjects'); el.innerHTML='';
  if(!subjects.length) el.innerHTML=`<div class="empty" style="grid-column:1/-1"><span class="ico">📚</span>No subjects yet. Add your first one to get started!</div>`;
  subjects.forEach(s=>{
    const days=Math.ceil((new Date(s.exam)-new Date())/864e5);
    const dtxt= days>0?`Exam in ${days} days`:days===0?'Exam today!':'Exam passed';
    const urgent= days>=0&&days<=7;
    el.innerHTML+=`<div class="subj">
      <div class="subj-top c-${s.color}"></div>
      <div class="subj-name">${esc(s.name)}</div>
      <div class="subj-meta ${urgent?'urgent':''}">${dtxt} · ${s.credits} cr</div>
      <div class="pbar"><i class="c-${s.color}" style="width:${s.progress}%"></i></div>
      <div class="subj-pct">${s.progress}% ready</div>
      <div class="subj-acts">
        <button class="chip e" data-action="edit-subject" data-id="${s.id}">Edit</button>
        <button class="chip d" data-action="delete-subject" data-id="${s.id}">Delete</button>
      </div></div>`;
  });
  el.innerHTML+=`<button class="add-card" data-action="add-subject"><b>+</b>Add subject</button>`;
}

function renderTasks(){
  const el=$('tasks'); el.innerHTML='';
  if(!tasks.length){ el.innerHTML=`<div class="empty"><span class="ico">✅</span>No tasks yet. Add one to start ticking things off.</div>`; return; }
  tasks.forEach(t=>{
    const s=subjById(t.subjectId); const color=s?s.color:'violet'; const sname=s?s.name:'-';
    const due=new Date(t.due); const days=Math.ceil((due-new Date())/864e5); const urgent=days<=2&&!t.done;
    el.innerHTML+=`<div class="task">
      <button class="check ${t.done?'on':''}" data-action="toggle-task" data-id="${t.id}">${t.done?'✓':''}</button>
      <span class="task-txt ${t.done?'on':''}">${esc(t.text)}</span>
      <span class="tag ${color}">${esc(sname.split(' ')[0])}</span>
      <span class="due ${urgent?'urgent':''}">${urgent?'⚠ ':''}${due.toLocaleDateString('en',{month:'short',day:'numeric'})}</span>
      <button class="task-del" data-action="delete-task" data-id="${t.id}" aria-label="Delete">×</button>
    </div>`;
  });
}

function renderWeek(){
  const el=$('week'); el.innerHTML='';
  const todayIdx=(new Date().getDay()+6)%7;
  DAYS.forEach((d,i)=>{
    const ids=schedule[d]||[];
    const blocks = ids.length ? ids.map((id,bi)=>{
      const s=subjById(id); if(!s) return '';
      return `<span class="block ${s.color}">${esc(s.name.split(' ')[0])}<button data-action="remove-block" data-day="${d}" data-idx="${bi}">×</button></span>`;
    }).join('') : `<span class="day-empty">Rest day</span>`;
    el.innerHTML+=`<div class="day ${i===todayIdx?'today':''}">
      <div class="day-top"><span class="day-name">${d}</span><button class="day-add" data-action="add-block" data-day="${d}">+</button></div>
      <div class="blocks">${blocks}</div></div>`;
  });
}

function renderExams(){
  const el=$('exams'); el.innerHTML='';
  if(!subjects.length){ el.innerHTML=`<div class="empty"><span class="ico">🗓️</span>No exams yet. Add subjects with exam dates.</div>`; return; }
  [...subjects].sort((a,b)=>new Date(a.exam)-new Date(b.exam)).forEach(s=>{
    const days=Math.ceil((new Date(s.exam)-new Date())/864e5);
    el.innerHTML+=`<div class="exam"><span class="tag ${s.color}">exam</span><span class="ename">${esc(s.name)}</span><span class="due ${days<=7?'urgent':''}">${days>=0?`in ${days} days`:'passed'}</span></div>`;
  });
}

function renderFocusSubjects(){
  const el=$('focus-subjects'); el.innerHTML='';
  if(!subjects.length){ el.innerHTML=`<div class="empty" style="grid-column:1/-1"><span class="ico">📚</span>Add a subject first to start a focus session.</div>`; return; }
  subjects.forEach(s=>{
    el.innerHTML+=`<button class="fsub ${timer.subjectId===s.id?'sel':''}" data-action="focus-subject" data-id="${s.id}">${esc(s.name)}<small>${s.progress}% ready</small></button>`;
  });
}

// ---------- INSIGHTS (real data, empty until used) ----------
function last7(){ return Array.from({length:7},(_,i)=>new Date(Date.now()-(6-i)*864e5).toISOString().slice(0,10)); }
function renderInsights(){
  // focus time per day
  const days=last7(); const totalMin=sessions.reduce((a,s)=>a+(s.minutes||0),0);
  $('ins-time-total').textContent=fmtMins(totalMin)+' total';
  const perDay=days.map(d=>sessions.filter(s=>s.date===d).reduce((a,s)=>a+(s.minutes||0),0));
  drawBars('bars-time',days,perDay,v=>v?fmtMins(v):'',false, totalMin===0,'⏱️','Complete a focus session to see your time here.');
  // consistency heatmap (28 days)
  const heat=$('heat'); heat.innerHTML='';
  const active = sessions.length||tasks.some(t=>t.completedDate);
  for(let i=27;i>=0;i--){
    const d=new Date(Date.now()-i*864e5).toISOString().slice(0,10);
    const c=sessions.filter(s=>s.date===d).length + tasks.filter(t=>t.completedDate===d).length;
    const lvl=c===0?0:c===1?1:c===2?2:c<=4?3:4;
    heat.innerHTML+=`<i class="hc h${lvl}" title="${d}: ${c} activities"></i>`;
  }
  // readiness
  const r=$('readiness');
  if(!subjects.length) r.innerHTML=`<div class="empty"><span class="ico">🎯</span>Add subjects to track readiness.</div>`;
  else r.innerHTML=subjects.map(s=>`<div class="rrow"><span class="rname">${esc(s.name)}</span><span class="rtrack"><i class="rfill c-${s.color}" style="width:${s.progress}%"></i></span><span class="rval">${s.progress}%</span></div>`).join('');
  // tasks completed per day
  const tdone=days.map(d=>tasks.filter(t=>t.completedDate===d).length);
  drawBars('bars-tasks',days,tdone,v=>v||'',true, tasks.every(t=>!t.completedDate),'✅','Tick off tasks to see your progress here.');
}
function drawBars(elId,days,vals,fmt,alt,isEmpty,ico,emptyMsg){
  const el=$(elId);
  if(isEmpty){ el.style.height='auto'; el.innerHTML=`<div class="empty" style="width:100%"><span class="ico">${ico}</span>${emptyMsg}</div>`; return; }
  el.style.height='120px';
  const max=Math.max(...vals,1);
  el.innerHTML=days.map((d,i)=>{
    const h=Math.round((vals[i]/max)*100);
    const lbl=new Date(d).toLocaleDateString('en',{weekday:'short'})[0];
    return `<div class="bar-col"><span class="bar-v">${fmt(vals[i])}</span><div class="bar ${alt?'alt':''}" style="height:0%" data-h="${h}"></div><span class="bar-x">${lbl}</span></div>`;
  }).join('');
  requestAnimationFrame(()=>el.querySelectorAll('.bar').forEach(b=>b.style.height=b.dataset.h+'%'));
}

// ====================== SUBJECT CRUD ======================
function openSubject(id){
  const editing=!!id; const s=editing?subjById(id):null;
  $('subj-title').textContent=editing?'Edit subject':'Add subject';
  $('subj-id').value=editing?id:'';
  $('subj-name').value=s?s.name:'';
  $('subj-date').value=s?s.exam:'';
  $('subj-credits').value=s?s.credits:'';
  $('subj-prog').value=s?s.progress:0; $('prog-val').textContent=(s?s.progress:0)+'%';
  pickColor(s?s.color:'violet');
  $('subj-del').hidden=!editing;
  openSheet('subject-sheet');
}
function saveSubject(){
  const name=$('subj-name').value.trim(); if(!name){ toast('Enter a subject name'); return; }
  const exam=$('subj-date').value||'2026-12-31';
  const credits=parseInt($('subj-credits').value)||4;
  const progress=parseInt($('subj-prog').value)||0;
  const id=$('subj-id').value;
  if(id){ const s=subjById(id); Object.assign(s,{name,exam,credits,color:pickedColor,progress}); toast('Subject updated'); }
  else { subjects.push({id:uid(),name,exam,credits,color:pickedColor,progress}); toast('Subject added 🎉'); }
  persist(); closeSheet('subject-sheet'); renderAll();
}
function deleteSubject(id){
  const s=subjById(id); if(!s) return;
  if(confirm(`Delete "${s.name}"? Its tasks and study blocks will be removed too.`)){
    subjects=subjects.filter(x=>x.id!==id);
    tasks=tasks.filter(t=>t.subjectId!==id);
    DAYS.forEach(d=>{ if(schedule[d]) schedule[d]=schedule[d].filter(x=>x!==id); });
    if(timer.subjectId===id) timer.subjectId=null;
    persist(); renderAll(); toast('Subject deleted');
  }
}

// ====================== TASK CRUD ======================
function openTask(){ if(!subjects.length){ toast('Add a subject first'); return; } $('task-name').value=''; openSheet('task-sheet'); }
function saveTask(){
  const text=$('task-name').value.trim(); if(!text){ toast('Enter a task'); return; }
  const subjectId=$('task-subj').value;
  const due=$('task-due').value||new Date(Date.now()+7*864e5).toISOString().slice(0,10);
  tasks.push({id:uid(),text,subjectId,due,done:false,completedDate:null});
  persist(); closeSheet('task-sheet'); renderAll(); toast('Task added ✓');
}
function toggleTask(id){
  const t=tasks.find(x=>x.id===id); if(!t) return;
  t.done=!t.done; t.completedDate=t.done?todayStr():null;
  if(t.done){ bumpStreak(); burstConfetti(); }
  persist(); renderAll();
}
function deleteTask(id){ tasks=tasks.filter(x=>x.id!==id); persist(); renderAll(); toast('Task deleted'); }

// ====================== SCHEDULE ======================
function generatePlan(){
  if(!subjects.length){ toast('Add subjects first'); return; }
  schedule={};
  const sorted=[...subjects].sort((a,b)=>{
    const da=Math.max(Math.ceil((new Date(a.exam)-new Date())/864e5),1);
    const dbb=Math.max(Math.ceil((new Date(b.exam)-new Date())/864e5),1);
    return ((100-b.progress)/dbb)-((100-a.progress)/da);
  });
  // urgent subjects get 3 days, others 2, spread Mon-Sat
  const studyDays=['Mon','Tue','Wed','Thu','Fri','Sat'];
  let cursor=0;
  sorted.forEach((s,rank)=>{
    const n = rank===0?3 : rank<=2?2 : 1;
    for(let k=0;k<n;k++){
      const day=studyDays[cursor%studyDays.length]; cursor+=2;
      schedule[day]=schedule[day]||[];
      if(!schedule[day].includes(s.id) && schedule[day].length<3) schedule[day].push(s.id);
    }
  });
  persist(); renderWeek(); toast('Plan generated ✨ Tweak any day you like');
}
function openBlock(day){
  if(!subjects.length){ toast('Add a subject first'); return; }
  $('block-day').value=day; $('block-title').textContent='Add block to '+day;
  openSheet('block-sheet');
}
function saveBlock(){
  const day=$('block-day').value, id=$('block-subj').value;
  schedule[day]=schedule[day]||[];
  if(!schedule[day].includes(id)) schedule[day].push(id);
  persist(); closeSheet('block-sheet'); renderWeek(); toast('Added to '+day);
}
function removeBlock(day,idx){ if(schedule[day]){ schedule[day].splice(idx,1); persist(); renderWeek(); } }

// ====================== TIMER ======================
const RING_LEN=628;
function setRing(){
  const total=timer.phase==='focus'?FOCUS_SECS:BREAK_SECS;
  const off=RING_LEN*(1-timer.secs/total);
  $('ring-fg').style.strokeDashoffset=off;
}
function paintTimer(){
  const m=String(Math.floor(timer.secs/60)).padStart(2,'0'), s=String(timer.secs%60).padStart(2,'0');
  $('t-time').textContent=`${m}:${s}`;
  $('t-phase').textContent=timer.phase==='focus'?'Focus':'Break';
  setRing();
}
function pickFocus(id){ timer.subjectId=id; const s=subjById(id); $('t-subj').textContent=s?('Studying '+s.name):'Pick a subject'; renderFocusSubjects(); }
function toggleTimer(){
  if(!timer.subjectId && timer.phase==='focus'){ toast('Pick a subject first'); return; }
  if(timer.running){ clearInterval(timer.int); timer.running=false; $('t-btn').textContent='Resume'; document.querySelector('.ring').classList.remove('run'); return; }
  timer.running=true; $('t-btn').textContent='Pause'; document.querySelector('.ring').classList.add('run');
  timer.int=setInterval(()=>{
    timer.secs--;
    if(timer.secs<0){
      clearInterval(timer.int); timer.running=false; document.querySelector('.ring').classList.remove('run');
      if(timer.phase==='focus'){
        sessions.push({date:todayStr(),subjectId:timer.subjectId,minutes:25});
        bumpStreak(); burstConfetti(); persist();
        timer.phase='break'; timer.secs=BREAK_SECS; $('t-btn').textContent='Start';
        toast('Session done! Take a 5-min break 🎉'); renderStats(); renderInsights();
      } else { timer.phase='focus'; timer.secs=FOCUS_SECS; $('t-btn').textContent='Start'; toast('Break over. Ready for another round?'); }
      paintTimer(); return;
    }
    paintTimer();
  },1000);
}
function resetTimer(){ clearInterval(timer.int); timer.running=false; timer.phase='focus'; timer.secs=FOCUS_SECS; $('t-btn').textContent='Start'; document.querySelector('.ring').classList.remove('run'); paintTimer(); }

// ====================== UI HELPERS ======================
function fillSubjectSelects(){
  const opts=subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
  $('task-subj').innerHTML=opts; $('block-subj').innerHTML=opts;
}
function pickColor(c){ pickedColor=c; document.querySelectorAll('#swatches .sw').forEach(b=>b.classList.toggle('selected',b.dataset.color===c)); }
function openSheet(id){ $(id).hidden=false; }
function closeSheet(id){ $(id).hidden=true; }
function tab(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  $('view-'+name).classList.add('active');
  document.querySelectorAll(`.tab[data-tab="${name}"]`).forEach(t=>t.classList.add('active'));
  window.scrollTo({top:0,behavior:'smooth'});
  if(name==='stats') renderInsights();
  if(name==='plan') renderWeek();
}
let toastT=null;
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2200); }
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function countUp(el,target){
  const start=parseInt(el.textContent)||0; if(start===target){el.textContent=target;return;}
  const dur=500, t0=performance.now();
  function step(now){ const p=Math.min((now-t0)/dur,1); el.textContent=Math.round(start+(target-start)*p); if(p<1)requestAnimationFrame(step); }
  requestAnimationFrame(step);
}
function burstConfetti(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const c=$('confetti'); const colors=['#6C5CE7','#FF6B6B','#FFB330','#1FC8D8','#FF6FB5'];
  for(let i=0;i<28;i++){
    const p=document.createElement('i');
    p.style.left=Math.random()*100+'vw'; p.style.top='-12px';
    p.style.background=colors[i%colors.length];
    p.style.animationDuration=(1+Math.random()*1.2)+'s';
    p.style.transform=`rotate(${Math.random()*360}deg)`;
    if(Math.random()>.5)p.style.borderRadius='50%';
    c.appendChild(p); setTimeout(()=>p.remove(),2400);
  }
}

// ====================== EVENT DELEGATION ======================
document.addEventListener('click', e=>{
  const el=e.target.closest('[data-action]'); if(!el) return;
  const a=el.dataset.action, id=el.dataset.id, day=el.dataset.day;
  switch(a){
    case 'switch-auth': switchAuth(); break;
    case 'auth-submit': authSubmit(); break;
    case 'google-login': googleLogin(); break;
    case 'forgot-password': forgotPassword(); break;
    case 'toggle-password': { const t=$(el.dataset.target); t.type=t.type==='password'?'text':'password'; el.style.opacity=t.type==='text'?1:.6; break; }
    case 'logout': logout(); break;
    case 'tab': tab(el.dataset.tab); break;
    case 'refresh-ai': refreshAI(); break;
    case 'add-subject': openSubject(); break;
    case 'edit-subject': openSubject(id); break;
    case 'delete-subject': deleteSubject(id); break;
    case 'delete-subject-modal': { const sid=$('subj-id').value; closeSheet('subject-sheet'); deleteSubject(sid); break; }
    case 'save-subject': saveSubject(); break;
    case 'select-color': pickColor(el.dataset.color); break;
    case 'add-task': openTask(); break;
    case 'save-task': saveTask(); break;
    case 'toggle-task': toggleTask(id); break;
    case 'delete-task': deleteTask(id); break;
    case 'generate-plan': generatePlan(); break;
    case 'add-block': openBlock(day); break;
    case 'save-block': saveBlock(); break;
    case 'remove-block': removeBlock(day, parseInt(el.dataset.idx)); break;
    case 'focus-subject': pickFocus(id); break;
    case 'timer-toggle': toggleTimer(); break;
    case 'timer-reset': resetTimer(); break;
    case 'close-sheet': closeSheet(el.dataset.sheet); break;
  }
});
// progress slider live label
$('subj-prog').addEventListener('input',e=>$('prog-val').textContent=e.target.value+'%');
// enter key on auth
['f-email','f-pass','f-pass2'].forEach(idd=>$(idd).addEventListener('keydown',e=>{if(e.key==='Enter')authSubmit();}));
// close sheet by tapping backdrop
document.querySelectorAll('.sheet-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.hidden=true;}));
// init timer paint
paintTimer();
