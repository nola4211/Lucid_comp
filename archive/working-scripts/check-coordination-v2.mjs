import {calculateActions} from '../outputs/lpc-bot-v2/bot_template.js';
const cells=Array.from({length:49},()=>({type:'empty'}));cells[24]={type:'gold',amount:6};
const unit=(id,x,y)=>({unitId:id,teamId:'us',position:{x,y},inventory:{gold:0,iron:0},inventoryCapacity:8,readyOnTurn:0});
const state={match:{matchId:'coordination-test',maxTurns:480},view:{turn:50,map:{width:7,height:7,cells},units:[unit('w1',2,3),unit('w2',3,3),unit('w3',0,1)],bases:[{baseId:'b',teamId:'us',position:{x:0,y:0}}],teamResources:{us:{gold:0,iron:4}}}};
console.log(JSON.stringify(calculateActions(state,{teamId:'us'}),null,2));
