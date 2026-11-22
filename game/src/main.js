// main.js — boot and the game loop: create the game, bind mouse and keyboard,
// run the turn flow (you play, Rill answers, the tide turns), and end the game.
// The rules live in rules.js, the AI in rivalBrain.js, the rendering in table.js.

import { FAVOUR_TO_WIN, HAND_SIZE, PLAYS_PER_HAND, START_HULL, START_SURGE, hasOp, isTidecaller } from './cards.js';
import { buildTideDeck, discardHand, drawUpToHand, makeRng, newPlayerState } from './deck.js';
import { bankSurgeForCard, gainSurgePerTurn, resetSurge } from './surge.js';
import { checkVictory, handIsOver, playCard, tideTurns } from './rules.js';
import { applyRivalMove, chooseRivalMove, readRivalIntent } from './rivalBrain.js';
import { dealHand, floatNumber, pulseGlow, shakeTable, slideCard, victoryFlourish } from './animation.js';
import { playCardSound, playDrawSound, playHitSound, playHookSound, playLoseSound, playScoreSound, playSurgeSound, playTideSound, playWinFanfare, setMuted, unlockAudio } from './sound.js';
import { renderHand, renderIntent, renderTable, setMessage, showEndScreen, showTitle } from './table.js';
import { stageShot, polishShot } from './shots.js';

export function createGame(seed = 20261122) {
  const rng = makeRng(seed);
  const state = {
    seed, rng,
    screen: 'title', phase: 'player', handNumber: 1,
    current: rng() < 0.5 ? 1 : -1,
    you: newPlayerState(makeRng(seed + 11)),
    rival: newPlayerState(makeRng(seed + 77)),
    lanes: [{ you: [], rival: [] }, { you: [], rival: [] }, { you: [], rival: [] }],
    intent: '', selectedUid: null, selectedLane: 1, bankMode: false,
    busy: false, log: [],
  };
  state.you.deck = buildTideDeck(state.you.rng, 'y');
  state.rival.deck = buildTideDeck(state.rival.rng, 'r');
  drawUpToHand(state.you, HAND_SIZE);
  drawUpToHand(state.rival, HAND_SIZE);
  return state;
}

function startNewHand(state) {
  state.handNumber += 1;
  state.current = state.rng() < 0.5 ? 1 : -1; // the current shifts every hand
  state.you.playsUsed = 0;
  state.rival.playsUsed = 0;
  resetSurge(state.you);
  resetSurge(state.rival);
  drawUpToHand(state.you, HAND_SIZE);
  drawUpToHand(state.rival, HAND_SIZE);
  state.phase = 'player';
  state.intent = '';
  setMessage(`Hand ${state.handNumber} — the current shifts. Play a card, or bank one for Surge.`);
}

export function startGame(state) {
  Object.assign(state, createGame(state.seed));
  state.screen = 'table';
  state.phase = 'player';
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('end-screen').classList.add('hidden');
  renderTable(state);
  dealHand(document.getElementById('player-hand'));
  playDrawSound();
  setMessage('Your move — click a card, then a lane. First to 15 favour, or sink Rill’s hull.');
  window.__tidebound = { state, api: { playPlayerCard, bankPlayerCard, passPlayerTurn, startGame: () => startGame(state) } };
}

// The player's move: play the selected card into a lane.
export function playPlayerCard(state, cardUid, laneIndex) {
  if (state.screen !== 'table' || state.phase !== 'player' || state.busy) return false;
  const card = state.you.hand.find((c) => c.uid === cardUid);
  if (!card) return false;
  if (card.cost > state.you.surge) {
    setMessage(`${card.name} costs ${card.cost} Surge — you have ${state.you.surge}. Bank a card first.`);
    return false;
  }
  const placed = playCard(state, 'you', cardUid, laneIndex);
  if (!placed) return false;
  state.selectedUid = null;
  state.bankMode = false;
  if (isTidecaller(placed)) playTideSound(); else if (hasOp(placed, 'dragRival')) playHookSound(); else playCardSound();
  renderTable(state);
  afterPlayerTurn(state);
  return true;
}

// Bank a card for +2 Surge instead of playing it.
export function bankPlayerCard(state, cardUid) {
  if (state.screen !== 'table' || state.phase !== 'player' || state.busy) return false;
  const card = bankSurgeForCard(state.you, cardUid);
  if (!card) return false;
  state.selectedUid = null;
  state.bankMode = false;
  playSurgeSound();
  setMessage(`Banked ${card.name} — +2 Surge. Rill answers…`);
  renderTable(state);
  afterPlayerTurn(state);
  return true;
}

export function passPlayerTurn(state) {
  if (state.screen !== 'table' || state.phase !== 'player' || state.busy) return false;
  state.you.playsUsed += 1;
  state.bankMode = false;
  state.selectedUid = null;
  setMessage('You pass. Rill answers…');
  renderTable(state);
  afterPlayerTurn(state);
  return true;
}

function afterPlayerTurn(state) {
  if (handIsOver(state)) { resolveTideTurn(state); return; }
  state.phase = 'rival';
  state.busy = true;
  renderTable(state);
  window.setTimeout(() => runRivalTurn(state), 650);
}

// Rill thinks, telegraphs, hovers a face-down card over its lane, then commits.
function runRivalTurn(state) {
  gainSurgePerTurn(state.rival);
  const move = chooseRivalMove(state);
  state.intent = readRivalIntent(state, move);
  renderIntent(state);
  renderTable(state);
  const hoverMs = move.kind === 'play' ? 850 : 500;
  if (move.kind === 'play') {
    const laneEl = document.querySelector(`.lane[data-lane="${move.lane}"] .lane-row.rival`);
    if (laneEl) laneEl.classList.add('hovering');
  }
  window.setTimeout(() => {
    document.querySelectorAll('.lane-row.rival.hovering').forEach((el) => el.classList.remove('hovering'));
    const note = applyRivalMove(state, move);
    if (move.kind === 'play' && isTidecaller(move.card)) playTideSound();
    else if (move.kind === 'play' && hasOp(move.card, 'dragRival')) playHookSound();
    else if (move.kind === 'play') playCardSound();
    else playSurgeSound();
    setMessage(note);
    state.busy = false;
    if (handIsOver(state)) { resolveTideTurn(state); return; }
    state.phase = 'player';
    gainSurgePerTurn(state.you);
    renderTable(state);
  }, hoverMs);
}

// Score the lanes, hand out favour and breakthrough damage, then next hand
// — or the end screen when someone has won.
function resolveTideTurn(state) {
  state.phase = 'scoring';
  state.intent = 'The tide turns…';
  renderTable(state);
  playScoreSound();
  const results = tideTurns(state);
  const layer = document.getElementById('fx-layer');
  const tableEl = document.getElementById('app');
  results.forEach((r, i) => {
    const laneEl = document.querySelector(`.lane[data-lane="${i}"]`);
    if (!r.winner) return;
    pulseGlow(laneEl);
    const rect = laneEl.getBoundingClientRect();
    const appRect = tableEl.getBoundingClientRect();
    floatNumber(layer, rect.left - appRect.left + rect.width / 2, rect.top - appRect.top + 8,
      `+${r.favour} favour ${r.winner === 'you' ? 'YOU' : 'RILL'}`, r.winner === 'you' ? 'favour' : 'damage');
    if (r.damage > 0) {
      shakeTable(tableEl, Math.min(1.4, r.damage / 4));
      playHitSound();
      floatNumber(layer, rect.left - appRect.left + rect.width / 2, rect.top - appRect.top + 44,
        `−${r.damage} hull`, 'damage');
    }
  });
  renderTable(state);
  window.setTimeout(() => {
    const winner = checkVictory(state);
    if (winner) { endGame(state, winner); return; }
    discardHand(state.you);
    discardHand(state.rival);
    startNewHand(state);
    renderTable(state);
    dealHand(document.getElementById('player-hand'));
    playDrawSound();
  }, 1500);
}

function endGame(state, winner) {
  state.screen = winner === 'you' ? 'win' : 'loss';
  state.phase = 'over';
  renderTable(state);
  showEndScreen(state, winner);
  if (winner === 'you') {
    playWinFanfare();
    victoryFlourish(document.getElementById('fx-layer'), 110);
  } else {
    playLoseSound();
  }
}

// --- input: mouse + keyboard ---------------------------------------------

function bindInput(state) {
  document.getElementById('player-hand').addEventListener('click', (e) => {
    const cardEl = e.target.closest('.card');
    if (!cardEl || state.phase !== 'player' || state.busy) return;
    unlockAudio();
    const uid = cardEl.dataset.uid;
    if (state.bankMode) { bankPlayerCard(state, uid); return; }
    state.selectedUid = state.selectedUid === uid ? null : uid;
    renderHand(state);
  });
  document.querySelectorAll('.lane').forEach((laneEl) => {
    laneEl.addEventListener('click', () => {
      if (state.phase !== 'player' || state.busy || !state.selectedUid) return;
      unlockAudio();
      playPlayerCard(state, state.selectedUid, Number(laneEl.dataset.lane));
    });
    laneEl.addEventListener('mouseenter', () => {
      if (state.selectedUid) laneEl.classList.add('targetable');
    });
    laneEl.addEventListener('mouseleave', () => laneEl.classList.remove('targetable'));
  });
  document.getElementById('bank-btn').addEventListener('click', () => {
    if (state.phase !== 'player' || state.busy) return;
    state.bankMode = !state.bankMode;
    state.selectedUid = null;
    renderHand(state);
    setMessage(state.bankMode ? 'Banking — click a card to discard it for +2 Surge.' : 'Banking off.');
  });
  document.getElementById('pass-btn').addEventListener('click', () => passPlayerTurn(state));
  document.getElementById('play-btn').addEventListener('click', () => { unlockAudio(); startGame(state); });
  document.getElementById('howto-btn').addEventListener('click', () => {
    document.getElementById('howto').classList.remove('hidden');
  });
  document.getElementById('howto-close').addEventListener('click', () => {
    document.getElementById('howto').classList.add('hidden');
  });
  document.getElementById('again-btn').addEventListener('click', () => { unlockAudio(); startGame(state); });
  document.getElementById('sound-btn').addEventListener('click', (e) => {
    const muted = setMuted(!document.getElementById('sound-btn').classList.toggle('muted'));
    e.currentTarget.textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
  });
  document.addEventListener('keydown', (e) => {
    if (state.screen === 'title' && (e.key === 'Enter' || e.key === ' ')) { unlockAudio(); startGame(state); return; }
    if (state.screen !== 'table' || state.phase !== 'player' || state.busy) return;
    if (e.key >= '1' && e.key <= '5') {
      const card = state.you.hand[Number(e.key) - 1];
      if (!card) return;
      if (state.bankMode) { bankPlayerCard(state, card.uid); return; }
      state.selectedUid = state.selectedUid === card.uid ? null : card.uid;
      renderHand(state);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      state.selectedLane = Math.max(0, Math.min(2, state.selectedLane + (e.key === 'ArrowRight' ? 1 : -1)));
      document.querySelectorAll('.lane').forEach((el, i) => el.classList.toggle('targetable', i === state.selectedLane && !!state.selectedUid));
    } else if (e.key === 'Enter' && state.selectedUid) {
      playPlayerCard(state, state.selectedUid, state.selectedLane);
    } else if (e.key.toLowerCase() === 'b') {
      state.bankMode = !state.bankMode;
      renderHand(state);
    } else if (e.key.toLowerCase() === 'p') {
      passPlayerTurn(state);
    } else if (e.key === 'Escape') {
      state.selectedUid = null;
      state.bankMode = false;
      renderHand(state);
    }
  });
}

// --- boot -----------------------------------------------------------------

export function boot() {
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed') || 20261122);
  const state = createGame(seed);
  const shot = params.get('shot');
  if (shot) {
    stageShot(state, shot);
    document.getElementById('title-screen').classList.toggle('hidden', state.screen !== 'title');
    renderTable(state);
    if (state.screen === 'win') showEndScreen(state, 'you');
    if (state.screen === 'loss') showEndScreen(state, 'rival');
    if (state.screen === 'title') showTitle();
    polishShot(shot);
    window.__tidebound = { state, api: { playPlayerCard, bankPlayerCard, passPlayerTurn, startGame: () => startGame(state) } };
    return state;
  }
  bindInput(state);
  renderTable(state);
  showTitle();
  window.__tidebound = { state, api: { playPlayerCard, bankPlayerCard, passPlayerTurn, startGame: () => startGame(state) } };
  return state;
}

document.addEventListener('DOMContentLoaded', boot);
