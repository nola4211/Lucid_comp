import {calculateActions,CONFIG} from '../outputs/lpc-bot-v2/bot_template.js';
import fs from 'node:fs';
function simulate(seed,count,selection){
 let r=seed; const random=()=>((r=(Math.imul(1664525,r)+1013904223)>>>0)/4294967296);
 const width=20,height=20, maxTurns=480;
 const cells=Array.from({length:width*height},()=>({type:random()<0.2?'mountain':random()<0.125?'crater':'empty'}));
 const pos={x:2,y:2};cells[42]={type:'empty'};
 let units=[{unitId:'w0',teamId:'us',position:{x:3,y:2},inventory:{gold:0,iron:0},inventoryCapacity:8,readyOnTurn:0}];cells[43]={type:'empty'};
 const bases=[{baseId:'b0',teamId:'us',position:pos}],bank={gold:0,iron:15};let recruits=0;
 const add=()=>{let choices=cells.map((c,i)=>c.type==='empty' && i!==42 && !units.some(w=>w.position.y*width+w.position.x===i)?i:-1).filter(i=>i>=0);if(choices.length){let i=choices[Math.floor(random()*choices.length)];cells[i]={type:'gold',amount:6+Math.floor(random()*4)};}};
 for(let i=0;i<14;i++)add();
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
       if(c.type==='gold' && c.amount>0 && w.inventory.gold<8){w.inventory.gold++;c.amount--;if(!c.amount){cells[i]={type:'empty'};depleted++;}}else invalid++;
     }else if(a.type==='deposit'){
       if(w.position.x===pos.x&&w.position.y===pos.y){bank.gold+=w.inventory.gold;w.inventory.gold=0;}else invalid++;
     }
   }
 }
 carried=units.reduce((s,w)=>s+w.inventory.gold,0);
 return {seed,selection,workers:count,gold:bank.gold,carried,invalid,actions:actionCounts};
}
const results=[];
for(let seed=1;seed<=12;seed++)for(const count of [1,2,3])results.push(simulate(seed,count,'rate'));
for(let seed=1;seed<=12;seed++)results.push(simulate(seed,3,'nearest'));
const summary=[1,2,3].map(workers=>{const rows=results.filter(r=>r.workers===workers && r.selection==='rate');return {workers,meanGold:rows.reduce((s,r)=>s+r.gold,0)/rows.length,minGold:Math.min(...rows.map(r=>r.gold)),maxGold:Math.max(...rows.map(r=>r.gold)),meanCarried:rows.reduce((s,r)=>s+r.carried,0)/rows.length,invalidActions:rows.reduce((s,r)=>s+r.invalid,0)};});
fs.writeFileSync('outputs/simulation-results-v2.json',JSON.stringify({assumptions:'Simplified solo 20x20 maps, 480 turns, 14 gold deposits, no iron deposits, uniform gold respawning without official spacing/center rules; fog, terrain cooldown, capacity, recruitment costs and banking modeled. Not the official engine.',summary,results},null,2));
console.log(JSON.stringify(summary,null,2));
const nearest=results.filter(r=>r.selection==='nearest');console.log('Nearest-gold 3-worker mean:',nearest.reduce((s,r)=>s+r.gold,0)/nearest.length);console.log('Rate strategy wins:',results.filter(r=>r.workers===3 && r.selection==='rate' && r.gold>nearest.find(x=>x.seed===r.seed).gold).length);
