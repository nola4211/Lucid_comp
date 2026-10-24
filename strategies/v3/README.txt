LPC V3 — ONE ADDITIONAL BASE

WHAT CHANGED
Keeps Version 2's three-worker opening and miner-priority allocation.
May build ONE additional base, with planning limited to the first half.
Uses recently observed gold stocks and route costs to estimate travel savings.
Only proceeds if estimated savings exceed 1.5 times estimated setup turns.
Accounts for builder travel, construction and a conservative iron-trip allowance.
With only 4 banked iron after recruitment, assigns one otherwise empty
worker to nearby eligible iron. Deposits enough to reach 6 before building.
Does not trade gold or recruit more than three workers.

BUILDING RULES
Candidate sites are empty known terrain near observed gold, not existing
bases, at least six travel turns from the current deposit network, and
outside known enemy territory. The builder must be alone when building.
Server checks remain authoritative when hidden enemies or bases exist.
Planning evaluates three promising sites with exact known route costs;
it is a heuristic, not a guarantee of optimal placement or future income.

TEST RESULTS
12 paired simplified maps, same seeds, 30x30, 480 turns, 24 gold deposits
and up to eight 3-kg iron deposits:
V2 mean: 234.58 banked gold.
V3 mean: 268.33 banked gold (+14.4%).
8 wins, 4 ties, 0 losses. A second base was built in 8 of 12 runs.
No invalid actions and no final carried gold in either set.
Focused checks confirmed justified early construction, no late construction,
and no unaffordable construction.

LIMITATIONS
Custom solo simulator, not the official engine; no enemies or rich-center
rules. Gold respawns uniformly without official spacing; depleted iron
is not respawned in this experiment. Terrain waits, fog, capacity, iron
banking, recruitment and friendly bases are modeled. Sequential resolution
is simplified. These figures are not comparable to prior smaller-map tests.
Official games must test whether opponents reduce construction's payback.
The previous official action log and telemetry confirm V2 banked 199 gold
by turn 478, mined all 199 successfully, and ended its logged states empty.
Different official maps/settings mean 152 versus 199 is not a controlled
comparison of versions.

RUN
Stop the old bot with Control-C. Create a new practice match.
In Terminal type cd and a space, drag THIS lpc-bot-v3 folder in,
and press Return. Then privately replace the key in:

API_KEY='your-team-key' LUCID_API_BASE_URL='https://lpc.sh' npm start

Confirm startup says: Starting lpc-v3-second-base
Do not create another match until this one finishes.
Share the final scoreboard, action replay and match-analysis.jsonl.
The analysis log appends states delivered to the strategy, including
inventories, bank, positions, visible ore and actions; no API key is logged.

NEXT REVIEW
When was iron collected and deposited? When was a base actually built?
How much gold was banked there, and how much travel did it save?
Were workers diverted from more profitable gold? Did it claim useful ore?
Compare multiple official seeds and rosters before keeping the change.
