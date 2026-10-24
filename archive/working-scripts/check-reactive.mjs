import assert from 'node:assert/strict';
import {calculateActions,CONFIG,getStrategyStatus} from '../outputs/lpc-bot-v5/bot_template.js';
CONFIG.extraBase=false;CONFIG.targetWorkers=1;
function scene(matchId,turn=50){
 const size=10,cells=Array.from({length:100},()=>({type:'empty'}));cells[26]={type:'gold',amount:8};cells[72]={type:'gold',amount:8};
 return {match:{matchId,maxTurns:480},view:{turn,map:{width:size,height:size,cells},units:[{unitId:'w1',teamId:'us',position:{x:2,y:2},inventory:{gold:0,iron:0},inventoryCapacity:8,readyOnTurn:0}],bases:[{baseId:'b',teamId:'us',position:{x:0,y:0}}],teamResources:{us:{gold:0,iron:4}},scores:{us:0}}};
}
const decide=s=>calculateActions(s,{teamId:'us'});
let s=scene('depletion');decide(s);assert.equal(getStrategyStatus().oreAssignments.w1,26);s.view.turn++;s.view.map.cells[26]={type:'empty'};decide(s);assert.equal(getStrategyStatus().oreAssignments.w1,72);assert.ok(getStrategyStatus().events.some(e=>e.type==='gold_depleted'));
s=scene('claims');decide(s);s.view.turn++;s.view.bases.push({baseId:'enemy',teamId:'enemy',position:{x:6,y:3}});decide(s);assert.equal(getStrategyStatus().oreAssignments.w1,72);
s=scene('competition');s.view.map.cells[26].amount=2;s.view.units.push({unitId:'enemy',teamId:'enemy',position:{x:6,y:2},readyOnTurn:0});decide(s);assert.equal(getStrategyStatus().oreAssignments.w1,72);
s=scene('small-improvement');decide(s);s.view.turn++;s.view.map.cells[25]={type:'gold',amount:8};decide(s);assert.equal(getStrategyStatus().oreAssignments.w1,26,'Keep old target when alternative saves only one turn');
s=scene('large-improvement');decide(s);s.view.turn++;s.view.map.cells[32]={type:'gold',amount:8};decide(s);assert.equal(getStrategyStatus().oreAssignments.w1,32,'Switch when three travel turns can be saved');
s=scene('cooldown');s.view.units[0].readyOnTurn=53;assert.equal(decide(s).w1.type,'pass');s.view.turn=53;assert.notEqual(decide(s).w1.type,'pass');
s=scene('blocked-route');s.view.map.cells=Array.from({length:100},()=>({type:'void'}));for(let x=2;x<=8;x++)s.view.map.cells[20+x]={type:'empty'};s.view.map.cells[28]={type:'gold',amount:8};s.view.bases[0].position={x:2,y:2};decide(s);assert.equal(getStrategyStatus().oreAssignments.w1,28);s.view.turn++;s.view.bases.push({baseId:'blocker',teamId:'enemy',position:{x:5,y:2}});decide(s);assert.equal(getStrategyStatus().oreAssignments.w1,undefined);assert.ok(getStrategyStatus().events.some(e=>e.type==='target_invalidated'));
CONFIG.extraBase=true;CONFIG.targetWorkers=3;
s=scene('cancel-base',48);s.view.map={width:20,height:20,cells:Array.from({length:400},()=>({type:'empty'}))};
for(const [x,y] of [[10,10],[11,10],[10,11],[12,11]])s.view.map.cells[y*20+x]={type:'gold',amount:16};
s.view.units=[{x:9,y:9},{x:9,y:10},{x:10,y:9}].map((position,i)=>({unitId:`w${i}`,teamId:'us',position,inventory:{gold:0,iron:0},inventoryCapacity:8,readyOnTurn:0}));s.view.teamResources.us.iron=6;decide(s);assert.ok(getStrategyStatus().basePlan,'Set up worthwhile base plan');
s.view.turn=49;s.view.map.cells=s.view.map.cells.map(c=>c.type==='gold'?{type:'empty'}:c);decide(s);assert.equal(getStrategyStatus().basePlan,null);assert.ok(getStrategyStatus().events.some(e=>e.type==='base_plan_cancelled'));
console.log('Passed: depleted ore, new enemy claim, likely depletion by visible enemy miners, small-vs-large target changes, cooldown recovery, a newly blocked route, and cancelling a base plan after its supporting gold disappears.');
