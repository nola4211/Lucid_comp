p='outputs/lpc-bot-v4/bot_template.js';s=open(p).read()
s=s.replace('lpc-v4-coordinated-experimental','lpc-v5-reactive-experimental')
s=s.replace('coordinateOre: true,','coordinateOre: true, reactive: true,')
s=s.replace('  memory.turn = v.turn;\n  map.cells.forEach', '''  memory.turn = v.turn;
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
  map.cells.forEach''')
s=s.replace('  const remaining=state.match.maxTurns-v.turn;', '''  const remaining=state.match.maxTurns-v.turn;
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
  };''')
s=s.replace('  // Only one extra base, only during the first half, and only on observed evidence.', '''  // Re-evaluate the remaining cost of a construction project, ignoring sunk costs.
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
  // Only one extra base, only during the first half, and only on observed evidence.''')
s=s.replace("      if(c?.type!=='gold' || !(c.amount>0))continue;", "      if(c?.type!=='gold' || !(c.amount>0))continue;")
s=s.replace('        const qty=Math.min(cap-load,memory.cells[site].amount,remaining-out.dist[site]-back.dist[site]-1-CONFIG.returnBuffer);', '        const qty=Math.min(cap-load,expectedStock(site,out.dist[site]),remaining-out.dist[site]-back.dist[site]-1-CONFIG.returnBuffer);')
s=s.replace('        const old=memory.oreGoals?.get(w.unitId);', '        const old=CONFIG.reactive?memory.goalHistory.get(w.unitId):memory.oreGoals?.get(w.unitId);')
s=s.replace('        const priority=out.dist[site]-(old===site?1.5:0)-(site===here?10000:0);', '''        const commitment=CONFIG.reactive?Math.max(2,Math.min(5,out.dist[site]*0.25)):1.5;
        const priority=out.dist[site]-(old===site?commitment:0)-(site===here?10000:0);''')
s=s.replace('const stock=memory.cells[pair.site].amount-(claimedOre.get(pair.site)??0);', 'const stock=expectedStock(pair.site,pair.travel)-(claimedOre.get(pair.site)??0);')
s=s.replace('    memory.oreGoals=oreAssignments;', '''    if(CONFIG.reactive) {
      for(const w of workers) {
        const old=memory.goalHistory.get(w.unitId),next=oreAssignments.get(w.unitId);
        const oldValid=old!==undefined && memory.cells[old]?.type==='gold' && memory.cells[old].amount>0 && eligibleOre(old) && !blocked.has(old);
        if(next!==undefined) {
          if(old!==undefined && old!==next)memory.events.push({type:'worker_reassigned',worker:w.unitId,from:point(old),to:point(next),reason:oldValid?'closer_or_less_contested_opportunity':'old_target_invalid'});
          memory.goalHistory.set(w.unitId,next);
        } else if(!oldValid)memory.goalHistory.delete(w.unitId);
      }
    }
    memory.oreGoals=oreAssignments;''')
s=s.replace('const qty=Math.min(capacity-load, c.amount-(reserved.get(i) ?? 0), remaining-out.dist[i]-back.dist[i]-1-CONFIG.returnBuffer);', 'const qty=Math.min(capacity-load, expectedStock(i,out.dist[i])-(reserved.get(i) ?? 0), remaining-out.dist[i]-back.dist[i]-1-CONFIG.returnBuffer);')
# Only patrol old ground if there is no eligible gold and no reachable unknown frontier.
s=s.replace('    if(frontier>=0){\n', '''    if(CONFIG.reactive && frontier<0 && remaining>12) {
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
''')
s=s.replace("if (process.argv[1] && import.meta.url", "export function getStrategyStatus() {\n  return {events:memory?.events??[],basePlan:memory?.basePlan??null,oreAssignments:Object.fromEntries(memory?.oreGoals??[])};\n}\nif (process.argv[1] && import.meta.url")
s=s.replace('planning:{base:memory?.basePlan??null,oreAssignments:Object.fromEntries(memory?.oreGoals??[])},', 'planning:getStrategyStatus(),')
open('outputs/lpc-bot-v5/bot_template.js','w').write(s)
