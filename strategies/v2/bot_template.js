#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { appendFileSync } from 'node:fs';
export const VERSION = 'lpc-v2-miner-priority';
import { runBot, isMarsView } from './bot_client.js';

// Tune only after comparing several practice seeds.
export const CONFIG = { targetWorkers: 3, targetSelection: 'nearest', returnBuffer: 2, explorationWeight: 0.045 };
let memory;
const directions = ['north-west','north','north-east','west',null,'east','south-west','south','south-east'];
const same = (a,b) => a.x === b.x && a.y === b.y;

export function calculateActions(state, identity) {
  if (!isMarsView(state.view)) return {};
  const v = state.view, team = identity.teamId, map = v.map, n = map.cells.length;
  const id = p => p.y * map.width + p.x;
  const point = i => ({x:i % map.width,y:Math.floor(i / map.width)});
  if (!memory || memory.match !== state.match.matchId || v.turn < memory.turn) {
    memory = {match:state.match.matchId, turn:v.turn, cells:Array(n).fill(null), seen:Array(n).fill(-1), bases:new Map(), returning:new Set()};
  }
  memory.turn = v.turn;
  map.cells.forEach((c,i) => { if (c.type !== 'hidden') { memory.cells[i] = {...c}; memory.seen[i] = v.turn; } });
  for (const b of v.bases) memory.bases.set(id(b.position),b);
  const bases = [...memory.bases.values()];
  const home = bases.filter(b => b.teamId === team);
  const blocked = new Set(bases.filter(b => b.teamId !== team).map(b => id(b.position)));
  const cost = i => ['mountain','crater'].includes(memory.cells[i]?.type) ? 3 : 1;
  const allowed = i => memory.cells[i] && !['hidden','void'].includes(memory.cells[i].type) && !blocked.has(i);
  function neighbors(i) {
    const p = point(i), out = [];
    for (let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
      const x=p.x+dx,y=p.y+dy;
      if ((dx || dy) && x>=0 && y>=0 && x<map.width && y<map.height) out.push(y*map.width+x);
    }
    return out;
  }
  // Integer-cost Dijkstra: reverse traversal gives the exact cost TO a base.
  function routes(starts, reverse=false) {
    const dist=Array(n).fill(Infinity), first=Array(n).fill(-1), buckets=[];
    for(const s of starts) {dist[s]=0;(buckets[0] ??= []).push(s);}
    for(let d=0;d<buckets.length;d++) for(const u of buckets[d] ?? []) {
      if(dist[u]!==d) continue;
      for(const z of neighbors(u)) {
        if(!allowed(z)) continue;
        const next=d+(reverse?cost(u):cost(z));
        if(next>=dist[z]) continue;
        dist[z]=next;first[z]=reverse?u:(dist[u]===0?z:first[u]);
        (buckets[next] ??= []).push(z);
      }
    }
    return {dist,first};
  }
  const back=routes(home.map(b=>id(b.position)),true);
  const workers=v.units.filter(w=>w.teamId===team).sort((a,b)=> {
    // Ready miners reserve ore before workers who still need to travel.
    const miningPriority = w => {
      const c=memory.cells[id(w.position)], inv=w.inventory ?? {gold:0,iron:0};
      return v.turn>=w.readyOnTurn && c?.type==='gold' && c.amount>0 && inv.gold+inv.iron<(w.inventoryCapacity ?? 8) ? 1 : 0;
    };
    return miningPriority(b)-miningPriority(a) || a.unitId.localeCompare(b.unitId);
  });
  const actions={}, reserved=new Map();
  const remaining=state.match.maxTurns-v.turn;
  let iron=v.teamResources[team]?.iron ?? 0;
  let plannedWorkers=workers.length;
  const prices=[5,6,11,17,28,45,73];
  function move(w,next) {
    if(next<0) return {type:'pass'};
    const p=point(next),dx=Math.sign(p.x-w.position.x),dy=Math.sign(p.y-w.position.y);
    return {type:'move',direction:directions[(dy+1)*3+dx+1]};
  }
  for(const w of workers) {
    const here=id(w.position), inv=w.inventory ?? {gold:0,iron:0};
    const load=inv.gold+inv.iron, capacity=w.inventoryCapacity ?? 8;
    actions[w.unitId]={type:'pass'};
    if(v.turn<w.readyOnTurn) continue;
    if(load && home.some(b=>same(b.position,w.position))) {
      actions[w.unitId]={type:'deposit'};memory.returning.delete(w.unitId);continue;
    }
    if(!load) memory.returning.delete(w.unitId);
    if(load>=capacity || (load && remaining<=back.dist[here]+CONFIG.returnBuffer+1)) memory.returning.add(w.unitId);
    if(memory.returning.has(w.unitId)) {actions[w.unitId]=move(w,back.first[here]);continue;}
    // A deliberately limited opening investment: two extra workers, no iron chase yet.
    const price=prices[plannedWorkers-1] ?? Infinity;
    if(plannedWorkers<CONFIG.targetWorkers && iron>=price && remaining>120) {
      actions[w.unitId]={type:'spawn'};iron-=price;plannedWorkers++;continue;
    }
    const out=routes([here]);
    let best=-1,bestScore=0;
    for(let i=0;i<n;i++) {
      const c=memory.cells[i];
      if(c?.type!=='gold' || !(c.amount>0) || !Number.isFinite(out.dist[i]+back.dist[i])) continue;
      const p=point(i),claims=bases.filter(b=>Math.abs(b.position.x-p.x)+Math.abs(b.position.y-p.y)<=2);
      if(claims.length && !claims.some(b=>b.teamId===team)) continue;
      const qty=Math.min(capacity-load, c.amount-(reserved.get(i) ?? 0), remaining-out.dist[i]-back.dist[i]-1-CONFIG.returnBuffer);
      if(qty<=0) continue;
      const age=v.turn-memory.seen[i];
      const score=(inv.gold+qty)/(out.dist[i]+qty+back.dist[i]+1) / (1+age*0.025);
      const selectionScore = CONFIG.targetSelection === 'nearest' ? 1 / (out.dist[i]+1) : score;
      if(selectionScore>bestScore) {best=i;bestScore=selectionScore;}
    }
    // Compare another mining trip with banking the current load immediately.
    const bankRate=inv.gold/(back.dist[here]+1);
    if(load && (best<0 || (CONFIG.targetSelection === 'rate' && bankRate>bestScore))) {
      memory.returning.add(w.unitId);actions[w.unitId]=move(w,back.first[here]);continue;
    }
    if(best>=0) {
      reserved.set(best,(reserved.get(best) ?? 0)+Math.min(capacity-load,memory.cells[best].amount));
      actions[w.unitId]=best===here?{type:'mine'}:move(w,out.first[best]);continue;
    }
    // Explore known frontier tiles; never pretend unseen terrain is traversable.
    let frontier=-1, frontierScore=-Infinity;
    for(let i=0;i<n;i++) {
      if(!allowed(i) || !Number.isFinite(out.dist[i]) || out.dist[i]===0 || remaining<out.dist[i]+back.dist[i]+3) continue;
      const p=point(i);let unknown=0;
      for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++) {
        const x=p.x+dx,y=p.y+dy;
        if(Math.abs(dx)+Math.abs(dy)<=3 && x>=0 && y>=0 && x<map.width && y<map.height && !memory.cells[y*map.width+x]) unknown++;
      }
      if(!unknown) continue;
      const score=unknown/(out.dist[i]+2)-CONFIG.explorationWeight*back.dist[i]-(reserved.get(i) ?? 0)*5;
      if(score>frontierScore){frontier=i;frontierScore=score;}
    }
    if(frontier>=0){reserved.set(frontier,1);actions[w.unitId]=move(w,out.first[frontier]);}
  }
  return actions;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.error(`Starting ${VERSION}`);
  let logWarningShown=false;
  await runBot((state, identity) => {
    const actions=calculateActions(state, identity);
    if(isMarsView(state.view)) {
      const v=state.view;
      const record={version:VERSION,matchId:state.match.matchId,turn:v.turn,maxTurns:state.match.maxTurns,
        bank:v.teamResources[identity.teamId],scores:v.scores,
        workers:v.units.filter(w=>w.teamId===identity.teamId),bases:v.bases,
        visibleOre:v.map.cells.flatMap((c,i)=>['gold','iron'].includes(c.type)?[{x:i%v.map.width,y:Math.floor(i/v.map.width),...c}]:[]),
        actions,warnings:v.warnings,info:v.info,effects:v.effects};
      try { appendFileSync(new URL('./match-analysis.jsonl',import.meta.url),JSON.stringify(record)+'\n'); }
      catch(error) { if(!logWarningShown){console.error('Could not save analysis log:',error.message);logWarningShown=true;} }
    }
    return actions;
  }).catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
}
