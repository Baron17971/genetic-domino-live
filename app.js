(function(){
'use strict';
const root=document.getElementById('dominoApp');
const toastBox=document.getElementById('dominoToast');
const q=new URLSearchParams(location.search);
const path=location.pathname;
const code=q.get('code')||'';
const token=q.get('token')||'';
let timer=null;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
function toast(t){toastBox.textContent=t;toastBox.classList.add('show');setTimeout(()=>toastBox.classList.remove('show'),1600);}
function playerId(){const k='genetic-domino-player';let v=localStorage.getItem(k);if(!v){v=crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random();localStorage.setItem(k,v);}return v;}
const pid=playerId();
const teacherUrl=(c,t)=>location.origin+'/teacher?code='+encodeURIComponent(c)+'&token='+encodeURIComponent(t);
const joinUrl=()=>location.origin+'/join?code='+encodeURIComponent(code);
const projectorUrl=()=>location.origin+'/projector?code='+encodeURIComponent(code)+'&token='+encodeURIComponent(token);
async function get(extra={}){let u='/api/domino?code='+encodeURIComponent(code);for(const [k,v] of Object.entries(extra))if(v)u+='&'+encodeURIComponent(k)+'='+encodeURIComponent(v);const r=await fetch(u,{cache:'no-store'});let d={};try{d=await r.json();}catch(e){}if(!r.ok){const er=new Error(d.error||'request');er.code=d.error;throw er;}return d;}
async function post(body,includeCode=true){const payload=includeCode?{...body,code}:body;const r=await fetch('/api/domino',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});let d={};try{d=await r.json();}catch(e){}if(!r.ok){const er=new Error(d.error||'request');er.code=d.error;throw er;}return d;}
function hero(sub){return '<section class="hero"><div class="eyebrow">ביוטכנולוגיה · הנדסה גנטית</div><h1>דומינו בהנדסה גנטית</h1><p>'+esc(sub||'מקשיבים לרמז. מחכים לרגע הנכון. מחברים את השרשרת.')+'</p></section>';}
function spritePos(id){
 const n=Math.max(1,Math.min(32,Number(id)||1))-1;
 const col=n%4,row=Math.floor(n/4);
 const x=col*(100/3),y=row*(100/7);
 return `background-position:${x}% ${y}%`;
}
function tile(t,compact=false){
 const id=Number(t.id)||1;
 const alt=esc((t.answer||'')+' — '+(t.clue||''));
 return '<div class="domino domino-picture'+(compact?' compact':'')+'" role="img" aria-label="'+alt+'"><div class="domino-sprite" style="'+spritePos(id)+'"></div></div>';
}
function chainHtml(list){if(!list||!list.length)return '<div class="waiting">השרשרת עדיין לא התחילה.</div>';const mobile=window.matchMedia('(max-width:760px)').matches;const perRow=mobile?2:4;const rows=[];for(let i=0;i<list.length;i+=perRow)rows.push(list.slice(i,i+perRow));return '<div class="chain-board">'+rows.map((row,ri)=>{const dir=ri%2===0?'rtl':'ltr';const cells=row.map((t,ci)=>{const globalIndex=ri*perRow+ci;const isLast=globalIndex===list.length-1;return '<div class="chain-cell'+(isLast?' newest':'')+'">'+tile(t,true)+'</div>';}).join('');const connector=ri<rows.length-1?'<div class="chain-turn" aria-hidden="true"><span></span></div>':'';return '<div class="chain-row '+dir+'">'+cells+connector+'</div>';}).join('')+'</div>';}
function projectorChainHtml(list){
 if(!list||!list.length)return '<div class="waiting">השרשרת עדיין לא התחילה.</div>';
 const CARD_RATIO=2172/724;
 const pad=12;
 const viewport=Math.max(760,Math.min(1840,(window.innerWidth||1280)-32));
 const tileW=Math.floor((viewport-(pad*2))/(8+(1/CARD_RATIO)));
 const tileH=Math.round(tileW/CARD_RATIO);
 const turnW=tileH, turnH=tileW;
 const leftX=pad+turnW;
 const rowStep=turnH;
 const row1Y=pad;
 const row2Y=row1Y+rowStep;
 const row3Y=row2Y+rowStep;
 const row4Y=row3Y+rowStep;
 const items=[];
 const add=(index,x,y,rot,turn=false)=>{if(index>=list.length)return;items.push({tile:list[index],index,x,y,rot,turn,footprintW:turn?turnW:tileW,footprintH:turn?turnH:tileH});};

 // קוביית הצד יושבת כך שהקצה הפנימי שלה מיושר למרכז הקובייה שמעליה/מתחתיה.
 const leftTurnX=leftX+Math.round(tileW/2)-turnW;
 const rightTurnX=leftX+Math.round(tileW*6.5);
 const row1TurnY=row1Y+Math.round(tileH/2);
 const row2TurnY=row2Y+Math.round(tileH/2);
 const row3TurnY=row3Y+Math.round(tileH/2);

 for(let index=0;index<=7;index++){const col=7-index;add(index,leftX+(col*tileW),row1Y,0,false);}
 add(8,leftTurnX,row1TurnY,-90,true);

 for(let index=9;index<=15;index++){const col=index-9;add(index,leftX+(col*tileW),row2Y,180,false);}
 add(16,rightTurnX,row2TurnY,-90,true);

 for(let index=17;index<=23;index++){const col=23-index;add(index,leftX+(col*tileW),row3Y,0,false);}
 add(24,leftTurnX,row3TurnY,-90,true);

 for(let index=25;index<=31;index++){const col=index-25;add(index,leftX+(col*tileW),row4Y,180,false);}

 const boardW=Math.ceil(leftX+(8*tileW)+pad);
 const boardH=Math.ceil(row4Y+tileH+pad);

 return '<div class="projector-chain-scroll"><div class="projector-chain-board" style="width:'+boardW+'px;height:'+boardH+'px">'+items.map(it=>{const isLast=it.index===list.length-1;const alt=esc((it.tile.answer||'')+' — '+(it.tile.clue||''));return '<div class="projector-domino-pos'+(it.turn?' turn':'')+(isLast?' newest':'')+'" aria-label="'+alt+'" role="img" style="left:'+it.x+'px;top:'+it.y+'px;width:'+it.footprintW+'px;height:'+it.footprintH+'px"><div class="projector-domino-img" style="left:50%;top:50%;width:'+tileW+'px;height:'+tileH+'px;transform:translate(-50%,-50%) rotate('+it.rot+'deg);'+spritePos(Number(it.tile.id)||1)+'"></div></div>';}).join('')+'</div></div>';
}
function progress(n){const p=Math.round((n/32)*100);return '<div class="progress"><span style="width:'+p+'%"></span></div><div class="tiny progress-label">'+n+'/32 קוביות</div>';}
function complete(){return '<div class="complete"><strong>השרשרת הושלמה ✓</strong><span>ביוטכנולוגיה זה ב־DNA שלך..</span></div>';}
function startPoll(fn){clearInterval(timer);timer=setInterval(fn,1050);}

function renderHome(){
 document.body.classList.remove('projector');
 const last=localStorage.getItem('genetic-domino-last-teacher')||'';
 root.innerHTML='<div class="shell">'+hero('משחק כיתתי חי · 32 קוביות')+'<section class="card home-card"><h2>פתיחת משחק חדש</h2><p class="muted">פותחים חדר, מקרינים QR, התלמידים מצטרפים בשם ומקבלים קוביית דומינו. הקובייה הראשונה מונחת מראש, והשרשרת נבנית יחד על המקרן.</p><label class="field"><span>שם הכיתה — לא חובה</span><input id="className" maxlength="60" placeholder="לדוגמה: י״א ביוטכנולוגיה"></label><button class="btn pri press" id="createGame">יצירת משחק חדש</button>'+(last?'<button class="btn ghost press" id="resumeLast">חזרה למשחק האחרון</button>':'')+'<div id="homeFeedback" class="feedback"></div></section><section class="card how"><div><strong>1</strong><span>המורה פותח משחק</span></div><div><strong>2</strong><span>התלמידים סורקים QR</span></div><div><strong>3</strong><span>השרשרת נבנית בזמן אמת</span></div></section></div>';
 document.getElementById('createGame').onclick=async()=>{const b=document.getElementById('createGame'),f=document.getElementById('homeFeedback');b.disabled=true;f.textContent='יוצר משחק…';try{const d=await post({action:'create',className:document.getElementById('className').value.trim()},false);const u=teacherUrl(d.code,d.teacherToken);localStorage.setItem('genetic-domino-last-teacher',u);location.href=u;}catch(e){f.className='feedback bad';f.textContent='לא ניתן ליצור משחק כרגע.';b.disabled=false;}};
 if(last)document.getElementById('resumeLast').onclick=()=>location.href=last;
}

async function renderTeacher(){
 try{
  const d=await get({teacherToken:token});if(!d.teacher)throw new Error('auth');
  localStorage.setItem('genetic-domino-last-teacher',location.href);
  const players=d.players||[];
  const spectators=Math.max(0,players.length-31);
  root.innerHTML='<div class="shell">'+hero(d.className?'מסך מורה · '+d.className:'מסך מורה')+'<section class="card"><div class="teacher-top"><div><div class="status"><span class="dot '+(d.phase==='playing'?'on':'')+'"></span>'+(d.phase==='lobby'?'ממתינים לתלמידים':d.phase==='playing'?'המשחק פעיל':'המשחק הושלם')+'</div><h2>קוד כיתה</h2><div class="code">'+esc(code)+'</div></div><div class="joinbox"><div class="qr"><img alt="QR למשחק" src="/api/qr?text='+encodeURIComponent(joinUrl())+'"></div><div><strong>כניסת תלמידים למשחק</strong><div class="linkbox">'+esc(joinUrl())+'</div><div class="btns"><button class="btn ghost" id="copyJoin">העתקת קישור</button><button class="btn ghost" id="openProjector">פתיחת מקרן</button></div></div></div></div></section><div class="grid"><section class="card"><h2>תלמידים מחוברים: '+players.length+'</h2><div class="roster">'+(players.length?players.map(p=>'<span class="chip">'+esc(p.name)+'</span>').join(''):'<span class="muted">עדיין אין תלמידים בלובי.</span>')+'</div>'+(spectators?'<div class="tiny note">בכיתה יש יותר מ־31 תלמידים; '+spectators+' תלמידים יהיו צופים בסבב הזה.</div>':'')+'<div class="btns">'+(d.phase==='lobby'?'<button class="btn pri" id="startGame" '+(!players.length?'disabled':'')+'>התחלת המשחק וחלוקת קוביות</button>':'<button class="btn danger" id="resetGame">איפוס וחזרה ללובי</button>')+'<button class="btn ghost" id="newRoster">ניקוי תלמידים ופתיחת כיתה מחדש</button></div></section><section class="card"><h2>מצב השרשרת</h2>'+progress(d.chainCount||0)+(d.currentClue?'<div class="open-clue"><span>הרמז הפתוח</span>„'+esc(d.currentClue)+'”</div>':'')+'</section></div><section class="card"><h2>השרשרת המשותפת</h2>'+chainHtml(d.chain||[])+(d.phase==='complete'?complete():'')+'</section></div>';
  document.getElementById('copyJoin').onclick=async()=>{try{await navigator.clipboard.writeText(joinUrl());toast('הקישור הועתק');}catch(e){}};
  document.getElementById('openProjector').onclick=()=>window.open(projectorUrl(),'_blank','noopener');
  const s=document.getElementById('startGame');if(s)s.onclick=async()=>{s.disabled=true;try{await post({action:'start',teacherToken:token});renderTeacher();}catch(e){toast(e.code==='no_players'?'אין עדיין תלמידים בלובי':'לא ניתן להתחיל');s.disabled=false;}};
  const r=document.getElementById('resetGame');if(r)r.onclick=async()=>{if(confirm('לאפס את השרשרת ולחלק שוב קוביות לאותם תלמידים?')){await post({action:'reset',teacherToken:token});renderTeacher();}};
  document.getElementById('newRoster').onclick=async()=>{if(confirm('למחוק גם את רשימת התלמידים ולפתוח לובי חדש?')){await post({action:'newRoster',teacherToken:token});renderTeacher();}};
  startPoll(async()=>{try{const n=await get({teacherToken:token});if(n.version!==d.version||n.players.length!==players.length)renderTeacher();}catch(e){}});
 }catch(e){root.innerHTML='<div class="shell">'+hero()+'<section class="card"><h2>לא ניתן לפתוח את מסך המורה</h2><p class="muted">הקישור אינו תקין או שהמשחק אינו קיים.</p><a class="btn pri linkbtn" href="/">פתיחת משחק חדש</a></section></div>';}
}

async function renderProjector(){
 document.body.classList.add('projector');
 try{
  const d=await get({teacherToken:token});if(!d.teacher)throw new Error('auth');
  root.innerHTML='<div class="shell">'+hero(d.className?'תצוגת מקרן · '+d.className:'תצוגת מקרן')+'<section class="card projector-head-card"><div class="teacher-top"><div><div class="eyebrow dark">קוד כיתה</div><div class="code">'+esc(code)+'</div></div><div class="joinbox"><div class="qr"><img alt="QR למשחק" src="/api/qr?text='+encodeURIComponent(joinUrl())+'"></div><div><strong>'+(d.phase==='lobby'?'סרקו והצטרפו ללובי':d.phase==='playing'?'מי מחזיק את התשובה?':'המשחק הסתיים')+'</strong><div class="muted">'+(d.players||[]).length+' תלמידים מחוברים</div></div></div></div>'+(d.currentClue?'<div class="open-clue projector-clue"><span>הרמז הפתוח</span>„'+esc(d.currentClue)+'”</div>':'')+'<div class="projector-progress">'+progress(d.chainCount||0)+'</div></section><section class="card projector-chain-card">'+projectorChainHtml(d.chain||[])+(d.lastPlayer?'<div class="feedback ok last-player">✓ '+esc(d.lastPlayer)+' חיבר/ה את הקובייה האחרונה</div>':'')+(d.phase==='complete'?complete():'')+'</section></div>';
  startPoll(async()=>{try{const n=await get({teacherToken:token});if(n.version!==d.version)renderProjector();}catch(e){}});
 }catch(e){root.innerHTML='<div class="shell">'+hero()+'<section class="card"><h2>לא ניתן לפתוח תצוגת מקרן</h2></section></div>';}
}

function joinForm(saved){
 root.innerHTML='<div class="shell student-shell">'+hero('קובייה אחת. רגע אחד נכון.')+'<section class="card nameform"><h2>כניסה למשחק</h2><p class="muted">כתבו שם פרטי. לאחר שהמורה יתחיל, תקבלו קוביית דומינו. לחצו רק כשהמושג שבצד ימין של הקובייה שלכם מתאים לרמז הפתוח.</p><input id="playerName" maxlength="24" autocomplete="name" placeholder="השם שלי" value="'+esc(saved||'')+'"><button class="btn pri press" id="joinGame">כניסה ללובי</button><div class="feedback" id="joinFeedback"></div></section></div>';
 document.getElementById('joinGame').onclick=async()=>{const name=document.getElementById('playerName').value.trim();if(!name){document.getElementById('joinFeedback').textContent='כתבו שם פרטי.';return;}localStorage.setItem('genetic-domino-name',name);try{await post({action:'join',playerId:pid,name});renderStudent();}catch(e){document.getElementById('joinFeedback').textContent=e.code==='game_started'?'המשחק כבר התחיל. בקשו מהמורה לאפס אם צריך.':'לא ניתן להצטרף כרגע.';}};
}

async function renderStudent(){
 const saved=localStorage.getItem('genetic-domino-name')||'';if(!saved){joinForm('');return;}
 try{
  const d=await get({playerId:pid});
  if(!d.joined){joinForm(saved);return;}
  if(d.phase==='lobby'){
   root.innerHTML='<div class="shell student-shell">'+hero('מחכים יחד לרגע הנכון')+'<section class="card"><div class="waiting"><strong>'+esc(saved)+'</strong>, הצטרפת ללובי ✓<br>המורה יתחיל את המשחק ויחלק קוביות.</div></section></div>';
  }else if(d.phase==='complete'){
   root.innerHTML='<div class="shell student-shell">'+hero('השרשרת הושלמה')+'<section class="card">'+complete()+chainHtml(d.chain||[])+'</section></div>';
  }else{
   const mine=d.myTile;
   root.innerHTML='<div class="shell student-shell">'+hero('עקבו אחרי הרמז. אל תמהרו ללחוץ.')+'<section class="card"><div class="open-clue"><span>הרמז הפתוח</span>„'+esc(d.currentClue||'')+'”</div>'+progress(d.chainCount||0)+(mine?'<div class="mytile"><div class="tiny mytile-title">קוביית הדומינו שלך</div>'+tile(mine)+'<button class="btn pri press" id="playTile">המושג שלי מתאים לרמז</button><div class="feedback" id="playFeedback"></div></div>':'<div class="waiting spectator" style="margin-top:18px">כרגע אין לך קובייה פעילה. המשך לעקוב אחרי השרשרת — ייתכן שתקבל קובייה בהמשך.</div>')+'</section></div>';
   const b=document.getElementById('playTile');if(b)b.onclick=async()=>{b.disabled=true;const f=document.getElementById('playFeedback');f.className='feedback';f.textContent='בודקים…';try{const r=await post({action:'play',playerId:pid});if(r.correct){f.className='feedback ok';f.textContent='✓ נכון! הקובייה שלך התחברה לשרשרת.';setTimeout(renderStudent,650);}else{f.className='feedback bad';f.textContent='עדיין לא. המשך לעקוב ולהמתין לרגע המתאים.';b.disabled=false;}}catch(e){f.className='feedback bad';f.textContent='לא ניתן לבדוק כרגע. נסו שוב.';b.disabled=false;}};
  }
  startPoll(async()=>{try{const n=await get({playerId:pid});if(n.version!==d.version||n.phase!==d.phase||((n.myTile&&n.myTile.id)!==(d.myTile&&d.myTile.id)))renderStudent();}catch(e){}});
 }catch(e){joinForm(saved);}
}

if(path==='/'&&!code){renderHome();return;}
if(!code){root.innerHTML='<div class="shell">'+hero()+'<section class="card"><h2>חסר קוד כיתה</h2><p class="muted">פתחו את הקישור שקיבלתם מהמורה.</p></section></div>';return;}
if(path==='/teacher')renderTeacher();else if(path==='/projector')renderProjector();else renderStudent();
})();
