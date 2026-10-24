import fs from 'node:fs';
import {calculateActions,getStrategyStatus} from '../outputs/lpc-bot-v6/bot_template.js';
const matchId='match-994eef88-f785-4100-bbb8-547160294eda';
const rows=fs.readFileSync('outputs/lpc-bot-v5/match-analysis.jsonl','utf8').trim().split('\n').map(JSON.parse).filter(r=>r.matchId===matchId);
const team=rows[0].workers[0].teamId;let known=[];const plans=[],actions=[];
for(const row of rows){
 const {width,height,changes}=row.map;if(!known.length)known=Array.from({length:width*height},()=>({type:'hidden'}));
 for(const change of changes)known[change.index]=change.cell;
 const sources=[...row.workers,...row.bases.filter(b=>b.teamId===team)];
 const visible=(x,y)=>sources.some(s=>{
  const dx=Math.abs(s.position.x-x),dy=Math.abs(s.position.y-y),terrain=known[s.position.y*width+s.position.x]?.type;
  return dx+dy<=3 || (['mountain','crater'].includes(terrain) && Math.max(dx,dy)<=1);
 });
 const view={turn:row.turn,map:{width,height,cells:known.map((c,i)=>visible(i%width,Math.floor(i/width))?c:{type:'hidden'})},units:row.workers,bases:row.bases,teamResources:{[team]:row.bank},scores:row.scores,warnings:row.warnings,info:row.info,effects:row.effects};
 const result=calculateActions({match:{matchId:'shadow-'+matchId,maxTurns:480},view},{teamId:team});
 const status=getStrategyStatus();if(status.basePlan)plans.push({turn:row.turn,...status.basePlan,sitePosition:{x:status.basePlan.site%width,y:Math.floor(status.basePlan.site/width)}});
 if(JSON.stringify(result)!==JSON.stringify(row.actions))actions.push(row.turn);
}
const report={note:'Passive decision replay of V5 observations and worker states. V6 actions were NOT executed; this cannot predict a counterfactual score. Enemy workers are omitted because the old log did not save their positions.',firstPlans:plans.slice(0,8),turnsWithPlans:plans.length,turnsWithDifferentActions:actions.length};
fs.writeFileSync('outputs/v6-shadow-review.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
