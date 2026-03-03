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

| Key | Action |
|-----|--------|
| `R` | Rotate piece 90° clockwise |
| `F` | Flip piece left ↔ right |
| Click piece | Select it |
| Click board | Place selected piece |

## Features

- All 21 Blokus pieces included
- Ghost preview shows where your piece will land (green = valid, grey = invalid)
- Players 2–4 default to AI — toggle any player between Human and AI mid-game
- Optional AI blocking rule: rewards moves that cover opponent corners
- End-game scoreboard with rankings

## Play Online

[https://davidrose79-code.github.io/My-Blokus/](https://davidrose79-code.github.io/My-Blokus/)
