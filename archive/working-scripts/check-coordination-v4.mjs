import assert from 'node:assert/strict';
import {calculateActions,CONFIG} from '../outputs/lpc-bot-v4/bot_template.js';
CONFIG.extraBase=false;
function scene(matchId,units,gold,turn=50){const cells=Array.from({length:49},()=>({type:'empty'}));for(const [x,y,amount] of gold)cells[y*7+x]={type:'gold',amount};return {match:{matchId,maxTurns:480},view:{turn,map:{width:7,height:7,cells},units:units.map(([unitId,x,y,qty=0])=>({unitId,teamId:'us',position:{x,y},inventory:{gold:qty,iron:0},inventoryCapacity:8,readyOnTurn:0})),bases:[{baseId:'b',teamId:'us',position:{x:0,y:0}}],teamResources:{us:{gold:0,iron:4}}}};}
let actions=calculateActions(scene('onsite',[['w1',2,3],['w2',3,3],['w3',0,1]],[[3,3,6]]),{teamId:'us'});
assert.equal(actions.w2.type,'mine');
actions=calculateActions(scene('nearer',[['w1',0,6],['w2',3,2],['w3',0,1]],[[3,3,6]]),{teamId:'us'});
assert.equal(actions.w2.type,'move');assert.equal(actions.w2.direction,'south');assert.equal(actions.w1.type,'pass');
actions=calculateActions(scene('rich',[['w1',3,3],['w2',3,3],['w3',0,1]],[[3,3,16]]),{teamId:'us'});
assert.equal(actions.w1.type,'mine');assert.equal(actions.w2.type,'mine');
actions=calculateActions(scene('deposit',[['w1',0,0,8],['w2',3,2],['w3',0,1]],[[3,3,6]]),{teamId:'us'});
assert.equal(actions.w1.type,'deposit');
console.log('Checks passed: on-site miner priority, closer-worker assignment, useful shared mining on rich ore, and full-load deposit.');
