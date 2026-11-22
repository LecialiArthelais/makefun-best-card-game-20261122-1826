// rivalBrain.js — Rill, the rival tide-caller. A small, legible policy, not a
// black box: perceive the table, score every legal move, play the best one,
// and say what it is about to do in plain words so the player can counter it.
//
// Policy, in order:
//   1. Win the cheapest lane it can take (favour now beats favour later).
//   2. Contest the Deep Trench only while ahead on Surge.
//   3. Bank Surge when its hand is weak (no affordable card wins a lane).
//   4. Hold the Tidecaller until flipping the current lands on a lane it leads.

import { LANES, PLAYS_PER_HAND, hasOp, isTidecaller } from './cards.js';
import { canAfford } from './surge.js';
import { laneTotal, otherSide, playCard } from './rules.js';

export const RIVAL_NAME = 'Rill';
export const RIVAL_TITLE = 'Tidecaller of the Deep';

// Score one candidate: play `card` into `lane`. Higher is better.
function scoreCandidateMove(state, card, laneIndex) {
  const before = laneTotal(state, 'rival', laneIndex) - laneTotal(state, 'you', laneIndex);
  // Simulate the play on a shallow copy of the lanes to read the new totals.
  const snapshot = state.lanes.map((l) => ({ you: l.you.slice(), rival: l.rival.slice() }));
  state.lanes[laneIndex].rival.push(card);
  const after = laneTotal(state, 'rival', laneIndex) - laneTotal(state, 'you', laneIndex);
  state.lanes = snapshot;
  let score = 0;
  const laneValue = LANES[laneIndex].value;
  if (before <= 0 && after > 0) score += 10 + laneValue * 3; // flips a lost lane
  if (before > 0 && after > before) score += 4 + laneValue; // extends a lead
  if (after > 0) score += laneValue; // holds a lane
  if (laneIndex === 2 && state.rival.surge <= state.you.surge) score -= 6; // Deep is dear when behind
  if (hasOp(card, 'dragRival')) {
    const target = state.lanes[laneIndex].you.slice().sort((a, b) => b.strength - a.strength)[0];
    if (target && laneIndex > 0) score += 5; // a drag that steals lane value
  }
  if (card.aura && card.aura.side === 'self') {
    const friends = state.lanes[laneIndex].rival.length;
    score += friends * 3; // floods love a lane already stacked
  }
  if (card.aura && card.aura.side === 'rival') {
    const foes = state.lanes[laneIndex].you.length;
    score += foes * 3;
  }
  score -= card.cost; // cheaper plays leave Surge for the next turn
  return score;
}

// The Tidecaller is held until flipping the current lands on a lane the rival
// already leads, or until the rival is far behind on favour and must gamble.
export function holdTidecaller(state) {
  if (!state.rival.tidecallerHeld) return true; // already gone
  const leads = LANES.some((_, i) => laneTotal(state, 'rival', i) > laneTotal(state, 'you', i));
  const desperate = state.rival.favour + 5 <= state.you.favour;
  const affordable = state.rival.surge >= 3;
  return !(affordable && (leads || desperate));
}

export function bankSurgeWhenWeak(state) {
  const hand = state.rival.hand;
  const affordable = hand.filter((c) => canAfford(state.rival, c));
  if (affordable.length > 0) {
    const best = Math.max(...affordable.map((c) => scoreCandidateMove(state, c, 0)));
    if (best > 2) return false; // a decent play exists — do not bank
  }
  return true; // weak hand: discard the cheapest card and bank +2 Surge
}

// How often Rill misreads the current and plays a random legal move instead
// of its best one. A perfect opponent is no fun to play against — and no fun
// to lose to. 0.18 keeps Rill sharp (it still punishes open lanes) while a
// player who reads the intent banner and counts Surge wins about half the
// games (measured: competent bot 14–19/30 across rates 0.15–0.22).
// The roll uses the game's own seeded RNG, so replays stay exact.
export const RIVAL_MISTAKE_RATE = 0.18;

// The AI's full move: { kind: 'play', card, lane } | { kind: 'bank', card } | { kind: 'pass' }.
export function chooseRivalMove(state, mistakeRate = RIVAL_MISTAKE_RATE) {
  if (state.rival.playsUsed >= PLAYS_PER_HAND) return { kind: 'pass' };
  const candidates = [];
  for (const card of state.rival.hand) {
    if (!canAfford(state.rival, card)) continue;
    if (isTidecaller(card) && holdTidecaller(state)) continue;
    for (let lane = 0; lane < LANES.length; lane += 1) {
      candidates.push({ kind: 'play', card, lane, score: scoreCandidateMove(state, card, lane) });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length > 0 && state.rng() < mistakeRate) {
    // Rill misreads the current: a random legal move, not the best one.
    return candidates[Math.floor(state.rng() * candidates.length)];
  }
  const best = candidates[0];
  if (best && best.score > 0) return best;
  if (bankSurgeWhenWeak(state) && state.rival.hand.length > 0) {
    const cheapest = state.rival.hand.slice().sort((a, b) => a.cost - b.cost || a.strength - b.strength)[0];
    return { kind: 'bank', card: cheapest };
  }
  if (best) return best;
  return { kind: 'pass' };
}

// Plain-words intent, generated from the move the AI actually chose —
// the player reads it and can counter the threatened lane.
export function readRivalIntent(state, move) {
  if (!move) return `${RIVAL_NAME} is watching the current…`;
  if (move.kind === 'bank') return `${RIVAL_NAME} is banking Surge — a big play is coming.`;
  if (move.kind === 'pass') return `${RIVAL_NAME} holds — the tide is yours to take.`;
  if (isTidecaller(move.card)) return `${RIVAL_NAME} raises the Tidecaller — the current is about to flip!`;
  if (hasOp(move.card, 'dragRival')) {
    return `${RIVAL_NAME} is about to Hook your ${LANES[move.lane].short} card.`;
  }
  if (move.card.aura) {
    return `${RIVAL_NAME} is flooding the ${LANES[move.lane].short} — answer it or lose the lane.`;
  }
  if (move.lane === 2) return `${RIVAL_NAME} is massing in the Deep Trench…`;
  if (move.lane === 0) return `${RIVAL_NAME} is slipping into the Shallows…`;
  return `${RIVAL_NAME} is pressing the Mid Current…`;
}

// Apply the chosen move to the real state. Returns a short description.
export function applyRivalMove(state, move) {
  if (move.kind === 'play') {
    const placed = playCard(state, 'rival', move.card.uid, move.lane);
    return placed ? `Rill played ${placed.name} in the ${LANES[move.lane].short}.` : 'Rill faltered.';
  }
  if (move.kind === 'bank') {
    const at = state.rival.hand.findIndex((c) => c.uid === move.card.uid);
    if (at >= 0) {
      const [card] = state.rival.hand.splice(at, 1);
      state.rival.discard.push(card);
      state.rival.surge = Math.min(6, state.rival.surge + 2);
      state.rival.playsUsed += 1;
      return `Rill banked ${card.name} for +2 Surge.`;
    }
  }
  state.rival.playsUsed += 1;
  return 'Rill passes.';
}

export function rivalCanAffordTidecaller(state) {
  return state.rival.tidecallerHeld && state.rival.surge >= 3;
}
