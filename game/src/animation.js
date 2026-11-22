// animation.js — the feel layer: cards that slide, flip and snap into place,
// a dealt hand with weight, a win that lands with a flourish. Every effect
// is visual only; the rules never wait on an animation.

export const EASE_SNAP = 'cubic-bezier(0.2, 1.4, 0.4, 1)';
export const EASE_SLIDE = 'cubic-bezier(0.25, 0.9, 0.3, 1)';

// Slide a card element from its current spot to a target slot, then settle.
export function slideCard(el, fromRect, toRect, ms = 380) {
  const dx = fromRect.left - toRect.left;
  const dy = fromRect.top - toRect.top;
  el.style.transition = 'none';
  el.style.transform = `translate(${dx}px, ${dy}px) rotate(${(Math.random() - 0.5) * 8}deg)`;
  el.style.zIndex = '30';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = `transform ${ms}ms ${EASE_SLIDE}`;
      el.style.transform = 'translate(0, 0) rotate(0deg)';
    });
  });
  window.setTimeout(() => { el.style.zIndex = ''; }, ms + 30);
  return ms;
}

// Flip a card face-down to face-up (or back) with a 3-D turn.
export function flipCard(el, faceUp, ms = 320) {
  el.style.transition = `transform ${ms}ms ${EASE_SLIDE}`;
  el.style.transform = faceUp ? 'rotateY(0deg)' : 'rotateY(180deg)';
  return ms;
}

// Deal a hand with weight: cards arrive one after another, fanning out with
// a slight rotation, each landing with a tiny overshoot.
export function dealHand(handEl, ms = 90) {
  const cards = [...handEl.querySelectorAll('.card')];
  cards.forEach((card, i) => {
    card.style.transition = 'none';
    card.style.transform = 'translateY(-46px) rotate(0deg) scale(0.92)';
    card.style.opacity = '0';
    window.setTimeout(() => {
      card.style.transition = `transform 340ms ${EASE_SNAP}, opacity 240ms ease-out`;
      card.style.transform = '';
      card.style.opacity = '1';
    }, 60 + i * ms);
  });
  return 60 + cards.length * ms;
}

// Shake the table on a breakthrough hit — trauma that decays, never a buzz.
export function shakeTable(tableEl, strength = 1) {
  tableEl.classList.remove('shake');
  void tableEl.offsetWidth; // restart the animation
  tableEl.style.setProperty('--shake', String(6 * strength));
  tableEl.classList.add('shake');
}

// A floating number that rises and fades over a lane (favour, damage).
export function floatNumber(layer, x, y, text, kind = 'favour') {
  const el = document.createElement('div');
  el.className = `float-num float-${kind}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  layer.appendChild(el);
  window.setTimeout(() => el.remove(), 1600);
  return el;
}

// The win flourish: gold confetti and glowing bubbles rising over the table.
export function victoryFlourish(layer, count = 90) {
  const colors = ['#f5b942', '#ffe9a8', '#3ec6e8', '#b78cff', '#ffffff'];
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement('div');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.9}s`;
    piece.style.animationDuration = `${2.2 + Math.random() * 1.8}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.appendChild(piece);
    window.setTimeout(() => piece.remove(), 5200);
  }
}

// A brief glow pulse on an element (a lane that just scored, a Tidecaller).
export function pulseGlow(el) {
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}
