LPC V2 — MINER PRIORITY

This candidate gives ready workers standing on gold first claim on their
remaining load before assigning ore to workers who still need to travel.
The prior version could make an on-site miner idle while a teammate walked
in. A focused scenario reproduced this and confirms the new behavior.

No base construction or trading is implemented in either supplied version.
The submitted official replay includes both; its executing code is not yet
identified. Do not attribute that replay's 152 gold to this candidate.

Testing: same 12 simplified seeds, nearest gold, 3 workers, 480 turns:
previous mean 307.33 gold; candidate mean 321.25 gold (about 4.5% higher).
This is not proof of improvement against official opponents. The custom
simulator uses smaller solo maps without rich-center or official respawn
spacing. The rate-selection experimental mode performed worse with this
change and remains disabled. Use the shipped nearest-selection setting.

HOW TO RUN
Stop any old bot with Control-C. Create a fresh official practice match.
In Terminal type cd and a space, drag THIS folder in, and press Return.
Then run, privately replacing the key:

API_KEY='your-team-key' LUCID_API_BASE_URL='https://lpc.sh' npm start

The startup message must say: Starting lpc-v2-miner-priority
Let the match finish without creating another match.

WHAT TO SHARE AFTERWARD
Final scoreboard, downloaded action replay, and match-analysis.jsonl from
this folder. That new log records your bank, inventories, positions,
readiness, visible ore, bases and decisions each turn. It contains no API
key. It appends across matches, identified by match ID and version.
It logs states delivered to the strategy, not a guaranteed final state;
the final scoreboard is still needed. It cannot reveal hidden enemy data.

Review goals: verify which actions succeeded, separate cooldown from idle,
measure deposit loads and travel, identify target switching and stale ore,
and estimate whether a new base would save enough future travel to justify
iron collection and its construction cost.
