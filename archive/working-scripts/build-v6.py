s=open('outputs/lpc-bot-v5/bot_template.js').read().replace('lpc-v5-reactive-experimental','lpc-v6-route-priced-bases')
s=s.replace('extraBase: true,','extraBase: true, exactFunding: true,')
needle='  // Re-evaluate the remaining cost of a construction project, ignoring sunk costs.'
helper='''  // Price iron collection using known paths, ore stock and a separate deposit turn.
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
  function setupFor(site,builder) {
    const here=id(builder.position),inv=builder.inventory??{gold:0,iron:0};
    const load=inv.gold+inv.iron;
    const delay=Math.max(0,builder.readyOnTurn-v.turn);
    const homeToSite=fromBank(here)?.dist[site]??Infinity;
    const builderReturn=load?back.dist[here]+1:0;
    const builderTravel=load?builderReturn+homeToSite:fromWorker(builder).dist[site];
    if(iron>=6)return {cost:delay+builderTravel+1,funding:null};
    const carriers=workers.filter(w=>(w.inventory?.iron??0)>0);
    const carry=carriers.reduce((sum,w)=>sum+w.inventory.iron,0);
    const extra=Math.max(0,6-iron-carry);
    if(extra===0) {
      const deliveries=carriers.reduce((sum,w)=>sum+back.dist[id(w.position)]+1,0);
      const countedReturn=carriers.some(w=>w.unitId===builder.unitId)?builderReturn:0;
      return {cost:delay+builderTravel+1+deliveries-countedReturn,funding:null};
    }
    let best={cost:Infinity,funding:null};
    for(const collector of workers) {
      const bag=collector.inventory??{gold:0,iron:0};
      if(bag.gold>0 || (carriers.length && !carriers.some(w=>w.unitId===collector.unitId)) || extra>(collector.inventoryCapacity??8)-bag.iron)continue;
      const walk=fromWorker(collector),start=id(collector.position);
      for(let i=0;i<n;i++) {
        const cell=memory.cells[i];
        if(cell?.type!=='iron' || cell.amount<extra || v.turn-memory.seen[i]>30 || !eligibleOre(i))continue;
        const delivery=walk.dist[i]+extra+back.dist[i]+1+Math.max(0,collector.readyOnTurn-v.turn);
        let total;
        if(collector.unitId===builder.unitId)total=delivery+(fromBank(i)?.dist[site]??Infinity)+1;
        else total=delivery+builderTravel+delay+1;
        // In normal play only one iron collector carries the construction supply.
        total+=carriers.filter(w=>w.unitId!==collector.unitId && w.unitId!==builder.unitId).reduce((sum,w)=>sum+back.dist[id(w.position)]+1,0);
        if(total<best.cost)best={cost:total,funding:{worker:collector.unitId,target:i,additionalIron:extra,estimatedWorkerTurns:delivery}};
      }
    }
    return best;
  }
'''
s=s.replace(needle,helper+needle)
s=s.replace('const stillOwed=travel+1+(needed?24+needed:0)+(carried && iron<6?4:0);','const evaluation=CONFIG.exactFunding?setupFor(plan.site,builder):{cost:travel+1+(needed?24+needed:0)+(carried && iron<6?4:0),funding:null};\n        const stillOwed=evaluation.cost;\n        plan.funding=evaluation.funding;plan.estimatedSetup=stillOwed;plan.estimatedTravelSavings=savings;')
s=s.replace('const setup=outbound+1+(needed?24+needed:0);', 'const evaluation=CONFIG.exactFunding?setupFor(site,w):{cost:outbound+1+(needed?24+needed:0),funding:null};\n        const setup=evaluation.cost;')
s=s.replace('investment={site,builder:w.unitId,created:v.turn};','investment={site,builder:w.unitId,created:v.turn,funding:evaluation.funding,estimatedSetup:setup,estimatedTravelSavings:savings};')
s=s.replace('  if(investment && iron+carriedIron<6) {','  if(investment && iron+carriedIron<6 && !CONFIG.exactFunding) {')
s=s.replace('  const oreAssignments=new Map(), claimedOre=new Map();','''  if(CONFIG.exactFunding && investment?.funding && iron+carriedIron<6) {
    ironCollector=investment.funding.worker;ironTarget=investment.funding.target;
  }
  const oreAssignments=new Map(), claimedOre=new Map();''')
s=s.replace("if(investment && inv.iron>0 && (iron+carriedIron>=6 || !ironCollector))", "if(inv.iron>0 && (!investment || iron+carriedIron>=6 || !ironCollector))")
s=s.replace('    if(investment && w.unitId===investment.builder && iron>=6 && !load) {', '''    if(investment && w.unitId===investment.builder && iron>=6 && load) {
      memory.returning.add(w.unitId);actions[w.unitId]=move(w,back.first[here]);continue;
    }
    if(investment && w.unitId===investment.builder && iron>=6 && !load) {''')
# Avoid repeating the full route search once for every site and builder.
s=s.replace('const outbound=routes([id(w.position)]).dist[site];','const outbound=fromWorker(w).dist[site];')
open('outputs/lpc-bot-v6/bot_template.js','w').write(s)
