import {calculateActions} from '../bot_template.js';
const size=50,cells=Array.from({length:2500},(_,i)=>({type:i%10===0?'mountain':'empty'}));
for(let i=100;i<2400;i+=37)cells[i]={type:'gold',amount:8};
const units=[{x:20,y:20},{x:22,y:20},{x:20,y:22}].map((position,i)=>({unitId:`w${i}`,teamId:'us',position,inventory:{gold:0,iron:0},inventoryCapacity:8,readyOnTurn:0}));
const samples=[];
for(let turn=36;turn<96;turn++){
 const state={match:{matchId:'benchmark',maxTurns:480},view:{turn,map:{width:size,height:size,cells},units,bases:[{baseId:'b',teamId:'us',position:{x:2,y:2}}],teamResources:{us:{gold:0,iron:4}},scores:{}}};
 const t=performance.now();calculateActions(state,{teamId:'us'});samples.push(performance.now()-t);
}
samples.sort((a,b)=>a-b);console.log(JSON.stringify({scenario:'Artificial fully observed 50x50 map; 60 strategy calls, not a network or match timing test',medianMs:samples[30],p95Ms:samples[57],maxMs:samples[59]},null,2));
