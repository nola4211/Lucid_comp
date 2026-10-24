import { randomUUID } from 'node:crypto';

/** @typedef {{x: number, y: number}} Coordinate */
/** @typedef {'gold' | 'iron'} Resource */
/** @typedef {{gold: number, iron: number}} Inventory */
/** @typedef {'north' | 'east' | 'south' | 'west' | 'north-east' | 'south-east' | 'south-west' | 'north-west'} Direction */
/** @typedef {'Mercury' | 'Venus' | 'Earth' | 'Mars' | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto'} PlanetName */
/** @typedef {{type: 'empty' | 'mountain' | 'hidden' | 'void'} | {type: 'crater', formation?: {x: number, y: number, size: number}} | {type: 'gold' | 'iron', amount: number} | {type: 'unit', unitId: string, teamId: string}} MapCell */
/** @typedef {{width: number, height: number, cells: MapCell[]}} GameMap */
/** @typedef {{width: number, height: number, cells: readonly {type: string, amount?: number}[]}} CoordinateGrid */
/** @typedef {{teamId: string, position: Coordinate}} BaseLocation */
/** @typedef {BaseLocation & {baseId: string}} Base */
/** @typedef {{bases: readonly BaseLocation[]}} TerritoryState */
/** @typedef {TerritoryState & {map: CoordinateGrid}} MovementState */
/** @typedef {{unitId: string, teamId: string, position: Coordinate, inventory?: Inventory, inventoryCapacity: number, readyOnTurn: number}} Unit */
/** @typedef {{entityId: string, error: 'movement_interrupted', note: string}} Notice */
/** @typedef {{type: 'bonk', coordinate: Coordinate, entityIds: string[], note: string} | {type: 'resource_deposit', coordinate: Coordinate, baseId: string, resource: Resource, amount: number, total: number}} Effect */
/** @typedef {{width: number, height: number, min: number, max: number, spawnPercent: number}} HighGoldSettings */
/** @typedef {{turn: number, map: GameMap, units: Unit[], bases: Base[], scores: Record<string, number>, teamResources: Record<string, Inventory>, baseResourceDeposits?: Record<string, Inventory>, highGoldArea: HighGoldSettings, warnings: Notice[], info: Notice[], effects: Effect[]}} MarsView */
/** @typedef {{name: PlanetName, position: Coordinate, orbitRadius: number}} SolarPlanet */
/** @typedef {{teamId: string, position: Coordinate, previousPosition: Coordinate, heading: number, target: PlanetName | null, targetPosition: Coordinate | null, orbit: {planet: PlanetName, angle: number} | null}} SolarRocket */
/** @typedef {{turn: number, planets: SolarPlanet[], rockets: SolarRocket[], entityId?: string}} SolarView */
/** @typedef {{type: 'move', direction: Direction} | {type: 'mine' | 'pass' | 'deposit' | 'spawn' | 'build-base'} | {type: 'trade', from: Resource}} MarsAction */
/** @typedef {{type: PlanetName} | {type: 'move', x: number, y: number}} SolarAction */
/** @typedef {MarsAction | SolarAction} Action */

/** @param {MarsView | SolarView | undefined} view @returns {view is MarsView} */
export function isMarsView(view) {
  return view !== undefined && 'units' in view;
}

/** @param {MarsView | SolarView | undefined} view @returns {view is SolarView} */
export function isSolarView(view) {
  return view !== undefined && 'rockets' in view;
}

/**
 * @typedef {Object} TeamDescriptor
 * @property {string} id
 * @property {string} displayName
 * @property {false | string} botType
 */

/**
 * @typedef {Object} MatchSummary
 * @property {string} [cancellationReason]
 * @property {TeamDescriptor[]} teams
 * @property {string} matchId
 * @property {string} status
 * @property {number} turn
 * @property {number} maxTurns
 * @property {string} [turnAdvanceMode]
 * @property {string} [rulesVersion]
 */

/**
 * @typedef {Object} BotState
 * @property {MatchSummary} match
 * @property {Record<string, number>} [actionRevisions]
 * @property {MarsView | SolarView} [view]
 * @property {number} serverTimeMs
 * @property {number} [turnEndsAtMs]
 */

/**
 * @typedef {Object} Identity
 * @property {string} teamId
 * @property {string} [displayName]
 */

/** @typedef {Record<string, Action>} ActionsByEntity */

/**
 * @typedef {Object} TurnEvent
 * @property {number} turn
 * @property {MarsView | SolarView} view
 * @property {number} serverTimeMs
 * @property {number} [turnEndsAtMs]
 */

/**
 * @typedef {Object} MatchStartingEvent
 * @property {string} message
 * @property {MatchSummary} match
 * @property {number} serverTimeMs
 * @property {number} startsAtMs
 */

/**
 * @typedef {(
 *   | { name: 'turn', data: TurnEvent }
 *   | { name: 'match_starting', data: MatchStartingEvent }
 *   | { name: 'match_ended', data: { match: MatchSummary, serverTimeMs: number } }
 *   | { name: 'message', data: unknown }
 * )} ServerEvent
 */

const API_BASE_URL = process.env.LUCID_API_BASE_URL ?? 'http://localhost:5173';
const API_KEY = process.env.API_KEY ?? 'replace-with-api-key';
const USING_DEFAULT_URL = process.env.LUCID_API_BASE_URL === undefined;
/** @type {string | undefined} */
let botSessionToken;
/** @type {string | undefined} */
let botSessionRevision;
/** @type {string | undefined} */
let botSessionMatchId;

class ApiError extends Error {
  /** @param {number} status @param {string} reason @param {string} body */
  constructor(status, reason, body) {
    let message = `${status} ${reason}`;
    try {
      message = JSON.parse(body).error?.message ?? message;
    } catch {
      /* Use the HTTP status when the server did not send JSON. */
    }
    if (status === 401 || status === 403) {
      message =
        message === 'Team is not in an active match.'
          ? 'No current match. Join a match on the website, then run the bot again.'
          : 'Invalid API key. Set API_KEY to the key from your team page.';
    }
    if (status === 404)
      message = `Cannot reach the bot API at ${API_BASE_URL}. Check LUCID_API_BASE_URL.`;
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** @param {unknown} error */
function isPvpDisabled(error) {
  if (!(error instanceof ApiError) || error.status !== 409) return false;
  try {
    return JSON.parse(error.body)?.error?.code === 'pvp_disabled';
  } catch {
    return false;
  }
}

/** @param {unknown} error */
function isMatchUnavailable(error) {
  if (!(error instanceof ApiError) || error.status !== 403) return false;
  try {
    const detail = JSON.parse(error.body).error;
    return detail?.code === 'forbidden' && detail.message === 'Team is not in an active match.';
  } catch {
    return false;
  }
}

/** @param {unknown} error */
function isAuthError(error) {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 401 || error.status === 403) return true;
  if (error.status !== 409) return false;
  try {
    return JSON.parse(error.body).error?.code === 'bot_session_conflict';
  } catch {
    return false;
  }
}

/** @param {BotState} state */
function isTerminal(state) {
  return state.match.status === 'completed' || state.match.status === 'cancelled';
}

const REQUEST_TIMEOUT_MS = 5000;
const STREAM_IDLE_TIMEOUT_MS = 10000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 250;

/** @param {unknown} error */
function isTransient(error) {
  return error instanceof ApiError
    ? [408, 429, 500, 502, 503, 504].includes(error.status)
    : error instanceof TypeError ||
        (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name));
}

/** @param {string} path @param {RequestInit} [options] */
async function request(path, options = {}) {
  const method = options.method ?? 'GET';
  const keyedWrite =
    method === 'PUT' &&
    !path.includes('/current/') &&
    typeof options.body === 'string' &&
    !!JSON.parse(options.body).submissionId;
  const headers = new Headers(options.headers);
  const boundRegistration =
    path === '/api/team/matches/current/register' &&
    headers.has('x-bot-match-id') &&
    headers.has('x-bot-session');
  const attempts =
    boundRegistration || method === 'GET' || path === '/api/auth/api-key' || keyedWrite
      ? MAX_ATTEMPTS
      : 1;
  let recoveredSession = false;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'x-api-key': API_KEY,
          'content-type': 'application/json',
          ...(botSessionToken ? { 'x-bot-session': botSessionToken } : {}),
          ...options.headers
        }
      });
      if (!response.ok) {
        const body = await response.text();
        let missingSession = false;
        try { missingSession = JSON.parse(body).error?.code === 'bot_session_missing'; } catch { /* non-JSON error */ }
        if (missingSession && !recoveredSession && botSessionToken && botSessionMatchId && path !== '/api/team/matches/current/register') {
          recoveredSession = true;
          await request('/api/team/matches/current/register', {
            method: 'POST', headers: { 'x-bot-match-id': botSessionMatchId, 'x-bot-session': botSessionToken, 'x-bot-session-recover': '1' }
          });
          attempt--;
          continue;
        }
        throw new ApiError(response.status, response.statusText, body);
      }
      const revision = response.headers.get('x-bot-session-revision');
      if (revision) botSessionRevision = revision;
      if (path === '/api/team/matches/current/register')
        botSessionToken = response.headers.get('x-bot-session') ?? undefined;
      try {
        return await response.json();
      } catch (error) {
        if (error instanceof SyntaxError)
          throw new Error(
            `The server at ${API_BASE_URL} did not return bot API JSON. Check LUCID_API_BASE_URL.`,
            { cause: error }
          );
        throw error;
      }
    } catch (error) {
      if (!isTransient(error)) throw error;
      if (attempt + 1 === attempts) {
        throw new Error(
          `Cannot reach ${API_BASE_URL} after ${attempts} attempt(s). Check LUCID_API_BASE_URL and your connection.`,
          { cause: error }
        );
      }
    } finally {
      clearTimeout(timeout);
    }
    await sleep(RETRY_DELAY_MS * 2 ** attempt);
  }
}

async function getServerTime() {
  const state = await request('/api/team/matches/current/state');
  return state.serverTimeMs;
}

/** @param {string} [matchId] @returns {Promise<BotState>} */
async function getCurrentState(matchId) {
  return request(`/api/team/matches/${matchId ? encodeURIComponent(matchId) : 'current'}/state`);
}

/** @returns {Promise<Identity>} */
async function validateApiKey() {
  if (!API_KEY.trim() || API_KEY === 'replace-with-api-key')
    throw new Error('Set API_KEY to the key from your team page before running the bot.');
  return request('/api/auth/api-key', {
    method: 'POST'
  });
}
/** @returns {Promise<BotState>} */
async function registerTeamToMatch() {
  botSessionToken = undefined;
  let selected;
  try {
    selected = await getCurrentState();
  } catch (error) {
    if (!isMatchUnavailable(error)) throw error;
    let announced = '';
    for (;;) {
      const response = await request('/api/team/matches/current/register', {method:'POST'});
      if ('match' in response) {
        selected = await getCurrentState();
        break;
      }
      if (!('queue' in response)) throw new Error('Invalid registration response.', {cause:error});
      const waiting = response.queue.autoQueue === false
        ? 'Waiting for a private practice match. Create one on the website; keep this bot running.'
        : 'Waiting in PvP queue; keep this bot running.';
      if (announced !== waiting) { console.log(waiting); announced = waiting; }
      await sleep(1000);
    }
  }
  botSessionMatchId = selected.match.matchId;
  const claimToken = randomUUID();
  const state = await request('/api/team/matches/current/register', {
    method: 'POST',
    headers: { 'x-bot-match-id': selected.match.matchId, 'x-bot-session': claimToken, ...(botSessionRevision ? { 'x-bot-session-revision': botSessionRevision } : {}) }
  });

  console.log(`registered for match ${state.match.matchId}`);

  if (state.match.status === 'pending') {
    console.log('waiting for all teams to join');
    return state;
  }

  console.log('All players joined, starting match');
  return state;
}

/** @param {BotState} state @returns {Promise<BotState>} */
async function waitForMatchStart(state) {
  return waitForProgress(state, true);
}

/** @type {{ matchId: string, events: AsyncGenerator<ServerEvent> } | undefined} */
let eventStream;

async function closeEventStream() {
  const current = eventStream;
  eventStream = undefined;
  await current?.events.return(undefined);
}

/** @param {BotState} state @param {boolean} starting @returns {Promise<BotState>} */
async function waitForProgress(state, starting) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let idle = false;
    try {
      if (eventStream?.matchId !== state.match.matchId) {
        await closeEventStream();
        eventStream = {
          matchId: state.match.matchId,
          events: streamEvents(
            `/api/events/matches/${encodeURIComponent(state.match.matchId)}?afterTurn=${state.match.turn}`
          )
        };
      }
      for (;;) {
        const next = await eventStream.events.next();
        if (next.done) break;
        const event = next.value;
        if (event.name === 'match_ended') {
          await closeEventStream();
          return { ...state, match: event.data.match, serverTimeMs: event.data.serverTimeMs };
        }
        if (event.name === 'match_starting' && event.data.match.turn >= state.match.turn) {
          state = applyMatchStartingEvent(state, event.data);
          if (starting) return state;
        }
        if (event.name === 'turn' && event.data.turn > state.match.turn) {
          const nextState = stateFromTurnEvent(state, event.data);
          if (isTerminal(nextState)) await closeEventStream();
          return nextState;
        }
      }
    } catch (error) {
      await closeEventStream();
      if (!isTransient(error)) throw error;
      idle = error instanceof Error && error.name === 'AbortError';
    }
    await closeEventStream();
    const latest = await getCurrentState(state.match.matchId);
    if (
      isTerminal(latest) ||
      latest.match.turn > state.match.turn ||
      (starting && latest.match.status !== 'pending')
    )
      return latest;
    state = latest;
    // A quiet pending lobby is healthy when its state endpoint still responds.
    if (idle && starting && state.match.status === 'pending') attempt = -1;
    if (attempt + 1 < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * 2 ** Math.max(attempt, 0));
  }
  throw new Error(
    `Match ${state.match.matchId} event stream made no progress after ${MAX_ATTEMPTS} attempts.`
  );
}

/** @param {string} path @returns {AsyncGenerator<ServerEvent>} */
async function* streamEvents(path) {
  const controller = new AbortController();
  let timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  /** @type {ReadableStreamDefaultReader<Uint8Array> | undefined} */
  let reader;
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      signal: controller.signal,
      headers: {
        'x-api-key': API_KEY,
        accept: 'text/event-stream',
        ...(botSessionToken ? { 'x-bot-session': botSessionToken } : {})
      }
    });
    if (!response.ok)
      throw new ApiError(response.status, response.statusText, await response.text());
    if (!response.body) throw new Error('Event stream response did not include a body.');
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      clearTimeout(timeout);
      timeout = setTimeout(() => controller.abort(), STREAM_IDLE_TIMEOUT_MS);
      const next = await reader.read();
      clearTimeout(timeout);
      if (next.done) break;
      buffer += decoder.decode(next.value, { stream: true });
      const parsed = readServerSentEvents(buffer);
      buffer = parsed.remaining;
      for (const event of parsed.events) yield event;
    }
    // An unterminated frame after disconnect is incomplete, not a valid event.
  } finally {
    clearTimeout(timeout);
    controller.abort();
    try {
      await reader?.cancel();
    } catch {
      /* Preserve the original transport/parse error. */
    }
    reader?.releaseLock();
  }
}

/** @param {string} buffer */
function readServerSentEvents(buffer) {
  let remaining = buffer;
  const events = [];
  let boundary = /\r?\n\r?\n/.exec(remaining);

  while (boundary) {
    const rawEvent = remaining.slice(0, boundary.index);
    remaining = remaining.slice(boundary.index + boundary[0].length);
    const event = parseServerSentEvent(rawEvent);

    if (event) {
      events.push(event);
    }

    boundary = /\r?\n\r?\n/.exec(remaining);
  }

  return {
    events,
    remaining
  };
}

/** @param {string} rawEvent @returns {ServerEvent | null} */
function parseServerSentEvent(rawEvent) {
  let name = 'message';
  const dataLines = [];

  for (const line of rawEvent.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) {
      continue;
    }

    if (line.startsWith('event:')) {
      name = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return /** @type {ServerEvent} */ ({
    name,
    data: JSON.parse(dataLines.join('\n'))
  });
}

/** @param {string} entityId @param {number} revision @param {unknown} action */
async function replaceEntityAction(entityId, revision, action) {
  return request(`/api/team/matches/current/entities/${encodeURIComponent(entityId)}/action`, {
    method: 'PUT',
    body: JSON.stringify({ submissionId: randomUUID(), revision, action })
  });
}

/** @param {ActionsByEntity} actionsByEntityId @param {Map<string, number>} revisions @param {string} [matchId] */
async function replaceActions(actionsByEntityId, revisions, matchId) {
  const submissions = Object.entries(actionsByEntityId).map(([entityId, action]) => {
    const revision = (revisions.get(entityId) ?? 0) + 1;
    revisions.set(entityId, revision);

    return {
      entityId,
      revision,
      action
    };
  });

  return request(
    matchId
      ? `/api/team/matches/${encodeURIComponent(matchId)}/action`
      : '/api/team/matches/current/actions',
    {
      method: 'PUT',
      body: JSON.stringify({ submissionId: randomUUID(), submissions })
    }
  );
}

/** @param {string} [matchId] */
async function advanceActions(matchId) {
  return request(
    matchId
      ? `/api/team/matches/${encodeURIComponent(matchId)}/action`
      : '/api/team/matches/current/actions',
    {
      method: 'PUT',
      body: JSON.stringify({ submissionId: randomUUID(), advanceOnly: true })
    }
  );
}

/** @param {BotState} state @returns {Promise<BotState>} */
async function waitForNextTurn(state) {
  return waitForProgress(state, false);
}

/** @param {BotState} state @param {MatchStartingEvent} event @returns {BotState} */
function applyMatchStartingEvent(state, event) {
  return {
    ...state,
    match: event.match,
    serverTimeMs: event.serverTimeMs,
    turnEndsAtMs: event.startsAtMs
  };
}

/** @param {BotState} state @param {TurnEvent} event @returns {BotState} */
function stateFromTurnEvent(state, event) {
  return {
    match: {
      ...state.match,
      status: event.turn >= state.match.maxTurns ? 'completed' : 'active',
      turn: event.turn
    },
    view: event.view,
    serverTimeMs: event.serverTimeMs,
    turnEndsAtMs: event.turnEndsAtMs
  };
}

/** @param {(state: BotState, identity: Identity) => ActionsByEntity | null | undefined | Promise<ActionsByEntity | null | undefined>} [calculateActions] */
export async function runBot(calculateActions = () => ({})) {
  const identity = await validateApiKey();
  if (USING_DEFAULT_URL)
    console.log(`Using ${API_BASE_URL}. Set LUCID_API_BASE_URL to connect to another server.`);
  /** @type {BotState} */
  let state;
  try {
    state = await registerTeamToMatch();
  } catch (error) {
    if (!isPvpDisabled(error)) throw error;
    console.error(
      'No match assigned. PvP practice is currently disabled.\nCreate a practice match on the website or ask an organizer to assign one,\nthen run your bot again.'
    );
    process.exitCode = 1;
    return;
  }
  const revisions = new Map(Object.entries(state.actionRevisions ?? {}));
  // One run belongs to this match, even if another becomes current.

  try {
    if (state.match.status === 'pending') {
      state = await waitForMatchStart(state);
    }

    const isClientActionMatch = state.match.turnAdvanceMode === 'client-action';

    let useLatestState = false;
    let needsRefresh = false;
    while (!isTerminal(state)) {
      try {
        if (needsRefresh) {
          const previousTurn = state.match.turn;
          state = await getCurrentState(state.match.matchId);
          useLatestState = state.match.turn > previousTurn;
          needsRefresh = false;
          if (isTerminal(state)) break;
        }
        if (!isClientActionMatch && !useLatestState) {
          state = await waitForNextTurn(state);
        }
        useLatestState = false;
        if (state.match.status !== 'active') break;
        const receivedAtMs = Date.now();
        /** @type {ActionsByEntity} */
        let actions = {};
        try {
          actions = (await calculateActions(state, identity)) ?? {};
        } catch (error) {
          console.error(
            `Strategy failed on turn ${state.match.turn}: ${error instanceof Error ? error.message : String(error)}. Passing this turn.`
          );
        }
        let late = false;
        try {
          const result = await replaceActions(actions, revisions, state.match.matchId);
          late = (result.accepted ?? []).some(
            (/** @type {{acceptedForTurn: number}} */ action) =>
              action.acceptedForTurn > state.match.turn + 1
          );
          console.log(`submitted turn ${state.match.turn}, actions: ${JSON.stringify(actions)}`);
        } catch (error) {
          if (isMatchUnavailable(error)) {
            state = await getCurrentState(state.match.matchId);
            if (isTerminal(state)) break;
            throw error;
          }
          if (isAuthError(error)) throw error;
          console.error(
            `Could not submit turn ${state.match.turn}: ${error instanceof Error ? error.message : String(error)}. Passing this turn.`
          );
          try {
            await replaceActions({}, revisions, state.match.matchId);
          } catch (fallbackError) {
            if (isAuthError(fallbackError)) throw fallbackError;
            console.error(
              `Could not submit a pass: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
            );
            await sleep(RETRY_DELAY_MS);
          }
        }
        late ||=
          state.turnEndsAtMs !== undefined &&
          state.serverTimeMs + Date.now() - receivedAtMs >= state.turnEndsAtMs;
        if (late && !isClientActionMatch) {
          console.warn(
            `Turn ${state.match.turn} missed its deadline; using the newest available state.`
          );
          const latest = await getCurrentState(state.match.matchId);
          useLatestState = latest.match.turn > state.match.turn;
          state = latest;
        } else if (isClientActionMatch) {
          state = await getCurrentState(state.match.matchId);
        }
      } catch (error) {
        if (isAuthError(error)) throw error;
        console.error(
          `Waiting for the match: ${error instanceof Error ? error.message : String(error)}`
        );
        needsRefresh = true;
        await sleep(RETRY_DELAY_MS);
      }
    }
    console.log(state.match.cancellationReason ?? `match ${state.match.matchId} is ${state.match.status}; stopping bot`);
  } finally {
    await closeEventStream();
  }
}

export {
  closeEventStream,
  advanceActions,
  getCurrentState,
  getServerTime,
  registerTeamToMatch,
  replaceEntityAction,
  replaceActions,
  validateApiKey,
  waitForNextTurn
};

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
