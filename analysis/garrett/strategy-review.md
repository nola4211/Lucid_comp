Garrett Ermer — strategy review of match ca31db86

This review compares [USU] Garrett Ermer with the teammate-controlled [BYU] Them bois in the supplied 480-turn action log. It does not evaluate the bot versions developed in this chat. The file contains accepted action submissions, without positions, terrain, inventories, resource types mined, scores or action outcomes. It cannot establish Garrett's final score, rank, starting-map advantage, exact base placement or whether a particular mine/build/deposit succeeded.

| Observable action pattern | Garrett | Teammate's BYU bot |
|---|---:|---:|
| Worker IDs submitting actions | 3 | 4 |
| Spawn attempts | Turns 2, 3 | Turns 2, 3, 26 |
| Base-build attempts | Turn 41 | Turns 156, 180 |
| Mine attempts | 336 | 276 |
| Move instructions | 942 | 1,377 |
| Deposit attempts | 50 | 52 |
| Pass instructions | 91 | 158 |
| Moves per mine attempt | 2.80 | 4.99 |
| Mine attempts / submitted actions | 23.6% | 14.8% |
| Completed deposit cycles containing 8 mine attempts | 29 of 50 | 17 of 52 |
| Completed deposit cycles containing at most 3 mine attempts | 5 of 50 | 13 of 52 |

A deposit cycle here means the submitted actions after one deposit through the next deposit for the same worker; the initial cycle starts at that worker's first submission. Eight mine attempts is evidence of a full-load preference, not proof of an eight-kilogram load. A mine might fail or collect iron. Similarly, 336 mine attempts is not a 336-gold score.

What is worth copying

1. Prioritize a productive three-worker economy over another worker by default. Garrett attempted 21.7% more mining with 31.6% fewer movement instructions. His move-to-mine ratio was 43.8% lower. This is a strong action-efficiency signal in this match, although map luck and unverified actions could contribute. It does not prove three workers are always optimal.

2. Seek an early, well-used additional base. Garrett attempted his base at turn 41, 115 turns before BYU's first attempt. His worker 2 later submitted several compact loops: turns 110–120, 135–145, 146–156 and 157–167 each consist of 8 mine actions, 2 moves and 1 deposit. If these actions succeeded and mined gold, each loop delivers 8 gold in 11 worker-turns. That is consistent with resources one step from a deposit point. Without positions, it is not proof of the precise geometry or which base was used.

   The mathematical lesson is to reduce repeated round-trip cost. A full load with d travel turns each way yields 8 / (8 + 2d + 1) gold per worker-turn in the ideal case. At d=1 this is 0.727; at d=10 it is 0.276. These figures assume successful gold mining, no competition, and an eight-unit load. A profitable base can matter much more than another miner.

3. Prefer useful loads over frequent small deliveries. Garrett's completed cycles averaged 6.68 mine attempts per deposit; BYU's averaged 5.31. Garrett had 29 cycles with eight attempts, versus 17. Our policy should prefer fuller loads when ore remains reachable, but allow partial deposits before deadlines or when further mining has poor return.

4. Budget investment before expanding the workforce. The third recruited worker costs 11 iron, whereas the first two together cost 11. If every listed base-build attempt succeeded, Garrett's two recruits and one base cost 17 iron; BYU's three recruits and two bases cost 34. After the starting 15, that would require at least 2 versus 19 newly banked iron. Those are conditional construction budgets, not observed bank balances. Investment diverts mining turns from gold and must repay itself before the deadline.

Where Garrett's pattern weakens

1. Mining activity nearly halved late in the game. Turns 1–240 contain 221 mine attempts; turns 241–480 contain 115, a 48.0% decline. Movement rises from 393 to 549 instructions. This is consistent with depletion near an early productive base and longer searches or return trips later, but positions and resource stocks are needed to confirm that explanation. Our response should reassess a mining region before it runs dry and stage exploration or a profitable next base rather than wait for throughput to collapse.

2. Several trips became extremely long. Worker 1 submitted 88 movement instructions between deposits at turns 248 and 347, with only eight mine attempts. Worker 3 submitted 70 movements between deposits at turns 278 and 357, with six mine attempts. Its next cycle, ending at 465, contains 81 moves and seven mine attempts. We should compare complete collection-and-return cost against alternative regions, and reject stale or likely exhausted targets. More movement is not automatically waste; these are investigation targets, not proof of a routing bug.

3. There is a builder waiting window. Worker 2 submits 14 consecutive passes on turns 27–40, then a base-build action on 41. Under the default three-turn obstacle cost, one terrain entry alone cannot explain all 14 passes. It might be waiting for iron, preserving a chosen site or satisfying another planning condition. State data is needed before declaring the wait a mistake. A robust planner should record why a builder waits, re-evaluate whether the project still pays, and cancel or reassign when appropriate.

4. Two late mine attempts cannot add to banked gold. Worker 1's last deposit is turn 462; it mines on 479 and moves on 480. Worker 2's last deposit is 441; it mines on 465 and never deposits afterward. If those attempts succeeded, that material remains carried at the end. The action sequence alone proves those attempts cannot increase banked gold before the deadline. Carried resources can still affect later tiebreaks. Our bot should require enough route time for the return AND a separate deposit action before committing to late mining.

5. Extra workers are not automatically useful on our side either. BYU's fourth worker submits just 38 mine attempts, versus 64, 79 and 95 for its other workers. It also submits 354 moves and 49 passes. Its slightly shorter lifetime does not explain most of this difference. This does not establish negative return: its construction work and actual gold output are unknown. It does show why each extra worker needs a funded assignment and a measured payback estimate.

How to compete against this pattern within the rules

- Contest valuable unclaimed clusters early when expected banked output justifies it. Garrett's strong opening makes an uncontested local mining hub dangerous. Use observed opportunities, not a hard-coded assumption that he always builds on turn 41.
- Build claims strategically. A base can deny an ore tile to an opponent only while that opponent has no claim of its own there. Overlapping claims allow both teams to mine, so building nearby does not automatically steal his deposit. A new base applies its claim before mining that turn.
- Preserve mining priority on genuinely contested ore. Eligible consecutive mining and time on the deposit determine scarcity priority; faster submission does not. Do not interrupt a productive mining streak merely to shuffle workers. Conversely, avoid a long trip to ore an incumbent is likely to exhaust before we arrive.
- Use the late-game opening. His mining activity falls sharply after halfway, so sustainable exploration and prompt reassignment may matter more than matching his peak opening burst. This is a hypothesis to test across multiple maps, not a guaranteed exploit.
- Do not try to block his movement by stacking workers. Workers can overlap and do not obstruct paths. No cargo-transfer or combat action exists in the supplied rules.

Recommended next experiment

Keep the existing three-worker opening. Test a version that searches for an early second base using projected trips and remaining stock, then measures actual gold deposited through that base. Require minimum expected savings after paying for iron gathering, builder travel, construction and the risk of depletion. Do not add a fourth worker unless its best available assignment repays its cost.

Separately test regional reassessment after a drop in recent mining output, and the deadline rule that accounts for the final deposit action. Run these as separate changes against a baseline, using repeated seeds, settings and opponent rosters. Treat opponent strategies as adaptive; a successful counter in one replay may fail elsewhere.

The next useful evidence is the final scoreboard plus a full-state replay or turn-by-turn state export. That would let us verify Garrett's actual output, successful bases, locations, resource mix, carried endgame gold and whether the attractive short loops explain his score. Until then, the strongest conclusion is about action efficiency and investment timing, not proven win rate.
