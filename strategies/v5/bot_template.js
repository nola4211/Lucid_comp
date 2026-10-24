#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { appendFileSync } from 'node:fs';
export const VERSION = 'lpc-v5-reactive-experimental';
import { runBot, isMarsView } from './bot_client.js';

// Tune only after comparing several practice seeds.
export const CONFIG = { targetWorkers: 3, extraBase: true, coordinateOre: true, reactive: true, coordinateExploration: false, targetSelection: 'nearest', returnBuffer: 2, explorationWeight: 0.045 };
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
  memory.events=[];
  memory.goalHistory ??= new Map();
  map.cells.forEach((cell,i)=>{
    if(cell.type==='hidden')return;
    const previous=memory.cells[i];
    if(cell.type==='gold' && cell.amount>0 && (previous?.type!=='gold' || !(previous.amount>0)))
      memory.events.push({type:'gold_discovered',position:point(i),amount:cell.amount});
    if(previous?.type==='gold' && previous.amount>0 && (cell.type!=='gold' || !(cell.amount>0)))
      memory.events.push({type:'gold_depleted',position:point(i)});
  });
  for(const b of v.bases)if(b.teamId!==team && !memory.bases.has(id(b.position)))
    memory.events.push({type:'enemy_base_discovered',position:b.position});
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
  const eligibleOre = i => {
    const p=point(i),claims=bases.filter(b=>Math.abs(b.position.x-p.x)+Math.abs(b.position.y-p.y)<=2);
    return !claims.length || claims.some(b=>b.teamId===team);
  };
  // Only observed enemy miners affect this estimate; their future actions are unknown.
  const enemyMiners=new Map();
  for(const u of v.units)if(u.teamId!==team && memory.cells[id(u.position)]?.type==='gold') {
    const site=id(u.position);
    enemyMiners.set(site,[...(enemyMiners.get(site)??[]),u]);
  }
  const expectedStock=(site,travel) => {
    const stock=memory.cells[site]?.amount??0;
    if(!CONFIG.reactive)return stock;
    const competition=(enemyMiners.get(site)??[]).reduce((sum,u)=>sum+Math.max(0,travel-Math.max(0,u.readyOnTurn-v.turn)),0);
    return Math.max(0,stock-competition);
  };
  let iron=v.teamResources[team]?.iron ?? 0;
  // Re-evaluate the remaining cost of a construction project, ignoring sunk costs.
  if(CONFIG.reactive && memory.basePlan) {
    const plan=memory.basePlan,p=point(plan.site),builder=workers.find(w=>w.unitId===plan.builder);
    let reason=null;
    if(!builder)reason='builder_missing';
    else if(home.length!==1)reason='base_network_changed';
    else if(memory.cells[plan.site]?.type!=='empty' || bases.some(b=>id(b.position)===plan.site))reason='site_unavailable';
    else if(bases.some(b=>b.teamId!==team && Math.abs(b.position.x-p.x)+Math.abs(b.position.y-p.y)<=2))reason='enemy_claim';
    else {
      const fromBuilder=routes([id(builder.position)]),fromSite=routes([plan.site],true);
      const travel=fromBuilder.dist[plan.site];
      if(!Number.isFinite(travel))reason='site_unreachable';
      else {
        const savings=memory.cells.reduce((sum,c,i)=> {
          if(c?.type!=='gold' || !(c.amount>0) || v.turn-memory.seen[i]>30 || !Number.isFinite(back.dist[i]+fromSite.dist[i]))return sum;
          const orePoint=point(i);
          if(!eligibleOre(i) && Math.abs(orePoint.x-p.x)+Math.abs(orePoint.y-p.y)>2)return sum;
          return sum+2*Math.max(0,back.dist[i]-fromSite.dist[i])*c.amount/8;
        },0);
        const carried=workers.reduce((sum,w)=>sum+(w.inventory?.iron??0),0);
        const needed=Math.max(0,6-iron-carried);
        const stillOwed=travel+1+(needed?24+needed:0)+(carried && iron<6?4:0);
        if(savings<=1.5*stillOwed)reason='insufficient_remaining_gold';
      }
    }
    if(reason){memory.events.push({type:'base_plan_cancelled',reason,position:p});memory.basePlan=null;}
  }
  // Only one extra base, only during the first half, and only on observed evidence.
  let investment = null;
  if(CONFIG.extraBase && home.length===1 && workers.length>=CONFIG.targetWorkers && remaining>240 && v.turn%12===0 && (!memory.basePlan || v.turn-memory.basePlan.created>36)) {
    const gold=memory.cells.flatMap((c,i)=>c?.type==='gold' && c.amount>0 && v.turn-memory.seen[i]<=30 ? [{i,amount:c.amount}]:[]);
    const sites=new Set();
    for(const g of gold) {
      const p=point(g.i);
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++) {
        const x=p.x+dx,y=p.y+dy;
        if(Math.abs(dx)+Math.abs(dy)>2 || x<0 || y<0 || x>=map.width || y>=map.height)continue;
        const i=y*map.width+x;
        if(memory.cells[i]?.type!=='empty' || bases.some(b=>id(b.position)===i) || back.dist[i]<6)continue;
        if(bases.some(b=>b.teamId!==team && Math.abs(b.position.x-x)+Math.abs(b.position.y-y)<=2))continue;
        sites.add(i);
      }
    }
    const cheb=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
    const ranked=[...sites].map(site=>({site,rough:gold.reduce((sum,g)=>sum+2*Math.max(0,back.dist[g.i]-cheb(point(g.i),point(site)))*g.amount/8,0)})).sort((a,b)=>b.rough-a.rough).slice(0,3);
    let bestNet=0;
    for(const {site} of ranked) {
      const siteRoutes=routes([site],true);
      const savings=gold.reduce((sum,g)=>{
        const a=point(g.i),b=point(site);
        if(CONFIG.reactive && (!Number.isFinite(back.dist[g.i]+siteRoutes.dist[g.i]) || (!eligibleOre(g.i) && Math.abs(a.x-b.x)+Math.abs(a.y-b.y)>2)))return sum;
        return sum+2*Math.max(0,back.dist[g.i]-siteRoutes.dist[g.i])*g.amount/8;
      },0);
      const builders=workers.filter(w=>(w.inventory?.gold??0)+(w.inventory?.iron??0)===0 && v.turn>=w.readyOnTurn);
      for(const w of builders) {
        const outbound=routes([id(w.position)]).dist[site];
        const needed=Math.max(0,6-iron);
        // Charge setup a conservative iron-trip allowance in addition to builder travel.
        const setup=outbound+1+(needed?24+needed:0);
        const net=savings-1.5*setup;
        if(net>bestNet && outbound<remaining/4) {bestNet=net;investment={site,builder:w.unitId,created:v.turn};}
      }
    }
    memory.basePlan=investment;
  }
  if(home.length!==1 || remaining<=240 || (memory.basePlan && v.turn-memory.basePlan.created>36)) memory.basePlan=null;
  investment=memory.basePlan;
  let ironCollector=null,ironTarget=-1;
  const carriedIron=workers.reduce((sum,w)=>sum+(w.inventory?.iron??0),0);
  if(investment && iron+carriedIron<6) {
    let bestCost=Infinity;
    for(const w of workers) {
      if((w.inventory?.gold??0)>0 || v.turn<w.readyOnTurn)continue;
      const out=routes([id(w.position)]);
      for(let i=0;i<n;i++) {
        if(memory.cells[i]?.type!=='iron' || !(memory.cells[i].amount>0) || v.turn-memory.seen[i]>30)continue;
        const p=point(i),claims=bases.filter(b=>Math.abs(b.position.x-p.x)+Math.abs(b.position.y-p.y)<=2);
        if(claims.length && !claims.some(b=>b.teamId===team))continue;
        const total=out.dist[i]+back.dist[i];
        if(total<bestCost && total<=24){bestCost=total;ironCollector=w.unitId;ironTarget=i;}
      }
    }
  }
  const oreAssignments=new Map(), claimedOre=new Map();
  const workerRoutes=new Map();
  const goldSites=[];
  for(let i=0;i<n;i++) {
    const c=memory.cells[i];
    if(c?.type!=='gold' || !(c.amount>0))continue;
    const p=point(i),claims=bases.filter(b=>Math.abs(b.position.x-p.x)+Math.abs(b.position.y-p.y)<=2);
    if(claims.length && !claims.some(b=>b.teamId===team))continue;
    goldSites.push(i);
  }
  if(CONFIG.coordinateOre) {
    const pairs=[];
    for(const w of workers) {
      const here=id(w.position),inv=w.inventory??{gold:0,iron:0},load=inv.gold+inv.iron,cap=w.inventoryCapacity??8;
      if(v.turn<w.readyOnTurn || load>=cap || memory.returning.has(w.unitId) || w.unitId===ironCollector ||
        (investment && w.unitId===investment.builder && iron>=6 && !load) ||
        (load && home.some(b=>same(b.position,w.position))) || (load && remaining<=back.dist[here]+CONFIG.returnBuffer+1))continue;
      const out=routes([here]);workerRoutes.set(w.unitId,out);
      for(const site of goldSites) {
        const qty=Math.min(cap-load,expectedStock(site,out.dist[site]),remaining-out.dist[site]-back.dist[site]-1-CONFIG.returnBuffer);
        if(qty<=0 || !Number.isFinite(out.dist[site]+back.dist[site]))continue;
        const old=CONFIG.reactive?memory.goalHistory.get(w.unitId):memory.oreGoals?.get(w.unitId);
        // A small commitment bonus avoids swapping two nearby workers every turn.
        const commitment=CONFIG.reactive?Math.max(2,Math.min(5,out.dist[site]*0.25)):1.5;
        const priority=out.dist[site]-(old===site?commitment:0)-(site===here?10000:0);
        pairs.push({worker:w.unitId,site,priority,room:cap-load,travel:out.dist[site]});
      }
    }
    pairs.sort((a,b)=>a.priority-b.priority || a.worker.localeCompare(b.worker));
    for(const pair of pairs) {
      if(oreAssignments.has(pair.worker))continue;
      const stock=expectedStock(pair.site,pair.travel)-(claimedOre.get(pair.site)??0);
      if(stock<=0)continue;
      oreAssignments.set(pair.worker,pair.site);
      claimedOre.set(pair.site,(claimedOre.get(pair.site)??0)+Math.min(stock,pair.room));
    }
    if(CONFIG.reactive) {
      for(const w of workers) {
        const old=memory.goalHistory.get(w.unitId),next=oreAssignments.get(w.unitId);
        const oldValid=old!==undefined && memory.cells[old]?.type==='gold' && memory.cells[old].amount>0 && eligibleOre(old) && !blocked.has(old) && (!workerRoutes.has(w.unitId) || Number.isFinite(workerRoutes.get(w.unitId).dist[old]));
        if(next!==undefined) {
          if(old!==undefined && old!==next)memory.events.push({type:'worker_reassigned',worker:w.unitId,from:point(old),to:point(next),reason:oldValid?'closer_or_less_contested_opportunity':'old_target_invalid'});
          memory.goalHistory.set(w.unitId,next);
        } else if(!oldValid) {
          if(old!==undefined)memory.events.push({type:'target_invalidated',worker:w.unitId,position:point(old)});
          memory.goalHistory.delete(w.unitId);
        }
      }
    }
    memory.oreGoals=oreAssignments;
  }
  const explorationFootprint=new Set();
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
    if(investment && inv.iron>0 && (iron+carriedIron>=6 || !ironCollector)) {
      memory.returning.add(w.unitId);actions[w.unitId]=move(w,back.first[here]);continue;
    }
    if(w.unitId===ironCollector && ironTarget>=0) {
      const out=routes([here]);actions[w.unitId]=here===ironTarget?{type:'mine'}:move(w,out.first[ironTarget]);continue;
    }
    if(investment && w.unitId===investment.builder && iron>=6 && !load) {
      const site=investment.site,p=point(site);
      const legal=memory.cells[site]?.type==='empty' && !bases.some(b=>id(b.position)===site) && !bases.some(b=>b.teamId!==team && Math.abs(b.position.x-p.x)+Math.abs(b.position.y-p.y)<=2);
      if(legal) {
        if(here===site) {
          if(!v.units.some(other=>other.unitId!==w.unitId && same(other.position,w.position))) {actions[w.unitId]={type:'build-base'};iron-=6;continue;}
        } else {const out=routes([here]);if(Number.isFinite(out.dist[site])){actions[w.unitId]=move(w,out.first[site]);continue;}}
      }
    }
    // Opening recruitment remains unchanged.
    const price=prices[plannedWorkers-1] ?? Infinity;
    if(plannedWorkers<CONFIG.targetWorkers && iron>=price && remaining>120) {
      actions[w.unitId]={type:'spawn'};iron-=price;plannedWorkers++;continue;
    }
    const out=workerRoutes.get(w.unitId)??routes([here]);
    let best=-1,bestScore=0;
    for(let i=0;i<n;i++) {
      if(CONFIG.coordinateOre && oreAssignments.get(w.unitId)!==i)continue;
      const c=memory.cells[i];
      if(c?.type!=='gold' || !(c.amount>0) || !Number.isFinite(out.dist[i]+back.dist[i])) continue;
      const p=point(i),claims=bases.filter(b=>Math.abs(b.position.x-p.x)+Math.abs(b.position.y-p.y)<=2);
      if(claims.length && !claims.some(b=>b.teamId===team)) continue;
      const qty=Math.min(capacity-load, expectedStock(i,out.dist[i])-(reserved.get(i) ?? 0), remaining-out.dist[i]-back.dist[i]-1-CONFIG.returnBuffer);
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
        if(Math.abs(dx)+Math.abs(dy)<=3 && x>=0 && y>=0 && x<map.width && y<map.height && !memory.cells[y*map.width+x] && (!CONFIG.coordinateExploration || !explorationFootprint.has(y*map.width+x))) unknown++;
      }
      if(!unknown) continue;
      const score=unknown/(out.dist[i]+2)-CONFIG.explorationWeight*back.dist[i]-(reserved.get(i) ?? 0)*5;
      if(score>frontierScore){frontier=i;frontierScore=score;}
    }
    if(CONFIG.reactive && frontier<0 && remaining>12) {
      let patrolScore=0;
      for(let i=0;i<n;i++) {
        if(!allowed(i) || out.dist[i]<=0 || !Number.isFinite(out.dist[i]+back.dist[i]) || remaining<out.dist[i]+back.dist[i]+4)continue;
        const p=point(i);let staleness=0;
        for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++) {
          const x=p.x+dx,y=p.y+dy;
          if(Math.abs(dx)+Math.abs(dy)>3 || x<0 || y<0 || x>=map.width || y>=map.height)continue;
          const j=y*map.width+x;
          if(memory.seen[j]>=0 && v.turn-memory.seen[j]>45)staleness+=Math.min(1,(v.turn-memory.seen[j]-45)/90);
        }
        const score=staleness/(out.dist[i]+3)-(reserved.get(i)??0)*5;
        if(score>patrolScore){patrolScore=score;frontier=i;}
      }
      if(frontier>=0)memory.events.push({type:'recheck_old_ground',worker:w.unitId,position:point(frontier)});
    }
    if(frontier>=0){
      reserved.set(frontier,1);actions[w.unitId]=move(w,out.first[frontier]);
      if(CONFIG.coordinateExploration){const p=point(frontier);
        for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++) {
          const x=p.x+dx,y=p.y+dy;
          if(Math.abs(dx)+Math.abs(dy)<=3 && x>=0 && y>=0 && x<map.width && y<map.height)explorationFootprint.add(y*map.width+x);
        }
      }
    }
  }
  // Movement resolves before construction: do not send a teammate onto a build site.
  for(const builder of workers) {
    if(actions[builder.unitId]?.type!=='build-base')continue;
    const occupied=workers.some(other=>{
      if(other.unitId===builder.unitId)return false;
      const action=actions[other.unitId];let future=other.position;
      if(action?.type==='move') {
        const index=directions.indexOf(action.direction);
        if(index>=0)future={x:other.position.x+(index%3)-1,y:other.position.y+Math.floor(index/3)-1};
      }
      return same(future,builder.position);
    });
    if(occupied)actions[builder.unitId]={type:'pass'};
  }
  return actions;
}
export function getStrategyStatus() {
  return {events:memory?.events??[],basePlan:memory?.basePlan??null,oreAssignments:Object.fromEntries(memory?.oreGoals??[])};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.error(`Starting ${VERSION}`);
  let logWarningShown=false, loggedMatch=null, loggedCells=[];
  await runBot((state, identity) => {
    const decisionStart=performance.now();
    const actions=calculateActions(state, identity);
    const decisionMs=performance.now()-decisionStart;
    if(isMarsView(state.view)) {
      const v=state.view;
      if(loggedMatch!==state.match.matchId) {loggedMatch=state.match.matchId;loggedCells=[];}
      const changes=[];
      v.map.cells.forEach((cell,index)=>{
        if(cell.type==='hidden')return;
        const encoded=JSON.stringify(cell);
        if(loggedCells[index]!==encoded){changes.push({index,cell});loggedCells[index]=encoded;}
      });
      const record={version:VERSION,matchId:state.match.matchId,turn:v.turn,maxTurns:state.match.maxTurns,
        decisionMs,config:CONFIG,map:{width:v.map.width,height:v.map.height,changes},
        planning:getStrategyStatus(),
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
