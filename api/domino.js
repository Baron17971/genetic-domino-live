import { getCache } from '@vercel/functions';
import crypto from 'node:crypto';

const TTL=2592000;
const NS='generic-pairs-domino-v1';
const SHARDS=16;
const cache=()=>getCache(undefined,NS);
const roomKey=c=>'r:'+c;
const gameKey=c=>'d:'+c;
const rosterKey=(c,n)=>'dr:'+c+':'+n;
const clean=(v,max=220)=>typeof v==='string'?v.replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max):'';
const newCode=()=>String(crypto.randomInt(100000,1000000));
function hash(value){let r=2166136261;for(const c of value){r^=c.charCodeAt(0);r=Math.imul(r,16777619);}return r>>>0;}
function sameToken(a,b){if(!a||!b)return false;const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);}
async function body(req){if(req.body&&typeof req.body==='object')return req.body;const chunks=[];for await(const c of req)chunks.push(c);try{return JSON.parse(Buffer.concat(chunks).toString());}catch{return {};}}
function shuffle(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=crypto.randomInt(i+1);[x[i],x[j]]=[x[j],x[i]];}return x;}
function normalisePairs(raw){
 if(!Array.isArray(raw)) return [];
 return raw.map(p=>({left:clean(p?.left,100),right:clean(p?.right,160)})).filter(p=>p.left&&p.right).slice(0,40);
}
function makeTiles(pairs){
 if(!pairs.length)return[];
 const tiles=[{id:1,left:'התחלה',right:pairs[0].right}];
 for(let i=0;i<pairs.length-1;i++)tiles.push({id:i+2,left:pairs[i].left,right:pairs[i+1].right});
 tiles.push({id:pairs.length+1,left:pairs[pairs.length-1].left,right:'סיום'});
 return tiles;
}
async function room(code){return cache().get(roomKey(code));}
async function saveRoom(r){await cache().set(roomKey(r.code),r,{ttl:TTL});}
async function game(code){return (await cache().get(gameKey(code)))||{phase:'lobby',version:1,chainCount:0,chain:[],assignments:{},players:[],lastPlayer:''};}
async function save(code,g){await cache().set(gameKey(code),g,{ttl:TTL});}
async function roster(code){const shards=await Promise.all(Array.from({length:SHARDS},(_,i)=>cache().get(rosterKey(code,i))));const out=[];for(const s of shards)if(s)for(const p of Object.values(s))if(p&&p.id&&p.name)out.push(p);return out.sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0));}
async function join(code,id,name){const key=rosterKey(code,hash(id)%SHARDS);for(let a=0;a<5;a++){const cur=await cache().get(key)||{};const next={...cur,[id]:{id,name,joinedAt:cur[id]?.joinedAt||Date.now()}};await cache().set(key,next,{ttl:TTL});const v=await cache().get(key)||{};if(v[id])return v[id];await new Promise(r=>setTimeout(r,25+a*20));}throw new Error('join_race');}
async function clearRoster(code){await Promise.all(Array.from({length:SHARDS},(_,i)=>cache().delete(rosterKey(code,i))));}
function tileBy(tiles,id){return tiles[Number(id)-1]||null;}
function publicState(g,tiles){const last=g.chainCount?tileBy(tiles,g.chainCount):null;return{phase:g.phase,version:g.version||1,chainCount:g.chainCount||0,chain:(g.chain||[]).map(id=>tileBy(tiles,id)).filter(Boolean),currentClue:last?.right||'',lastPlayer:g.lastPlayer||'',tileCount:tiles.length};}
function remainingIds(g,tiles){const used=new Set(g.chain||[]);const assigned=new Set(Object.values(g.assignments||{}).map(Number));return tiles.map(t=>t.id).filter(id=>id>1&&!used.has(id)&&!assigned.has(id));}
function ensureNext(g,lastPlayerId,tiles){const next=(g.chainCount||0)+1;if(next>tiles.length)return;const values=Object.values(g.assignments||{}).map(Number);if(values.includes(next))return;const holders=Object.keys(g.assignments||{});if(!holders.length)return;const choices=holders.filter(id=>id!==lastPlayerId);const pool=choices.length?choices:holders;g.assignments[pool[crypto.randomInt(pool.length)]]=next;}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  const b=req.method==='POST'?await body(req):{};
  const action=req.method==='POST'?clean(b.action,30):'';
  if(req.method==='POST'&&action==='create'){
   const allPairs=normalisePairs(b.pairs);
   const requestedPairs=Math.max(4,Math.min(40,Number(b.requestedPairs)||20));
   if(allPairs.length<requestedPairs)return res.status(400).json({error:'not_enough_pairs'});
   const pairs=allPairs.slice(0,requestedPairs);
   let code='';for(let i=0;i<10;i++){const c=newCode();if(!await room(c)){code=c;break;}}
   if(!code)return res.status(503).json({error:'code'});
   const now=Date.now();
   const r={code,teacherToken:crypto.randomBytes(24).toString('hex'),className:clean(b.className,60),title:clean(b.title,80)||'דומינו זוגות',pairs,createdAt:now,lastActiveAt:now};
   await saveRoom(r);await save(code,{phase:'lobby',version:1,chainCount:0,chain:[],assignments:{},players:[],lastPlayer:''});
   return res.status(201).json({code,teacherToken:r.teacherToken,className:r.className,title:r.title});
  }
  const code=clean(req.method==='GET'?req.query?.code:(b.code||''),10);
  if(!code)return res.status(400).json({error:'missing_code'});
  const r=await room(code);if(!r)return res.status(404).json({error:'room_not_found'});
  const tiles=makeTiles(r.pairs||[]);
  if(req.method==='GET'){
   const g=await game(code),teacher=sameToken(clean(req.query?.teacherToken,120),r.teacherToken),id=clean(req.query?.playerId,140);
   const livePlayers=g.phase==='lobby'?await roster(code):(g.players||[]);
   const out={...publicState(g,tiles),teacher,className:r.className||'',title:r.title||'דומינו זוגות',pairCount:(r.pairs||[]).length,players:livePlayers.map(p=>({id:p.id,name:p.name}))};
   if(id){const p=livePlayers.find(x=>x.id===id);out.joined=Boolean(p);out.myTile=g.assignments?.[id]?tileBy(tiles,g.assignments[id]):null;}
   return res.json(out);
  }
  if(req.method!=='POST')return res.status(405).json({error:'method'});
  const g=await game(code);
  if(action==='join'){
   if(g.phase!=='lobby')return res.status(409).json({error:'game_started'});
   const id=clean(b.playerId,140),name=clean(b.name,24);if(!id||!name)return res.status(400).json({error:'bad_player'});
   await join(code,id,name);g.version=(g.version||1)+1;await save(code,g);r.lastActiveAt=Date.now();await saveRoom(r);return res.json({ok:true});
  }
  if(action==='play'){
   if(g.phase!=='playing')return res.status(409).json({error:'not_playing'});
   const id=clean(b.playerId,140),assigned=Number(g.assignments?.[id]||0),needed=(g.chainCount||0)+1;
   if(!assigned)return res.status(409).json({error:'no_tile'});
   if(assigned!==needed)return res.json({correct:false});
   const player=(g.players||[]).find(p=>p.id===id);
   g.chainCount=needed;g.chain=[...(g.chain||[]),needed];g.lastPlayer=player?.name||'';delete g.assignments[id];
   if(needed>=tiles.length)g.phase='complete';
   else{const pool=remainingIds(g,tiles);if(pool.length)g.assignments[id]=pool[crypto.randomInt(pool.length)];ensureNext(g,id,tiles);}
   g.version=(g.version||1)+1;await save(code,g);r.lastActiveAt=Date.now();await saveRoom(r);return res.json({correct:true,complete:g.phase==='complete'});
  }
  if(!sameToken(clean(b.teacherToken,120),r.teacherToken))return res.status(403).json({error:'teacher_auth_failed'});
  if(action==='start'){
   const all=await roster(code);if(!all.length)return res.status(409).json({error:'no_players'});
   const players=shuffle(all),active=players.slice(0,Math.min(players.length,tiles.length-1));
   const rest=shuffle(tiles.slice(2).map(t=>t.id)),deal=[2,...rest].slice(0,active.length),assignments={};active.forEach((p,i)=>assignments[p.id]=deal[i]);
   await save(code,{phase:'playing',version:(g.version||1)+1,chainCount:1,chain:[1],assignments,players,lastPlayer:''});r.lastActiveAt=Date.now();await saveRoom(r);return res.json({ok:true});
  }
  if(action==='reset'){await save(code,{phase:'lobby',version:(g.version||1)+1,chainCount:0,chain:[],assignments:{},players:[],lastPlayer:''});r.lastActiveAt=Date.now();await saveRoom(r);return res.json({ok:true});}
  if(action==='newRoster'){await clearRoster(code);await save(code,{phase:'lobby',version:(g.version||1)+1,chainCount:0,chain:[],assignments:{},players:[],lastPlayer:''});r.lastActiveAt=Date.now();await saveRoom(r);return res.json({ok:true});}
  return res.status(400).json({error:'action'});
 }catch(e){console.error(e);return res.status(500).json({error:'server_error'});}
}