// deck.js — the 24-card tide deck: build it, shuffle it, draw from it.
// Both players get the same mirrored composition, so every game is fair;
// the only difference between the two decks is the shuffle seed.

import { CARD_DEFS, START_HULL, makeCardInstance } from './cards.js';

export const DECK_SIZE = 24;

// Deterministic PRNG (mulberry32) so staged screenshots and replays are stable.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildTideDeck(rng, prefix = 'c') {
  const deck = [];
  let uid = 0;
  for (const def of CARD_DEFS) {
    for (let i = 0; i < def.copies; i += 1) deck.push(makeCardInstance(def, `${prefix}${uid++}`));
  }
  return shuffleDeck(deck, rng);
}

export function shuffleDeck(deck, rng) {
  const shuffled = deck.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Draw one card into a hand; when the deck runs dry, reshuffle the discard pile.
export function drawCard(player) {
  if (player.deck.length === 0) {
    if (player.discard.length === 0) return null;
    player.deck = shuffleDeck(player.discard, player.rng);
    player.discard = [];
  }
  const card = player.deck.pop();
  if (card) player.hand.push(card);
  return card;
}

export function drawUpToHand(player, size) {
  while (player.hand.length < size) {
    if (!drawCard(player)) break;
  }
}

export function discardHand(player) {
  player.discard.push(...player.hand);
  player.hand = [];
}

export function newPlayerState(rng) {
  return {
    hull: START_HULL, favour: 0, surge: 2,
    hand: [], deck: [], discard: [],
    tidecallerHeld: true, tidecallerPlayed: false,
    playsUsed: 0, rng,
  };
}
