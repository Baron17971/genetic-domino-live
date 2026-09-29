(function(){
'use strict';
const root=document.getElementById('dominoApp'),toastBox=document.getElementById('dominoToast');
const q=new URLSearchParams(location.search),path=location.pathname,code=q.get('code')||'',token=q.get('token')||'';let timer=null;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
function toast(t){toastBox.textContent=t;toastBox.classList.add('show');setTimeout(()=>toastBox.classList.remove('show'),1600)}
function playerId(){const k='pairs-domino-player';let v=localStorage.getItem(k);if(!v){v=crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random();localStorage.setItem(k,v)}return v}
const pid=playerId(),teacherUrl=(c,t)=>location.origin+'/teacher?code='+encodeURIComponent(c)+'&token='+encodeURIComponent(t),joinUrl=()=>location.origin+'/join?code='+encodeURIComponent(code),projectorUrl=()=>location.origin+'/projector?code='+encodeURIComponent(code)+'&token='+encodeURIComponent(token);
async function get(extra={}){let u='/api/domino?code='+encodeURIComponent(code);for(const[k,v]of Object.entries(extra))if(v)u+='&'+encodeURIComponent(k)+'='+encodeURIComponent(v);const r=await fetch(u,{cache:'no-store'});let d={};try{d=await r.json()}catch{}if(!r.ok){const e=new Error(d.error||'request');e.code=d.error;throw e}return d}
async function post(body,includeCode=true){const r=await fetch('/api/domino',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(includeCode?{...body,code}:body)});let d={};try{d=await r.json()}catch{}if(!r.ok){const e=new Error(d.error||'request');e.code=d.error;throw e}return d}
function hero(sub,title='DomiKnow'){return '<section class="hero hero-image" aria-label="'+esc(title)+'"><picture><source media="(max-width:760px)" srcset="/domino-home/top-banner-mobile..png"><img src="/domino-home/top-banner-desktop.png" alt="DomiKnow — כל הכיתה. שרשרת אחת של ידע."></picture><span class="sr-only">'+esc(sub||'')+'</span></section>'}
function homeVisual(){return '<section class="home-visual" aria-label="DomiKnow — כשידע ומשחק מתחברים"><picture><source media="(max-width:760px)" srcset="/domino-home/domino-home-mobile.png"><img src="/domino-home/domino-home-desktop.png" alt="DomiKnow — משחק דומינו כיתתי"></picture><button type="button" class="home-teacher-hotspot" id="homeTeacherStart" aria-label="כניסת מורה"></button><button type="button" class="home-demo-hotspot" id="homeDemoStart" aria-label="צפו בדוגמה"></button></section>'}
function tile(t,compact=false){const lc=Number.isInteger(t?.leftColor)?t.leftColor:0,rc=Number.isInteger(t?.rightColor)?t.rightColor:1,p=document.documentElement.dataset.dominoPattern||'grid';return '<div class="domino '+(compact?'compact ':'')+'pattern-'+esc(p)+'"><div class="domino-half dc-'+lc+'"><span class="domino-half-text">'+esc(t.left)+'</span></div><div class="domino-half dc-'+rc+'"><span class="domino-half-text">'+esc(t.right)+'</span></div></div>'}
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
 {id:'grid',name:'גריד עדין'},
 {id:'dots',name:'נקודות רכות'},
 {id:'wave',name:'גלים'},
 {id:'grain',name:'טקסטורה'},
 {id:'corners',name:'פינות גאומטריות'}
];
function savedDesign(){try{return JSON.parse(sessionStorage.getItem(DESIGN_KEY)||'')||{palette:'beach',pattern:'grid'}}catch{return{palette:'beach',pattern:'grid'}}}
function saveDesign(d){sessionStorage.setItem(DESIGN_KEY,JSON.stringify(d));applyDesign(d)}
function applyDesign(d={}){const p=d.palette||'beach',x=d.pattern||'grid';document.documentElement.dataset.dominoPalette=p;document.documentElement.dataset.dominoPattern=x}
function renderDesign(){
 clearInterval(timer);document.body.classList.remove('projector','landing');
 let design=savedDesign();applyDesign(design);
 const paletteCards=palettes.map(p=>'<button type="button" class="design-palette '+(p.id===design.palette?'selected':'')+'" data-palette="'+p.id+'"><span class="palette-swatches">'+p.colors.map(x=>'<i style="background:'+x+'"></i>').join('')+'</span><strong>'+esc(p.name)+'</strong><span class="design-check">✓</span></button>').join('');
 const patternCards=patterns.map(p=>'<button type="button" class="design-pattern pattern-'+p.id+' '+(p.id===design.pattern?'selected':'')+'" data-pattern="'+p.id+'"><span class="pattern-demo"></span><strong>'+esc(p.name)+'</strong><span class="design-check">✓</span></button>').join('');
 root.innerHTML='<div class="shell design-shell"><div class="setup-topbar"><button class="btn ghost back-home" id="designBack">← חזרה לדף הבית</button></div><section class="card design-card"><div class="design-kicker">שלב 1 מתוך 2</div><h2>בחרו את המראה של DomiKnow שלכם</h2><p class="muted">בחרו פלטת צבעים ודוגמה עדינה לקוביות. תוכלו לראות מיד תצוגה מקדימה.</p><h3>פלטת צבעים</h3><div class="palette-grid">'+paletteCards+'</div><h3>דוגמת רקע</h3><div class="pattern-grid">'+patternCards+'</div><div class="design-preview"><span>תצוגה מקדימה</span>'+tile({left:'מושג',right:'הגדרה קצרה',leftColor:0,rightColor:1})+'</div><button class="btn pri design-next" id="designNext">המשך ליצירת המשחק</button></section></div>';
 document.getElementById('designBack').onclick=renderHome;
 document.querySelectorAll('[data-palette]').forEach(b=>b.onclick=()=>{design={...design,palette:b.dataset.palette};saveDesign(design);renderDesign()});
 document.querySelectorAll('[data-pattern]').forEach(b=>b.onclick=()=>{design={...design,pattern:b.dataset.pattern};saveDesign(design);renderDesign()});
 document.getElementById('designNext').onclick=renderSetup;
 fitDominoText();
}
function renderHome(){
 clearInterval(timer);document.body.classList.remove('projector');document.body.classList.add('landing');
 root.innerHTML='<div class="home-only">'+homeVisual()+
 '<div class="home-demo-modal" id="homeDemoModal" hidden><div class="home-demo-backdrop" id="closeDemoBackdrop"></div><section class="home-demo-panel" role="dialog" aria-modal="true" aria-label="דוגמה למשחק DomiKnow"><button type="button" class="demo-close" id="closeDemo" aria-label="סגירת הדוגמה">×</button><div class="demo-kicker">DomiKnow · דוגמה חיה</div><h2>כך נראית התאמה במשחק</h2><div class="open-clue"><span>ההתאמה הפתוחה</span>תהליך יצירת מזון בצמחים בעזרת אור השמש</div><div class="demo-sample-tile">'+tile({left:'פוטוסינתזה',right:'תהליך יצירת מזון בצמחים בעזרת אור השמש'})+'</div><div class="feedback ok">✓ זו ההתאמה הנכונה</div></section></div></div>';
 const teacher=document.getElementById('homeTeacherStart'),demo=document.getElementById('homeDemoStart'),modal=document.getElementById('homeDemoModal');
 if(teacher)teacher.onclick=renderDesign;
 const close=()=>{if(modal)modal.hidden=true};
 if(demo)demo.onclick=()=>{if(modal){modal.hidden=false;fitDominoText()}};
 document.getElementById('closeDemo')?.addEventListener('click',close);
 document.getElementById('closeDemoBackdrop')?.addEventListener('click',close);
}

function renderSetup(){
 document.body.classList.remove('projector','landing');applyDesign(savedDesign());const last=localStorage.getItem('pairs-domino-last-teacher')||'';
 root.innerHTML='<div class="shell setup-shell"><div class="setup-topbar"><button class="btn ghost back-home" id="backHome">← חזרה לעיצוב</button></div>'+
 '<section class="card create-game-card" id="createGameSection"><h2>יצירת משחק חדש</h2><div class="grid"><div><label class="field"><span>מקצוע</span><input id="subjectName" maxlength="60" placeholder="לדוגמה: ביולוגיה"></label><label class="field"><span>כיתה</span><input id="className" maxlength="60" placeholder="לדוגמה: ח׳2"></label><label class="field"><span>נושא</span><input id="topicName" maxlength="80" placeholder="לדוגמה: מערכת הנשימה"></label><label class="field"><span>מספר זוגות</span><input id="wantedPairs" type="number" min="4" max="40" value="20" inputmode="numeric"></label></div><div class="muted">הזינו את פרטי השיעור פעם אחת. המקצוע, הכיתה והנושא ייכנסו אוטומטית לפרומפט.<br><br>את הזוגות מזינים בפורמט:<br><strong>מושג | התאמה</strong></div></div>'+
 '<section class="prompt-helper"><div class="prompt-head"><div><strong>צריכים עזרה ביצירת הזוגות?</strong><span>ערכו את הפרומפט והעתיקו אותו לבינה המועדפת עליכם.</span></div><button class="btn ghost compact-btn" id="copyPrompt">העתקת פרומפט</button></div><textarea id="promptText" class="prompt-text">אני מורה ל__________ ומלמד/ת תלמידי כיתה ________ את הנושא: __________.\nצור עבורי מאגר של 20 זוגות למשחק דומינו לימודי.\n\nכל זוג צריך לכלול:\nמושג קצר | הגדרה / שאלה / תיאור שהתשובה עליו היא בדיוק אותו מושג\n\nהקפד על ניסוח קצר וברור, התאמה לגיל התלמידים, ללא כפילויות, ללא מושגים כמעט זהים, וללא כתיבת המושג עצמו בתוך ההגדרה.\nהמושג צריך להיות קצר ככל האפשר, רצוי עד 22 תווים. ההגדרה/התיאור צריכים להיות תמציתיים, רצוי עד 55 תווים. אם ניתן לקצר בלי לפגוע בדיוק — קצר.\n\nהחזר את התשובה בתוך בלוק קוד רגיל בלבד (plain text), ללא כותרת, ללא מספור, ללא bullets וללא טקסט לפני או אחרי בלוק הקוד.\n\nבתוך בלוק הקוד חייבות להיות בדיוק מספר השורות שביקשתי — שורה אחת לכל זוג.\nכל זוג נכתב בשורה אחת בלבד בפורמט:\nמושג | התאמה\n\nבסיום כל זוג לחץ Enter פעם אחת ועבור לשורה חדשה.\nאסור לכתוב שני זוגות באותה שורה ואסור להמשיך זוג חדש באותה שורה.\n\nדוגמה מדויקת למבנה הפלט בתוך בלוק הקוד:\nמיטוכונדריה | אברון שבו מתבצעת נשימה תאית\nריבוזום | אברון שבו מתבצע תרגום\nDNA | מולקולה הנושאת מידע תורשתי</textarea></section>'+ 
 '<div class="pairs-head"><div><strong>זוגות למשחק</strong><span>העתיקו את המאגר מהבינה. הכפתור למטה יטען אותו וייצור את המשחק.</span></div></div><label class="field pairs-field"><textarea id="pairs" placeholder="מיטוכונדריה | אברון שבו מתבצעת נשימה תאית\nריבוזום | אברון שבו מתבצע תרגום\nDNA | מולקולה הנושאת מידע תורשתי\n..."></textarea></label>'+
 '<div class="pair-help"><span class="count" id="pairCount">0 זוגות</span><span class="tiny">מינימום 4 · מקסימום 40 זוגות</span></div><div class="btns"><button class="btn pri combo-create" id="createGame">טעינת המאגר ויצירת משחק</button>'+(last?'<button class="btn ghost" id="resumeLast">חזרה למשחק האחרון</button>':'')+'</div><div id="homeFeedback" class="feedback"></div></section>'+
 '<section class="card how"><div><strong>1</strong><span>המורה מזין זוגות</span></div><div><strong>2</strong><span>התלמידים מקבלים קוביות</span></div><div><strong>3</strong><span>הכיתה בונה שרשרת</span></div></section></div>';
 document.getElementById('backHome').onclick=renderDesign;
 const ta=document.getElementById('pairs'),count=document.getElementById('pairCount'),btn=document.getElementById('createGame'),copyPrompt=document.getElementById('copyPrompt'),promptText=document.getElementById('promptText'),subjectName=document.getElementById('subjectName'),className=document.getElementById('className'),topicName=document.getElementById('topicName'),wantedPairs=document.getElementById('wantedPairs');
 const refresh=()=>{const n=parsePairs(ta.value).length,wanted=Math.max(4,Math.min(40,Number(wantedPairs.value)||20)),missing=Math.max(0,wanted-n);count.textContent=missing? n+' מתוך '+wanted+' זוגות · חסרים '+missing:n+' מתוך '+wanted+' זוגות ✓'};
 const syncPrompt=()=>{const subject=subjectName.value.trim()||'__________',klass=className.value.trim()||'__________',topic=topicName.value.trim()||'__________',wanted=Math.max(4,Math.min(40,Number(wantedPairs.value)||20));const lines=promptText.value.split('\n');lines[0]='אני מורה ל'+subject+' ומלמד/ת תלמידי כיתה '+klass+' את הנושא: '+topic+'.';lines[1]='צור עבורי מאגר של '+wanted+' זוגות למשחק דומינו לימודי.';promptText.value=lines.join('\n')};
 [subjectName,className,topicName].forEach(el=>el.addEventListener('input',syncPrompt));
 wantedPairs.addEventListener('input',()=>{syncPrompt();refresh()});wantedPairs.addEventListener('change',()=>{syncPrompt();refresh()});
 ta.addEventListener('input',refresh);ta.addEventListener('change',refresh);ta.addEventListener('paste',()=>setTimeout(refresh,0));
 syncPrompt();refresh();
 copyPrompt.onclick=async()=>{const t=promptText.value;try{await navigator.clipboard.writeText(t);toast('הפרומפט הועתק')}catch{promptText.select();document.execCommand('copy');toast('הפרומפט הועתק')}};

 btn.onclick=async()=>{const f=document.getElementById('homeFeedback'),wanted=Math.max(4,Math.min(40,Number(wantedPairs.value)||20));btn.disabled=true;f.className='feedback';try{let current=ta.value.trim();if(!current){f.textContent='טוען את המאגר…';let t='';try{if(navigator.clipboard?.readText){t=await Promise.race([navigator.clipboard.readText(),new Promise(resolve=>setTimeout(()=>resolve(''),900))])}}catch{}if(t.trim()){t=t.replace(/^\s*\`\`\`(?:text|txt|plaintext)?\s*/i,'').replace(/\s*\`\`\`\s*$/,'').trim();ta.value=t;current=t}}const pairs=parsePairs(ta.value);refresh();if(pairs.length<wanted){f.className='feedback bad';f.textContent='נמצאו '+pairs.length+' מתוך '+wanted+' זוגות. הדביקו את המאגר בשדה הזוגות ונסו שוב.';btn.disabled=false;ta.focus();return}f.textContent='יוצר משחק…';const design=savedDesign();const d=await post({action:'create',title:topicName.value.trim(),className:className.value.trim(),subject:subjectName.value.trim(),topic:topicName.value.trim(),palette:design.palette,pattern:design.pattern,requestedPairs:wanted,pairs},false);const u=teacherUrl(d.code,d.teacherToken);localStorage.setItem('pairs-domino-last-teacher',u);location.href=u}catch(e){f.className='feedback bad';f.textContent=e.code==='not_enough_pairs'?'אין מספיק זוגות ביחס למספר שבחרת.':'לא ניתן ליצור משחק כרגע.';btn.disabled=false;refresh()}};
 if(last)document.getElementById('resumeLast').onclick=()=>location.href=last;
}
async function renderTeacher(){
 try{const d=await get({teacherToken:token});applyDesign(d);if(!d.teacher)throw new Error('auth');localStorage.setItem('pairs-domino-last-teacher',location.href);const players=d.players||[],spectators=Math.max(0,players.length-(d.tileCount-1));
 root.innerHTML='<div class="shell">'+hero(d.className?'מסך מורה · '+d.className:'מסך מורה',d.title)+'<section class="card"><div class="teacher-top"><div><div class="status"><span class="dot '+(d.phase==='playing'?'on':'')+'"></span>'+(d.phase==='lobby'?'ממתינים לתלמידים':d.phase==='playing'?'המשחק פעיל':'המשחק הושלם')+'</div><h2>קוד כיתה</h2><div class="code">'+esc(code)+'</div></div><div class="joinbox"><div class="qr"><img alt="QR למשחק" src="/api/qr?text='+encodeURIComponent(joinUrl())+'"></div><div><strong>כניסת תלמידים</strong><div class="linkbox">'+esc(joinUrl())+'</div><div class="btns"><button class="btn ghost" id="copyJoin">העתקת קישור</button><button class="btn ghost" id="openProjector">פתיחת מקרן</button></div></div></div></div></section>'+
 '<div class="grid"><section class="card"><h2>תלמידים מחוברים: '+players.length+'</h2><div class="roster">'+(players.length?players.map(p=>'<span class="chip">'+esc(p.name)+'</span>').join(''):'<span class="muted">עדיין אין תלמידים בלובי.</span>')+'</div>'+(spectators?'<div class="tiny note">'+spectators+' תלמידים יהיו צופים בסבב הזה.</div>':'')+'<div class="btns">'+(d.phase==='lobby'?'<button class="btn pri" id="startGame" '+(!players.length?'disabled':'')+'>התחלת המשחק וחלוקת קוביות</button>':'<button class="btn danger" id="resetGame">איפוס המשחק</button>')+'<button class="btn ghost" id="newRoster">ניקוי תלמידים</button></div></section><section class="card"><h2>מצב השרשרת</h2>'+progress(d.chainCount||0,d.tileCount)+(d.currentClue?'<div class="open-clue"><span>ההתאמה הפתוחה</span>'+esc(d.currentClue)+'</div>':'')+'<div class="tiny note">'+d.pairCount+' זוגות · '+d.tileCount+' קוביות</div><div class="turn-timer" id="turnTimer"></div></section></div>'+
 '<section class="card"><h2>השרשרת המשותפת</h2>'+chainHtml(d.chain||[])+(d.phase==='complete'?complete():'')+'</section></div>';
 document.getElementById('copyJoin').onclick=async()=>{try{await navigator.clipboard.writeText(joinUrl());toast('הקישור הועתק')}catch{}};
 document.getElementById('openProjector').onclick=()=>window.open(projectorUrl(),'_blank','noopener');
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
async function renderProjector(){
 document.body.classList.add('projector');try{const d=await get({teacherToken:token});applyDesign(d);if(!d.teacher)throw new Error('auth');
 root.innerHTML='<div class="shell">'+hero(d.className?'תצוגת מקרן · '+d.className:'תצוגת מקרן',d.title)+'<section class="card"><div class="teacher-top"><div><div class="eyebrow">קוד כיתה</div><div class="code">'+esc(code)+'</div></div><div class="joinbox"><div class="qr"><img alt="QR" src="/api/qr?text='+encodeURIComponent(joinUrl())+'"></div><div><strong>'+(d.phase==='lobby'?'סרקו והצטרפו ללובי':d.phase==='playing'?'מי מחזיק את ההתאמה?':'המשחק הסתיים')+'</strong><div class="muted">'+(d.players||[]).length+' תלמידים מחוברים</div></div></div></div>'+(d.currentClue?'<div class="open-clue projector-clue"><span>ההתאמה הפתוחה</span>'+esc(d.currentClue)+'</div>':'')+'<div class="turn-timer projector-turn-timer" id="turnTimer"></div>'+progress(d.chainCount||0,d.tileCount)+'</section><section class="card">'+chainHtml((d.chain||[]).slice(-5))+(d.lastPlayer?'<div class="feedback ok last-player">✓ '+esc(d.lastPlayer)+' חיבר/ה את הקובייה האחרונה</div>':'')+(d.phase==='complete'?complete():'')+'</section></div>';
 fitDominoText();updateTurnTimer(d);startPoll(async()=>{try{const n=await get({teacherToken:token});updateTurnTimer(n);if(n.chainCount>d.chainCount){playSuccessSound();showSuccessMoment('נוצר חיבור')}if(turnTiming(n).rotate){const x=await post({action:'tick',teacherToken:token});if(x.rotated){stableRerender(renderProjector);return}}if(n.version!==d.version)stableRerender(renderProjector)}catch{}})}catch{root.innerHTML='<div class="shell">'+hero()+'<section class="card"><h2>לא ניתן לפתוח תצוגת מקרן</h2></section></div>'}
}
function joinForm(saved,title='דומינו זוגות'){
 root.innerHTML='<div class="shell student-shell">'+hero('קובייה אחת. התאמה אחת. רגע אחד נכון.',title)+'<section class="card nameform"><h2>כניסה למשחק</h2><p class="muted">כתבו שם פרטי. לאחר שהמורה יתחיל תקבלו קובייה. לחצו כאשר הצד הימני של הקובייה שלכם מתאים להתאמה הפתוחה.</p><input id="playerName" maxlength="24" autocomplete="name" placeholder="השם שלי" value="'+esc(saved||'')+'"><button class="btn pri" id="joinGame">כניסה ללובי</button><div class="feedback" id="joinFeedback"></div></section></div>';
 document.getElementById('joinGame').onclick=async()=>{const name=document.getElementById('playerName').value.trim();if(!name){document.getElementById('joinFeedback').textContent='כתבו שם פרטי.';return}try{await post({action:'join',playerId:pid,name});localStorage.setItem('pairs-domino-name',name);renderStudent()}catch(e){document.getElementById('joinFeedback').textContent=e.code==='game_started'?'המשחק כבר התחיל.':'לא ניתן להצטרף כרגע.'}}
}
async function renderStudent(){
 try{const d=await get({playerId:pid}),saved=localStorage.getItem('pairs-domino-name')||'';applyDesign(d);if(!d.joined&&d.phase==='lobby'){joinForm(saved,d.title);return}
 if(d.phase==='lobby'){root.innerHTML='<div class="shell student-shell">'+hero('הצטרפת. מחכים שהמורה יתחיל.',d.title)+'<section class="card waiting">את/ה בלובי ✓</section></div>';startPoll(async()=>{try{const n=await get({playerId:pid});if(n.phase!==d.phase)stableRerender(renderStudent)}catch{}});return}
 if(!d.myTile&&d.phase!=='complete'){root.innerHTML='<div class="shell student-shell">'+hero('את/ה צופה בסבב הזה.',d.title)+'<section class="card waiting">אין לך כרגע קובייה. עקבו אחרי השרשרת על המקרן.</section></div>';startPoll(async()=>{try{const n=await get({playerId:pid});if(n.phase!==d.phase||!!n.myTile!==!!d.myTile)stableRerender(renderStudent)}catch{}});return}
 if(d.phase==='complete'){root.innerHTML='<div class="shell student-shell">'+hero('השרשרת הושלמה!',d.title)+'<section class="card">'+complete()+'</section></div>';return}
 root.innerHTML='<div class="shell student-shell">'+hero('בדקו האם הצד הימני שלכם מתאים למה שפתוח עכשיו.',d.title)+'<section class="card"><div class="open-clue" id="studentClue"><span>ההתאמה הפתוחה</span><b id="studentClueText">'+esc(d.currentClue)+'</b></div><div class="turn-timer student-turn-timer" id="studentTurn"></div><div class="my-tile" id="studentTile">'+tile(d.myTile)+'</div><div class="match-action"><button class="btn pri" id="playTile">זה מתאים — חיבור הקובייה</button><div class="feedback" id="playFeedback"></div></div></section></div>';
 document.getElementById('playTile').onclick=async()=>{const b=document.getElementById('playTile'),f=document.getElementById('playFeedback');b.disabled=true;const sx=window.scrollX,sy=window.scrollY;try{const x=await post({action:'play',playerId:pid});if(x.correct){playSuccessSound();showSuccessMoment('התאמה נכונה');f.className='feedback ok';f.textContent='הקובייה התחברה לשרשרת ✓';b.textContent='הקובייה חוברה ✓';requestAnimationFrame(()=>window.scrollTo(sx,sy));setTimeout(async()=>{try{const n=await get({playerId:pid});if(n.phase!==d.phase){stableRerender(renderStudent);return}const oldTile=d.myTile?.id||null,newTile=n.myTile?.id||null;d.currentClue=n.currentClue;d.turnStartedAt=n.turnStartedAt;d.timeoutCount=n.timeoutCount;d.version=n.version;updateTurnTimer(n,'studentTurn');const clue=document.getElementById('studentClueText');if(clue)clue.textContent=n.currentClue||'';if(oldTile!==newTile&&n.myTile){const tileBox=document.getElementById('studentTile');if(tileBox)tileBox.innerHTML=tile(n.myTile);d.myTile=n.myTile;const play=document.getElementById('playTile');if(play){play.textContent='זה מתאים — חיבור הקובייה';play.disabled=false}const feed=document.getElementById('playFeedback');if(feed){feed.className='feedback';feed.textContent=''}fitDominoText()}requestAnimationFrame(()=>window.scrollTo(sx,sy))}catch{}},900)}else{f.className='feedback bad';f.textContent='עדיין לא — חפשו התאמה מדויקת.';b.disabled=false;requestAnimationFrame(()=>window.scrollTo(sx,sy))}}catch{b.disabled=false;requestAnimationFrame(()=>window.scrollTo(sx,sy))}};
 fitDominoText();updateTurnTimer(d,'studentTurn');startPoll(async()=>{try{
  const n=await get({playerId:pid});
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
if(path.startsWith('/teacher'))renderTeacher();else if(path.startsWith('/projector'))renderProjector();else if(path.startsWith('/join'))renderStudent();else renderHome();
})();