# Blokus

A browser-based implementation of the Blokus board game for 4 players.

## How to Play

Blokus is a strategy game where each player tries to place as many of their 21 pieces on the board as possible.

**Rules:**
- Each player starts in one corner of the 20×20 board
- Your first piece must cover your starting corner
- Every piece you place must touch one of your own pieces **corner-to-corner** (diagonally)
- Your pieces may **not** touch your own pieces edge-to-edge
- The game ends when no player can place any more pieces

**Scoring:**
- -1 point for every square in your unplaced pieces
- +15 bonus if you placed all your pieces
- +5 additional bonus if your last piece was the 1×1 square

## Controls

| Key / Action | What it does |
|---|---|
| `R` | Rotate piece 90° clockwise |
| `F` | Flip piece left ↔ right |
| Click piece | Select it |
| Click board | Place selected piece |
| Hold **Hint** button | Highlights every valid placement for your selected piece |
| **Reset Board** | Restart the game from scratch |

## Features

- All 21 Blokus pieces included
- Ghost preview shows where your piece will land (green = valid, grey = invalid)
- **Hint button** — hold it down to see every cell where your selected piece could legally be placed (any rotation or flip)
- Players 2–4 default to AI — toggle any player between Human and AI mid-game
- Optional AI blocking rule: rewards moves that cover opponent corners
- Passing is automatic — if you have no legal moves the game skips your turn for you
- Responsive layout: board and controls sit side by side on wide screens and stack vertically on narrow ones
- Live status message shown in the header bar so you always know whose turn it is
- How to Play rules and keyboard shortcuts shown alongside the board
- End-game scoreboard with rankings

## Play Online

[https://davidrose79-code.github.io/My-Blokus/](https://davidrose79-code.github.io/My-Blokus/)
