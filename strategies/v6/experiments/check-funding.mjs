import assert from 'node:assert/strict';
import {calculateActions,CONFIG,getStrategyStatus} from '../bot_template.js';
function scene(matchId,withIron=true){
 const cells=Array.from({length:400},()=>({type:'empty'}));cells[210]={type:'gold',amount:8};cells[211]={type:'gold',amount:8};if(withIron)cells[22]={type:'iron',amount:3};
 const units=[{x:9,y:9},{x:1,y:1},{x:1,y:2}].map((position,i)=>({unitId:`w${i}`,teamId:'us',position,inventory:{gold:0,iron:0},inventoryCapacity:8,readyOnTurn:0}));
 return {match:{matchId,maxTurns:480},view:{turn:48,map:{width:20,height:20,cells},units,bases:[{baseId:'b',teamId:'us',position:{x:1,y:1}}],teamResources:{us:{gold:0,iron:4}},scores:{us:0}}};
}
CONFIG.exactFunding=false;calculateActions(scene('fixed'),{teamId:'us'});assert.equal(getStrategyStatus().basePlan,null);
CONFIG.exactFunding=true;const actions=calculateActions(scene('priced'),{teamId:'us'});const plan=getStrategyStatus().basePlan;assert.ok(plan);assert.equal(plan.funding.additionalIron,2);assert.equal(plan.funding.target,22);assert.ok(plan.estimatedSetup<15);assert.equal(actions[plan.funding.worker].type,'move');
calculateActions(scene('unfunded',false),{teamId:'us'});assert.equal(getStrategyStatus().basePlan,null);
// Collected iron should be banked even if the project is no longer viable.
const orphan=scene('orphan',false);orphan.view.map.cells[210]={type:'empty'};orphan.view.map.cells[211]={type:'empty'};orphan.view.units[0].inventory.iron=2;const result=calculateActions(orphan,{teamId:'us'});assert.equal(result.w0.type,'move');
console.log('Passed: route-priced funding approves a justified project rejected by the fixed allowance; mines only two needed iron; rejects unavailable funding; returns construction iron after cancellation.');
