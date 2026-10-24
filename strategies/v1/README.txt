LPC BOT — FIRST MEASURED BASELINE

Keep bot_template.js, bot_client.js and package.json together in this folder.
Create a new practice match on the competition website.
In Terminal type cd followed by a space, drag this folder into Terminal,
and press Return. Then run:

API_KEY='your-team-key' LUCID_API_BASE_URL='https://lpc.sh' npm start

Replace your-team-key privately. Run only one client at a time.
Stop an old client with Control-C before starting another.

BEHAVIOR
Recruits two extra workers using 11 of the initial 15 banked iron.
Remembers explored terrain and routes around slow terrain when faster.
Chooses the nearest reachable eligible gold, reserving expected loads
so workers tend to choose different deposits.
Returns full loads, or partial loads when no useful gold is known.
Budgets travel home and a deposit turn before the match ends.
Explores when there is no known useful gold.
No new bases, iron mining or trading in this baseline.
Movement costs assume the supplied default obstacle cost of three.

EVIDENCE
48 simplified solo simulations across 12 seeds, 480 turns each.
Rate-based selection with partial-load return heuristic:
  1 worker: mean 114.67 gold (range 96–139)
  2 workers: mean 197.92 gold (range 171–219)
  3 workers: mean 277.75 gold (range 261–302)
Nearest gold, full-load preference, 3 workers: mean 307.33 gold.
Nearest won all 12 paired seeds against the rate version.
The 36 rate-version runs had zero invalid actions and zero final carried gold.
Raw results include the corresponding metrics for all 48 runs.

LIMITATIONS
This is a custom simplified simulator, not the official game engine.
20x20 maps, 14 normal gold deposits, no enemies, no iron deposits,
uniform gold respawns without official spacing or rich-center rules.
It models fog, terrain waits, capacity, spawning and depositing.
These results select a starting hypothesis; they do not establish
optimal play or predict official scores. Selection and partial-return
behavior changed together, so their effects have not been isolated.

AFTER EACH OFFICIAL MATCH
Share the action replay and final scoreboard. A full-state replay, if
available, permits much stronger analysis than an action log alone.
Measure banked gold, gold per worker-turn, final carried gold,
idle actions excluding cooldown, unsuccessful actions, return-trip time,
mining time, and recruitment payback when the supplied data permits.
Compare the same seeds, opponents and settings over several matches.
Change one strategy choice at a time. Keep an earlier baseline and test
new settings on additional seeds before deciding an improvement is real.
