// cards.js — every card in Tidebound: its family, cost, strength and rule text.
// Families are told apart by colour AND shape, never by text alone:
//   Sail  = amber  + triangle, Hook = coral + anchor, Flood = blue + wave,
//   Tide  = violet + spiral. All names, art and rules are original to this game.

export const FAMILIES = {
  sail: { label: 'Sail', color: '#f5b942', dark: '#8a5a00', glyph: '▲', shape: 'triangle' },
  hook: { label: 'Hook', color: '#ff6b5e', dark: '#8f1f16', glyph: '⚓', shape: 'anchor' },
  flood: { label: 'Flood', color: '#3ec6e8', dark: '#0a5a74', glyph: '〰', shape: 'wave' },
  tide: { label: 'Tide', color: '#b78cff', dark: '#4a2a8f', glyph: '◎', shape: 'spiral' },
};

// Cards are DATA for one effect interpreter (see rules.js resolveCardOps):
// each card lists its `ops` (things that happen when it is played) and an
// optional `aura` (a continuous lane modifier read at scoring time), plus
// `keywords` implemented once in the interpreter — never per-card code.
// Power budget: 1 Surge buys about 3 strength (Skiff 1/3 is the baseline);
// a higher cost reliably buys more impact, and zero-cost cards stay small.

// One entry per card kind. `copies` is how many of it go into each 24-card tide deck.
export const CARD_DEFS = [
  { id: 'skiff', name: 'Skiff', family: 'sail', cost: 1, strength: 3, copies: 6,
    keywords: ['fleet'], ops: [], aura: null,
    text: 'Fleet: +1 with a Sail next door.' },
  { id: 'galleon', name: 'Galleon', family: 'sail', cost: 2, strength: 5, copies: 4,
    keywords: ['fleet'], ops: [], aura: null,
    text: 'Fleet: +1 with a Sail next door.' },
  { id: 'keelback', name: 'Keelback', family: 'sail', cost: 0, strength: 1, copies: 2,
    keywords: ['fleet'], ops: [], aura: null,
    text: 'Free to play. Fleet: +1 with a Sail next door.' },
  { id: 'grapnel', name: 'Grapnel Hook', short: 'Grapnel', family: 'hook', cost: 1, strength: 2, copies: 4,
    keywords: [], ops: [{ op: 'dragRival', toward: 'shallows' }], aura: null,
    text: 'Drag the strongest rival card toward the Shallows.' },
  { id: 'floodtide', name: 'Floodtide', family: 'flood', cost: 2, strength: 1, copies: 4,
    keywords: [], ops: [], aura: { side: 'self', amount: 2 },
    text: 'Your cards in this lane gain +2.' },
  { id: 'undertow', name: 'Undertow', family: 'flood', cost: 2, strength: 2, copies: 3,
    keywords: [], ops: [], aura: { side: 'rival', amount: -2 },
    text: 'Rival cards in this lane lose 2.' },
  { id: 'tidecaller', name: 'Tidecaller', family: 'tide', cost: 3, strength: 6, copies: 1,
    keywords: [], ops: [{ op: 'flipCurrent' }], aura: null,
    text: 'Flip the current. Once per game.' },
];

export const LANES = [
  { name: 'Sunlit Shallows', short: 'Shallows', value: 1, color: '#e8c15a', glyph: '〰', shape: 'wave' },
  { name: 'Mid Current', short: 'Mid Current', value: 2, color: '#2fbfae', glyph: '◎', shape: 'swirl' },
  { name: 'Deep Trench', short: 'Deep Trench', value: 3, color: '#9b7bff', glyph: '▽', shape: 'trench' },
];

export const HAND_SIZE = 5;
export const PLAYS_PER_HAND = 4;
export const FAVOUR_TO_WIN = 15;
export const START_HULL = 16;
export const START_SURGE = 2;
export const MAX_SURGE = 6;
export const SURGE_PER_TURN = 1;
export const SURGE_PER_DISCARD = 2;

// A fresh card instance (a def plus a unique id) so the table can track it.
export function makeCardInstance(def, uid) {
  return { uid, id: def.id, name: def.name, short: def.short || def.name, family: def.family, cost: def.cost,
    strength: def.strength, text: def.text,
    keywords: def.keywords ? def.keywords.slice() : [],
    ops: def.ops ? def.ops.map((o) => ({ ...o })) : [],
    aura: def.aura ? { ...def.aura } : null };
}

// Does this card carry the named op? (The interpreter reads ops, never ids.)
export function hasOp(card, op) {
  return (card.ops || []).some((o) => o.op === op);
}

export function isTidecaller(card) { return hasOp(card, 'flipCurrent'); }

export function defineCards() { return CARD_DEFS.map((d) => ({ ...d })); }

export function cardStrength(card) { return card.strength; }

export function cardCost(card) { return card.cost; }

export function familyOf(card) { return FAMILIES[card.family]; }
