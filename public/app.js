(function(){
'use strict';
const root=document.getElementById('dominoApp'),toastBox=document.getElementById('dominoToast');
const q=new URLSearchParams(location.search),path=location.pathname,code=q.get('code')||'',token=q.get('token')||'',preview=q.get('preview')==='1';let timer=null;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
function toast(t){toastBox.textContent=t;toastBox.classList.add('show');setTimeout(()=>toastBox.classList.remove('show'),1600)}
function loadPlayerCredentials(){try{return JSON.parse(localStorage.getItem('pairs-domino-player:'+code)||'null')||{}}catch{return {}}}
let playerCred=loadPlayerCredentials(),pid=playerCred.playerId||'',playerToken=playerCred.playerToken||'',playerDisplayName=playerCred.displayName||'';
const teacherUrl=(c,t)=>location.origin+'/teacher?code='+encodeURIComponent(c)+'&token='+encodeURIComponent(t),joinUrl=()=>location.origin+'/join?code='+encodeURIComponent(code),projectorUrl=()=>location.origin+'/projector?code='+encodeURIComponent(code)+'&token='+encodeURIComponent(token),previewStudentUrl=()=>location.origin+'/join?code='+encodeURIComponent(code)+'&preview=1&token='+encodeURIComponent(token);
async function get(extra={}){let u='/api/domino?code='+encodeURIComponent(code);for(const[k,v]of Object.entries(extra))if(v)u+='&'+encodeURIComponent(k)+'='+encodeURIComponent(v);const r=await fetch(u,{cache:'no-store'});let d={};try{d=await r.json()}catch{}if(!r.ok){const e=new Error(d.error||'request');e.code=d.error;throw e}return d}
async function post(body,includeCode=true){const r=await fetch('/api/domino',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(includeCode?{...body,code}:body)});let d={};try{d=await r.json()}catch{}if(!r.ok){const e=new Error(d.error||'request');e.code=d.error;throw e}return d}

const XSITE_URL='https://zydhfhfhspflvhlpmokj.supabase.co';
const XSITE_KEY='sb_publishable_DJN48TNChvPce3MZ7bDaiw_5Q8Eam6x';
const xsiteCore=window.supabase?.createClient?window.supabase.createClient(XSITE_URL,XSITE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const SETUP_DRAFT_KEY='domiknow-teacher-draft-v1';

async function consumeBridgeSession(){
 if(!xsiteCore)return null;
 const hash=new URLSearchParams(location.hash.replace(/^#/,''));
 if(hash.get('oauth_bridge')!=='1')return null;
 const access_token=hash.get('access_token')||'',refresh_token=hash.get('refresh_token')||'';
 if(!access_token||!refresh_token)return null;
 const {data,error}=await xsiteCore.auth.setSession({access_token,refresh_token});
 if(!error){history.replaceState({},document.title,location.pathname+location.search);return data?.session||null}
 return null;
}
async function xsiteTeacherSession(){
 if(!xsiteCore)return null;
 try{await consumeBridgeSession();const {data}=await xsiteCore.auth.getSession();return data?.session||null}catch{return null}
}
function redirectToXsiteGoogle(target){
 const bridge=new URL('https://xsite-live-anats-projects-8c3e7bfa.vercel.app/');
 bridge.searchParams.set('auth_for','domiknow');
 bridge.searchParams.set('next',target);
 location.assign(bridge.toString());
}
async function requireTeacherAuth(returnQuery='?teacher=1'){
 const s=await xsiteTeacherSession();if(s)return s;
 if(!xsiteCore){toast('חיבור Google אינו זמין כרגע');return null}
 redirectToXsiteGoogle('https://domiknow.vercel.app/'+returnQuery);
 return null;
}
function loadSetupDraft(){
 try{return JSON.parse(localStorage.getItem(SETUP_DRAFT_KEY)||'null')||null}catch{return null}
}
function saveSetupDraft(data){
 try{localStorage.setItem(SETUP_DRAFT_KEY,JSON.stringify({...data,updatedAt:Date.now()}))}catch{}
}
function restoreDraftSession(d){
 if(!d)return;
 if(d.design){saveDesign(d.design)}
 if(d.mode){saveMode(d.mode)}
 if(d.runGroups){saveRunGroups(d.runGroups)}
}
function gradeNumber(label){const a=['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ז׳','ח׳','ט׳','י׳','י״א','י״ב'];const i=a.indexOf(String(label||''));return i>=0?i+1:null}
async function saveProjectToXsite(payload,projectId=''){
 const s=await requireTeacherAuth(projectId?'?edit='+encodeURIComponent(projectId):'?teacher=1');if(!s)return null;
 const row={teacher_id:s.user.id,app_id:'domiknow',title:payload.topic||'DomiKnow',subject:payload.subject||'',grade:gradeNumber(payload.className),payload};
 if(projectId){
   const {error}=await xsiteCore.from('teacher_projects').update(row).eq('id',projectId).eq('teacher_id',s.user.id).eq('app_id','domiknow');
   if(error)throw error;return projectId;
 }
 const {data,error}=await xsiteCore.from('teacher_projects').insert(row).select('id').single();
 if(error)throw error;return data.id;
}
async function loadProjectFromXsite(projectId){
 const s=await requireTeacherAuth('?edit='+encodeURIComponent(projectId));if(!s)return null;
 const {data,error}=await xsiteCore.from('teacher_projects').select('id,title,payload').eq('id',projectId).eq('teacher_id',s.user.id).eq('app_id','domiknow').maybeSingle();
 if(error||!data)throw error||new Error('not_found');
 return data;
}
function hero(sub,title='DomiKnow'){return '<section class="hero hero-image" aria-label="'+esc(title)+'"><picture><source media="(max-width:760px)" srcset="/domino-home/top-banner-mobile..png"><img src="/domino-home/top-banner-desktop.png" alt="DomiKnow — כל הכיתה. שרשרת אחת של ידע."></picture><span class="sr-only">'+esc(sub||'')+'</span></section>'}
function homeVisual(){return '<section class="home-visual" aria-label="DomiKnow — כשידע ומשחק מתחברים"><picture><source media="(max-width:760px)" srcset="/domino-home/domino-home-mobile.png"><img src="/domino-home/domino-home-desktop.png" alt="DomiKnow — משחק דומינו כיתתי"></picture><button type="button" class="home-teacher-hotspot" id="homeTeacherStart" aria-label="כניסת מורה"></button><button type="button" class="home-demo-hotspot" id="homeDemoStart" aria-label="צפו בדוגמה"></button></section>'}
function tile(t,compact=false){const lc=Number.isInteger(t?.leftColor)?t.leftColor:0,rc=Number.isInteger(t?.rightColor)?t.rightColor:1;return '<div class="domino '+(compact?'compact':'')+'"><div class="domino-half dc-'+lc+'"><span class="domino-half-text">'+esc(t.left)+'</span></div><div class="domino-half dc-'+rc+'"><span class="domino-half-text">'+esc(t.right)+'</span></div></div>'}
let fitRaf=0;
function fitDominoText(){
 cancelAnimationFrame(fitRaf);
 fitRaf=requestAnimationFrame(()=>{
  document.querySelectorAll('.domino-half-text').forEach(el=>{
   const box=el.parentElement;
   el.style.fontSize='';
   let size=parseFloat(getComputedStyle(box).fontSize)||14;
   const min=10.5;
   const fits=()=>el.scrollHeight<=Math.max(20,box.clientHeight-14)&&el.scrollWidth<=Math.max(20,box.clientWidth-14);
   while(size>min&&!fits()){size-=.5;el.style.fontSize=size+'px'}
  });
 });
}
window.addEventListener('resize',fitDominoText);
function chainHtml(list){if(!list?.length)return '<div class="waiting">השרשרת עדיין לא התחילה.</div>';return '<div class="chain-board">'+list.map((t,i)=>tile(t,true)+(i<list.length-1?'<span class="connector">‹</span>':'')).join('')+'</div>'}
function progress(n,total){const p=total?Math.round(n/total*100):0;return '<div class="progress"><span style="width:'+p+'%"></span></div><div class="tiny progress-label">'+n+'/'+total+' קוביות</div>'}
function complete(){return '<div class="complete"><div class="complete-mark">✓</div><strong>השרשרת הושלמה</strong><span>כל קובייה מצאה את מקומה — וכל הכיתה בנתה יחד שרשרת אחת של ידע.</span></div>'}
function startPoll(fn){clearInterval(timer);timer=setInterval(fn,1100)}
function stableRerender(fn){
 const x=window.scrollX,y=window.scrollY;
 Promise.resolve(fn()).finally(()=>requestAnimationFrame(()=>window.scrollTo(x,y)));
}
let successAudioCtx=null;
function unlockSuccessAudio(){
 try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!successAudioCtx)successAudioCtx=new AC();if(successAudioCtx.state==='suspended')successAudioCtx.resume().catch(()=>{})}catch{}
}
window.addEventListener('pointerdown',unlockSuccessAudio,{passive:true});
window.addEventListener('keydown',unlockSuccessAudio,{passive:true});
function playSuccessSound(){
 try{
  unlockSuccessAudio();const ctx=successAudioCtx;if(!ctx||ctx.state!=='running')return;const now=ctx.currentTime;
  [[523.25,0],[659.25,.10],[783.99,.20]].forEach(([freq,delay])=>{
   const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=freq;
   g.gain.setValueAtTime(.0001,now+delay);g.gain.exponentialRampToValueAtTime(.18,now+delay+.015);g.gain.exponentialRampToValueAtTime(.0001,now+delay+.18);
   o.connect(g);g.connect(ctx.destination);o.start(now+delay);o.stop(now+delay+.2);
  });
 }catch{}
}
function showSuccessMoment(text='נוצר חיבור'){
 const old=document.querySelector('.success-moment');if(old)old.remove();
 const el=document.createElement('div');el.className='success-moment';el.innerHTML='<span class="success-link">⌁</span><div><strong>'+esc(text)+'</strong><small>השרשרת ממשיכה</small></div>';
 document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('show'));
 setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),260)},1350);
}
function turnTiming(d){
 if(d?.phase!=='playing'||!d.turnStartedAt)return{elapsed:0,remain:10,warning:false,rotate:false};
 const elapsed=Math.max(0,Date.now()-Number(d.turnStartedAt||0)),warning=elapsed>=10000&&elapsed<15000;
 return{elapsed,remain:warning?Math.max(0,Math.ceil((15000-elapsed)/1000)):Math.max(0,Math.ceil((10000-elapsed)/1000)),warning,rotate:elapsed>=15000};
}
function updateTurnTimer(d,id='turnTimer'){
 const el=document.getElementById(id);if(!el)return;const t=turnTiming(d);
 if(d?.phase!=='playing'){el.textContent='';el.classList.remove('warning');return}
 if(t.warning){el.classList.add('warning');el.innerHTML='<strong>עדיין לא נוצר חיבור</strong><span>מי מחזיק בקובייה המתאימה?</span><b>העברה לתלמיד אחר בעוד '+t.remain+' שנ׳</b>'}
 else{el.classList.remove('warning');el.innerHTML='<span>זמן לחיבור</span><strong>'+t.remain+'</strong><span>שניות</span>'}
}
function parsePairs(text){return text.split(/\n+/).map(x=>{const p=x.split('|');return{left:(p.shift()||'').trim(),right:p.join('|').trim()}}).filter(p=>p.left&&p.right).slice(0,40)}
const DESIGN_KEY='domiknow-design-v1';
const palettes=[
 {id:'beach',name:'חוף',colors:['#35566F','#C7B392','#E3D7C6','#81919A']},
 {id:'classic',name:'קלאסי',colors:['#061A44','#86113E','#0B6769','#55306F']},
 {id:'ocean',name:'אוקיינוס',colors:['#173B57','#2E6673','#6F9694','#B7C8BE']},
 {id:'berry',name:'ברי',colors:['#6F2747','#934A68','#76506F','#B47C89']},
 {id:'earth',name:'אדמה',colors:['#4E5B43','#8A6C3D','#A98E66','#6F7C63']}
];
const patterns=[
 {id:'none',name:'ללא רקע'},
 {id:'leaves',name:'עלים'},
 {id:'flowers',name:'פרחים'},
 {id:'hearts',name:'לבבות'},
 {id:'ribbons',name:'סרטים'},
 {id:'sparkles',name:'ניצוצות'}
];
const patternIds=new Set(patterns.map(p=>p.id));
function savedDesign(){try{const d=JSON.parse(sessionStorage.getItem(DESIGN_KEY)||'')||{};return{palette:d.palette||'beach',pattern:patternIds.has(d.pattern)?d.pattern:'leaves'}}catch{return{palette:'beach',pattern:'leaves'}}}
function saveDesign(d){sessionStorage.setItem(DESIGN_KEY,JSON.stringify(d));applyDesign(d)}
function applyDesign(d={}){const p=d.palette||'beach',x=d.pattern||'leaves';document.documentElement.dataset.dominoPalette=p;document.documentElement.dataset.dominoPattern=x}
const MODE_KEY='domiknow-mode-v1',GROUPS_KEY='domiknow-run-groups-v1';
function savedMode(){return sessionStorage.getItem(MODE_KEY)||'classic'}
function saveMode(mode){sessionStorage.setItem(MODE_KEY,mode)}
function savedRunGroups(){
 try{
  const d=JSON.parse(sessionStorage.getItem(GROUPS_KEY)||'')||{};
  const count=Math.max(2,Math.min(4,Number(d.count)||2));
  const defaults=['קבוצה 1','קבוצה 2','קבוצה 3','קבוצה 4'];
  const names=Array.from({length:count},(_,i)=>(d.names?.[i]||defaults[i]).trim()||defaults[i]);
  return{count,names}
 }catch{return{count:2,names:['קבוצה 1','קבוצה 2']}}
}
function saveRunGroups(d){sessionStorage.setItem(GROUPS_KEY,JSON.stringify(d))}
function renderMode(){
 clearInterval(timer);document.body.classList.remove('projector','landing');applyDesign(savedDesign());
 const mode=savedMode();
 root.innerHTML='<div class="shell mode-shell">'+hero('בחרו איך הכיתה תשחק','DomiKnow')+
 '<div class="setup-topbar"><button class="btn ghost back-home" id="modeBack">← חזרה לעיצוב</button></div>'+
 '<section class="card mode-card"><div class="design-kicker">מצב משחק</div><h2>איך תרצו לשחק?</h2><p class="muted">אפשר לבנות יחד שרשרת אחת, או להפוך את הפעילות למרוץ קבוצות.</p>'+
 '<div class="mode-grid">'+
 '<button type="button" class="mode-choice '+(mode==='classic'?'selected':'')+'" id="modeClassic"><span class="mode-badge">Classic</span><strong>DomiKnow Classic</strong><span>כל הכיתה בונה יחד שרשרת אחת משותפת.</span><b>שרשרת אחת · קצב כיתתי</b></button>'+
 '<button type="button" class="mode-choice run '+(mode==='run'?'selected':'')+'" id="modeRun"><span class="mode-badge">Run</span><strong>DomiKnow Run</strong><span>הכיתה מתחלקת לקבוצות שמתחרות על השלמת המושגים שלהן.</span><b>2–4 קבוצות · מרוץ חי</b></button>'+
 '</div></section></div>';
 document.getElementById('modeBack').onclick=renderDesign;
 document.getElementById('modeClassic').onclick=()=>{saveMode('classic');renderSetup()};
 document.getElementById('modeRun').onclick=()=>{saveMode('run');renderGroups()};
}
function renderGroups(){
 clearInterval(timer);document.body.classList.remove('projector','landing');applyDesign(savedDesign());saveMode('run');
 let data=savedRunGroups();
 const rows=()=>Array.from({length:data.count},(_,i)=>'<label class="group-name-field"><span><i>'+(i+1)+'</i> קבוצה '+(i+1)+'</span><input class="run-group-name" data-group-index="'+i+'" maxlength="24" value="'+esc(data.names[i]||('קבוצה '+(i+1)))+'" placeholder="שם הקבוצה"></label>').join('');
 root.innerHTML='<div class="shell groups-shell">'+hero('מגדירים את קבוצות המרוץ','DomiKnow Run')+
 '<div class="setup-topbar"><button class="btn ghost back-home" id="groupsBack">← חזרה לבחירת מצב</button></div>'+
 '<section class="card groups-card"><div class="design-kicker">DomiKnow Run</div><h2>כמה קבוצות משתתפות?</h2><p class="muted">בחרו 2–4 קבוצות ותנו להן שמות. בהמשך התלמידים ישויכו לקבוצות והמסך הראשי יציג רק את ההתקדמות של כל קבוצה.</p>'+
 '<div class="group-count" role="group" aria-label="מספר קבוצות">'+[2,3,4].map(n=>'<button type="button" class="group-count-btn '+(data.count===n?'selected':'')+'" data-count="'+n+'">'+n+' קבוצות</button>').join('')+'</div>'+
 '<div class="group-names" id="groupNames">'+rows()+'</div>'+
 '<button class="btn pri groups-next" id="groupsNext">המשך ליצירת המשחק</button></section></div>';
 document.getElementById('groupsBack').onclick=renderMode;
 const bindInputs=()=>document.querySelectorAll('.run-group-name').forEach(inp=>inp.addEventListener('input',()=>{const i=Number(inp.dataset.groupIndex);data.names[i]=inp.value;saveRunGroups(data)}));
 bindInputs();
 document.querySelectorAll('[data-count]').forEach(btn=>btn.onclick=()=>{
   const current=[...document.querySelectorAll('.run-group-name')].map(x=>x.value);
   data.names=current;
   data.count=Number(btn.dataset.count);
   while(data.names.length<data.count)data.names.push('קבוצה '+(data.names.length+1));
   data.names=data.names.slice(0,data.count);
   saveRunGroups(data);
   renderGroups();
 });
 document.getElementById('groupsNext').onclick=()=>{
   const names=[...document.querySelectorAll('.run-group-name')].map((x,i)=>x.value.trim()||('קבוצה '+(i+1)));
   saveRunGroups({count:data.count,names});
   renderSetup();
 };
}


async function renderTeacherEntry(){
 clearInterval(timer);document.body.classList.remove('projector','landing');applyDesign(savedDesign());
 const s=await requireTeacherAuth('?teacher=1');if(!s)return;
 let projects=[];try{const {data}=await xsiteCore.from('teacher_projects').select('id,title,updated_at').eq('teacher_id',s.user.id).eq('app_id','domiknow').order('updated_at',{ascending:false}).limit(50);projects=data||[]}catch{}
 const draft=loadSetupDraft();
 root.innerHTML='<div class="shell setup-shell">'+hero('צד המורה','DomiKnow')+
 '<section class="card create-game-card"><h2>כניסת מורה</h2><p class="muted">צרו פעילות חדשה, טענו פעילות קיימת או חזרו לכיתה חיה באמצעות קוד.</p>'+
 '<div class="btns teacher-entry-actions">'+
 (draft?'<button class="btn pri" id="continueDraft">המשך טיוטה</button>':'')+
 '<button class="btn pri" id="newActivity">צור פעילות חדשה</button>'+
 '<button class="btn ghost" id="loadActivity">טען פעילות קיימת</button>'+
 '<button class="btn ghost" id="openByCode">פתח באמצעות קוד</button></div>'+
 '<div id="teacherEntryPanel"></div></section></div>';
 const panel=document.getElementById('teacherEntryPanel');
 document.getElementById('continueDraft')?.addEventListener('click',()=>{restoreDraftSession(draft);renderSetup()});
 document.getElementById('newActivity').onclick=()=>{if(draft&&!confirm('לפתוח פעילות חדשה? הטיוטה הנוכחית תוחלף.'))return;localStorage.removeItem(SETUP_DRAFT_KEY);renderDesign()};
 document.getElementById('loadActivity').onclick=()=>{
   panel.innerHTML='<div class="field" style="margin-top:16px"><span>פעילות שמורה</span><select id="savedProjectSelect"><option value="">בחרו פעילות</option>'+projects.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.title||'DomiKnow')+'</option>').join('')+'</select></div><button class="btn pri" id="openSavedProject">פתח פעילות</button>';
   document.getElementById('openSavedProject').onclick=async()=>{const id=document.getElementById('savedProjectSelect').value;if(!id)return;try{const p=await loadProjectFromXsite(id);const d=p.payload||{};saveSetupDraft({...d,projectId:id});restoreDraftSession(d);renderSetup()}catch{toast('לא הצלחנו לטעון את הפעילות')}};
 };
 document.getElementById('openByCode').onclick=()=>{
   panel.innerHTML='<div class="field" style="margin-top:16px"><span>קוד פעילות / כיתה</span><input id="existingGameCode" inputmode="numeric" maxlength="6" placeholder="לדוגמה: 482731"></div><button class="btn pri" id="openExistingGame">פתח פעילות</button><div class="feedback" id="openCodeFeedback"></div>';
   document.getElementById('openExistingGame').onclick=()=>{const c=(document.getElementById('existingGameCode').value||'').replace(/\D/g,'').slice(0,6),fb=document.getElementById('openCodeFeedback');if(c.length!==6){fb.textContent='יש להזין קוד בן 6 ספרות.';return}try{const saved=JSON.parse(localStorage.getItem('domiknow-live:'+c)||'null');if(saved?.teacherToken){location.href=teacherUrl(c,saved.teacherToken);return}}catch{}fb.textContent='לא נמצאה הרשאת מורה לקוד הזה בדפדפן זה.'};
 };
}

function renderDesign(){
 clearInterval(timer);document.body.classList.remove('projector','landing');
 let design=savedDesign();applyDesign(design);
 const paletteCards=palettes.map(p=>'<button type="button" class="design-palette '+(p.id===design.palette?'selected':'')+'" data-palette="'+p.id+'"><span class="palette-swatches">'+p.colors.map(x=>'<i style="background:'+x+'"></i>').join('')+'</span><strong>'+esc(p.name)+'</strong><span class="design-check">✓</span></button>').join('');
 const patternCards=patterns.map(p=>'<button type="button" class="design-pattern pattern-'+p.id+' '+(p.id===design.pattern?'selected':'')+'" data-pattern="'+p.id+'"><span class="pattern-demo"></span><strong>'+esc(p.name)+'</strong><span class="design-check">✓</span></button>').join('');
 root.innerHTML='<div class="shell design-shell">'+hero('בחרו את סגנון הקוביות שלכם','DomiKnow')+'<div class="setup-topbar"><button class="btn ghost back-home" id="designBack">← חזרה לדף הבית</button></div><section class="card design-card"><div class="design-kicker">שלב 1 מתוך 2</div><h2>בחרו את המראה של DomiKnow שלכם</h2><p class="muted">בחרו פלטת צבעים ודוגמה עדינה לקוביות. תוכלו לראות מיד תצוגה מקדימה.</p><h3>פלטת צבעים</h3><div class="palette-grid">'+paletteCards+'</div><h3>דוגמת רקע</h3><div class="pattern-grid">'+patternCards+'</div><div class="design-preview"><span>תצוגה מקדימה</span>'+tile({left:'מושג',right:'הגדרה קצרה',leftColor:0,rightColor:1})+'</div><button class="btn pri design-next" id="designNext">המשך ליצירת המשחק</button></section></div>';
 document.getElementById('designBack').onclick=renderHome;
 document.querySelectorAll('[data-palette]').forEach(b=>b.onclick=()=>{design={...design,palette:b.dataset.palette};saveDesign(design);renderDesign()});
 document.querySelectorAll('[data-pattern]').forEach(b=>b.onclick=()=>{design={...design,pattern:b.dataset.pattern};saveDesign(design);renderDesign()});
 document.getElementById('designNext').onclick=renderMode;
 fitDominoText();
}
function renderHome(){
 clearInterval(timer);document.body.classList.remove('projector');document.body.classList.add('landing');
 root.innerHTML='<div class="home-only">'+homeVisual()+
 '<div class="home-demo-modal" id="homeDemoModal" hidden><div class="home-demo-backdrop" id="closeDemoBackdrop"></div><section class="home-demo-panel" role="dialog" aria-modal="true" aria-label="דוגמה למשחק DomiKnow"><button type="button" class="demo-close" id="closeDemo" aria-label="סגירת הדוגמה">×</button><div class="demo-kicker">DomiKnow · דוגמה חיה</div><h2>כך נראית התאמה במשחק</h2><div class="open-clue"><span>ההתאמה הפתוחה</span>תהליך יצירת מזון בצמחים בעזרת אור השמש</div><div class="demo-sample-tile">'+tile({left:'פוטוסינתזה',right:'תהליך יצירת מזון בצמחים בעזרת אור השמש'})+'</div><div class="feedback ok">✓ זו ההתאמה הנכונה</div></section></div></div>';
 const teacher=document.getElementById('homeTeacherStart'),demo=document.getElementById('homeDemoStart'),modal=document.getElementById('homeDemoModal');
 if(teacher)teacher.onclick=()=>renderTeacherEntry();
 const close=()=>{if(modal)modal.hidden=true};
 if(demo)demo.onclick=()=>{if(modal){modal.hidden=false;fitDominoText()}};
 document.getElementById('closeDemo')?.addEventListener('click',close);
 document.getElementById('closeDemoBackdrop')?.addEventListener('click',close);
}

function renderSetup(){
 document.body.classList.remove('projector','landing');applyDesign(savedDesign());
 const last=localStorage.getItem('pairs-domino-last-teacher')||'',draft=loadSetupDraft()||{};
 const subjectOptions=['אני ישראלי','ביולוגיה','ביוטכנולוגיה','מדעים','מתמטיקה','עברית','אנגלית','היסטוריה','תנ״ך','ספרות','אזרחות','גאוגרפיה','כימיה','פיזיקה','מחשבים'];
 const gradeOptions=['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ז׳','ח׳','ט׳','י׳','י״א','י״ב'];
 const samplePairs=[
  ['מיטוכונדריה','אברון שבו מתבצעת נשימה תאית'],['ריבוזום','אברון שבו מתבצע תרגום'],['DNA','מולקולה הנושאת מידע תורשתי'],
  ['גרעין','אברון המכיל את רוב החומר התורשתי'],['קרום התא','מעטפת בררנית המווסתת מעבר חומרים'],['ציטופלזמה','הסביבה התאית שבה נמצאים האברונים'],
  ['דיפוזיה','מעבר חלקיקים מריכוז גבוה לנמוך'],['אוסמוזה','מעבר מים דרך קרום בררני'],['אנזים','חלבון המזרז תגובה כימית'],
  ['ATP','מולקולה המשמשת מטבע אנרגיה בתא'],['כרומוזום','מבנה המכיל DNA וחלבונים'],['גן','קטע DNA המכיל מידע לתוצר'],
  ['חלבון','פולימר הבנוי מחומצות אמינו'],['פוטוסינתזה','תהליך יצירת חומר אורגני בעזרת אור'],['כלורופלסט','אברון שבו מתרחשת פוטוסינתזה'],
  ['הומאוסטזיס','שמירה על סביבה פנימית יציבה'],['מיטוזה','חלוקת תא היוצרת שני תאי בת דומים'],['מיוזה','חלוקה היוצרת תאי מין'],
  ['נשימה תאית','תהליך הפקת אנרגיה זמינה מחומר אורגני'],['מוטציה','שינוי ברצף ה-DNA']
 ];
 root.innerHTML='<div class="shell setup-shell">'+hero('יוצרים פעילות חדשה','DomiKnow')+'<div class="setup-topbar"><button class="btn ghost back-home" id="backHome">← חזרה</button></div>'+
 '<section class="card create-game-card" id="createGameSection"><div class="setup-mode-pill">'+(savedMode()==='run'?'DomiKnow Run':'DomiKnow Classic')+'</div><h2>פרטי הפעילות</h2>'+
 '<div class="grid"><div>'+
 '<label class="field"><span>מקצוע</span><select id="subjectName"><option value="">בחרו מקצוע</option>'+subjectOptions.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</select></label>'+
 '<label class="field"><span>נושא</span><input id="topicName" maxlength="80" placeholder="לדוגמה: מערכת הנשימה"></label>'+
 '<label class="field"><span>כיתה</span><select id="className"><option value="">בחרו כיתה</option>'+gradeOptions.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</select></label>'+
 '</div><div><h3>הגדרות משחק</h3><label class="field"><span>מספר זוגות</span><input id="wantedPairs" type="number" min="4" max="40" value="20" inputmode="numeric"></label><div class="muted">מצב המשחק, הקבוצות, העיצוב ומספר הזוגות נשארים הגדרות ייחודיות של DomiKnow.</div></div></div>'+
 '<section class="prompt-helper"><div class="prompt-head"><div><strong>יצירת מאגר בעזרת AI</strong><span>כל זוג בשורה נפרדת בפורמט מושג | התאמה.</span></div><button class="btn ghost compact-btn" id="copyPrompt">העתקת פרומפט</button></div><textarea id="promptText" class="prompt-text">אני מורה ל__________ ומלמד/ת תלמידי כיתה ________ את הנושא: __________.\nצור עבורי מאגר של 20 זוגות למשחק דומינו לימודי.\n\nהחזר את כל התשובה בתוך חלונית קוד אחת בלבד, ללא טקסט לפניה או אחריה.\nבתוך חלונית הקוד החזר בדיוק 20 שורות בלבד.\nכל זוג חייב להופיע בשורה אחת בלבד בפורמט:\nמושג | התאמה\n\nאין להוסיף מספור, bullets, כותרות או שורות ריקות.\nכל זוג חייב להיות שונה וברור, והמושג עצמו לא יופיע בתוך ההתאמה.</textarea></section>'+
 '<div class="pairs-head"><div><strong>מאגר התוכן</strong><span>הדביקו זוג אחד בכל שורה.</span></div></div>'+
 '<label class="field pairs-field"><textarea id="pairs" placeholder="מיטוכונדריה | אברון שבו מתבצעת נשימה תאית\nריבוזום | אברון שבו מתבצע תרגום"></textarea></label>'+
 '<div class="pair-help"><span class="count" id="pairCount">0 זוגות</span><span class="tiny">מינימום 4 · מקסימום 40 זוגות</span></div>'+
 '<div class="btns"><button class="btn ghost" id="loadExample">טען דוגמה</button><button class="btn ghost" id="loadBank">טען למאגר</button><button class="btn ghost" id="editConcepts" hidden>ערוך מושגים</button></div>'+
 '<div id="pairsEditor" hidden></div>'+
 '<div class="btns"><button class="btn ghost" id="archiveActivity">העבר לארכיון</button><button class="btn pri combo-create" id="createGame">צור פעילות</button>'+(last?'<button class="btn ghost" id="resumeLast">חזרה למשחק האחרון</button>':'')+'</div>'+
 '<div id="homeFeedback" class="feedback"></div></section>'+
 '<section class="card how"><div><strong>1</strong><span>המורה מזין זוגות</span></div><div><strong>2</strong><span>התלמידים מקבלים קוביות</span></div><div><strong>3</strong><span>הכיתה בונה שרשרת</span></div></section></div>';

 document.getElementById('backHome').onclick=renderTeacherEntry;
 const ta=document.getElementById('pairs'),count=document.getElementById('pairCount'),btn=document.getElementById('createGame'),copyPrompt=document.getElementById('copyPrompt'),promptText=document.getElementById('promptText'),subjectName=document.getElementById('subjectName'),className=document.getElementById('className'),topicName=document.getElementById('topicName'),wantedPairs=document.getElementById('wantedPairs'),feedback=document.getElementById('homeFeedback'),editor=document.getElementById('pairsEditor'),editBtn=document.getElementById('editConcepts');
 let loadedPairs=[];

 const payload=()=>({subject:subjectName.value.trim(),topic:topicName.value.trim(),className:className.value.trim(),wantedPairs:Math.max(4,Math.min(40,Number(wantedPairs.value)||20)),pairs:loadedPairs.length?loadedPairs:parsePairs(ta.value),design:savedDesign(),mode:savedMode(),runGroups:savedRunGroups(),projectId:draft.projectId||''});
 const saveDraftNow=()=>saveSetupDraft(payload());
 const refresh=()=>{const n=parsePairs(ta.value).length,wanted=Math.max(4,Math.min(40,Number(wantedPairs.value)||20)),missing=Math.max(0,wanted-n);count.textContent=missing?n+' מתוך '+wanted+' זוגות · חסרים '+missing:n+' מתוך '+wanted+' זוגות ✓'};
 const syncPrompt=()=>{const subject=subjectName.value.trim()||'__________',klass=className.value.trim()||'__________',topic=topicName.value.trim()||'__________',wanted=Math.max(4,Math.min(40,Number(wantedPairs.value)||20));const lines=promptText.value.split('\n');lines[0]='אני מורה ל'+subject+' ומלמד/ת תלמידי כיתה '+klass+' את הנושא: '+topic+'.';lines[1]='צור עבורי מאגר של '+wanted+' זוגות למשחק דומינו לימודי.';const exact=lines.findIndex(x=>x.startsWith('בתוך חלונית הקוד החזר בדיוק '));if(exact>=0)lines[exact]='בתוך חלונית הקוד החזר בדיוק '+wanted+' שורות בלבד.';promptText.value=lines.join('\n')};
 const renderEditor=()=>{
   editor.innerHTML='<div class="items-editor"><div class="items-editor-head"><div><h3>עריכת המושגים</h3><p>'+loadedPairs.length+' זוגות במאגר</p></div><button class="btn ghost compact-btn" id="addPair">＋ הוסף זוג</button></div><div class="items-list">'+
   loadedPairs.map((p,i)=>'<article class="item-card" data-pair-row="'+i+'"><div class="item-number">'+(i+1)+'</div><div class="item-two"><label>מושג<input data-left="'+i+'" value="'+esc(p.left)+'"></label><label>התאמה<input data-right="'+i+'" value="'+esc(p.right)+'"></label></div><button class="remove-item" data-remove="'+i+'">מחק זוג</button></article>').join('')+
   '</div><button class="save-items" id="savePairChanges">שמור שינויים</button></div>';
   editor.querySelectorAll('[data-left]').forEach(x=>x.oninput=()=>loadedPairs[Number(x.dataset.left)].left=x.value);
   editor.querySelectorAll('[data-right]').forEach(x=>x.oninput=()=>loadedPairs[Number(x.dataset.right)].right=x.value);
   editor.querySelectorAll('[data-remove]').forEach(x=>x.onclick=()=>{loadedPairs.splice(Number(x.dataset.remove),1);renderEditor()});
   document.getElementById('addPair').onclick=()=>{loadedPairs.push({left:'',right:''});renderEditor()};
   document.getElementById('savePairChanges').onclick=()=>{loadedPairs=loadedPairs.map(x=>({left:x.left.trim(),right:x.right.trim()})).filter(x=>x.left&&x.right).slice(0,40);ta.value=loadedPairs.map(x=>x.left+' | '+x.right).join('\n');editor.hidden=true;editBtn.textContent='ערוך מושגים';refresh();saveDraftNow();toast('השינויים נשמרו')};
 };
 const loadBank=()=>{loadedPairs=parsePairs(ta.value);if(!loadedPairs.length){feedback.className='feedback bad';feedback.textContent='לא זוהו זוגות. כל שורה צריכה להיות: מושג | התאמה';return false}feedback.className='feedback ok';feedback.textContent='המאגר נטען: '+loadedPairs.length+' זוגות.';editBtn.hidden=false;editor.hidden=true;editBtn.textContent='ערוך מושגים';refresh();saveDraftNow();return true};

 if(draft){
   if(draft.subject&&!subjectOptions.includes(draft.subject)){subjectName.insertAdjacentHTML('beforeend','<option value="'+esc(draft.subject)+'">'+esc(draft.subject)+'</option>')}
   if(draft.className&&!gradeOptions.includes(draft.className)){className.insertAdjacentHTML('beforeend','<option value="'+esc(draft.className)+'">'+esc(draft.className)+'</option>')}
   subjectName.value=draft.subject||'';topicName.value=draft.topic||'';className.value=draft.className||'';wantedPairs.value=draft.wantedPairs||20;
   loadedPairs=Array.isArray(draft.pairs)?draft.pairs.map(x=>({left:x.left||'',right:x.right||''})).filter(x=>x.left&&x.right):[];
   ta.value=loadedPairs.map(x=>x.left+' | '+x.right).join('\n');if(loadedPairs.length)editBtn.hidden=false;
 }

 [subjectName,className,topicName].forEach(el=>el.addEventListener('change',()=>{syncPrompt();saveDraftNow()}));
 topicName.addEventListener('input',()=>{syncPrompt();saveDraftNow()});
 wantedPairs.addEventListener('input',()=>{syncPrompt();refresh();saveDraftNow()});
 ta.addEventListener('input',()=>{loadedPairs=[];editBtn.hidden=true;editor.hidden=true;refresh();saveDraftNow()});
 ta.addEventListener('paste',()=>setTimeout(()=>{refresh();saveDraftNow()},0));
 syncPrompt();refresh();

 copyPrompt.onclick=async()=>{try{await navigator.clipboard.writeText(promptText.value);toast('הפרומפט הועתק')}catch{promptText.select();document.execCommand('copy');toast('הפרומפט הועתק')}};
 document.getElementById('loadExample').onclick=()=>{const wanted=Math.max(4,Math.min(40,Number(wantedPairs.value)||20));const ex=Array.from({length:wanted},(_,i)=>samplePairs[i%samplePairs.length]).map((x,i)=>({left:x[0]+(i>=samplePairs.length?' '+(Math.floor(i/samplePairs.length)+1):''),right:x[1]+(i>=samplePairs.length?' — דוגמה '+(i+1):'')}));ta.value=ex.map(x=>x.left+' | '+x.right).join('\n');loadedPairs=ex;editBtn.hidden=false;refresh();saveDraftNow();feedback.className='feedback ok';feedback.textContent='נטענה דוגמה בפורמט הנכון.'};
 document.getElementById('loadBank').onclick=loadBank;
 editBtn.onclick=()=>{if(!loadedPairs.length&&!loadBank())return;editor.hidden=!editor.hidden;editBtn.textContent=editor.hidden?'ערוך מושגים':'סגור עריכה';if(!editor.hidden)renderEditor()};

 document.getElementById('archiveActivity').onclick=async()=>{
   if(!subjectName.value||!topicName.value||!className.value){feedback.className='feedback bad';feedback.textContent='יש להשלים מקצוע, נושא וכיתה לפני העברה לארכיון.';return}
   if(!loadedPairs.length&&!loadBank())return;
   const b=document.getElementById('archiveActivity');b.disabled=true;b.textContent='שומר…';
   try{const p=payload(),id=await saveProjectToXsite(p,p.projectId||'');if(id){saveSetupDraft({...p,projectId:id});draft.projectId=id;b.textContent='עדכן בארכיון';feedback.className='feedback ok';feedback.textContent='הפעילות נשמרה בארכיון MyXsite ✓'}}catch{feedback.className='feedback bad';feedback.textContent='לא הצלחנו לשמור בארכיון.'}finally{b.disabled=false;if(b.textContent==='שומר…')b.textContent='העבר לארכיון'}
 };
 if(draft.projectId)document.getElementById('archiveActivity').textContent='עדכן בארכיון';

 btn.onclick=async()=>{
   const wanted=Math.max(4,Math.min(40,Number(wantedPairs.value)||20));
   if(!subjectName.value||!topicName.value||!className.value){feedback.className='feedback bad';feedback.textContent='יש להשלים מקצוע, נושא וכיתה.';return}
   if(!loadedPairs.length&&!loadBank())return;
   const pairs=loadedPairs.slice(0,40);if(pairs.length<wanted){feedback.className='feedback bad';feedback.textContent='נמצאו '+pairs.length+' מתוך '+wanted+' זוגות.';return}
   btn.disabled=true;feedback.className='feedback';feedback.textContent='יוצר פעילות…';
   try{const design=savedDesign(),mode=savedMode(),runGroups=savedRunGroups();const d=await post({action:'create',title:topicName.value.trim(),className:className.value.trim(),subject:subjectName.value.trim(),topic:topicName.value.trim(),palette:design.palette,pattern:design.pattern,mode,groups:mode==='run'?runGroups.names.map(name=>({name})):[],requestedPairs:wanted,pairs},false);const u=teacherUrl(d.code,d.teacherToken);localStorage.setItem('pairs-domino-last-teacher',u);localStorage.setItem('domiknow-live:'+d.code,JSON.stringify({teacherToken:d.teacherToken,code:d.code,updatedAt:Date.now()}));saveDraftNow();location.href=u}catch(e){feedback.className='feedback bad';feedback.textContent=e.code==='not_enough_pairs'?'אין מספיק זוגות ביחס למספר שבחרת.':'לא ניתן ליצור פעילות כרגע.';btn.disabled=false}
 };
 if(last)document.getElementById('resumeLast').onclick=()=>location.href=last;
}
function runProgressCard(team,livePlayers=[],winnerTeamId=''){
 const roster=(livePlayers||[]).filter(p=>p.groupId===team.id);
 const done=Number(team.chainCount||0),total=Number(team.total||0),pct=total?Math.round(done/total*100):0,isWinner=winnerTeamId===team.id,isDone=team.phase==='complete';
 return '<section class="run-team-card '+(isDone?'complete ':'')+(isWinner?'winner':'')+'" data-run-team="'+esc(team.id)+'"><div class="run-team-head"><div><span class="run-team-label">'+(isWinner?'🏁 ראשונה לסיים':isDone?'✓ הושלמה':'קבוצה')+'</span><h3>'+esc(team.name)+'</h3></div><div class="run-score"><strong data-run-done>'+done+'</strong><span>מתוך</span><b data-run-total>'+total+'</b></div></div><div class="run-progress"><span data-run-bar style="width:'+pct+'%"></span></div><div class="run-progress-caption"><strong data-run-caption>'+pct+'%</strong><span>'+(isDone?'כל המושגים חוברו':'ממשיכים לחבר…')+'</span></div><div class="run-team-roster">'+(roster.length?roster.map(p=>'<span class="chip">'+esc(p.name)+'</span>').join(''):'<span class="muted">עדיין אין תלמידים בקבוצה.</span>')+'</div></section>';
}
function runLobbyCard(group,players=[]){
 const roster=(players||[]).filter(p=>p.groupId===group.id);
 return '<section class="run-team-card lobby"><div class="run-team-head"><div><span class="run-team-label">קבוצה</span><h3>'+esc(group.name)+'</h3></div><strong>'+roster.length+' תלמידים</strong></div><div class="run-team-roster">'+(roster.length?roster.map(p=>'<span class="chip">'+esc(p.name)+'</span>').join(''):'<span class="muted">ממתינים לתלמידים…</span>')+'</div></section>';
}
async function renderRunTeacher(d){
 const players=d.players||[],groups=d.groups||[],teams=d.runTeams||[];
 const empty=groups.filter(g=>!players.some(p=>p.groupId===g.id));
 root.innerHTML='<div class="shell run-teacher-shell">'+hero(d.className?'DomiKnow Run · '+d.className:'DomiKnow Run',d.title)+
 '<section class="card"><div class="teacher-top"><div><div class="status"><span class="dot '+(d.phase==='playing'?'on':'')+'"></span>'+(d.phase==='lobby'?'ממתינים לקבוצות':d.phase==='playing'?'המרוץ פעיל':'המרוץ הושלם')+'</div><h2>קוד כיתה</h2><div class="code">'+esc(code)+'</div></div><div class="joinbox"><div class="qr"><img alt="QR למשחק" src="/api/qr?text='+encodeURIComponent(joinUrl())+'"></div><div><strong>כניסת תלמידים</strong><div class="linkbox">'+esc(joinUrl())+'</div><div class="btns"><button class="btn ghost" id="copyJoin">העתק קישור תלמיד</button><button class="btn ghost" id="copyCode">העתק קוד</button><button class="btn ghost" id="previewStudent">צפה כתלמיד</button><button class="btn ghost" id="openProjector">פתח מקרן</button></div></div></div></div></section>'+
 '<section class="card run-board"><div class="run-board-title"><div><span class="setup-mode-pill">DomiKnow Run</span><h2>'+(d.phase==='lobby'?'הקבוצות מוכנות למרוץ':'התקדמות הקבוצות')+'</h2></div>'+'<div class="run-winner '+(d.winnerTeamName?'show':'')+'" id="runWinner">'+(d.winnerTeamName?'🏁 '+esc(d.winnerTeamName)+' — סיימה ראשונה!':'')+'</div></div><div class="run-team-grid">'+
 (d.phase==='lobby'?groups.map(g=>runLobbyCard(g,players)).join(''):teams.map(t=>runProgressCard(t,players,d.winnerTeamId||'')).join(''))+
 '</div><div class="btns">'+(d.phase==='lobby'?'<button class="btn pri" id="startGame" '+(empty.length?'disabled':'')+'>התחלת המרוץ</button>':'<button class="btn danger" id="resetGame">איפוס המרוץ</button>')+'<button class="btn ghost" id="newRoster">ניקוי תלמידים</button><button class="btn ghost" id="backEdit">חזרה לעריכה</button></div>'+
 (empty.length?'<div class="feedback bad">כדי להתחיל, צריך לפחות תלמיד אחד בכל קבוצה.</div>':'')+'</section></div>';
 document.getElementById('copyJoin').onclick=async()=>{try{await navigator.clipboard.writeText(joinUrl());toast('הועתק ✓')}catch{}};
 document.getElementById('copyCode').onclick=async()=>{try{await navigator.clipboard.writeText(code);toast('הועתק ✓')}catch{}};
 document.getElementById('previewStudent').onclick=()=>window.open(previewStudentUrl(),'_blank','noopener');
 document.getElementById('openProjector').onclick=()=>window.open(projectorUrl(),'_blank','noopener');
 document.getElementById('backEdit').onclick=()=>renderSetup();
 const s=document.getElementById('startGame');if(s)s.onclick=async()=>{s.disabled=true;try{await post({action:'start',teacherToken:token});renderTeacher()}catch(e){toast(e.code==='empty_group'?'יש קבוצה ללא תלמידים':e.code==='no_players'?'אין עדיין תלמידים':'לא ניתן להתחיל');s.disabled=false}};
 const r=document.getElementById('resetGame');if(r)r.onclick=async()=>{if(confirm('לאפס את המרוץ ולחזור ללובי?')){await post({action:'reset',teacherToken:token});renderTeacher()}};
 document.getElementById('newRoster').onclick=async()=>{if(confirm('למחוק את רשימת התלמידים ולפתוח לובי חדש?')){await post({action:'newRoster',teacherToken:token});renderTeacher()}};
 startPoll(async()=>{try{
   let n=await get({teacherToken:token});
   if(n.phase==='playing'){try{const tick=await post({action:'tick',teacherToken:token});if(tick.rotated)n=await get({teacherToken:token})}catch{}}
   if(n.phase!==d.phase){stableRerender(renderTeacher);return}
   if(n.phase==='lobby'){
     if(n.version!==d.version)stableRerender(renderTeacher);
     return;
   }
   (n.runTeams||[]).forEach(team=>{
     const card=document.querySelector('[data-run-team="'+CSS.escape(team.id)+'"]');if(!card)return;
     const done=Number(team.chainCount||0),total=Number(team.total||0),pct=total?Math.round(done/total*100):0;
     card.querySelector('[data-run-done]')?.replaceChildren(document.createTextNode(String(done)));
     card.querySelector('[data-run-total]')?.replaceChildren(document.createTextNode(String(total)));
     const bar=card.querySelector('[data-run-bar]');if(bar)bar.style.width=pct+'%';
     card.querySelector('[data-run-caption]')?.replaceChildren(document.createTextNode(pct+'%'));
     card.classList.toggle('complete',team.phase==='complete');
     card.classList.toggle('winner',n.winnerTeamId===team.id);
     const label=card.querySelector('.run-team-label');if(label)label.textContent=n.winnerTeamId===team.id?'🏁 ראשונה לסיים':team.phase==='complete'?'✓ הושלמה':'קבוצה';
     const cap=card.querySelector('.run-progress-caption span');if(cap)cap.textContent=team.phase==='complete'?'כל המושגים חוברו':'ממשיכים לחבר…';
   });
   const winner=document.getElementById('runWinner');
   if(winner){
     const has=Boolean(n.winnerTeamName);winner.classList.toggle('show',has);
     winner.textContent=has?'🏁 '+n.winnerTeamName+' — סיימה ראשונה!':'';
   }
   d.version=n.version;d.runTeams=n.runTeams;d.winnerTeamId=n.winnerTeamId;d.winnerTeamName=n.winnerTeamName;
 }catch{}});
}
function runJoinForm(saved,d){
 const groups=d.groups||[];
 root.innerHTML='<div class="shell student-shell">'+hero('מצטרפים למרוץ הקבוצות','DomiKnow Run')+
 '<section class="card nameform"><span class="setup-mode-pill">DomiKnow Run</span><h2>כניסה למשחק</h2><p class="muted">כתבו שם ובחרו את הקבוצה שלכם.</p><input id="playerName" maxlength="24" autocomplete="name" placeholder="השם שלי" value="'+esc(saved||'')+'"><div class="student-group-grid">'+groups.map((g,i)=>'<button type="button" class="student-group-choice" data-group-id="'+esc(g.id)+'"><span>'+(i+1)+'</span><strong>'+esc(g.name)+'</strong></button>').join('')+'</div><button class="btn pri" id="joinGame" disabled>כניסה ללובי</button><div class="feedback" id="joinFeedback"></div></section></div>';
 let selected='';
 document.querySelectorAll('[data-group-id]').forEach(b=>b.onclick=()=>{selected=b.dataset.groupId;document.querySelectorAll('[data-group-id]').forEach(x=>x.classList.toggle('selected',x===b));document.getElementById('joinGame').disabled=false});
 document.getElementById('joinGame').onclick=async()=>{const name=document.getElementById('playerName').value.trim();if(!name){document.getElementById('joinFeedback').textContent='כתבו שם פרטי.';return}if(!selected){document.getElementById('joinFeedback').textContent='בחרו קבוצה.';return}try{const joined=await post({action:'join',name,groupId:selected});pid=joined.playerId;playerToken=joined.playerToken;playerDisplayName=joined.displayName||name;localStorage.setItem('pairs-domino-name',name);localStorage.setItem('pairs-domino-player:'+code,JSON.stringify({playerId:pid,playerToken,displayName:playerDisplayName}));renderStudent()}catch(e){document.getElementById('joinFeedback').textContent=e.code==='game_started'?'המשחק כבר התחיל.':'לא ניתן להצטרף כרגע.'}};
}
async function renderRunStudent(d,saved){
 if(!d.joined&&d.phase==='lobby'){runJoinForm(saved,d);return}
 if(d.phase==='lobby'){
  root.innerHTML='<div class="shell student-shell">'+hero('מחכים שהמרוץ יתחיל','DomiKnow Run')+'<section class="card waiting run-waiting"><span class="setup-mode-pill">'+esc(d.teamName||'DomiKnow Run')+'</span><strong>את/ה בלובי ✓</strong><span>מחכים למורה שיזניק את המרוץ.</span></section></div>';
  startPoll(async()=>{try{const n=await get({playerId:pid,playerToken});if(n.phase!==d.phase)stableRerender(renderStudent)}catch{}});return;
 }
 if(d.teamPhase==='complete'){
  root.innerHTML='<div class="shell student-shell">'+hero('הקבוצה השלימה את השרשרת','DomiKnow Run')+'<section class="card run-team-complete"><div class="complete-mark">✓</div><span class="setup-mode-pill">'+esc(d.teamName||'הקבוצה שלי')+'</span><h2>סיימתם את כל המושגים!</h2><p class="muted">כל הקוביות של הקבוצה חוברו. אפשר לעקוב אחרי שאר הקבוצות על המקרן.</p></section></div>';
  if(d.phase!=='complete')startPoll(async()=>{try{const n=await get({playerId:pid,playerToken});if(n.version!==d.version)stableRerender(renderStudent)}catch{}});return;
 }
 if(!d.myTile){
  root.innerHTML='<div class="shell student-shell">'+hero('המרוץ ממשיך','DomiKnow Run')+'<section class="card waiting run-waiting"><span class="setup-mode-pill">'+esc(d.teamName||'הקבוצה שלי')+'</span><strong>ממתינים לקובייה הבאה</strong><span>הקבוצה שלך: '+Number(d.teamChainCount||0)+' / '+Number(d.teamTotal||0)+' חוברו</span></section></div>';
  startPoll(async()=>{try{const n=await get({playerId:pid,playerToken});if(n.version!==d.version)stableRerender(renderStudent)}catch{}});return;
 }
 const pct=d.teamTotal?Math.round((d.teamChainCount||0)/d.teamTotal*100):0;
 root.innerHTML='<div class="shell student-shell">'+hero('הקובייה של הקבוצה שלך','DomiKnow Run')+
 '<section class="card run-student-card"><div class="run-student-head"><span class="setup-mode-pill">'+esc(d.teamName||'הקבוצה שלי')+'</span><strong id="runStudentProgress">'+Number(d.teamChainCount||0)+' מתוך '+Number(d.teamTotal||0)+' חוברו</strong></div><div class="run-progress"><span id="runStudentBar" style="width:'+pct+'%"></span></div><div class="open-clue" id="studentClue"><span>ההתאמה הפתוחה של הקבוצה</span><b id="studentClueText">'+esc(d.currentClue||'')+'</b></div><div class="my-tile" id="studentTile">'+tile(d.myTile)+'</div><div class="match-action"><button class="btn pri" id="playTile">זה מתאים — חיבור הקובייה</button><div class="feedback" id="playFeedback"></div></div></section></div>';
 document.getElementById('playTile').onclick=async()=>{const b=document.getElementById('playTile'),f=document.getElementById('playFeedback');b.disabled=true;try{const x=await post({action:'play',playerId:pid,playerToken});if(x.correct){playSuccessSound();showSuccessMoment('התאמה נכונה');f.className='feedback ok';f.textContent='הקובייה התחברה לקבוצה ✓';setTimeout(()=>stableRerender(renderStudent),650)}else{f.className='feedback bad';f.textContent='עדיין לא — זו לא ההתאמה הפתוחה.';b.disabled=false}}catch{b.disabled=false}};
 fitDominoText();
 startPoll(async()=>{try{
   const n=await get({playerId:pid,playerToken});
   if(n.phase!==d.phase||n.teamPhase!==d.teamPhase){stableRerender(renderStudent);return}
   const oldTile=d.myTile?.id||null,newTile=n.myTile?.id||null;
   if(oldTile!==newTile){stableRerender(renderStudent);return}
   const clue=document.getElementById('studentClueText');if(clue)clue.textContent=n.currentClue||'';
   const prog=document.getElementById('runStudentProgress');if(prog)prog.textContent=Number(n.teamChainCount||0)+' מתוך '+Number(n.teamTotal||0)+' חוברו';
   const bar=document.getElementById('runStudentBar');if(bar)bar.style.width=(n.teamTotal?Math.round((n.teamChainCount||0)/n.teamTotal*100):0)+'%';
   d.currentClue=n.currentClue;d.teamChainCount=n.teamChainCount;d.version=n.version;
 }catch{}});
}
async function renderTeacher(){
 try{const d=await get({teacherToken:token});applyDesign(d);if(!d.teacher)throw new Error('auth');localStorage.setItem('pairs-domino-last-teacher',location.href);if(d.mode==='run'){await renderRunTeacher(d);return}const players=d.players||[],spectators=Math.max(0,players.length-(d.tileCount-1));
 root.innerHTML='<div class="shell">'+hero(d.className?'מסך מורה · '+d.className:'מסך מורה',d.title)+'<section class="card"><div class="teacher-top"><div><div class="status"><span class="dot '+(d.phase==='playing'?'on':'')+'"></span>'+(d.phase==='lobby'?'ממתינים לתלמידים':d.phase==='playing'?'המשחק פעיל':'המשחק הושלם')+'</div><h2>קוד כיתה</h2><div class="code">'+esc(code)+'</div></div><div class="joinbox"><div class="qr"><img alt="QR למשחק" src="/api/qr?text='+encodeURIComponent(joinUrl())+'"></div><div><strong>כניסת תלמידים</strong><div class="linkbox">'+esc(joinUrl())+'</div><div class="btns"><button class="btn ghost" id="copyJoin">העתק קישור תלמיד</button><button class="btn ghost" id="copyCode">העתק קוד</button><button class="btn ghost" id="previewStudent">צפה כתלמיד</button><button class="btn ghost" id="openProjector">פתח מקרן</button></div></div></div></div></section>'+
 '<div class="grid"><section class="card"><h2>תלמידים מחוברים: '+players.length+'</h2><div class="roster">'+(players.length?players.map(p=>'<span class="chip">'+esc(p.name)+'</span>').join(''):'<span class="muted">עדיין אין תלמידים בלובי.</span>')+'</div>'+(spectators?'<div class="tiny note">'+spectators+' תלמידים יהיו צופים בסבב הזה.</div>':'')+'<div class="btns">'+(d.phase==='lobby'?'<button class="btn pri" id="startGame" '+(!players.length?'disabled':'')+'>התחלת המשחק וחלוקת קוביות</button>':'<button class="btn danger" id="resetGame">איפוס המשחק</button>')+'<button class="btn ghost" id="newRoster">ניקוי תלמידים</button><button class="btn ghost" id="backEdit">חזרה לעריכה</button></div></section><section class="card"><h2>מצב השרשרת</h2>'+progress(d.chainCount||0,d.tileCount)+(d.currentClue?'<div class="open-clue"><span>ההתאמה הפתוחה</span>'+esc(d.currentClue)+'</div>':'')+'<div class="tiny note">'+d.pairCount+' זוגות · '+d.tileCount+' קוביות</div><div class="turn-timer" id="turnTimer"></div></section></div>'+
 '<section class="card"><h2>השרשרת המשותפת</h2>'+chainHtml(d.chain||[])+(d.phase==='complete'?complete():'')+'</section><div class="btns"><button class="btn ghost" id="exitProjector">יציאה ממצב מקרן</button></div></div>';
 document.getElementById('copyJoin').onclick=async()=>{try{await navigator.clipboard.writeText(joinUrl());toast('הועתק ✓')}catch{}};
 document.getElementById('copyCode').onclick=async()=>{try{await navigator.clipboard.writeText(code);toast('הועתק ✓')}catch{}};
 document.getElementById('previewStudent').onclick=()=>window.open(previewStudentUrl(),'_blank','noopener');
 document.getElementById('openProjector').onclick=()=>window.open(projectorUrl(),'_blank','noopener');
 document.getElementById('backEdit').onclick=()=>renderSetup();
 const s=document.getElementById('startGame');if(s)s.onclick=async()=>{s.disabled=true;try{await post({action:'start',teacherToken:token});renderTeacher()}catch(e){toast(e.code==='no_players'?'אין עדיין תלמידים':'לא ניתן להתחיל');s.disabled=false}};
 const r=document.getElementById('resetGame');if(r)r.onclick=async()=>{if(confirm('לאפס את השרשרת ולחלק מחדש?')){await post({action:'reset',teacherToken:token});renderTeacher()}};
 document.getElementById('newRoster').onclick=async()=>{if(confirm('למחוק את רשימת התלמידים ולפתוח לובי חדש?')){await post({action:'newRoster',teacherToken:token});renderTeacher()}};
 fitDominoText();fitDominoText();updateTurnTimer(d);startPoll(async()=>{try{const n=await get({teacherToken:token});updateTurnTimer(n);if(n.chainCount>d.chainCount){playSuccessSound();showSuccessMoment('נוצר חיבור')}if(turnTiming(n).rotate){const x=await post({action:'tick',teacherToken:token});if(x.rotated){stableRerender(renderTeacher);return}}const prevChain=Number(d.chainCount||0),nextChain=Number(n.chainCount||0);
const prevClue=d.currentClue||'',nextClue=n.currentClue||'';
if(n.phase!==d.phase){stableRerender(renderTeacher);return}
if(d.phase!=='lobby'&&(nextChain!==prevChain||nextClue!==prevClue)){stableRerender(renderTeacher);return}
const oldPlayers=d.players||[],newPlayers=n.players||[];
if(newPlayers.length!==oldPlayers.length){
 const sx=window.scrollX,sy=window.scrollY;
 const roster=document.querySelector('.roster');
 const countHeading=roster?.previousElementSibling;
 if(countHeading)countHeading.textContent='תלמידים מחוברים: '+newPlayers.length;
 if(roster)roster.innerHTML=newPlayers.length?newPlayers.map(p=>'<span class="chip">'+esc(p.name)+'</span>').join(''):'<span class="muted">עדיין אין תלמידים בלובי.</span>';
 const start=document.getElementById('startGame');
 if(start)start.disabled=!newPlayers.length;
 d.players=newPlayers;
 requestAnimationFrame(()=>window.scrollTo(sx,sy));
}
d.version=n.version}catch{}});
 }catch{root.innerHTML='<div class="shell">'+hero()+'<section class="card"><h2>לא ניתן לפתוח את מסך המורה</h2><a class="btn pri linkbtn" href="/">פתיחת משחק חדש</a></section></div>'}
}
function runProjectorTeamCard(team,placeMap){
 const done=Number(team.chainCount||0),total=Math.max(1,Number(team.total||0)),pct=Math.max(0,Math.min(100,Math.round(done/total*100)));
 const place=placeMap.get(team.id)||0;
 const medal=place===1?'🥇':place===2?'🥈':place===3?'🥉':place?String(place):'';
 const status=team.phase==='complete'?'הושלם':done+' מתוך '+total;
 return '<article class="run-projector-lane '+(team.phase==='complete'?'complete':'')+' '+(place===1?'winner':'')+'" data-projector-team="'+esc(team.id)+'">'+
 '<div class="run-projector-team"><div class="run-projector-place">'+(medal||'•')+'</div><div><strong>'+esc(team.name)+'</strong><span>'+esc(status)+'</span></div></div>'+
 '<div class="run-projector-track"><div class="run-projector-fill" style="width:'+pct+'%"></div><div class="run-projector-domino" style="right:calc('+pct+'% - 18px)" aria-hidden="true">▮▮</div><span class="run-projector-finish">🏁</span></div>'+
 '<div class="run-projector-percent">'+pct+'%</div></article>';
}
function renderRunProjector(d){
 const teams=(d.runTeams||[]).slice();
 const finished=teams.filter(t=>t.phase==='complete'&&Number(t.finishedAt||0)>0).sort((a,b)=>Number(a.finishedAt)-Number(b.finishedAt));
 const placeMap=new Map(finished.map((t,i)=>[t.id,i+1]));
 const order=finished.length?'<div class="run-projector-order"><span>סדר הגעה</span>'+finished.map((t,i)=>'<strong class="place-'+(i+1)+'">'+(i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.')+' '+esc(t.name)+'</strong>').join('')+'</div>':'<div class="run-projector-order waiting-order"><span>סדר הגעה</span><strong>עדיין אין מסיימים</strong></div>';
 root.innerHTML='<div class="shell run-projector-shell">'+hero(d.className?'DomiKnow Run · '+d.className:'DomiKnow Run',d.title)+
 '<section class="card run-projector-top"><div class="run-projector-code"><span>קוד כיתה</span><strong>'+esc(code)+'</strong></div><div class="joinbox"><div class="qr"><img alt="QR" src="/api/qr?text='+encodeURIComponent(joinUrl())+'"></div><div><strong>'+(d.phase==='lobby'?'סרקו והצטרפו למרוץ':d.phase==='playing'?'המרוץ בעיצומו':'המרוץ הסתיים')+'</strong><div class="muted">'+(d.players||[]).length+' תלמידים מחוברים</div></div></div></section>'+
 '<section class="card run-projector-race"><div class="run-projector-title"><div><span class="setup-mode-pill">DomiKnow Run</span><h2>'+(d.phase==='complete'?'תוצאות המרוץ':'התקדמות הקבוצות')+'</h2></div>'+order+'</div>'+
 '<div class="run-projector-lanes">'+teams.map(t=>runProjectorTeamCard(t,placeMap)).join('')+'</div>'+
 (d.winnerTeamName?'<div class="run-projector-winner">🏆 '+esc(d.winnerTeamName)+' הגיעה ראשונה לפתרון!</div>':'')+
 '</section><div class="btns projector-exit-row"><button class="btn ghost" id="exitProjector">יציאה ממצב מקרן</button></div></div>';
 document.getElementById('exitProjector')?.addEventListener('click',()=>{if(window.opener){window.close()}else{location.href=teacherUrl(code,token)}});
 startPoll(async()=>{try{const n=await get({teacherToken:token});if(n.version!==d.version)renderProjector()}catch{}});
}
async function renderProjector(){
 document.body.classList.add('projector');try{const d=await get({teacherToken:token});applyDesign(d);if(!d.teacher)throw new Error('auth');if(d.mode==='run'){renderRunProjector(d);return}
 root.innerHTML='<div class="shell">'+hero(d.className?'תצוגת מקרן · '+d.className:'תצוגת מקרן',d.title)+'<section class="card"><div class="teacher-top"><div><div class="eyebrow">קוד כיתה</div><div class="code">'+esc(code)+'</div></div><div class="joinbox"><div class="qr"><img alt="QR" src="/api/qr?text='+encodeURIComponent(joinUrl())+'"></div><div><strong>'+(d.phase==='lobby'?'סרקו והצטרפו ללובי':d.phase==='playing'?'מי מחזיק את ההתאמה?':'המשחק הסתיים')+'</strong><div class="muted">'+(d.players||[]).length+' תלמידים מחוברים</div></div></div></div>'+(d.currentClue?'<div class="open-clue projector-clue"><span>ההתאמה הפתוחה</span>'+esc(d.currentClue)+'</div>':'')+'<div class="turn-timer projector-turn-timer" id="turnTimer"></div>'+progress(d.chainCount||0,d.tileCount)+'</section><section class="card">'+chainHtml((d.chain||[]).slice(-5))+(d.lastPlayer?'<div class="feedback ok last-player">✓ '+esc(d.lastPlayer)+' חיבר/ה את הקובייה האחרונה</div>':'')+(d.phase==='complete'?complete():'')+'</section><div class="btns"><button class="btn ghost" id="exitProjector">יציאה ממצב מקרן</button></div></div>';
 document.getElementById('exitProjector')?.addEventListener('click',()=>{if(window.opener){window.close()}else{location.href=teacherUrl(code,token)}});
 fitDominoText();updateTurnTimer(d);startPoll(async()=>{try{const n=await get({teacherToken:token});updateTurnTimer(n);if(n.chainCount>d.chainCount){playSuccessSound();showSuccessMoment('נוצר חיבור')}if(turnTiming(n).rotate){const x=await post({action:'tick',teacherToken:token});if(x.rotated){stableRerender(renderProjector);return}}if(n.version!==d.version)stableRerender(renderProjector)}catch{}})}catch{root.innerHTML='<div class="shell">'+hero()+'<section class="card"><h2>לא ניתן לפתוח תצוגת מקרן</h2></section></div>'}
}
async function renderStudentPreview(){
 try{
  const d=await get({teacherToken:token,preview:'1'});applyDesign(d);if(!d.teacher)throw new Error('auth');
  const t=d.previewTile;
  root.innerHTML='<div class="shell student-shell">'+hero('תצוגת מורה בלבד — לא נשמרים נתונים',d.mode==='run'?'DomiKnow Run':(d.title||'DomiKnow'))+
  '<section class="card"><div class="feedback ok">תצוגה בלבד</div>'+
  (d.currentClue?'<div class="open-clue"><span>ההתאמה הפתוחה</span>'+esc(d.currentClue)+'</div>':'<div class="waiting">כך ייראה מסך התלמיד בזמן המשחק.</div>')+
  (t?'<div class="my-tile">'+tile(t)+'</div>':'')+
  '<div class="tiny">קוד כיתה: '+esc(code)+'</div></section></div>';fitDominoText();
 }catch{root.innerHTML='<div class="shell student-shell">'+hero()+'<section class="card"><h2>לא ניתן לפתוח תצוגת תלמיד</h2></section></div>'}
}
function joinForm(saved,title='דומינו זוגות',data=null){if(data?.mode==='run'){runJoinForm(saved,data);return}
 root.innerHTML='<div class="shell student-shell">'+hero('קובייה אחת. התאמה אחת. רגע אחד נכון.',title)+'<section class="card nameform"><h2>כניסה למשחק</h2><p class="muted">כתבו שם פרטי. לאחר שהמורה יתחיל תקבלו קובייה. לחצו כאשר הצד הימני של הקובייה שלכם מתאים להתאמה הפתוחה.</p><input id="playerName" maxlength="24" autocomplete="name" placeholder="השם שלי" value="'+esc(saved||'')+'"><button class="btn pri" id="joinGame">כניסה ללובי</button><div class="feedback" id="joinFeedback"></div></section></div>';
 document.getElementById('joinGame').onclick=async()=>{const name=document.getElementById('playerName').value.trim();if(!name){document.getElementById('joinFeedback').textContent='כתבו שם פרטי.';return}try{const joined=await post({action:'join',name});pid=joined.playerId;playerToken=joined.playerToken;playerDisplayName=joined.displayName||name;localStorage.setItem('pairs-domino-name',name);localStorage.setItem('pairs-domino-player:'+code,JSON.stringify({playerId:pid,playerToken,displayName:playerDisplayName}));renderStudent()}catch(e){document.getElementById('joinFeedback').textContent=e.code==='game_started'?'המשחק כבר התחיל.':'לא ניתן להצטרף כרגע.'}}
}
async function renderStudent(){
 const saved=localStorage.getItem('pairs-domino-name')||'';
 if(!pid){try{const d=await get();applyDesign(d);joinForm(saved,d.title,d)}catch{joinForm(saved)}return}
 try{const d=await get({playerId:pid,playerToken});applyDesign(d);if(d.mode==='run'){await renderRunStudent(d,saved);return}if(!d.joined&&d.phase==='lobby'){joinForm(saved,d.title,d);return}
 if(d.phase==='lobby'){root.innerHTML='<div class="shell student-shell">'+hero('הצטרפת. מחכים שהמורה יתחיל.',d.title)+'<section class="card waiting"><strong>'+esc(d.playerName||playerDisplayName||saved)+'</strong>, את/ה בלובי ✓</section></div>';startPoll(async()=>{try{const n=await get({playerId:pid,playerToken});if(n.phase!==d.phase)stableRerender(renderStudent)}catch{}});return}
 if(!d.myTile&&d.phase!=='complete'){root.innerHTML='<div class="shell student-shell">'+hero('את/ה צופה בסבב הזה.',d.title)+'<section class="card waiting">אין לך כרגע קובייה. עקבו אחרי השרשרת על המקרן.</section></div>';startPoll(async()=>{try{const n=await get({playerId:pid,playerToken});if(n.phase!==d.phase||!!n.myTile!==!!d.myTile)stableRerender(renderStudent)}catch{}});return}
 if(d.phase==='complete'){root.innerHTML='<div class="shell student-shell">'+hero('השרשרת הושלמה!',d.title)+'<section class="card">'+complete()+'</section></div>';return}
 root.innerHTML='<div class="shell student-shell">'+hero('בדקו האם הצד הימני שלכם מתאים למה שפתוח עכשיו.',d.title)+'<section class="card"><div class="open-clue" id="studentClue"><span>ההתאמה הפתוחה</span><b id="studentClueText">'+esc(d.currentClue)+'</b></div><div class="turn-timer student-turn-timer" id="studentTurn"></div><div class="my-tile" id="studentTile">'+tile(d.myTile)+'</div><div class="match-action"><button class="btn pri" id="playTile">זה מתאים — חיבור הקובייה</button><div class="feedback" id="playFeedback"></div></div></section></div>';
 document.getElementById('playTile').onclick=async()=>{const b=document.getElementById('playTile'),f=document.getElementById('playFeedback');b.disabled=true;const sx=window.scrollX,sy=window.scrollY;try{const x=await post({action:'play',playerId:pid,playerToken});if(x.correct){playSuccessSound();showSuccessMoment('התאמה נכונה');f.className='feedback ok';f.textContent='הקובייה התחברה לשרשרת ✓';b.textContent='הקובייה חוברה ✓';requestAnimationFrame(()=>window.scrollTo(sx,sy));setTimeout(async()=>{try{const n=await get({playerId:pid,playerToken});if(n.phase!==d.phase){stableRerender(renderStudent);return}const oldTile=d.myTile?.id||null,newTile=n.myTile?.id||null;d.currentClue=n.currentClue;d.turnStartedAt=n.turnStartedAt;d.timeoutCount=n.timeoutCount;d.version=n.version;updateTurnTimer(n,'studentTurn');const clue=document.getElementById('studentClueText');if(clue)clue.textContent=n.currentClue||'';if(oldTile!==newTile&&n.myTile){const tileBox=document.getElementById('studentTile');if(tileBox)tileBox.innerHTML=tile(n.myTile);d.myTile=n.myTile;const play=document.getElementById('playTile');if(play){play.textContent='זה מתאים — חיבור הקובייה';play.disabled=false}const feed=document.getElementById('playFeedback');if(feed){feed.className='feedback';feed.textContent=''}fitDominoText()}requestAnimationFrame(()=>window.scrollTo(sx,sy))}catch{}},900)}else{f.className='feedback bad';f.textContent='עדיין לא — חפשו התאמה מדויקת.';b.disabled=false;requestAnimationFrame(()=>window.scrollTo(sx,sy))}}catch{b.disabled=false;requestAnimationFrame(()=>window.scrollTo(sx,sy))}};
 fitDominoText();updateTurnTimer(d,'studentTurn');startPoll(async()=>{try{
  const n=await get({playerId:pid,playerToken});
  if(n.phase!==d.phase){stableRerender(renderStudent);return}
  if(n.phase==='playing'){
    updateTurnTimer(n,'studentTurn');
    const clue=document.getElementById('studentClueText');
    if(clue&&n.currentClue!==d.currentClue)clue.textContent=n.currentClue||'';
    const oldTile=d.myTile?.id||null,newTile=n.myTile?.id||null;
    if(oldTile!==newTile){
      if(n.myTile){
        const tileBox=document.getElementById('studentTile');
        if(tileBox)tileBox.innerHTML=tile(n.myTile);
        d.myTile=n.myTile;
        const play=document.getElementById('playTile');
        if(play){play.textContent='זה מתאים — חיבור הקובייה';play.disabled=false}
        const feed=document.getElementById('playFeedback');
        if(feed){feed.className='feedback';feed.textContent=''}
        fitDominoText();
      }else{
        const tileBox=document.getElementById('studentTile');
        if(tileBox)tileBox.innerHTML='<div class="waiting">אין לך כרגע קובייה. עקבו אחרי השרשרת על המקרן.</div>';
        const play=document.getElementById('playTile');
        if(play){play.disabled=true;play.textContent='ממתינים לקובייה'}
        d.myTile=null;
      }
    }
    d.currentClue=n.currentClue;
    d.turnStartedAt=n.turnStartedAt;
    d.timeoutCount=n.timeoutCount;
    d.version=n.version;
    return;
  }
  if(n.version!==d.version)stableRerender(renderStudent);
 }catch{}});
 }catch{root.innerHTML='<div class="shell student-shell">'+hero()+'<section class="card"><h2>המשחק לא נמצא</h2></section></div>'}
}
if(path.startsWith('/teacher'))renderTeacher();else if(path.startsWith('/projector'))renderProjector();else if(path.startsWith('/join')&&preview)renderStudentPreview();else if(path.startsWith('/join'))renderStudent();else if(q.get('edit')||q.get('teacher')==='1')renderTeacherEntry();else renderHome();
})();