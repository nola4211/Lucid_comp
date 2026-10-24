LPC V4 — EXPERIMENTAL COORDINATED DEPOSIT ASSIGNMENT

Run as usual, from this folder. Stop previous clients first and create a
new practice match before starting. Use your team key privately:

API_KEY='your-team-key' LUCID_API_BASE_URL='https://lpc.sh' npm start

Confirm: Starting lpc-v4-coordinated-experimental

CHANGES
Assigns candidate worker/deposit pairs across the team, prioritizing workers
already mining and shorter travel. Estimates remaining stock against each
assigned worker's free capacity. A small continuity preference reduces
switching between targets. Allows multiple workers on rich deposits with
enough stock. Keeps V3's optional second-base planner.

This is a greedy assignment heuristic, not a globally optimal solution.
It does not enforce fixed territories or support cargo handoffs.
The tested exploration-spreading option remains OFF: it did not improve
on deposit assignment alone on the initial experimental maps.
No special endgame iron collection is added in this version.

EVIDENCE AND LIMITS
24 paired simplified solo maps, 30x30, 480 turns, gold and iron:
V3 mean banked gold: 266.58
Candidate mean: 271.75 (+1.94%)
15 wins, 1 tie, 8 losses.
On the first 12 seeds the candidate averaged 281.50 versus 268.33.
On 12 fresh seeds it averaged 262.00 versus 264.83.
The paired mean difference was 5.17 gold, with standard error 8.43.
This is too uncertain to claim reliable improvement. Keep V3 as baseline.
Zero invalid actions and zero final carried gold in these candidate runs.
The local engine simplifies resolution, omits opponents and rich-center
rules, respawns gold uniformly, and does not respawn depleted iron.

Focused checks cover miner priority, assigning closer workers, allowing
useful simultaneous mining on rich ore, and depositing a full load.
A construction guard avoids a known movement-before-building conflict.

LOGGING
match-analysis.jsonl records bank, inventories, decisions, planning targets,
known-map changes and strategy computation time. No API key is logged.
Preserve the entire file: later map records are changes to earlier records.
Share it with the action replay and final scoreboard after the match.
Only delivered strategy states are logged, not a guaranteed final state.

STRATEGY PRIORITIES
Measure unproductive travel and assignments, not overlap alone.
Shared routes and deposits can be useful; workers do not block movement.
Build near persistent useful gold when predicted travel savings pay back
iron gathering, travel and construction. Construction is not mandatory.
After gold opportunities run out, consider banked iron for tiebreaks; gold
has strict priority and one extra gold beats any iron advantage.
