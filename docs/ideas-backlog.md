# Ideas and their current status

| Idea | Status | Next useful test |
|---|---|---|
| Three-worker opening using initial iron | Tested in simplified models; used in recent official games | Compare conditional fourth-worker payback under official competition |
| Prefer nearest gold versus trip-rate heuristic | Nearest won the original paired toy test; return policy changed too | Isolate selection from partial-return behavior |
| Give on-site miners allocation priority | Reproduced coordination defect fixed in V2 | Preserve scarcity streaks when opponents contest ore |
| Global greedy deposit assignment | Mixed training/holdout results | Evaluate travel and delivery loads in official states |
| Separate exploration footprints / fixed territories | Footprints tested with mixed results; fixed territories untested | Test flexible region assignments without stranding workers |
| Assembly line / cargo handoff | Unsupported by supplied actions | Use nearby bases and independent collection loops instead |
| Route-priced construction funding | V6 candidate; small uncertain model gains | Official matched V5/V6 trials, inspect candidate rejection reasons |
| Early base near productive clusters | Supported by Garrett's action pattern; location/outcomes unknown | Measure successful construction, deposits and paid-back travel |
| More than one additional base / late relocation | Untested in our shipped strategies | Only approve where remaining horizon and stock repay setup |
| Automatic fourth worker | Not shipped; teammate's fourth worker showed low activity | Require a concrete profitable assignment and iron opportunity cost |
| React to depleted/claimed/contested ore | Focused behavior checks passed; score benefit unproven | Log successful reactions and avoided wasted travel against opponents |
| Revisit old explored ground for respawns | Included in V5 when no frontier/gold is available | Compare against deliberate patrol schedules |
| Center-directed exploration | Reduced returns on initial rich-center test; disabled | Retest only with a new hypothesis and holdout seeds |
| Fuller loads before returning | Garrett had more eight-attempt delivery cycles | Compare actual gold loads, not mine attempt counts |
| Deadline-aware mining/return/deposit | Included; empty endgames observed in latest runs | Test obstacle/cut-route cases and final deposit margin |
| Late iron tiebreak collection | Proposed; no special policy shipped | Collect only when it does not sacrifice bankable gold |
| Predict enemy depletion | V5 heuristic assumes visible opponents continue mining | Measure over-avoidance when opponents are full, leaving or doing other work |
| Claim unclaimed ore before an opponent's hub forms | Proposed legal tactic | Include overlapping claims and build-before-mine timing |
| Attack/block workers | No combat action; workers do not block movement | Do not build a strategy on unsupported mechanics |
| Faster decision computation | Current measured local calls are milliseconds | Optimize only if timing/late-submission data identifies a bottleneck |

The strongest open problem is productive travel: early hubs, timely relocation and assignments that deliver more banked gold per worker-turn. No idea in this table is a promised winning strategy.
