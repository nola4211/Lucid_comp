import json,collections,csv,pathlib
src='/Users/fordnola4211/Downloads/match-ca31db86-2bf0-4d81-a052-f2d71ac36d18-actions.json'
d=json.load(open(src));out=pathlib.Path('outputs/garrett-review');out.mkdir(exist_ok=True)
summary=[];cycles=[];workers=[]
for team in d['teams']:
 rows=[(t['turn'],a) for t in d['turns'] for a in t['actions'] if a['teamId']==team['id']]
 counts=collections.Counter(a['action']['type'] for _,a in rows)
 summary.append({'team':team['displayName'],'workers_with_actions':len({a['entityId'] for _,a in rows}),'submitted_actions':len(rows),**dict(counts),'moves_per_mining_attempt':counts['move']/counts['mine'] if counts['mine'] else None,'mining_share':counts['mine']/len(rows) if rows else 0,'construction':[(t,a['entityId'],a['action']['type']) for t,a in rows if a['action']['type'] in ['spawn','build-base']]})
 if not any(x in team['displayName'] for x in ['Garrett','Them bois']):continue
 for wid in sorted({a['entityId'] for _,a in rows}):
  r=[(t,a['action']) for t,a in rows if a['entityId']==wid];start=r[0][0];c=collections.Counter();lastdep=None
  for t,a in r:
   c[a['type']]+=1
   if a['type']=='deposit':
    cycles.append({'team':team['displayName'],'worker':wid,'start':start,'deposit_turn':t,'mining_attempts':c['mine'],'movement_instructions':c['move'],'pass_instructions':c['pass']});start=t;lastdep=t;c=collections.Counter()
  workers.append({'team':team['displayName'],'worker':wid,'first_turn':r[0][0],'last_turn':r[-1][0],**dict(collections.Counter(a['type'] for t,a in r)),'last_deposit':lastdep,'mine_attempts_after_last_deposit':c['mine']})
json.dump({'matchId':d['matchId'],'limitations':'Action submissions only; no scores, terrain, positions, resources, inventories or action outcomes. Counts are attempts, not verified output. This BYU strategy belongs to the teammate, not the bot versions developed in this chat.','teams':summary,'workers':workers},open(out/'action-summary.json','w'),indent=2)
with open(out/'deposit-cycles.csv','w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=list(cycles[0]));w.writeheader();w.writerows(cycles)
