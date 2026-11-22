# Tidebound — Duel of the Deep Current

[![make.fun](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/LecialiArthelais/makefun-best-card-game-20261122-1826/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/LecialiArthelais/makefun-best-card-game-20261122-1826/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826)

An original duelling card game built for [make.fun's best card game bounty](https://make.fun/bounty/best-card-game-20261122-1826). You are the Shorebound; Rill, Tidecaller of the Deep, is waiting across a three-lane current.

## The game

Play cards into the **Sunlit Shallows** (worth 1), the **Mid Current** (2) and the **Deep Trench** (3). When the tide turns, the higher strength in a lane takes its favour — first to **15 favour** wins, or sink Rill's **16 hull** to win by breakthrough.

- **Surge** pays for cards: start with 2, gain +1 a turn, or bank a card for +2. Rill's Surge is always visible, so every spend is a decision you can count.
- **Combos:** Sails in neighbouring lanes boost each other (+1 fleet); cards downstream of a friendly card ride the current (+1); Floodtide gives a whole lane +2; Undertow takes 2 from the rival lane; Hooks drag a rival card toward the Shallows.
- **The Tidecaller** (cost 3, strength 6) flips the current — once per game, and both sides can see it coming.
- **Readable AI:** Rill telegraphs every move in plain words ("Rill is massing in the Deep Trench…"), hovers a face-down card over its lane before committing, and its Tidecaller status is always on display.

Suits are told apart by colour **and** shape (Sail ▲ amber, Hook ⚓ coral, Flood 〰 blue, Tide ◎ violet) — never by text alone. All art is CSS-drawn and all sounds are WebAudio-generated in code; nothing is copied from any commercial game.

## How to run

No build step, no network. Serve `game/` with any static server and open it in desktop Chrome:

```sh
node serve.ts        # then open http://localhost:8080
```

Or open `game/index.html` directly from disk.

**Controls:** mouse (click a card, then a lane) or keyboard — `1–5` select a card, `←` `→` pick a lane, `Enter` play, `B` bank a card for Surge, `P` pass, `Esc` deselect.

## Layout

```
game/
  index.html        page shell: top bar, rival zone, lanes, hand, overlays
  styles.css        table felt, card faces, lane bands, win/loss overlays
  src/
    main.js         boot, turn flow, mouse + keyboard input
    cards.js        card data: Sail / Hook / Flood / Tide definitions
    deck.js         the 24-card tide deck, shuffle, draw
    rules.js        playCard, scoreLane, tideTurns, checkVictory
    surge.js        the Surge economy
    rivalBrain.js   Rill's readable AI: chooseRivalMove, bankSurgeWhenWeak, holdTidecaller
    table.js        rendering the table, hands, lanes, score bars
    animation.js    slide / flip / deal / shake / victory flourish
    sound.js        WebAudio sounds, generated in code
    shots.js        deterministic staged states for screenshots (?shot=…)
main.ts             hand-in program: copies game/ + screenshots/ to /output, writes dossier.json
vendor/makefun-game.ts  the kit's dossier library, unchanged
screenshots/       1-title, 2-table, 3-win, 4-loss — real renders of the game
```

Screenshots are staged through the game's own `?shot=` hooks (`?shot=title|table|win|loss&seed=…`), the same states live play reaches.
