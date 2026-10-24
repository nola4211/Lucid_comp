#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { appendFileSync } from 'node:fs';
export const VERSION = '007-v7-adaptive-expansion';
import { runBot, isMarsView } from './bot_client.js';

// Tune only after comparing several practice seeds.
export const CONFIG = { targetWorkers: 3, maxWorkers: 5, maxBases: 5, goldFunding: true, investmentMinTurns: 90, extraBase: true, exactFunding: true, centerExploration: false, coordinateOre: true, reactive: true, coordinateExploration: false, targetSelection: 'nearest', returnBuffer: 2, explorationWeight: 0.045 };
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
  // Price iron collection using known paths, ore stock and a separate deposit turn.
  const fromWorkerCache=new Map(),fromBankCache=new Map();
  const fromWorker=w=>{
    if(!fromWorkerCache.has(w.unitId))fromWorkerCache.set(w.unitId,routes([id(w.position)]));
    return fromWorkerCache.get(w.unitId);
  };
  function bankReachedFrom(start) {
    let p=start;
    for(let steps=0;steps<n && back.dist[p]>0;steps++) {
      p=back.first[p];if(p<0)return -1;
    }
    return Number.isFinite(back.dist[p])?p:-1;
  }
  function fromBank(start) {
    const bank=bankReachedFrom(start);if(bank<0)return null;
    if(!fromBankCache.has(bank))fromBankCache.set(bank,routes([bank]));
    return fromBankCache.get(bank);
  }
  function setupFor(site,builder,goal=6) {
    const here=id(builder.position),inv=builder.inventory??{gold:0,iron:0};
    const load=inv.gold+inv.iron;
    const delay=Math.max(0,builder.readyOnTurn-v.turn);
    const homeToSite=site===null?0:(fromBank(here)?.dist[site]??Infinity);
    const builderReturn=site===null?0:(load?back.dist[here]+1:0);
    const builderTravel=site===null?0:(load?builderReturn+homeToSite:fromWorker(builder).dist[site]);
    if(iron>=goal)return {cost:delay+builderTravel+1,funding:null,goldSpend:0};
    const carriers=workers.filter(w=>(w.inventory?.iron??0)>0);
    const carry=carriers.reduce((sum,w)=>sum+w.inventory.iron,0);
    const extra=Math.max(0,goal-iron-carry);
    if(extra===0) {
      const deliveries=carriers.reduce((sum,w)=>sum+back.dist[id(w.position)]+1,0);
      const countedReturn=carriers.some(w=>w.unitId===builder.unitId)?builderReturn:0;
      return {cost:delay+builderTravel+1+deliveries-countedReturn,funding:null,goldSpend:0};
    }
    let best={cost:Infinity,funding:null,goldSpend:0};
    for(const collector of workers) {
      const bag=collector.inventory??{gold:0,iron:0};
      if(bag.gold>0 || (carriers.length && !carriers.some(w=>w.unitId===collector.unitId)))continue;
      const walk=fromWorker(collector),start=id(collector.position);
      for(let i=0;i<n;i++) {
        const cell=memory.cells[i];
        if(cell?.type!=='iron' || !(cell.amount>0) || v.turn-memory.seen[i]>30 || !eligibleOre(i))continue;
        const batch=Math.min(extra,cell.amount,(collector.inventoryCapacity??8)-bag.iron);
        if(batch<=0)continue;
        const knownSupply=memory.cells.reduce((sum,c,j)=>sum+(c?.type==='iron' && v.turn-memory.seen[j]<=30 && eligibleOre(j)?c.amount:0),0);
        if(knownSupply<=0)continue;
        const oneTrip=walk.dist[i]+batch+back.dist[i]+1+Math.max(0,collector.readyOnTurn-v.turn);
        const delivery=oneTrip*Math.ceil(extra/batch)+2*Math.max(0,extra-knownSupply);
        let total;
        if(collector.unitId===builder.unitId)total=delivery+(site===null?0:(fromBank(i)?.dist[site]??Infinity))+1;
        else total=delivery+builderTravel+delay+1;
        // In normal play only one iron collector carries the construction supply.
        total+=carriers.filter(w=>w.unitId!==collector.unitId && w.unitId!==builder.unitId).reduce((sum,w)=>sum+back.dist[id(w.position)]+1,0);
        if(total<best.cost)best={cost:total,goldSpend:0,funding:{type:'mine',worker:collector.unitId,target:i,additionalIron:extra,batch,estimatedWorkerTurns:delivery}};
      }
    }
    // Convert carried gold only for a project whose benefit can repay the gold.
    if(CONFIG.goldFunding && remaining>CONFIG.investmentMinTurns && workers.reduce((sum,w)=>sum+(w.inventory?.gold??0),0)>=extra*3) {
      for(const collector of workers) {
        const bag=collector.inventory??{gold:0,iron:0};
        if(bag.gold<3 || v.turn<collector.readyOnTurn || carriers.some(w=>w.unitId!==collector.unitId))continue;
        const batch=Math.min(extra,Math.floor(bag.gold/3));
        // Repeated batches are budgeted conservatively, including replacement gold mining.
        const delivery=extra*4+back.dist[id(collector.position)]+1;
        const total=delivery+(collector.unitId===builder.unitId?(site===null?0:homeToSite):builderTravel)+1;
        const goldSpend=extra*3;
        if(total+goldSpend/0.3 < best.cost+(best.goldSpend??0)/0.3)
          best={cost:total,goldSpend,funding:{type:'trade',worker:collector.unitId,target:null,batch,additionalIron:extra,estimatedWorkerTurns:delivery}};
      }
    }
    return best;
  }
  // Re-evaluate the remaining cost of a construction project, ignoring sunk costs.
  if(CONFIG.reactive && memory.basePlan) {
    const plan=memory.basePlan,p=point(plan.site),builder=workers.find(w=>w.unitId===plan.builder);
    let reason=null;
    if(!builder)reason='builder_missing';
    else if(home.length!==plan.baseCount || home.length>=CONFIG.maxBases)reason='base_network_changed';
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
        const evaluation=CONFIG.exactFunding?setupFor(plan.site,builder):{cost:travel+1+(needed?24+needed:0)+(carried && iron<6?4:0),funding:null};
        const stillOwed=evaluation.cost;
        plan.funding=evaluation.funding;plan.estimatedSetup=stillOwed;plan.estimatedTravelSavings=savings;
        if(savings<=1.5*stillOwed+(evaluation.goldSpend??0)/0.3 || stillOwed+12>=remaining)reason='insufficient_remaining_gold';
      }
    }
    if(reason){memory.events.push({type:'base_plan_cancelled',reason,position:p});memory.basePlan=null;}
  }
  // Expand the deposit network while recent ore can repay the remaining setup cost.
  let investment = null;
  if(CONFIG.extraBase && home.length<CONFIG.maxBases && workers.length>=CONFIG.targetWorkers && remaining>CONFIG.investmentMinTurns && v.turn%12===0 && (!memory.basePlan || v.turn-memory.basePlan.created>36)) {
    memory.baseEvaluation={turn:v.turn,candidates:[]};
    const gold=memory.cells.flatMap((c,i)=>c?.type==='gold' && c.amount>0 && v.turn-memory.seen[i]<=30 ? [{i,amount:c.amount}]:[]);
    const sites=new Set();
    for(const g of gold) {
      const p=point(g.i);
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++) {
        const x=p.x+dx,y=p.y+dy;
        if(Math.abs(dx)+Math.abs(dy)>2 || x<0 || y<0 || x>=map.width || y>=map.height)continue;
        const i=y*map.width+x;
        if(memory.cells[i]?.type!=='empty' || bases.some(b=>id(b.position)===i) || back.dist[i]<6 || home.some(b=>Math.abs(b.position.x-x)+Math.abs(b.position.y-y)<5))continue;
        if(bases.some(b=>b.teamId!==team && Math.abs(b.position.x-x)+Math.abs(b.position.y-y)<=2))continue;
        sites.add(i);
      }
    }
    const cheb=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
    const ranked=[...sites].map(site=>({site,rough:gold.reduce((sum,g)=>sum+2*Math.max(0,back.dist[g.i]-cheb(point(g.i),point(site)))*g.amount/8,0)})).sort((a,b)=>b.rough-a.rough).slice(0,3);
    let bestNet=0;
    memory.baseEvaluation.candidateSites=sites.size;
    for(const {site} of ranked) {
      const siteRoutes=routes([site],true);
      const savings=gold.reduce((sum,g)=>{
        const a=point(g.i),b=point(site);
        if(CONFIG.reactive && (!Number.isFinite(back.dist[g.i]+siteRoutes.dist[g.i]) || (!eligibleOre(g.i) && Math.abs(a.x-b.x)+Math.abs(a.y-b.y)>2)))return sum;
        return sum+2*Math.max(0,back.dist[g.i]-siteRoutes.dist[g.i])*g.amount/8;
      },0);
      const builders=workers.filter(w=>(w.inventory?.gold??0)+(w.inventory?.iron??0)===0 && v.turn>=w.readyOnTurn);
      for(const w of builders) {
        const outbound=fromWorker(w).dist[site];
        const needed=Math.max(0,6-iron);
        // Charge setup a conservative iron-trip allowance in addition to builder travel.
        const evaluation=CONFIG.exactFunding?setupFor(site,w):{cost:outbound+1+(needed?24+needed:0),funding:null};
        const setup=evaluation.cost;
        const net=savings-1.5*setup-(evaluation.goldSpend??0)/0.3;
        memory.baseEvaluation.candidates.push({site:point(site),builder:w.unitId,travelSavings:savings,estimatedSetup:Number.isFinite(setup)?setup:null,fundingAvailable:Number.isFinite(setup),net:Number.isFinite(net)?net:null});
        if(net>bestNet && outbound<remaining/4 && setup+12<remaining) {bestNet=net;investment={kind:'base',goal:6,baseCount:home.length,site,builder:w.unitId,created:v.turn,funding:evaluation.funding,estimatedSetup:setup,estimatedTravelSavings:savings};}
      }
    }
    memory.basePlan=investment;
  }
  if(home.length>=CONFIG.maxBases || remaining<=CONFIG.investmentMinTurns || (memory.basePlan && v.turn-memory.basePlan.created>36)) memory.basePlan=null;
  investment=memory.basePlan;
  const prices=[5,6,11,17,28,45,73];
  // Additional workers need observable surplus work, useful delivery routes and payback time.
  if(!investment && workers.length>=CONFIG.targetWorkers && workers.length<CONFIG.maxWorkers && remaining>120) {
    const stock=memory.cells.reduce((sum,c,i)=>sum+(c?.type==='gold' && c.amount>0 && v.turn-memory.seen[i]<=30 && eligibleOre(i) && back.dist[i]<=12?c.amount:0),0);
    const currentDemand=workers.reduce((sum,w)=>sum+Math.max(0,(w.inventoryCapacity??8)-(w.inventory?.gold??0)-(w.inventory?.iron??0)),0);
    const surplus=Math.max(0,stock-currentDemand);
    const price=prices[workers.length-1]??Infinity;
    let bestGrowth=null;
    for(const w of workers) {
      if(v.turn<w.readyOnTurn)continue;
      const evaluation=setupFor(null,w,price);
      const expectedGold=Math.min(surplus*2,0.65*8*Math.floor((remaining-evaluation.cost)/28));
      const burden=evaluation.cost*0.3+(evaluation.goldSpend??0);
      if(expectedGold>=12 && expectedGold>1.5*burden && evaluation.cost+45<remaining && (!bestGrowth || burden<bestGrowth.burden))
        bestGrowth={kind:'spawn',goal:price,builder:w.unitId,site:null,workerCount:workers.length,created:v.turn,funding:evaluation.funding,estimatedSetup:evaluation.cost,expectedGold,burden};
    }
    investment=bestGrowth;
  }
  memory.activeProject=investment;
  let ironCollector=null,ironTarget=-1;
  const carriedIron=workers.reduce((sum,w)=>sum+(w.inventory?.iron??0),0);
  if(investment && iron+carriedIron<(investment?.goal??6) && !CONFIG.exactFunding) {
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
  if(CONFIG.exactFunding && investment?.funding && iron+carriedIron<(investment?.goal??6)) {
    ironCollector=investment.funding.worker;ironTarget=investment.funding.target;
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
        (investment && w.unitId===investment.builder && iron>=(investment.goal??6) && (investment.kind==='spawn' || !load)) ||
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
  const rich=v.highGoldArea;
  const richWidth=Math.min(map.width,rich?.width??16),richHeight=Math.min(map.height,rich?.height??16);
  const richLeft=Math.floor((map.width-richWidth)/2),richTop=Math.floor((map.height-richHeight)/2);
  const richArea=richWidth*richHeight,outerArea=n-richArea;
  const richShare=Math.max(0,Math.min(1,(rich?.spawnPercent??35)/100));
  const richDensity=outerArea>0 && richShare<1?Math.max(1,Math.min(4,(richShare/richArea)/((1-richShare)/outerArea))):1;
  const richWeight=Math.sqrt(richDensity);
  const inRich=p=>p.x>=richLeft && p.x<richLeft+richWidth && p.y>=richTop && p.y<richTop+richHeight;
  const distanceToRich=p=>Math.max(richLeft-p.x,0,p.x-(richLeft+richWidth-1))+Math.max(richTop-p.y,0,p.y-(richTop+richHeight-1));
  const explorationFootprint=new Set();
  let plannedWorkers=workers.length;
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
    if(investment && w.unitId===investment.builder && investment.kind==='spawn' && iron>=investment.goal) {
      actions[w.unitId]={type:'spawn'};iron-=investment.goal;memory.events.push({type:'worker_recruited',worker:w.unitId,price:investment.goal});continue;
    }
    if(investment?.funding?.type==='trade' && w.unitId===ironCollector && inv.gold>=3 && iron+carriedIron<investment.goal) {
      actions[w.unitId]={type:'trade',from:'gold'};memory.returning.delete(w.unitId);continue;
    }
    if(load>=capacity || (load && remaining<=back.dist[here]+CONFIG.returnBuffer+1)) memory.returning.add(w.unitId);
    if(memory.returning.has(w.unitId)) {actions[w.unitId]=move(w,back.first[here]);continue;}
    if(inv.iron>0 && (!investment || iron+carriedIron>=(investment?.goal??6) || !ironCollector)) {
      memory.returning.add(w.unitId);actions[w.unitId]=move(w,back.first[here]);continue;
    }
    if(w.unitId===ironCollector && ironTarget>=0) {
      const out=routes([here]);actions[w.unitId]=here===ironTarget?{type:'mine'}:move(w,out.first[ironTarget]);continue;
    }
    if(investment?.kind==='base' && w.unitId===investment.builder && iron>=6 && load) {
      memory.returning.add(w.unitId);actions[w.unitId]=move(w,back.first[here]);continue;
    }
    if(investment?.kind==='base' && w.unitId===investment.builder && iron>=6 && !load) {
      const site=investment.site,p=point(site);
      const legal=memory.cells[site]?.type==='empty' && !bases.some(b=>id(b.position)===site) && !bases.some(b=>b.teamId!==team && Math.abs(b.position.x-p.x)+Math.abs(b.position.y-p.y)<=2);
      if(legal) {
        if(here===site) {
          if(!v.units.some(other=>other.unitId!==w.unitId && same(other.position,w.position))) {actions[w.unitId]={type:'build-base'};iron-=6;continue;}
        } else {const out=routes([here]);if(Number.isFinite(out.dist[site])){actions[w.unitId]=move(w,out.first[site]);continue;}}
      }
    }
    // Two inexpensive recruits remain the default opening.
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
        if(Math.abs(dx)+Math.abs(dy)<=3 && x>=0 && y>=0 && x<map.width && y<map.height && !memory.cells[y*map.width+x] && (!CONFIG.coordinateExploration || !explorationFootprint.has(y*map.width+x))) unknown+=CONFIG.centerExploration && inRich({x,y})?richWeight:1;
      }
      if(!unknown) continue;
      const centerProgress=CONFIG.centerExploration?2*(distanceToRich(w.position)-distanceToRich(p))/(out.dist[i]+2):0;
      const score=unknown/(out.dist[i]+2)+centerProgress-CONFIG.explorationWeight*back.dist[i]-(reserved.get(i) ?? 0)*5;
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
  return {events:memory?.events??[],basePlan:memory?.basePlan??null,activeProject:memory?.activeProject??null,baseEvaluation:memory?.baseEvaluation??null,oreAssignments:Object.fromEntries(memory?.oreGoals??[])};
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
        bank:v.teamResources[identity.teamId],scores:v.scores,highGoldArea:v.highGoldArea,visibleEnemies:v.units.filter(w=>w.teamId!==identity.teamId),
        workers:v.units.filter(w=>w.teamId===identity.teamId),bases:v.bases,
        visibleOre:v.map.cells.flatMap((c,i)=>['gold','iron'].includes(c.type)?[{x:i%v.map.width,y:Math.floor(i/v.map.width),...c}]:[]),
        actions,warnings:v.warnings,info:v.info,effects:v.effects};
      try { appendFileSync(new URL('./match-analysis.jsonl',import.meta.url),JSON.stringify(record)+'\n'); }
      catch(error) { if(!logWarningShown){console.error('Could not save analysis log:',error.message);logWarningShown=true;} }
    }
    return actions;
  }).catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
}
