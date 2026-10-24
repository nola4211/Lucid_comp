# Shared context — read first

Objective: maximize gold remaining in the shared bank after 480 turns. Carried gold does not count toward that score. Banked iron is the first tiebreak. Each worker submits one fresh action per turn; movement, mining and depositing are separate actions.

## Where we stand

- V5 won the latest shared official practice match with 204 gold versus 188 for second. All 204 mined gold was banked; final logged inventories were empty. It submitted 207 mine attempts: three failed. No movement attempt failed. It did not approve or build an additional base.
- V6 replaces a fixed iron-gathering allowance in base planning with known route, mining and deposit costs. It keeps three workers and reactive coordinated assignments. It also returns iron from cancelled projects and banks a funded builder's cargo before construction. It remains an unconfirmed candidate for official play.
- V6 versus V5 on 24 paired simplified uniform maps averaged 278.96 versus 270.58 gold; on 24 rich-center maps, 384.96 versus 381.50. Variation is large relative to the mean differences. These are not demonstrated win-rate improvements.
- Center-directed exploration reduced returns in its initial test and is disabled. Exploration spreading and global ore assignment also had mixed evidence; consult raw results rather than assuming every version is better.
- Garrett's replay suggests a compact early mining hub: three workers, base attempt on turn 41, 336 mine attempts and 942 moves. The teammate-controlled BYU bot had four workers, 276 mine attempts and 1,377 moves. Garrett's action count is NOT his gold score. His late mining declined sharply, and two mine attempts occurred after their workers' final deposits.

## Strategy lineage

| Version | Main change | Evidence status |
|---|---|---|
| Starter | Pass every turn | First official action export confirms 480 passes |
| V1 | Gold collection, exploration, return deadline, three-worker opening | Simplified tests; partial terminal match |
| V2 | Give on-site miners priority before reserving deposits for travelers | Focused bug reproduced and fixed; official telemetry shows 199 banked gold before end |
| V3 | Optional one additional base and construction iron collection | Screenshot: 193 gold, second on banked-iron tiebreak; position log only through turn 189 |
| V4 | Team-wide greedy ore assignment and switching preference | Mixed simulation results; experimental |
| V5 | Reactive depletion/claim/competition checks, cancellation, revisiting old ground | Latest confirmed official practice win: 204 gold |
| V6 | Price construction funding from actual known routes | Small uncertain simulation gains; official result not supplied |

## Important provenance limits

- Match a64dfc31 has 152 gold on the scoreboard but includes building/trading actions the supplied V1 source cannot issue. Its executing source is unresolved. Do not label it a V1 result.
- Match ca31db86 is the teammate's separate code, explicitly identified by the user. Its source and final scores were not provided.
- Match 62e5b30a has a complete action export and V2 states 0–479. Match e6512d1b has a complete action export but only V3 states 0–189. Match 994eef88 has complete action data and V5 states 0–479.
- Additional incomplete practice runs are preserved. Do not score an interrupted or partial run as a completed game.
- Exact source commits, seeds and settings were not captured in most old official runs. Saved strategy hashes identify current archived snapshots, not necessarily the exact bytes at every historical measurement.
- Telemetry ends at the last state delivered to the strategy, usually 479. A final scoreboard and that state are distinct evidence.

## Open questions from the session

1. Test V5 versus V6 across repeated official seeds/settings/rosters. Inspect V6's base candidate evaluations and actual base payback.
2. Measure travel per delivered load, gold per available worker-turn, deposit load distribution, target switches and idle turns excluding cooldown.
3. Improve regional reassignment when a productive mining area is exhausted. Avoid long trips to stale or nearly depleted ore.
4. Test a fourth worker only when it has a profitable assignment and enough time to repay iron diversion.
5. Test late iron collection only when it will not sacrifice gold, since an earlier match tied on gold and lost on iron.

These are recorded questions, not a request to build or change a bot. Do not promise wins or infer hidden state. Read docs/testing.md before comparing experiments.
