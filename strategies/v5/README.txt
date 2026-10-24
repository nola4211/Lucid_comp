LPC V5 — REACTIVE EXPERIMENTAL CANDIDATE

The earlier bot already recalculated movement and mining every turn.
This candidate adds deliberate responses and records why plans changed.

RESPONSES
- Newly observed depletion: abandon the deposit and reassign workers.
- Newly observed enemy base: respect its claims and blocked base tile,
  recalculate routes, and cancel an affected construction project.
- Visible enemy workers on a deposit: estimate stock left at arrival,
  assuming those workers continue mining. Their actual future actions and
  inventories are unknown; this is a conservative estimate, not knowledge.
- Better gold: prefer existing assignments for small travel savings;
  permit switches for larger improvements or invalid targets.
- Construction: reconsider remaining gold and remaining setup cost every
  turn. Cancel a project that no longer appears worth completing.
- No reachable unexplored frontier or eligible gold: revisit old ground
  to discover resource respawns instead of waiting indefinitely.
- Cooldown and endgame: respect readiness and budget the return and deposit.

Only visible information and remembered observations are available.
The bot cannot react to changes it has not seen.

TESTING
Behavior checks: depletion, new enemy claim, likely enemy depletion before
arrival, retaining a target for a one-turn saving, switching for a three-turn
saving, cooldown recovery, a newly blocked route, and cancelling a base
project after its supporting gold disappears. All passed.

24 simplified solo 30x30 simulations, 480 turns, same initial seeds as V4:
V4 mean gold: 271.75
V5 mean gold: 270.58
Zero invalid actions and zero final carried gold in these V5 runs.
This is behavioral validation, not evidence of a score improvement.
The simulation lacks opponents, so it does not measure the new opponent
response. Its respawn and turn-resolution mechanics are simplified.
Do not claim better official win rate until practice matches support it.

Artificial fully visible 50x50 timing check, 60 strategy calls:
median about 8ms, 95th percentile about 18ms, maximum about 46ms on this
machine. This excludes networking and log writes and is not a deadline
guarantee for other machines or match conditions.

RUN
Keep all files together. Stop the previous bot with Control-C.
Create a new practice match. In Terminal type cd and a space, drag THIS
lpc-bot-v5 folder in, press Return, then privately replace your key in:

API_KEY='your-team-key' LUCID_API_BASE_URL='https://lpc.sh' npm start

Confirm: Starting lpc-v5-reactive-experimental

REVIEW
Keep previous versions for comparisons on the same seeds and roster.
After a match share the scoreboard, action replay and match-analysis.jsonl.
The log records observed-map changes, bank, inventories, targets, reaction
events and strategy computation time. No API key is logged. Preserve the
whole log because later map entries are changes to earlier observations.
Only states delivered to the strategy are logged, not a guaranteed final
state. Events reveal what the bot observed, not the full hidden world.
