// shots.js — deterministic staged states for the four screenshots, reached
// through ?shot=title|table|win|loss&seed=…. These are real states of the
// game's own code, rendered by the same renderTable as live play — nothing
// is composited or edited. Live play reaches win and loss for real too.

import { CARD_DEFS, makeCardInstance } from './cards.js';
import { victoryFlourish } from './animation.js';

let uidCounter = 1000;

function stagedCard(id, count = 1) {
  const def = CARD_DEFS.find((d) => d.id === id);
  const cards = [];
  for (let i = 0; i < count; i += 1) cards.push(makeCardInstance(def, `shot-${uidCounter++}`));
  return cards;
}

// Put the state into the staged configuration for one screenshot.
export function stageShot(state, shot) {
  state.screen = 'table';
  state.phase = 'player';
  if (shot === 'title') {
    state.screen = 'title';
    state.you.favour = 0;
    state.rival.favour = 0;
    return state;
  }
  if (shot === 'win') {
    state.screen = 'win';
    state.handNumber = 5;
    state.you.favour = 15;
    state.rival.favour = 9;
    state.you.hull = 12;
    state.rival.hull = 8;
    state.you.surge = 3;
    state.rival.surge = 1;
    return state;
  }
  if (shot === 'loss') {
    state.screen = 'loss';
    state.handNumber = 4;
    state.you.favour = 7;
    state.rival.favour = 15;
    state.you.hull = 0;
    state.rival.hull = 11;
    state.you.surge = 1;
    state.rival.surge = 4;
    return state;
  }
  // shot === 'table': a mid-game table with combos visible.
  state.handNumber = 3;
  state.current = 1; // current flows toward the Deep
  state.you.favour = 9;
  state.rival.favour = 6;
  state.you.hull = 16;
  state.rival.hull = 11;
  state.you.surge = 4;
  state.rival.surge = 3;
  state.you.tidecallerHeld = true;
  state.rival.tidecallerHeld = true;
  state.intent = 'Rill is massing in the Deep Trench…';
  // Shallows: your Floodtide buffs your Skiff (+2); a lone rival Keelback.
  state.lanes[0].you = [...stagedCard('skiff'), ...stagedCard('floodtide')];
  state.lanes[0].rival = stagedCard('keelback');
  // Mid Current: your Galleon rides the current (+1) and the fleet (+1);
  // Rill's Grapnel already dragged your Keelback down from the Deep.
  state.lanes[1].you = [...stagedCard('galleon'), ...stagedCard('keelback')];
  state.lanes[1].rival = [...stagedCard('skiff'), ...stagedCard('grapnel')];
  // Deep Trench: your Galleon vs Rill's Skiff, blunted by an Undertow (−2).
  state.lanes[2].you = stagedCard('galleon');
  state.lanes[2].rival = [...stagedCard('skiff'), ...stagedCard('undertow')];
  // Your hand: one of each family, Tidecaller in sight, Grapnel selected.
  const hand = [
    ...stagedCard('skiff'), ...stagedCard('grapnel'), ...stagedCard('floodtide'),
    ...stagedCard('undertow'), ...stagedCard('tidecaller'),
  ];
  state.you.hand = hand;
  state.selectedUid = hand[1].uid; // the Grapnel, raised and ready
  state.rival.hand = [
    ...stagedCard('skiff'), ...stagedCard('galleon'), ...stagedCard('grapnel'),
    ...stagedCard('floodtide'), ...stagedCard('keelback'),
  ];
  return state;
}

// DOM-only polish applied after renderTable, for the screenshot only:
// a card caught mid-slide, and the win flourish on the victory screen.
export function polishShot(shot) {
  if (shot === 'table') {
    const galleon = document.querySelector('.lane[data-lane="2"] .lane-row.you .card');
    if (galleon) galleon.classList.add('mid-slide');
  }
  if (shot === 'win') {
    victoryFlourish(document.getElementById('fx-layer'), 110);
  }
}
