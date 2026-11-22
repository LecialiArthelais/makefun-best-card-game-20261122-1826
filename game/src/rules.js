// rules.js — the rules of Tidebound: playing cards, lane strength, the tide
// turning, favour and hull. No rendering here, only numbers and decisions.
//
// Effect resolution (card-game skill): every card is data — a list of `ops`
// plus an optional `aura` — and ONE interpreter resolves them. Playing a
// card is atomic: validate cost and lane first, then pay, move the card from
// hand to its lane, and resolve its ops through a FIFO queue in listed
// order. Auras are continuous lane modifiers read at scoring time, not ops.
// MAX_EFFECT_PUSHES caps the queue so a trigger loop can never run away.

import { FAVOUR_TO_WIN, LANES, PLAYS_PER_HAND, hasOp } from './cards.js';
import { spendSurge } from './surge.js';

export const MAX_EFFECT_PUSHES = 100;

export function otherSide(who) { return who === 'you' ? 'rival' : 'you'; }

// Resolve a played card's ops, in listed order, through a FIFO queue.
// Returns the number of ops resolved (0 when the card has none).
export function resolveCardOps(state, who, laneIndex, card) {
  const queue = (card.ops || []).slice();
  let pushes = 0;
  while (queue.length > 0) {
    const op = queue.shift();
    pushes += 1;
    if (pushes > MAX_EFFECT_PUSHES) {
      console.warn('Tidebound: effect queue stopped at the depth cap', op);
      break;
    }
    if (op.op === 'flipCurrent') {
      state.current = -state.current; // the Tidecaller flips the current
    } else if (op.op === 'dragRival') {
      dragStrongestRivalCard(state, who, laneIndex);
    }
    // Unknown ops are ignored: a card's data can never run code it does not name.
  }
  return pushes;
}

// Effective strength of one card in its lane, with every combo applied:
//   +1 riding the current (a friendly card sits in the adjacent upstream lane),
//   +1 fleet (keyword: a Sail in a neighbouring lane),
//   auras: each friendly aura card in the lane adds its amount to every
//   friendly card here (Floodtide +2), each rival aura adds its amount
//   (Undertow −2). Scoring order is fixed: base, current, fleet, auras.
export function effectiveStrength(state, who, laneIndex, card) {
  let strength = card.strength;
  const lane = state.lanes[laneIndex];
  const mine = lane[who];
  const theirs = lane[otherSide(who)];
  const upstream = laneIndex - state.current; // current +1 flows toward Deep
  if (upstream >= 0 && upstream < LANES.length) {
    const upstreamCards = state.lanes[upstream][who];
    if (upstreamCards.length > 0) strength += 1;
  }
  if ((card.keywords || []).includes('fleet')) {
    const neighbours = [laneIndex - 1, laneIndex + 1].filter((i) => i >= 0 && i < LANES.length);
    if (neighbours.some((i) => state.lanes[i][who].some((c) => c.family === 'sail'))) strength += 1;
  }
  for (const c of mine) if (c.aura && c.aura.side === 'self') strength += c.aura.amount;
  for (const c of theirs) if (c.aura && c.aura.side === 'rival') strength += c.aura.amount;
  return Math.max(0, strength);
}

export function laneTotal(state, who, laneIndex) {
  return state.lanes[laneIndex][who]
    .reduce((sum, card) => sum + effectiveStrength(state, who, laneIndex, card), 0);
}

// Score one lane: the higher total takes the lane's favour value; a win by
// 4 or more breaks through and deals up to 3 hull damage (margin − 3, capped).
export function scoreLane(state, laneIndex) {
  const youTotal = laneTotal(state, 'you', laneIndex);
  const rivalTotal = laneTotal(state, 'rival', laneIndex);
  const value = LANES[laneIndex].value;
  if (youTotal === rivalTotal) return { lane: laneIndex, winner: null, youTotal, rivalTotal, favour: 0, damage: 0 };
  const winner = youTotal > rivalTotal ? 'you' : 'rival';
  const margin = Math.abs(youTotal - rivalTotal);
  // Breakthrough: a win by 4+ dents the loser's hull — capped at 3 per lane
  // so a game lasts 4–6 hands and the favour race stays the main path.
  const damage = margin >= 4 ? Math.min(3, margin - 3) : 0;
  return { lane: laneIndex, winner, youTotal, rivalTotal, favour: value, damage };
}

// Play a card from a hand onto a lane. Returns the placed card, or null when
// the move is illegal (wrong phase, unaffordable, or the hand is over).
export function playCard(state, who, cardUid, laneIndex) {
  const player = state[who];
  if (player.playsUsed >= PLAYS_PER_HAND) return null;
  const at = player.hand.findIndex((c) => c.uid === cardUid);
  if (at < 0) return null;
  const card = player.hand[at];
  if (player.surge < card.cost) return null;
  if (laneIndex < 0 || laneIndex >= LANES.length) return null;
  spendSurge(player, card.cost);
  player.hand.splice(at, 1);
  state.lanes[laneIndex][who].push(card);
  player.playsUsed += 1;
  if (hasOp(card, 'flipCurrent')) {
    player.tidecallerHeld = false;
    player.tidecallerPlayed = true;
  }
  resolveCardOps(state, who, laneIndex, card);
  return card;
}

// A Hook drags the strongest enemy card in its lane one lane toward the
// Shallows (index − 1). Returns the dragged card, or null when there is none.
export function dragStrongestRivalCard(state, who, laneIndex) {
  if (laneIndex <= 0) return null;
  const foe = otherSide(who);
  const targets = state.lanes[laneIndex][foe];
  if (targets.length === 0) return null;
  let strongest = targets[0];
  for (const c of targets) if (c.strength > strongest.strength) strongest = c;
  state.lanes[laneIndex][foe] = targets.filter((c) => c.uid !== strongest.uid);
  state.lanes[laneIndex - 1][foe].push(strongest);
  return strongest;
}

export function handIsOver(state) {
  return state.you.playsUsed >= PLAYS_PER_HAND && state.rival.playsUsed >= PLAYS_PER_HAND;
}

// The tide turns: score every lane, hand out favour and breakthrough damage,
// then clear the table. Returns the per-lane results for the animation.
export function tideTurns(state) {
  const results = LANES.map((_, i) => scoreLane(state, i));
  for (const r of results) {
    if (!r.winner) continue;
    state[r.winner].favour += r.favour;
    if (r.damage > 0) state[otherSide(r.winner)].hull = Math.max(0, state[otherSide(r.winner)].hull - r.damage);
  }
  for (const lane of state.lanes) {
    state.you.discard.push(...lane.you);
    state.rival.discard.push(...lane.rival);
    lane.you = [];
    lane.rival = [];
  }
  return results;
}

export function checkVictory(state) {
  if (state.you.favour >= FAVOUR_TO_WIN && state.rival.favour >= FAVOUR_TO_WIN) {
    return state.you.hull >= state.rival.hull ? 'you' : 'rival';
  }
  if (state.you.favour >= FAVOUR_TO_WIN) return 'you';
  if (state.rival.favour >= FAVOUR_TO_WIN) return 'rival';
  if (state.you.hull <= 0) return 'rival';
  if (state.rival.hull <= 0) return 'you';
  return null;
}
