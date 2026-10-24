const {calculateActions,CONFIG}=await import(process.argv[2]);
import fs from 'node:fs';
Object.assign(CONFIG,JSON.parse(process.argv[4]??'{}'));
const startSeed=Number(process.argv[5]??1);
function simulate(seed,count,selection){
 let r=seed; const random=()=>((r=(Math.imul(1664525,r)+1013904223)>>>0)/4294967296);
 const width=30,height=30, maxTurns=480;
 const cells=Array.from({length:width*height},()=>({type:random()<0.2?'mountain':random()<0.125?'crater':'empty'}));
 const pos={x:2,y:2};cells[62]={type:'empty'};
 let units=[{unitId:'w0',teamId:'us',position:{x:3,y:2},inventory:{gold:0,iron:0},inventoryCapacity:8,readyOnTurn:0}];cells[63]={type:'empty'};
 const bases=[{baseId:'b0',teamId:'us',position:pos}],bank={gold:0,iron:15};let recruits=0;
 const add=()=>{let choices=cells.map((c,i)=>c.type==='empty' && i!==62 && !units.some(w=>w.position.y*width+w.position.x===i)?i:-1).filter(i=>i>=0);if(choices.length){let i=choices[Math.floor(random()*choices.length)];cells[i]={type:'gold',amount:6+Math.floor(random()*4)};}};
 for(let i=0;i<24;i++)add();
 for(let k=0;k<8;k++){let i=Math.floor(random()*cells.length);if(cells[i].type==='empty' && i!==62 && i!==63)cells[i]={type:'iron',amount:3};}
 const moves={'north':[0,-1],'north-east':[1,-1],east:[1,0],'south-east':[1,1],south:[0,1],'south-west':[-1,1],west:[-1,0],'north-west':[-1,-1]};
 const actionCounts={};let depleted=0,carried=0,invalid=0;
 CONFIG.targetWorkers=count; CONFIG.targetSelection=selection;
 for(let turn=0;turn<maxTurns;turn++){
   while(depleted>0){add();depleted--;}
   const visible=(x,y)=>[...units,...bases].some(w=>Math.abs(w.position.x-x)+Math.abs(w.position.y-y)<=3);
   const view={turn,map:{width,height,cells:cells.map((c,i)=>visible(i%width,Math.floor(i/width))?{...c}:{type:'hidden'})},units:structuredClone(units),bases,teamResources:{us:{...bank}},scores:{us:bank.gold},warnings:[],info:[],effects:[]};
   const actions=calculateActions({match:{matchId:`${seed}-${count}-${selection}`,maxTurns},view},{teamId:'us'});
   const old=[...units];
   for(const w of old){
     const a=actions[w.unitId]??{type:'pass'};actionCounts[a.type]=(actionCounts[a.type]??0)+1;
     if(turn<w.readyOnTurn)continue;
     if(a.type==='move'){
       const [dx,dy]=moves[a.direction],x=w.position.x+dx,y=w.position.y+dy;
       if(x<0||y<0||x>=width||y>=height){invalid++;continue;}
       w.position={x,y};w.readyOnTurn=turn+(['mountain','crater'].includes(cells[y*width+x].type)?3:1);
     }else if(a.type==='spawn'){
       const price=[5,6,11,17,28][recruits]??Infinity;
       if(bank.iron>=price){bank.iron-=price;recruits++;units.push({unitId:`w${recruits}`,teamId:'us',position:{...w.position},inventory:{gold:0,iron:0},inventoryCapacity:8,readyOnTurn:turn+1});}else invalid++;
     }else if(a.type==='mine'){
       const i=w.position.y*width+w.position.x,c=cells[i];
       if(['gold','iron'].includes(c.type) && c.amount>0 && w.inventory.gold+w.inventory.iron<8){w.inventory[c.type]++;c.amount--;if(!c.amount){const was=c.type;cells[i]={type:'empty'};if(was==='gold')depleted++;}}else invalid++;
     }else if(a.type==='build-base'){
       const i=w.position.y*width+w.position.x;
       if(bank.iron>=6 && cells[i].type==='empty' && !bases.some(b=>b.position.x===w.position.x && b.position.y===w.position.y) && !units.some(other=>other!==w && other.position.x===w.position.x && other.position.y===w.position.y)){bank.iron-=6;bases.push({baseId:`b${bases.length}`,teamId:'us',position:{...w.position}});}else invalid++;
     }else if(a.type==='deposit'){
       if(bases.some(b=>b.position.x===w.position.x && b.position.y===w.position.y)){bank.gold+=w.inventory.gold;bank.iron+=w.inventory.iron;w.inventory.gold=0;w.inventory.iron=0;}else invalid++;
     }
   }
 }
 carried=units.reduce((s,w)=>s+w.inventory.gold,0);
 return {seed,selection,workers:count,bases:bases.length,gold:bank.gold,carried,invalid,actions:actionCounts};
}
const results=[];
for(let seed=startSeed;seed<startSeed+12;seed++)results.push(simulate(seed,3,'nearest'));
fs.writeFileSync(process.argv[3],JSON.stringify(results,null,2));
console.log(JSON.stringify({mean:results.reduce((s,r)=>s+r.gold,0)/results.length,bases:results.map(r=>r.bases),invalid:results.reduce((s,r)=>s+r.invalid,0),carried:results.reduce((s,r)=>s+r.carried,0)}));
