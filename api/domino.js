import { getCache } from '@vercel/functions';
import crypto from 'node:crypto';

const TTL=2592000;
const NS='genetic-domino-live-v1';
const SHARDS=16;
const cache=()=>getCache(undefined,NS);
const roomKey=c=>'r:'+c;
const gameKey=c=>'d:'+c;
const rosterKey=(c,n)=>'dr:'+c+':'+n;
const clean=(v,max=180)=>typeof v==='string'?v.replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max):'';
const newCode=()=>String(crypto.randomInt(100000,1000000));

function hash(value){let r=2166136261;for(const c of value){r^=c.charCodeAt(0);r=Math.imul(r,16777619);}return r>>>0;}
function sameToken(a,b){if(!a||!b)return false;const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);}
async function body(req){if(req.body&&typeof req.body==='object')return req.body;const chunks=[];for await(const c of req)chunks.push(c);try{return JSON.parse(Buffer.concat(chunks).toString());}catch{return {};}}
function shuffle(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=crypto.randomInt(i+1);[x[i],x[j]]=[x[j],x[i]];}return x;}

const tiles=[
{id:1,answer:'התחלה',clue:'יצירת עותק נוסף של מולקולת DNA'},
{id:2,answer:'שכפול DNA',clue:'יצירת RNA על פי תבנית DNA'},
{id:3,answer:'שעתוק',clue:'יצירת חלבון על פי המידע שב־mRNA'},
{id:4,answer:'תרגום',clue:'אנזים המזהה רצף מסוים וחותך בו את ה־DNA'},
{id:5,answer:'אנזים הגבלה',clue:'רצף DNA מסוים שאנזים הגבלה מזהה'},
{id:6,answer:'אתר הגבלה',clue:'רצף הנקרא בכיוון 5′→3′ באופן זהה בשני גדילי ה־DNA'},
{id:7,answer:'רצף פלינדרומי',clue:'קצוות חד־גדיליים משלימים הנוצרים בחיתוך מדורג'},
{id:8,answer:'קצוות דביקים',clue:'הפרדת מקטעי DNA לפי גודלם באמצעות שדה חשמלי'},
{id:9,answer:'אלקטרופורזה בג׳ל',clue:'מולקולת DNA מעגלית קטנה היכולה לשמש כנשא'},
{id:10,answer:'פלסמיד',clue:'החדרת פלסמיד לתא חיידק'},
{id:11,answer:'טרנספורמציה',clue:'אזור בפלסמיד שממנו מתחיל שכפולו'},
{id:12,answer:'Ori – מוצא הכפלה',clue:'גן המאפשר לברור תאים שקלטו את הפלסמיד'},
{id:13,answer:'סמן ברירה',clue:'מקטעי DNA קצרים הקובעים את גבולות המקטע שיוגבר'},
{id:14,answer:'תחלים – Primers',clue:'אנזים עמיד לחום המאריך גדילי DNA חדשים'},
{id:15,answer:'Taq polymerase',clue:'הפרדת שני גדילי ה־DNA באמצעות חימום'},
{id:16,answer:'דנטורציה',clue:'שלב שבו התחלים נקשרים לרצפים המשלימים בתבנית'},
{id:17,answer:'Annealing – הצמדות',clue:'שלב שבו הפולימראז מאריך את גדילי ה־DNA החדשים'},
{id:18,answer:'אלונגציה',clue:'אנזים היוצר DNA על פי תבנית RNA'},
{id:19,answer:'Reverse Transcriptase – RT',clue:'DNA שנוצר על פי תבנית של RNA'},
{id:20,answer:'cDNA',clue:'מספר המחזור שבו האות הפלואורסצנטי עובר את ערך הסף ב־qPCR'},
{id:21,answer:'Cq / Ct',clue:'אנזים החותך את ה־DNA באתר המטרה בעריכה גנטית'},
{id:22,answer:'Cas9',clue:'מולקולת RNA המכוונת את Cas9 אל רצף המטרה'},
{id:23,answer:'gRNA – RNA מנחה',clue:'החלק ב־RNA המנחה המשלים לרצף המטרה וקובע את הספציפיות'},
{id:24,answer:'Spacer – ספייסר',clue:'רצף קצר הסמוך לרצף המטרה ונדרש לפעילות Cas9'},
{id:25,answer:'PAM',clue:'תבנית DNA המשמשת לתיקון או להכנסת רצף רצוי לאחר החיתוך'},
{id:26,answer:'Donor DNA – DNA תורם',clue:'אנזים המחבר בין מקטעי DNA'},
{id:27,answer:'DNA ליגאז',clue:'מולקולת DNA המכילה מקטעים שמקורם במקורות שונים'},
{id:28,answer:'DNA רקומביננטי',clue:'מקטעי DNA באורכים ידועים המשמשים להשוואת גודל בהרצה בג׳ל'},
{id:29,answer:'סולם גדלים – DNA ladder',clue:'נשא גנטי המשמש להעברת DNA לתא'},
{id:30,answer:'וקטור',clue:'תרשים המתאר את מיקומי אתרי ההגבלה במולקולת DNA'},
{id:31,answer:'מפת הגבלה',clue:'קצוות DNA ללא בליטה חד־גדילית, הנוצרים בחיתוך ישר'},
{id:32,answer:'קצוות קהים',clue:'ביוטכנולוגיה זה ב־DNA שלך..'}
];

const tileBy=id=>tiles[id-1]||null;
async function room(code){return cache().get(roomKey(code));}
async function saveRoom(r){await cache().set(roomKey(r.code),r,{ttl:TTL});}
async function game(code){return (await cache().get(gameKey(code)))||{phase:'lobby',version:1,chainCount:0,chain:[],assignments:{},players:[],lastPlayer:''};}
async function save(code,g){await cache().set(gameKey(code),g,{ttl:TTL});}
async function roster(code){const shards=await Promise.all(Array.from({length:SHARDS},(_,i)=>cache().get(rosterKey(code,i))));const out=[];for(const s of shards)if(s)for(const p of Object.values(s))if(p&&p.id&&p.name)out.push(p);return out.sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0));}
async function join(code,id,name){const key=rosterKey(code,hash(id)%SHARDS);for(let a=0;a<5;a++){const cur=await cache().get(key)||{};const next={...cur,[id]:{id,name,joinedAt:cur[id]?.joinedAt||Date.now()}};await cache().set(key,next,{ttl:TTL});const v=await cache().get(key)||{};if(v[id])return v[id];await new Promise(r=>setTimeout(r,25+a*20));}throw new Error('join_race');}
async function clearRoster(code){await Promise.all(Array.from({length:SHARDS},(_,i)=>cache().delete(rosterKey(code,i))));}
function publicState(g){const last=g.chainCount?tileBy(g.chainCount):null;return{phase:g.phase,version:g.version||1,chainCount:g.chainCount||0,chain:(g.chain||[]).map(tileBy).filter(Boolean),currentClue:last?.clue||'',lastPlayer:g.lastPlayer||''};}
function remainingIds(g){const used=new Set(g.chain||[]);const assigned=new Set(Object.values(g.assignments||{}).map(Number));return tiles.map(t=>t.id).filter(id=>id>1&&!used.has(id)&&!assigned.has(id));}
function ensureNext(g,lastPlayerId){const next=(g.chainCount||0)+1;if(next>32)return;const values=Object.values(g.assignments||{}).map(Number);if(values.includes(next))return;const holders=Object.keys(g.assignments||{});if(!holders.length)return;const choices=holders.filter(id=>id!==lastPlayerId);const target=(choices.length?choices:holders)[crypto.randomInt(choices.length||holders.length)];g.assignments[target]=next;}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    const b=req.method==='POST'?await body(req):{};
    const action=req.method==='POST'?clean(b.action,30):'';

    if(req.method==='POST'&&action==='create'){
      let code='';
      for(let i=0;i<10;i+=1){const c=newCode();if(!await room(c)){code=c;break;}}
      if(!code)return res.status(503).json({error:'code'});
      const now=Date.now();
      const r={code,teacherToken:crypto.randomBytes(24).toString('hex'),className:clean(b.className,60),createdAt:now,lastActiveAt:now};
      await saveRoom(r);
      await save(code,{phase:'lobby',version:1,chainCount:0,chain:[],assignments:{},players:[],lastPlayer:''});
      return res.status(201).json({code,teacherToken:r.teacherToken,className:r.className});
    }

    const code=clean(req.method==='GET'?req.query?.code:(b.code||''),10);
    if(!code)return res.status(400).json({error:'missing_code'});
    const r=await room(code);
    if(!r)return res.status(404).json({error:'room_not_found'});

    if(req.method==='GET'){
      const g=await game(code),teacher=sameToken(clean(req.query?.teacherToken,120),r.teacherToken),id=clean(req.query?.playerId,140);
      const livePlayers=g.phase==='lobby'?await roster(code):(g.players||[]);
      const out={...publicState(g),teacher,className:r.className||'',players:livePlayers.map(p=>({id:p.id,name:p.name}))};
      if(id){const p=livePlayers.find(x=>x.id===id);out.joined=Boolean(p);out.myTile=g.assignments?.[id]?tileBy(g.assignments[id]):null;}
      return res.json(out);
    }

    if(req.method!=='POST')return res.status(405).json({error:'method'});
    const g=await game(code);

    if(action==='join'){
      if(g.phase!=='lobby')return res.status(409).json({error:'game_started'});
      const id=clean(b.playerId,140),name=clean(b.name,24);
      if(!id||!name)return res.status(400).json({error:'bad_player'});
      await join(code,id,name);
      g.version=(g.version||1)+1;
      await save(code,g);
      r.lastActiveAt=Date.now();await saveRoom(r);
      return res.json({ok:true});
    }

    if(action==='play'){
      if(g.phase!=='playing')return res.status(409).json({error:'not_playing'});
      const id=clean(b.playerId,140),assigned=Number(g.assignments?.[id]||0),needed=(g.chainCount||0)+1;
      if(!assigned)return res.status(409).json({error:'no_tile'});
      if(assigned!==needed)return res.json({correct:false});
      const player=(g.players||[]).find(p=>p.id===id);
      g.chainCount=needed;g.chain=[...(g.chain||[]),needed];g.lastPlayer=player?.name||'';
      delete g.assignments[id];
      if(needed>=32){g.phase='complete';}
      else{
        const pool=remainingIds(g);
        if(pool.length)g.assignments[id]=pool[crypto.randomInt(pool.length)];
        ensureNext(g,id);
      }
      g.version=(g.version||1)+1;
      await save(code,g);
      r.lastActiveAt=Date.now();await saveRoom(r);
      return res.json({correct:true,complete:g.phase==='complete'});
    }

    if(!sameToken(clean(b.teacherToken,120),r.teacherToken))return res.status(403).json({error:'teacher_auth_failed'});

    if(action==='start'){
      const all=await roster(code);
      if(!all.length)return res.status(409).json({error:'no_players'});
      const players=shuffle(all);
      const active=players.slice(0,Math.min(players.length,31));
      const rest=shuffle(tiles.slice(2).map(t=>t.id));
      const deal=[2,...rest].slice(0,active.length);
      const assignments={};active.forEach((p,i)=>assignments[p.id]=deal[i]);
      const ng={phase:'playing',version:(g.version||1)+1,chainCount:1,chain:[1],assignments,players,lastPlayer:''};
      await save(code,ng);r.lastActiveAt=Date.now();await saveRoom(r);
      return res.json({ok:true});
    }

    if(action==='reset'){
      const ng={phase:'lobby',version:(g.version||1)+1,chainCount:0,chain:[],assignments:{},players:[],lastPlayer:''};
      await save(code,ng);r.lastActiveAt=Date.now();await saveRoom(r);
      return res.json({ok:true});
    }

    if(action==='newRoster'){
      await clearRoster(code);
      const ng={phase:'lobby',version:(g.version||1)+1,chainCount:0,chain:[],assignments:{},players:[],lastPlayer:''};
      await save(code,ng);r.lastActiveAt=Date.now();await saveRoom(r);
      return res.json({ok:true});
    }

    return res.status(400).json({error:'action'});
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
}
