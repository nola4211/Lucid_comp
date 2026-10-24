#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { runBot, isMarsView } from './bot_client.js';

/** @import {BotState, Identity, ActionsByEntity, Coordinate, CoordinateGrid, TerritoryState, MovementState, BaseLocation, Resource} from './bot_client.js' */

/** @param {BotState} state @param {Identity} identity @returns {ActionsByEntity} */
export function calculateActions(state, identity) {
  /** @type {ActionsByEntity} */
  const actions = {};
  if (!isMarsView(state.view)) return actions;

  for (const worker of state.view.units) {
    if (worker.teamId !== identity.teamId) continue;

    // Strategy goes here.

    actions[worker.unitId] = { type: 'pass' };
  }

  return actions;
}

// Game helpers. Feel free to use, discard, or modify.
// Fill in the strategy section above.
/** @param {CoordinateGrid} map @param {Coordinate} p */
function cellAt(map, p) {
  if (
    !Number.isInteger(p.x) ||
    !Number.isInteger(p.y) ||
    p.x < 0 ||
    p.y < 0 ||
    p.x >= map.width ||
    p.y >= map.height
  )
    return undefined;

  const rowStart = p.y * map.width;
  return map.cells[rowStart + p.x];
}
/** All visible claims; overlapping territories can belong to more than one team.
 * @param {TerritoryState} state @param {Coordinate} p */
export function isClaimed(state, p) {
  return [
    ...new Set(
      state.bases
        .filter((base) => Math.abs(base.position.x - p.x) + Math.abs(base.position.y - p.y) <= 2)
        .map((base) => base.teamId)
    )
  ];
}
/** @param {TerritoryState} state @param {Coordinate} p */
export function isBase(state, p) {
  return (
    state.bases.find((base) => base.position.x === p.x && base.position.y === p.y)?.teamId ?? null
  );
}
/** @param {{map: CoordinateGrid}} state @param {Coordinate} p @returns {Resource | null} */
export function isOre(state, p) {
  const cell = cellAt(state.map, p);
  return cell && (cell.type === 'gold' || cell.type === 'iron') && (cell.amount ?? 0) > 0
    ? cell.type
    : null;
}
/** Unknown cells are excluded. Obstacles are traversable; workers do not block.
 * @param {MovementState} state @param {Coordinate} p @param {string} [teamId] */
export function canMoveOnto(state, p, teamId) {
  const cell = cellAt(state.map, p);
  const base = isBase(state, p);
  return !!cell && !['hidden', 'void'].includes(cell.type) && (base === null || base === teamId);
}
/** Lowest visible cost until ready at the destination. Start must be ready; null means no route.
 * @param {CoordinateGrid} map
 * @param {Coordinate} start
 * @param {Coordinate} end
 * @param {{bases?: readonly BaseLocation[], teamId?: string, obstacleCost?: number}} [options]
 * @returns {Coordinate[] | null} */
export function pathTo(map, start, end, options = {}) {
  const obstacleCost = options.obstacleCost ?? 3;
  if (!Number.isFinite(obstacleCost) || obstacleCost < 1) return null;
  const state = { map, bases: options.bases ?? [] };
  if (!canMoveOnto(state, start, options.teamId) || !canMoveOnto(state, end, options.teamId))
    return null;
  const key = (/** @type {Coordinate} */ point) => `${point.x},${point.y}`;
  const distance = new Map([[key(start), 0]]);
  /** @type {Map<string, Coordinate>} */
  const previous = new Map();
  const queue = [start];
  while (queue.length > 0) {
    queue.sort((a, b) => (distance.get(key(a)) ?? Infinity) - (distance.get(key(b)) ?? Infinity));
    const current = queue.shift();
    if (!current) break;
    if (key(current) === key(end)) break;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const next = { x: current.x + dx, y: current.y + dy };
        if (!canMoveOnto(state, next, options.teamId)) continue;
        const terrain = cellAt(map, next)?.type;
        const stepCost = terrain === 'mountain' || terrain === 'crater' ? obstacleCost : 1;
        const cost = (distance.get(key(current)) ?? Infinity) + stepCost;
        if (cost >= (distance.get(key(next)) ?? Infinity)) continue;
        distance.set(key(next), cost);
        previous.set(key(next), current);
        if (!queue.some((point) => key(point) === key(next))) queue.push(next);
      }
    }
  }
  if (!distance.has(key(end))) return null;
  const path = [];
  let current = end;
  while (key(current) !== key(start)) {
    path.push(current);
    const parent = previous.get(key(current));
    if (!parent) return null;
    current = parent;
  }
  return path.reverse();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runBot(calculateActions).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
