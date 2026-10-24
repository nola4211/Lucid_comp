LPC V6 — ROUTE-PRICED BASE FUNDING

RUN
Stop the previous bot with Control-C. Start a fresh practice match.
In Terminal type cd followed by a space, drag THIS lpc-bot-v6 folder into
Terminal and press Return. Then privately replace your key in:

API_KEY='your-team-key' LUCID_API_BASE_URL='https://lpc.sh' npm start

Confirm: Starting lpc-v6-route-priced-bases
Keep Version 5 for comparisons. Let each match finish before creating another.

WHAT THE LAST OFFICIAL MATCH SHOWED
Version 5 won with 204 gold, 16 ahead of second place. Its log confirms
204 gold mined and banked, empty final inventories, no failed moves and
three failed mining attempts out of 207. Average deposited load was 6 kg.
There were 28 cooldown passes and 34 ready passes before the last logged
turn. No additional base was planned or built. Decision time was about
6.8ms at the median, maximum about 65.5ms, excluding log writes/network.

WHAT CHANGED
The base planner previously charged a fixed 24-turn allowance for fetching
iron, plus mining and builder travel. V6 prices the known funding route:
collector to iron, the missing quantity, return to a friendly base, and
one deposit action. It also accounts for builder travel, inventory return
when required, and construction. It considers collected iron and avoids
charging the builder's return twice when it also carries the supply.

Plans still require estimated travel savings to exceed 1.5 times estimated
remaining setup work. Only observed, recent gold and eligible known iron
are counted. A project can be cancelled as ore disappears or claims change.
A builder carrying gold is sent to bank it before constructing once funded.
Iron collected for a cancelled project is returned to the bank.
No extra base is guaranteed: some observed opportunities do not pay.
The route pricing is an estimate, not an exact schedule or score forecast.

Garrett's replay motivated the focus on early productive mining hubs and
fuller collection loops. His replay provides action patterns, not verified
scores or exact geography. V6 retains three workers, coordinated deposits,
reactive target checks and the endgame return/deposit budget.

A center-directed exploration experiment lowered returns on its test seeds.
That option remains OFF in the shipped version.

TEST RESULTS
24 paired seeds per setting, simplified solo maps, 480 turns:
Uniform map setting: V5 mean 270.58 gold; V6 mean 278.96 (+3.10%).
Rich-center setting: V5 mean 381.50; V6 mean 384.96 (+0.91%).
Zero invalid actions and zero final carried gold in these V6 runs.
Raw results, paired variability and limitations are in experiment-results.json.
These small gains do not establish a better official win rate.

The solo engines omit opponents, iron respawning and official ore spacing.
The rich-center engine resolves movement before construction and deposits
last. Its initial center allocation is probabilistic rather than the
competition's exact initial count. The older uniform engine simplifies
turn resolution. Compare versions within a setting, not across settings.

Focused checks cover depleted ore, new claims, blocked routes, visible
competition, target stability, cooldown, cancellation, route-priced funding
and returning orphaned construction iron. They all pass.
Artificial fully observed 50x50 timing check: median about 4ms, maximum
about 42ms for 60 strategy calls on this machine, excluding logging/network.

REVIEW THE NEXT MATCH
Share the final scoreboard, action replay and match-analysis.jsonl.
The log now records evaluated base candidates with savings, setup costs
and whether funding was available. It also saves visible enemy units and
rich-center settings, which were missing from earlier logs.
Map records are incremental; preserve the entire file. No API key is logged.
Only states delivered to the strategy are logged, not a guaranteed final state.

OPTIONAL REPRODUCIBLE CHECKS
From this folder:
node experiments/check-reactions.mjs
node experiments/check-funding.mjs
node experiments/benchmark.mjs

The simplified engines and V5 reference are also in experiments/. For example:
node experiments/simulate-rich-center.mjs ../bot_template.js candidate.json
node experiments/simulate-rich-center.mjs ./baseline-v5.mjs baseline.json
Those imports resolve relative to the simulator file. Results are written
to the current directory. A fourth argument can override exported CONFIG
as JSON, and a fifth sets the starting seed. Each run uses 12 seeds.
