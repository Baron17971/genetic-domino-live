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
 const color=i=>((i%4)+4)%4;
 const tiles=[{id:1,left:'התחלה',right:pairs[0].right,leftColor:3,rightColor:color(0)}];
 for(let i=0;i<pairs.length-1;i++)tiles.push({id:i+2,left:pairs[i].left,right:pairs[i+1].right,leftColor:color(i),rightColor:color(i+1)});
 const lastColor=color(pairs.length-1);tiles.push({id:pairs.length+1,left:pairs[pairs.length-1].left,right:'סיום',leftColor:lastColor,rightColor:(lastColor+1)%5});
 return tiles;
}
async function room(code){return cache().get(roomKey(code));}
async function saveRoom(r){await cache().set(roomKey(r.code),r,{ttl:TTL});}
async function game(code){return (await cache().get(gameKey(code)))||{phase:'lobby',version:1,chainCount:0,chain:[],assignments:{},players:[],lastPlayer:'',turnStartedAt:0,timeoutCount:0};}
async function save(code,g){await cache().set(gameKey(code),g,{ttl:TTL});}
async function roster(code){const shards=await Promise.all(Array.from({length:SHARDS},(_,i)=>cache().get(rosterKey(code,i))));const out=[];for(const s of shards)if(s)for(const p of Object.values(s))if(p&&p.id&&p.name)out.push(p);return out.sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0));}
async function join(code,id,name,playerToken,rawName,groupId=''){const key=rosterKey(code,hash(id)%SHARDS);for(let a=0;a<5;a++){const cur=await cache().get(key)||{};const next={...cur,[id]:{id,name,rawName:rawName||name,playerToken,groupId:clean(groupId,40),joinedAt:cur[id]?.joinedAt||Date.now()}};await cache().set(key,next,{ttl:TTL});const v=await cache().get(key)||{};if(v[id])return v[id];await new Promise(r=>setTimeout(r,25+a*20));}throw new Error('join_race');}
function sameName(a,b){return String(a||'').trim().toLocaleLowerCase('he-IL')===String(b||'').trim().toLocaleLowerCase('he-IL');}
function playerOK(p,t){return !!p&&(!p.playerToken||sameToken(clean(t,140),p.playerToken));}
async function clearRoster(code){await Promise.all(Array.from({length:SHARDS},(_,i)=>cache().delete(rosterKey(code,i))));}
function tileBy(tiles,id){return tiles[Number(id)-1]||null;}
function publicState(g,tiles){const last=g.chainCount?tileBy(tiles,g.chainCount):null;return{phase:g.phase,version:g.version||1,chainCount:g.chainCount||0,chain:(g.chain||[]).map(id=>tileBy(tiles,id)).filter(Boolean),currentClue:last?.right||'',lastPlayer:g.lastPlayer||'',tileCount:tiles.length,turnStartedAt:g.turnStartedAt||0,timeoutCount:g.timeoutCount||0};}
function remainingIds(g,tiles){const used=new Set(g.chain||[]);const assigned=new Set(Object.values(g.assignments||{}).map(Number));return tiles.map(t=>t.id).filter(id=>id>1&&!used.has(id)&&!assigned.has(id));}
function ensureNext(g,lastPlayerId,tiles){const next=(g.chainCount||0)+1;if(next>tiles.length)return;const values=Object.values(g.assignments||{}).map(Number);if(values.includes(next))return;const holders=Object.keys(g.assignments||{});if(!holders.length)return;const choices=holders.filter(id=>id!==lastPlayerId);const pool=choices.length?choices:holders;g.assignments[pool[crypto.randomInt(pool.length)]]=next;}
function rotateTimedOutTurn(g,tiles){
 if(g.phase!=='playing')return false;
 const next=(g.chainCount||0)+1;if(next>tiles.length)return false;
 const now=Date.now();if(!g.turnStartedAt){g.turnStartedAt=now;return true}
 if(now-g.turnStartedAt<15000)return false;
 const assignments=g.assignments||{};
 let holder=Object.keys(assignments).find(id=>Number(assignments[id])===next)||'';
 if(!holder){ensureNext(g,'',tiles);holder=Object.keys(assignments).find(id=>Number(assignments[id])===next)||''}
 const candidates=(g.players||[]).map(p=>p.id).filter(id=>id&&id!==holder);
 if(holder&&candidates.length){
  const target=candidates[crypto.randomInt(candidates.length)];
  const targetTile=assignments[target];
  assignments[target]=next;
  if(targetTile)assignments[holder]=targetTile;else delete assignments[holder];
 }
 g.turnStartedAt=now;g.timeoutCount=(g.timeoutCount||0)+1;g.version=(g.version||1)+1;
 return true;
}

function makeRunTeamState(team,players,tiles){
 const active=shuffle(players),assignments={};
 const rest=shuffle(tiles.slice(2).map(t=>t.id));
 const deal=[2,...rest].slice(0,Math.min(active.length,Math.max(0,tiles.length-1)));
 active.slice(0,deal.length).forEach((p,i)=>assignments[p.id]=deal[i]);
 return{id:team.id,name:team.name,phase:'playing',chainCount:1,chain:[1],assignments,players:active,lastPlayer:'',turnStartedAt:Date.now(),timeoutCount:0,finishedAt:0};
}
function runSummary(g,tiles){
 return Object.values(g.runTeams||{}).map(t=>({id:t.id,name:t.name,phase:t.phase||'playing',chainCount:t.chainCount||0,total:tiles.length,lastPlayer:t.lastPlayer||'',finishedAt:t.finishedAt||0,players:(t.players||[]).map(p=>({id:p.id,name:p.name,groupId:p.groupId||t.id}))}));
}
function runPlayerState(g,tiles,id){
 const team=Object.values(g.runTeams||{}).find(t=>(t.players||[]).some(p=>p.id===id));
 if(!team)return null;
 const last=team.chainCount?tileBy(tiles,team.chainCount):null;
 return{teamId:team.id,teamName:team.name,teamPhase:team.phase||'playing',teamChainCount:team.chainCount||0,teamTotal:tiles.length,currentClue:last?.right||'',myTile:team.assignments?.[id]?tileBy(tiles,team.assignments[id]):null,turnStartedAt:team.turnStartedAt||0,timeoutCount:team.timeoutCount||0};
}
function rotateRunTeam(team,tiles){
 if(!team||team.phase!=='playing')return false;
 return rotateTimedOutTurn(team,tiles);
}

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
   const allowedPalettes=new Set(['beach','classic','ocean','berry','earth']),allowedPatterns=new Set(['none','leaves','ribbons','hearts','flowers','sparkles','circles','softcorners','grid','dots','wave','grain','corners']);const palette=allowedPalettes.has(clean(b.palette,20))?clean(b.palette,20):'beach',pattern=allowedPatterns.has(clean(b.pattern,20))?clean(b.pattern,20):'leaves';const mode=clean(b.mode,20)==='run'?'run':'classic';const rawGroups=Array.isArray(b.groups)?b.groups:[];const groups=mode==='run'?rawGroups.slice(0,4).map((x,i)=>({id:'g'+(i+1),name:clean(x?.name||x,24)||('קבוצה '+(i+1))})).filter(Boolean):[];while(mode==='run'&&groups.length<2)groups.push({id:'g'+(groups.length+1),name:'קבוצה '+(groups.length+1)});const r={code,teacherToken:crypto.randomBytes(24).toString('hex'),className:clean(b.className,60),subject:clean(b.subject,60),topic:clean(b.topic,80),title:clean(b.title,80)||'דומינו זוגות',palette,pattern,mode,groups,pairs,createdAt:now,lastActiveAt:now};
   await saveRoom(r);await save(code,{phase:'lobby',version:1,chainCount:0,chain:[],assignments:{},players:[],lastPlayer:'',turnStartedAt:0,timeoutCount:0});
   return res.status(201).json({code,teacherToken:r.teacherToken,className:r.className,title:r.title});
  }
  const code=clean(req.method==='GET'?req.query?.code:(b.code||''),10);
  if(!code)return res.status(400).json({error:'missing_code'});
  const r=await room(code);if(!r)return res.status(404).json({error:'room_not_found'});
  const tiles=makeTiles(r.pairs||[]);
  if(req.method==='GET'){
   const g=await game(code),teacher=sameToken(clean(req.query?.teacherToken,120),r.teacherToken),id=clean(req.query?.playerId,140);
   const mode=r.mode==='run'?'run':'classic';
   const livePlayers=g.phase==='lobby'?await roster(code):(mode==='run'?Object.values(g.runTeams||{}).flatMap(t=>t.players||[]):(g.players||[]));
   const out={...publicState(g,tiles),teacher,className:r.className||'',title:r.title||'דומינו זוגות',subject:r.subject||'',topic:r.topic||r.title||'',palette:r.palette||'beach',pattern:r.pattern||'leaves',pairCount:(r.pairs||[]).length,mode,groups:r.groups||[],players:livePlayers.map(p=>({id:p.id,name:p.name,groupId:p.groupId||''}))};
   if(teacher&&String(req.query?.preview||'')==='1')out.previewTile=tiles[1]||tiles[0]||null;
   if(mode==='run'){
    out.runTeams=runSummary(g,tiles);
    out.winnerTeamId=g.winnerTeamId||'';
    out.winnerTeamName=g.winnerTeamName||'';
    if(id){
      const p=livePlayers.find(x=>x.id===id),playerToken=clean(req.query?.playerToken,140);
      out.joined=Boolean(p&&playerOK(p,playerToken));
      if(out.joined){out.playerName=p.name||'';out.groupId=p.groupId||'';out.teamName=(r.groups||[]).find(x=>x.id===p.groupId)?.name||'';const ps=runPlayerState(g,tiles,id);if(ps)Object.assign(out,ps);}
    }
    if(!teacher&&id){out.chain=[];out.chainCount=out.teamChainCount||0;}
    out.currentClue=(id&&out.currentClue)||'';
   }else if(id){const p=livePlayers.find(x=>x.id===id),playerToken=clean(req.query?.playerToken,140);out.joined=Boolean(p&&playerOK(p,playerToken));out.playerName=out.joined?(p.name||''):'';out.myTile=out.joined&&g.assignments?.[id]?tileBy(tiles,g.assignments[id]):null;}
   return res.json(out);
  }
  if(req.method!=='POST')return res.status(405).json({error:'method'});
  const g=await game(code);
  if(action==='join'){
   if(g.phase!=='lobby')return res.status(409).json({error:'game_started'});
   const rawName=clean(b.name,24);if(!rawName)return res.status(400).json({error:'bad_player'});
   const groupId=r.mode==='run'?clean(b.groupId,40):'';if(r.mode==='run'&&!(r.groups||[]).some(x=>x.id===groupId))return res.status(400).json({error:'bad_group'});
   const existing=await roster(code),same=existing.filter(p=>sameName(p.rawName||p.name,rawName)).length;
   const name=same===0?rawName:`${rawName} (${same+1})`,id=crypto.randomUUID(),playerToken=crypto.randomBytes(24).toString('hex');
   await join(code,id,name,playerToken,rawName,groupId);g.version=(g.version||1)+1;await save(code,g);r.lastActiveAt=Date.now();await saveRoom(r);
   return res.json({ok:true,playerId:id,playerToken,displayName:name});
  }
  if(action==='play'){
   if(g.phase!=='playing')return res.status(409).json({error:'not_playing'});
   const id=clean(b.playerId,140);
   const pAuth=(g.players||[]).find(p=>p.id===id)||Object.values(g.runTeams||{}).flatMap(t=>t.players||[]).find(p=>p.id===id)||(await roster(code)).find(p=>p.id===id);
   if(!playerOK(pAuth,b.playerToken))return res.status(403).json({error:'forbidden'});
   if(r.mode==='run'){
    const team=Object.values(g.runTeams||{}).find(t=>(t.players||[]).some(p=>p.id===id));
    if(!team)return res.status(409).json({error:'no_team'});
    const assigned=Number(team.assignments?.[id]||0),needed=(team.chainCount||0)+1;
    if(!assigned)return res.status(409).json({error:'no_tile'});
    if(assigned!==needed)return res.json({correct:false});
    const player=(team.players||[]).find(p=>p.id===id);
    team.chainCount=needed;team.chain=[...(team.chain||[]),needed];team.lastPlayer=player?.name||'';team.turnStartedAt=Date.now();delete team.assignments[id];
    if(needed>=tiles.length){team.phase='complete';team.finishedAt=Date.now();if(!g.winnerTeamId){g.winnerTeamId=team.id;g.winnerTeamName=team.name;}}
    else{const pool=remainingIds(team,tiles);if(pool.length)team.assignments[id]=pool[crypto.randomInt(pool.length)];ensureNext(team,id,tiles);}
    if(Object.values(g.runTeams||{}).every(t=>t.phase==='complete'))g.phase='complete';
    g.version=(g.version||1)+1;await save(code,g);r.lastActiveAt=Date.now();await saveRoom(r);return res.json({correct:true,complete:team.phase==='complete',teamId:team.id});
   }
   const assigned=Number(g.assignments?.[id]||0),needed=(g.chainCount||0)+1;
   if(!assigned)return res.status(409).json({error:'no_tile'});
   if(assigned!==needed)return res.json({correct:false});
   const player=(g.players||[]).find(p=>p.id===id);
   g.chainCount=needed;g.chain=[...(g.chain||[]),needed];g.lastPlayer=player?.name||'';g.turnStartedAt=Date.now();delete g.assignments[id];
   if(needed>=tiles.length)g.phase='complete';
   else{const pool=remainingIds(g,tiles);if(pool.length)g.assignments[id]=pool[crypto.randomInt(pool.length)];ensureNext(g,id,tiles);}
   g.version=(g.version||1)+1;await save(code,g);r.lastActiveAt=Date.now();await saveRoom(r);return res.json({correct:true,complete:g.phase==='complete'});
  }
  if(!sameToken(clean(b.teacherToken,120),r.teacherToken))return res.status(403).json({error:'teacher_auth_failed'});
  if(action==='tick'){
   let changed=false;
   if(r.mode==='run'){for(const t of Object.values(g.runTeams||{}))if(rotateRunTeam(t,tiles))changed=true;if(changed)g.version=(g.version||1)+1;}
   else changed=rotateTimedOutTurn(g,tiles);
   if(changed){await save(code,g);r.lastActiveAt=Date.now();await saveRoom(r)}
   return res.json({ok:true,rotated:changed,version:g.version||1,turnStartedAt:g.turnStartedAt||0});
  }
  if(action==='start'){
   const all=await roster(code);if(!all.length)return res.status(409).json({error:'no_players'});
   if(r.mode==='run'){
    const runTeams={};
    for(const team of (r.groups||[])){const ps=all.filter(p=>p.groupId===team.id);if(!ps.length)return res.status(409).json({error:'empty_group',groupId:team.id});runTeams[team.id]=makeRunTeamState(team,ps,tiles);}
    await save(code,{phase:'playing',version:(g.version||1)+1,chainCount:0,chain:[],assignments:{},players:all,runTeams,lastPlayer:'',turnStartedAt:Date.now(),timeoutCount:0,winnerTeamId:'',winnerTeamName:''});r.lastActiveAt=Date.now();await saveRoom(r);return res.json({ok:true});
   }
   const players=shuffle(all),active=players.slice(0,Math.min(players.length,tiles.length-1));
   const rest=shuffle(tiles.slice(2).map(t=>t.id)),deal=[2,...rest].slice(0,active.length),assignments={};active.forEach((p,i)=>assignments[p.id]=deal[i]);
   await save(code,{phase:'playing',version:(g.version||1)+1,chainCount:1,chain:[1],assignments,players,lastPlayer:'',turnStartedAt:Date.now(),timeoutCount:0});r.lastActiveAt=Date.now();await saveRoom(r);return res.json({ok:true});
  }
  if(action==='reset'){await save(code,{phase:'lobby',version:(g.version||1)+1,chainCount:0,chain:[],assignments:{},players:[],lastPlayer:'',turnStartedAt:0,timeoutCount:0});r.lastActiveAt=Date.now();await saveRoom(r);return res.json({ok:true});}
  if(action==='newRoster'){await clearRoster(code);await save(code,{phase:'lobby',version:(g.version||1)+1,chainCount:0,chain:[],assignments:{},players:[],lastPlayer:'',turnStartedAt:0,timeoutCount:0});r.lastActiveAt=Date.now();await saveRoom(r);return res.json({ok:true});}
  return res.status(400).json({error:'action'});
 }catch(e){console.error(e);return res.status(500).json({error:'server_error'});}
}