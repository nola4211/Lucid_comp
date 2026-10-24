import assert from 'node:assert/strict';
import {calculateActions} from '../outputs/lpc-bot-v3/bot_template.js';
const size=20,cells=Array.from({length:size*size},()=>({type:'empty'}));
for(const [x,y] of [[10,10],[11,10],[10,11],[12,11]])cells[y*size+x]={type:'gold',amount:16};
const worker=(i,x,y)=>({unitId:`w${i}`,teamId:'us',position:{x,y},inventory:{gold:0,iron:0},inventoryCapacity:8,readyOnTurn:0});
function state(turn,iron,matchId){return {match:{matchId,maxTurns:480},view:{turn,map:{width:size,height:size,cells},units:[worker(1,9,9),worker(2,9,10),worker(3,10,9)],bases:[{baseId:'b',teamId:'us',position:{x:1,y:1}}],teamResources:{us:{gold:0,iron}},scores:{},warnings:[],info:[],effects:[]}};}
let s=state(48,6,'early'),built=false;
for(let t=48;t<65;t++){
 s.view.turn=t;
 const actions=calculateActions(s,{teamId:'us'});
 for(const w of s.view.units){const a=actions[w.unitId];
  if(a.type==='build-base'){assert.equal(s.view.map.cells[w.position.y*size+w.position.x].type,'empty');built=true;}
  if(a.type==='move'){const m={'north':[0,-1],'north-east':[1,-1],east:[1,0],'south-east':[1,1],south:[0,1],'south-west':[-1,1],west:[-1,0],'north-west':[-1,-1]};const [dx,dy]=m[a.direction];w.position={x:w.position.x+dx,y:w.position.y+dy};}
 }
 if(built)break;
}
assert.ok(built,'High-stock cluster should justify an early second base');
const late=calculateActions(state(360,6,'late'),{teamId:'us'});assert.ok(!Object.values(late).some(a=>a.type==='build-base'));
const noIron=calculateActions(state(48,4,'no-iron'),{teamId:'us'});assert.ok(!Object.values(noIron).some(a=>a.type==='build-base'));
console.log('Policy checks passed: justified early base; no late construction; no unaffordable construction.');
