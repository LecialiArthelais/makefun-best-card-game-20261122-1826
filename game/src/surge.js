// surge.js — the Surge economy: the glowing resource that pays for cards.
// Surge is always visible for both players, so every spend is a readable
// decision and a bluff the other side can count.

import { MAX_SURGE, START_SURGE, SURGE_PER_DISCARD, SURGE_PER_TURN } from './cards.js';

export function gainSurge(player, amount) {
  player.surge = Math.min(MAX_SURGE, player.surge + amount);
  return player.surge;
}

export function gainSurgePerTurn(player) {
  return gainSurge(player, SURGE_PER_TURN);
}

export function resetSurge(player) {
  player.surge = START_SURGE;
  return player.surge;
}

export function spendSurge(player, cost) {
  if (player.surge < cost) return false;
  player.surge -= cost;
  return true;
}

export function canAfford(player, card) {
  return player.surge >= card.cost;
}

// Discard a card from the hand instead of playing it: +2 Surge, one turn spent.
// The tempo-vs-resources tension: fewer cards now for a bigger play later.
export function bankSurgeForCard(player, cardUid) {
  const at = player.hand.findIndex((c) => c.uid === cardUid);
  if (at < 0) return null;
  const [card] = player.hand.splice(at, 1);
  player.discard.push(card);
  gainSurge(player, SURGE_PER_DISCARD);
  player.playsUsed += 1;
  return card;
}
