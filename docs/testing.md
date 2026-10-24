# Evidence and testing

An official action export contains match/team identifiers, submitted actions and turns. A telemetry log contains only the states available to the running strategy, often with incremental map changes. A scoreboard screenshot supplies a displayed outcome. A simplified local simulation supplies a model result, not an official result.

## Historical experiment code

The saved code is under strategies/v6/experiments and archive/working-scripts. Original result files and overlapping experiment families are indexed in data/experiment-index.json. Reading or downloading these files requires no installation. Some historical working scripts retain their original workspace paths.

## Model gaps

The original experiment uses 20x20 solo maps; later base/coordination tests use 30x30 solo maps with gold and iron. The rich-center model adds concentrated/richer gold and resolves movement first and deposits last. These engines omit opponents, official scarcity priorities, exact resource spacing and iron respawns. The older uniform model simplifies turn-resolution order. The rich-center initial center allocation is probabilistic rather than an exact rounded count. Memory, fog, movement waits, capacity and banking are modeled, but these are not an implementation of the entire official engine.

Compare variants within the same model, seeds, settings and roster. Different models have different score scales. Strategy choices affect depletion and therefore future resource placement; common seeds preserve initial conditions rather than identical trajectories. Averages should be accompanied by paired differences and variation. Keep fresh seeds separate from tuning seeds. Do not call a small uncertain mean change a demonstrated win-rate gain.

## Official trial record

Record the strategy source SHA/commit, configuration, seed (if known), settings, roster, client version, match ID, final score/placement and source evidence. Preserve original action export bytes and telemetry. Mark interruptions, missed states, unavailable source and incomplete data.

Useful measures: banked gold, gold per available worker-turn, delivery-load distribution, travel per load, idle turns excluding cooldown, failed actions, target switches, base funding/build turns, base-specific deposits and travel payback, final carried resources. Only compute measures the evidence actually supports.

Never change raw historical files to make checks pass. Derived data must identify its sources. Duplicate result containers are documented in the experiment index and must not inflate sample counts.
