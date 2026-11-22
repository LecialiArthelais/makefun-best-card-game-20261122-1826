// table.js — rendering the table: the two hands, the three lanes, the score
// and hull bars, the Surge orbs and the intent banner. DOM only; the rules
// live in rules.js and the AI in rivalBrain.js.

import { FAMILIES, FAVOUR_TO_WIN, LANES, START_HULL } from './cards.js';
import { effectiveStrength, laneTotal } from './rules.js';
import { RIVAL_NAME, RIVAL_TITLE } from './rivalBrain.js';

const $ = (id) => document.getElementById(id);

// Render the whole table from the state. Called after every move.
export function renderTable(state) {
  renderScore(state);
  renderRivalZone(state);
  renderLanes(state);
  renderHand(state);
  renderIntent(state);
  document.querySelectorAll('.lane').forEach((el, i) => {
    el.classList.toggle('current-right', state.current === 1);
    el.classList.toggle('current-left', state.current === -1);
  });
  $('current-arrow').textContent = state.current === 1 ? 'Current flows → toward the Deep' : 'Current flows ← toward the Shallows';
}

export function renderScore(state) {
  $('favour-you').textContent = state.you.favour;
  $('favour-rival').textContent = state.rival.favour;
  $('favour-fill').style.width = `${(state.you.favour / FAVOUR_TO_WIN) * 100}%`;
  $('favour-fill-rival').style.width = `${(state.rival.favour / FAVOUR_TO_WIN) * 100}%`;
  setHullBar('you', state.you.hull);
  setHullBar('rival', state.rival.hull);
  $('hand-label').textContent = `Hand ${state.handNumber}`;
}

function setHullBar(who, hull) {
  const pct = Math.max(0, (hull / START_HULL) * 100);
  $(`hull-fill-${who}`).style.width = `${pct}%`;
  $(`hull-num-${who}`).textContent = `${hull}`;
  $(`hull-fill-${who}`).classList.toggle('low', hull <= 6);
}

export function renderRivalZone(state) {
  const backs = $('rival-backs');
  backs.innerHTML = '';
  for (let i = 0; i < state.rival.hand.length; i += 1) {
    const back = document.createElement('div');
    back.className = 'card-back';
    back.innerHTML = '<span class="back-glyph">◎</span>';
    backs.appendChild(back);
  }
  $('rival-count').textContent = `${state.rival.hand.length} cards`;
  renderSurgeOrbs('rival', state.rival.surge);
  const chip = $('rival-tidecaller');
  chip.classList.toggle('held', state.rival.tidecallerHeld);
  chip.classList.toggle('spent', !state.rival.tidecallerHeld);
  chip.classList.toggle('ready', state.rival.tidecallerHeld && state.rival.surge >= 3);
  chip.textContent = state.rival.tidecallerHeld
    ? (state.rival.surge >= 3 ? '◎ Tidecaller READY' : '◎ Tidecaller held')
    : '◎ Tidecaller spent';
  $('rival-name').textContent = `${RIVAL_NAME} — ${RIVAL_TITLE}`;
}

export function renderLanes(state) {
  LANES.forEach((lane, i) => {
    const el = document.querySelector(`.lane[data-lane="${i}"]`);
    renderLaneRow(el.querySelector('.lane-row.rival'), state.lanes[i].rival, state, 'rival', i);
    renderLaneRow(el.querySelector('.lane-row.you'), state.lanes[i].you, state, 'you', i);
    el.querySelector('.lane-total-rival').textContent = laneTotal(state, 'rival', i);
    el.querySelector('.lane-total-you').textContent = laneTotal(state, 'you', i);
    el.querySelector('.lane-value').textContent = `★ ${lane.value}`;
  });
}

function renderLaneRow(rowEl, cards, state, who, laneIndex) {
  rowEl.innerHTML = '';
  for (const card of cards) {
    const el = renderCard(card, state, who, laneIndex);
    el.classList.add('in-lane');
    rowEl.appendChild(el);
  }
}

export function renderHand(state) {
  const handEl = $('player-hand');
  handEl.innerHTML = '';
  state.you.hand.forEach((card, i) => {
    const el = renderCard(card, state, 'you', -1);
    el.style.setProperty('--fan', `${(i - (state.you.hand.length - 1) / 2) * 4}deg`);
    el.dataset.index = String(i);
    if (state.selectedUid === card.uid) el.classList.add('selected');
    if (card.cost > state.you.surge) el.classList.add('unaffordable');
    handEl.appendChild(el);
  });
  renderSurgeOrbs('you', state.you.surge);
  const chip = $('you-tidecaller');
  chip.classList.toggle('held', state.you.tidecallerHeld);
  chip.classList.toggle('spent', !state.you.tidecallerHeld);
  chip.classList.toggle('ready', state.you.tidecallerHeld && state.you.surge >= 3);
  chip.textContent = state.you.tidecallerHeld
    ? (state.you.surge >= 3 ? '◎ Tidecaller READY — 3 Surge' : '◎ Tidecaller held')
    : '◎ Tidecaller spent';
  $('bank-btn').classList.toggle('active', state.bankMode);
  $('bank-btn').textContent = state.bankMode ? 'Banking… click a card (+2 Surge)' : 'Bank a card (+2 Surge)';
  $('pass-btn').disabled = state.phase !== 'player';
}

// One card face: huge strength numeral, family glyph + colour, cost pips,
// name and rule text. Suits are colour AND shape, never text alone.
export function renderCard(card, state, who, laneIndex) {
  const fam = FAMILIES[card.family];
  const el = document.createElement('div');
  el.className = `card fam-${card.family}`;
  el.dataset.uid = card.uid;
  el.style.setProperty('--fam', fam.color);
  el.style.setProperty('--fam-dark', fam.dark);
  let bonus = '';
  if (laneIndex >= 0) {
    // Effective strength is shown on lane cards so combos read at a glance.
    const eff = effectiveStrength(state, who, laneIndex, card);
    if (eff !== card.strength) bonus = `<div class="card-bonus">${eff > card.strength ? `+${eff - card.strength}` : `${eff - card.strength}`}</div>`;
  }
  const pips = Array.from({ length: 3 }, (_, i) =>
    `<span class="pip${i < card.cost ? ' on' : ''}">●</span>`).join('');
  el.innerHTML = `
    <div class="card-top"><span class="card-str">${card.strength}</span><span class="card-cost">${pips}</span></div>
    <div class="card-glyph" style="color:${fam.color}">${fam.glyph}</div>
    <div class="card-name">${laneIndex >= 0 ? (card.short || card.name) : card.name}</div>
    <div class="card-fam">${fam.label}</div>
    <div class="card-text">${card.text}</div>
    ${bonus}`;
  return el;
}

export function renderSurgeOrbs(who, surge) {
  const el = $(`surge-${who}`);
  el.innerHTML = '';
  for (let i = 0; i < 6; i += 1) {
    const orb = document.createElement('span');
    orb.className = `surge-orb${i < surge ? ' on' : ''}`;
    orb.textContent = '●';
    el.appendChild(orb);
  }
  $(`surge-num-${who}`).textContent = `${surge}`;
}

export function renderIntent(state) {
  const banner = $('intent-banner');
  banner.textContent = state.intent || '';
  banner.classList.toggle('visible', Boolean(state.intent));
}

export function setMessage(text) {
  $('table-message').textContent = text;
}

// Show the title screen, with a fanned sample hand across the bottom.
export function showTitle() {
  $('title-screen').classList.remove('hidden');
  $('end-screen').classList.add('hidden');
}

// Show the win or loss screen. `result` is 'you' (victory) or 'rival' (defeat).
export function showEndScreen(state, result) {
  const end = $('end-screen');
  const win = result === 'you';
  end.classList.remove('hidden', 'win', 'loss');
  end.classList.add(win ? 'win' : 'loss');
  $('end-title').textContent = win ? 'VICTORY — The Tide Is Yours' : 'DEFEAT — The Current Takes You';
  $('end-sub').textContent = win
    ? 'The Deep bows to the Shorebound. Rill’s hull lies in the Shallows.'
    : 'Your hull is broken on the rocks. Rill keeps the Deep — this time.';
  $('end-score').textContent = `Favour ${state.you.favour} — ${state.rival.favour} · Hull ${state.you.hull} — ${state.rival.hull}`;
  $('end-detail').textContent = win
    ? (state.rival.hull <= 0
      ? `You sank Rill's hull in ${state.handNumber} hand${state.handNumber === 1 ? '' : 's'}.`
      : `You reached ${FAVOUR_TO_WIN} favour in ${state.handNumber} hand${state.handNumber === 1 ? '' : 's'}.`)
    : (state.you.hull <= 0
      ? `Your hull hit 0 in hand ${state.handNumber}.`
      : `Rill reached ${FAVOUR_TO_WIN} favour in hand ${state.handNumber}.`);
}
