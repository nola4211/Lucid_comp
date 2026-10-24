# Lucid competition — shared data archive

A place for the team and its AI agents to read the game data and lessons gathered so far.

**Start with [TEAM_CONTEXT.md](TEAM_CONTEXT.md), then take the files you need.**

| What you want | Where it is |
|---|---|
| All matches and available records | [Match index](data/match-index.json) |
| Game replays, telemetry and scoreboards | [Match files](data/matches) |
| Trial results and tested variants | [Experiment index](data/experiment-index.json), [raw results](data/experiments/original-results) |
| Existing strategy snapshots, starter through V6 | [Strategies](strategies), [version registry](data/strategy-registry.json) |
| What worked, what failed and what remains uncertain | [Findings](knowledge/findings.jsonl), [strategy history](docs/strategy-history.md) |
| Ideas we discussed | [Ideas backlog](docs/ideas-backlog.md) |
| Garrett's strategy analysis | [Review](analysis/garrett/strategy-review.md) |
| Game rules supplied during development | [Rules](docs/game-rules-provided.md) |

Includes six complete action exports, records spanning nine match IDs, all six saved strategy versions plus the starter, and the available local trial results. Existing code is archived as reference material. This archive does not create a new bot.

For your AI, give it this repo link and say:

> Read TEAM_CONTEXT.md and AGENTS.md, then use the match index, experiment index and findings as shared context for our competition work. Cite the evidence you use and distinguish successful game outcomes from action attempts and simplified simulations.

Raw game exports are preserved as gzip files; readable turn chunks are alongside them. Some logs are partial. Team keys and unrelated Terminal history are excluded. The repo is public.
