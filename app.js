// ── app.js — Stage 9: Turn flow, no-legal-moves detection, end game ──

// ── Players ──
const PLAYERS = [
  { name: 'Blue',   color: '#4a90d9', startCol: 0,  startRow: 0  },
  { name: 'Yellow', color: '#f0c040', startCol: 19, startRow: 0  },
  { name: 'Red',    color: '#e05050', startCol: 19, startRow: 19 },
  { name: 'Green',  color: '#50b050', startCol: 0,  startRow: 19 },
];

const BOARD_SIZE = 20;

// ── Piece definitions ──
const PIECES = [
  { name: 'I1', cells: [[0,0]] },
  { name: 'I2', cells: [[0,0],[1,0]] },
  { name: 'I3', cells: [[0,0],[1,0],[2,0]] },
  { name: 'V3', cells: [[0,0],[1,0],[0,1]] },
  { name: 'I4', cells: [[0,0],[1,0],[2,0],[3,0]] },
  { name: 'L4', cells: [[0,0],[1,0],[2,0],[2,1]] },
  { name: 'T4', cells: [[0,0],[1,0],[2,0],[1,1]] },
  { name: 'S4', cells: [[1,0],[2,0],[0,1],[1,1]] },
  { name: 'O4', cells: [[0,0],[1,0],[0,1],[1,1]] },
  { name: 'F',  cells: [[1,0],[2,0],[0,1],[1,1],[1,2]] },
  { name: 'I5', cells: [[0,0],[1,0],[2,0],[3,0],[4,0]] },
  { name: 'L5', cells: [[0,0],[0,1],[0,2],[0,3],[1,3]] },
  { name: 'N',  cells: [[1,0],[0,1],[1,1],[0,2],[0,3]] },
  { name: 'P',  cells: [[0,0],[1,0],[0,1],[1,1],[0,2]] },
  { name: 'T5', cells: [[0,0],[1,0],[2,0],[1,1],[1,2]] },
  { name: 'U',  cells: [[0,0],[2,0],[0,1],[1,1],[2,1]] },
  { name: 'V5', cells: [[0,0],[0,1],[0,2],[1,2],[2,2]] },
  { name: 'W',  cells: [[0,0],[0,1],[1,1],[1,2],[2,2]] },
  { name: 'X',  cells: [[1,0],[0,1],[1,1],[2,1],[1,2]] },
  { name: 'Y',  cells: [[1,0],[0,1],[1,1],[1,2],[1,3]] },
  { name: 'Z5', cells: [[0,0],[1,0],[1,1],[1,2],[2,2]] },
];

// ── Piece transforms (pure functions) ──

function normalize(cells) {
  const minCol = Math.min(...cells.map(([c]) => c));
  const minRow = Math.min(...cells.map(([, r]) => r));
  return cells.map(([c, r]) => [c - minCol, r - minRow]);
}

function rotateCW(cells) {
  const maxRow = Math.max(...cells.map(([, r]) => r));
  return normalize(cells.map(([c, r]) => [maxRow - r, c]));
}

function flipH(cells) {
  const maxCol = Math.max(...cells.map(([c]) => c));
  return normalize(cells.map(([c, r]) => [maxCol - c, r]));
}

// ── Piece orientations ──
// Returns all unique rotations + flips of a piece (up to 8, fewer for symmetric pieces).
// We try 4 rotations of the original and 4 rotations of the flipped version,
// deduplicating via a sorted string key.
function getOrientations(cells) {
  const unique = [];
  const seen = new Set();

  let cur = normalize(cells.map(([c, r]) => [c, r])); // fresh copy

  for (let flip = 0; flip < 2; flip++) {
    for (let rot = 0; rot < 4; rot++) {
      // Sort cells so the key is order-independent
      const key = [...cur]
        .sort((a, b) => a[1] - b[1] || a[0] - b[0])
        .map(([c, r]) => `${c},${r}`)
        .join('|');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(cur);
      }
      cur = rotateCW(cur);
    }
    cur = flipH(cur); // after 4 rotations cur = original; now flip it
  }

  return unique;
}

// Pre-compute orientations for every piece once at startup.
// hasLegalMove uses this instead of calling getOrientations inside the hot loop.
const PIECE_ORIENTATIONS = PIECES.map(p => getOrientations(p.cells));

// ── Board neighbor helpers ──

// The 4 cells sharing an edge with (r, c), filtered to in-bounds only.
function getEdgeNeighbors(r, c) {
  return [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]
    .filter(([nr,nc]) => nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE);
}

// The 4 diagonal cells of (r, c), filtered to in-bounds only.
function getDiagNeighbors(r, c) {
  return [[r-1,c-1],[r-1,c+1],[r+1,c-1],[r+1,c+1]]
    .filter(([nr,nc]) => nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE);
}

// True if the player owns at least one cell on the board (i.e. has made a move).
function hasPlacedAny(playerIndex) {
  return board.some(row => row.some(cell => cell === playerIndex));
}

// ── Placement validation ──
// Takes absolute [row, col] positions (already offset by anchor).
// Returns { ok: true } or { ok: false, reason: '...' }.

function canPlace(absCells, playerIndex) {
  // ── Rule 1: in-bounds & no overlap ──
  for (const [r, c] of absCells) {
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
      return { ok: false, reason: 'Out of bounds — move the piece so it fits on the board.' };
    }
    if (board[r][c] !== null) {
      return { ok: false, reason: 'Overlaps an existing piece.' };
    }
  }

  // ── Rule 2: first move must cover the player's starting corner ──
  if (!hasPlacedAny(playerIndex)) {
    const p = PLAYERS[playerIndex];
    const coversCorner = absCells.some(([r, c]) => r === p.startRow && c === p.startCol);
    if (!coversCorner) {
      return {
        ok: false,
        reason: `First move must cover your starting corner (row ${p.startRow}, col ${p.startCol}).`,
      };
    }
    return { ok: true, reason: '' }; // first move only needs the corner rule
  }

  // ── Rule 3: no edge-to-edge contact with own existing pieces ──
  // Because the new cells haven't been written to board[][] yet, every cell
  // in absCells is currently null on the board — so we only catch genuine
  // conflicts with already-placed pieces of the same player.
  for (const [r, c] of absCells) {
    for (const [nr, nc] of getEdgeNeighbors(r, c)) {
      if (board[nr][nc] === playerIndex) {
        return { ok: false, reason: 'Your pieces may not touch each other edge-to-edge.' };
      }
    }
  }

  // ── Rule 4: must touch own piece corner-to-corner (diagonally) ──
  const touchesCorner = absCells.some(([r, c]) =>
    getDiagNeighbors(r, c).some(([nr, nc]) => board[nr][nc] === playerIndex)
  );
  if (!touchesCorner) {
    return { ok: false, reason: 'Must touch one of your own pieces corner-to-corner (diagonally).' };
  }

  return { ok: true, reason: '' };
}

// ── Game state ──
let board = [];
let currentPlayerIndex = 0;
let turnNumber = 1;
let selectedPieceIndex = null;
let currentCells = null;   // selected piece's cells after transforms
let ghostAnchor = null;    // { row, col } of the last cell the cursor hovered over
// playerPieces[i] = array of PIECES indices still available to player i
let playerPieces = [];
// Players with no remaining legal moves; once stuck, always stuck
let stuckPlayers = new Set();
let gameOver = false;

// lastPlacedPieceIndex[i] = PIECES index of the most recent piece player i placed, or null
let lastPlacedPieceIndex = [];

// 'human' or 'ai' for each player — persists across resets
let playerModes = ['human', 'ai', 'ai', 'ai'];

// When true, the AI scoring function also rewards blocking opponent corners
let blockOpponentsEnabled = false;

// Handle for the pending AI move setTimeout so we can cancel it on reset
let aiTimeout = null;

// True while the Hint button is held — suppresses the ghost preview
let hintActive = false;

function initPlayerPieces() {
  playerPieces = PLAYERS.map(() => PIECES.map((_, i) => i));
  lastPlacedPieceIndex = new Array(PLAYERS.length).fill(null);
  stuckPlayers = new Set();
  gameOver = false;
}

// ── Legal-move detection ──
// Tries every remaining piece × every orientation × every board position.
// Returns true as soon as one valid placement is found (short-circuits).
function hasLegalMove(playerIndex) {
  const available = playerPieces[playerIndex];
  for (const pieceIndex of available) {
    for (const cells of PIECE_ORIENTATIONS[pieceIndex]) {
      for (let anchorRow = 0; anchorRow < BOARD_SIZE; anchorRow++) {
        for (let anchorCol = 0; anchorCol < BOARD_SIZE; anchorCol++) {
          const abs = cells.map(([dc, dr]) => [anchorRow + dr, anchorCol + dc]);
          if (canPlace(abs, playerIndex).ok) return true;
        }
      }
    }
  }
  return false;
}

// ── AI: score a candidate placement ──
// Higher score = better move.  Three (optionally four) factors:
//   1. Piece size      — +2 per square  (big pieces early)
//   2. New corners     — +1 per new diagonal corner the move opens up
//   3. Reach           — 0–5 bonus scaled by how far the piece extends from
//                        the player's starting corner
//   4. Block opponents — +2 per opponent corner our cells cover
//                        (only active when blockOpponentsEnabled is true)
function scoreMove(absCells, playerIndex) {
  let score = 0;

  // ── Factor 1: piece size ──
  score += absCells.length * 2;

  // ── Factor 2: new corners opened ──
  // Build the full set of own cells after this move (existing board + new)
  const placedSet = new Set(absCells.map(([r, c]) => `${r},${c}`));
  const ownAfter  = new Set();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === playerIndex) ownAfter.add(`${r},${c}`);
    }
  }
  placedSet.forEach(k => ownAfter.add(k));

  const newCorners = new Set();
  for (const [r, c] of absCells) {
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
      if (board[nr][nc] !== null) continue;       // occupied by anyone
      if (placedSet.has(`${nr},${nc}`)) continue; // part of this very piece
      // Not edge-adjacent to any of our own cells (would violate future moves)
      const edgeBlocked = [[-1,0],[1,0],[0,-1],[0,1]].some(
        ([er, ec]) => ownAfter.has(`${nr+er},${nc+ec}`)
      );
      if (!edgeBlocked) newCorners.add(`${nr},${nc}`);
    }
  }
  score += newCorners.size;

  // ── Factor 3: reach ──
  const { startRow, startCol } = PLAYERS[playerIndex];
  let maxDist = 0;
  for (const [r, c] of absCells) {
    const d = Math.sqrt((r - startRow) ** 2 + (c - startCol) ** 2);
    if (d > maxDist) maxDist = d;
  }
  // Max possible distance on a 20×20 board ≈ 27.5; scale to 0–5
  score += (maxDist / 27.5) * 5;

  // ── Factor 4: block opponents (optional) ──
  if (blockOpponentsEnabled) {
    for (let opp = 0; opp < PLAYERS.length; opp++) {
      if (opp === playerIndex) continue;
      if (stuckPlayers.has(opp)) continue;
      for (const [r, c] of absCells) {
        // Is (r,c) currently a valid corner option for the opponent?
        const diagToOpp = [[-1,-1],[-1,1],[1,-1],[1,1]].some(([dr, dc]) => {
          const nr = r+dr, nc = c+dc;
          return nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE
                 && board[nr][nc] === opp;
        });
        if (!diagToOpp) continue;
        const edgeToOpp = [[-1,0],[1,0],[0,-1],[0,1]].some(([dr, dc]) => {
          const nr = r+dr, nc = c+dc;
          return nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE
                 && board[nr][nc] === opp;
        });
        if (!edgeToOpp) score += 2; // we are covering one of their corner options
      }
    }
  }

  return score;
}

// ── AI: pick and play the best move for playerIndex ──
function doAiTurn(playerIndex) {
  if (gameOver) return;

  let bestScore = -Infinity;
  let bestPieceIndex = null, bestOrientation = null;
  let bestAnchorRow  = null, bestAnchorCol   = null;

  for (const pieceIndex of playerPieces[playerIndex]) {
    for (const orientation of PIECE_ORIENTATIONS[pieceIndex]) {
      for (let anchorRow = 0; anchorRow < BOARD_SIZE; anchorRow++) {
        for (let anchorCol = 0; anchorCol < BOARD_SIZE; anchorCol++) {
          const abs = orientation.map(([dc, dr]) => [anchorRow + dr, anchorCol + dc]);
          if (!canPlace(abs, playerIndex).ok) continue;
          const s = scoreMove(abs, playerIndex);
          if (s > bestScore) {
            bestScore      = s;
            bestPieceIndex = pieceIndex;
            bestOrientation = orientation;
            bestAnchorRow  = anchorRow;
            bestAnchorCol  = anchorCol;
          }
        }
      }
    }
  }

  if (bestPieceIndex === null) {
    // No legal move — forced pass
    setStatus(`${PLAYERS[playerIndex].name} (AI) has no moves — passing.`);
    advanceTurn();
    return;
  }

  setStatus(`${PLAYERS[playerIndex].name} (AI) plays ${PIECES[bestPieceIndex].name}.`);
  selectedPieceIndex = bestPieceIndex;
  currentCells       = bestOrientation;
  tryPlace(bestAnchorRow, bestAnchorCol);
}

// ── Turn advancement ──
// Moves to the next player, auto-skipping anyone with no legal moves.
// Calls endGame() if all players are stuck.
function advanceTurn() {
  clearGhost();
  selectedPieceIndex = null;
  currentCells = null;
  ghostAnchor = null;

  const startPlayer = currentPlayerIndex;

  for (let step = 1; step <= PLAYERS.length; step++) {
    const candidate = (startPlayer + step) % PLAYERS.length;

    // Increment round counter each time we cycle past player 0 (Blue)
    if (candidate === 0) turnNumber++;

    // Already known to be stuck — skip without re-checking
    if (stuckPlayers.has(candidate)) continue;

    // Check whether this player has any valid move
    if (!hasLegalMove(candidate)) {
      stuckPlayers.add(candidate);
      continue; // keep looking
    }

    // Found a player who can move — hand them the turn
    currentPlayerIndex = candidate;
    renderPlayerCards();
    renderPalette();

    if (playerModes[currentPlayerIndex] === 'ai') {
      setStatus(`${PLAYERS[currentPlayerIndex].name} (AI) is thinking...`);
      aiTimeout = setTimeout(() => doAiTurn(currentPlayerIndex), 400);
    } else {
      setStatus(`${PLAYERS[currentPlayerIndex].name}'s turn — pick a piece.`);
    }
    return;
  }

  // Every player was stuck → game over
  endGame();
}

// ── End game ──
function endGame() {
  gameOver = true;
  clearGhost();
  selectedPieceIndex = null;
  currentCells = null;
  renderPlayerCards();

  // ── Compute scores ──
  // Base:  -1 per square in each unplaced piece
  // +15   if the player placed every single one of their pieces
  // +5    additionally if their very last piece was the 1-square monomino (I1)
  const scores = PLAYERS.map((player, i) => {
    const remainingSquares = playerPieces[i]
      .reduce((sum, idx) => sum + PIECES[idx].cells.length, 0);
    const base     = -remainingSquares;
    const placedAll = playerPieces[i].length === 0;
    const lastIdx  = lastPlacedPieceIndex[i];
    const lastWasMono = placedAll && lastIdx !== null && PIECES[lastIdx].cells.length === 1;
    const bonus    = placedAll ? (lastWasMono ? 20 : 15) : 0;
    const total    = base + bonus;
    return { player, i, base, placedAll, lastWasMono, bonus, total,
             piecesLeft: playerPieces[i].length };
  });

  // Sort highest → lowest
  scores.sort((a, b) => b.total - a.total);

  // ── Build scoreboard DOM ──
  const boardEl2 = document.getElementById('scoreboard');
  boardEl2.innerHTML = '';

  const rankLabels = ['1st', '2nd', '3rd', '4th'];
  const rankClasses = ['rank-1', 'rank-2', 'rank-3', 'rank-4'];

  scores.forEach((s, rank) => {
    const row = document.createElement('div');
    row.className = `score-row ${rankClasses[rank]}`;

    // Rank
    const rankEl = document.createElement('div');
    rankEl.className = 'score-rank';
    rankEl.textContent = rankLabels[rank];

    // Color swatch
    const swatch = document.createElement('div');
    swatch.className = 'score-swatch';
    swatch.style.background = s.player.color;

    // Name + detail lines
    const info = document.createElement('div');
    info.className = 'score-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'score-name';
    nameEl.textContent = s.player.name;

    const details = [];
    if (s.base < 0)       details.push(`${s.base} (${s.piecesLeft} piece${s.piecesLeft !== 1 ? 's' : ''} left)`);
    if (s.placedAll)      details.push('+15 all pieces placed');
    if (s.lastWasMono)    details.push('+5 last piece was 1×1');
    if (details.length === 0) details.push('No pieces placed');

    const detailEl = document.createElement('div');
    detailEl.className = 'score-detail';
    detailEl.textContent = details.join(' · ');

    info.appendChild(nameEl);
    info.appendChild(detailEl);

    // Total score
    const totalEl = document.createElement('div');
    totalEl.className = 'score-total';
    totalEl.textContent = s.total >= 0 ? `+${s.total}` : `${s.total}`;
    totalEl.style.color = s.total >= 0 ? '#2a9' : '#c44';

    row.appendChild(rankEl);
    row.appendChild(swatch);
    row.appendChild(info);
    row.appendChild(totalEl);
    boardEl2.appendChild(row);
  });

  // Show overlay
  document.getElementById('end-screen').classList.remove('hidden');
  setStatus('Game over! See the final scores.');
}

// ── DOM references ──
const boardEl       = document.getElementById('board');
const playerCardsEl = document.getElementById('player-cards');
const turnNumberEl  = document.getElementById('turn-number');
const statusTextEl  = document.getElementById('status-text');
const paletteEl     = document.getElementById('piece-palette');
const btnReset      = document.getElementById('btn-reset');
const btnHint       = document.getElementById('btn-hint');

// ── Responsive cell sizing ──
// Calculates the largest cell size that fits the board in the visible window.

function calcCellSize() {
  const headerH = document.getElementById('header').offsetHeight;
  const PADDING = 32;  // 16px on each side
  const GAP     = 16;  // gap between board-area and sidebar

  const availH = window.innerHeight - headerH - PADDING;
  const availW = window.innerWidth  - PADDING;

  let maxPx;
  if (window.innerWidth < 700) {
    // Stacked layout: board uses full width; leave half the height for the sidebar
    maxPx = Math.min(availW, availH * 0.5);
  } else {
    // 50/50 layout: each half = (viewport - left pad - right pad - gap) / 2
    const halfW = (window.innerWidth - 48) / 2;
    maxPx = Math.min(halfW, availH);
  }

  return Math.max(12, Math.floor(maxPx / BOARD_SIZE));
}

function applyCellSize() {
  const size = calcCellSize();
  document.documentElement.style.setProperty('--cell-size', size + 'px');
  boardEl.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, ${size}px)`;
}

// ── Board init ──

function initBoard() {
  board = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    board.push(new Array(BOARD_SIZE).fill(null));
  }
  initPlayerPieces();
}

// ── Board rendering ──

function renderBoard() {
  boardEl.innerHTML = '';
  boardEl.style.display = 'grid';
  applyCellSize();

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = row;
      cell.dataset.col = col;

      const playerIdx = board[row][col];
      if (playerIdx !== null) {
        cell.style.background = PLAYERS[playerIdx].color;
      }

      cell.addEventListener('click', () => onCellClick(row, col));
      boardEl.appendChild(cell);
    }
  }
}

// ── Ghost preview helpers ──

function getCellEl(row, col) {
  return boardEl.children[row * BOARD_SIZE + col];
}

function restoreCellBg(el, row, col) {
  const playerIdx = board[row][col];
  el.style.background = playerIdx !== null ? PLAYERS[playerIdx].color : '';
}

// Remove the visual ghost from the board without changing ghostAnchor.
// (ghostAnchor is a position tracker; clearGhost is purely visual.)
function clearGhost() {
  boardEl.querySelectorAll('.cell-ghost').forEach(el => {
    el.classList.remove('cell-ghost');
    restoreCellBg(el, parseInt(el.dataset.row), parseInt(el.dataset.col));
  });
}

// ── Hint: highlight every cell that is part of any valid placement ──
// Considers all rotations and flips of the selected piece.

function showHints() {
  if (selectedPieceIndex === null || gameOver) return;
  if (playerModes[currentPlayerIndex] === 'ai') return;

  hintActive = true;
  clearGhost();

  // Collect every board cell that appears in at least one valid placement
  const hintCells = new Set();
  for (const orientation of PIECE_ORIENTATIONS[selectedPieceIndex]) {
    for (let anchorRow = 0; anchorRow < BOARD_SIZE; anchorRow++) {
      for (let anchorCol = 0; anchorCol < BOARD_SIZE; anchorCol++) {
        const abs = orientation.map(([dc, dr]) => [anchorRow + dr, anchorCol + dc]);
        if (canPlace(abs, currentPlayerIndex).ok) {
          for (const [r, c] of abs) hintCells.add(`${r},${c}`);
        }
      }
    }
  }

  for (const key of hintCells) {
    const [r, c] = key.split(',').map(Number);
    const el = getCellEl(r, c);
    el.classList.add('cell-hint');
    el.style.background = '#555';
  }

  setStatus(`Hint: showing all valid placements for ${PIECES[selectedPieceIndex].name}.`);
}

function clearHints() {
  hintActive = false;
  boardEl.querySelectorAll('.cell-hint').forEach(el => {
    el.classList.remove('cell-hint');
    restoreCellBg(el, parseInt(el.dataset.row), parseInt(el.dataset.col));
  });
  // Restore ghost if the cursor is still over the board
  if (ghostAnchor !== null) showGhost(ghostAnchor.row, ghostAnchor.col);
}

// Show the piece ghost anchored at (anchorRow, anchorCol).
// Runs canPlace to decide green (valid) vs red (invalid).
// Also updates ghostAnchor so R/F keypresses can re-draw without a mouse move.
function showGhost(anchorRow, anchorCol) {
  clearGhost();
  if (selectedPieceIndex === null || currentCells === null) return;

  // Remember where the cursor is so R/F can call showGhost again
  ghostAnchor = { row: anchorRow, col: anchorCol };

  // Compute absolute board positions for this anchor
  const absCells = currentCells.map(([dc, dr]) => [anchorRow + dr, anchorCol + dc]);

  const result = canPlace(absCells, currentPlayerIndex);

  // Valid → player color; invalid → grey
  const ghostColor = result.ok ? PLAYERS[currentPlayerIndex].color : '#aaa';

  // Only colour cells that are actually on the board
  absCells.forEach(([r, c]) => {
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return;
    const el = getCellEl(r, c);
    el.classList.add('cell-ghost');
    el.style.background = ghostColor;
  });

  // Show validation feedback in the status bar
  if (!result.ok) {
    setStatus(result.reason);
  } else {
    setStatus(`${PIECES[selectedPieceIndex].name} — click to place. (R rotate, F flip)`);
  }
}

// ── Piece placement ──

function tryPlace(anchorRow, anchorCol) {
  const absCells = currentCells.map(([dc, dr]) => [anchorRow + dr, anchorCol + dc]);
  const result = canPlace(absCells, currentPlayerIndex);

  if (!result.ok) {
    setStatus(result.reason);
    return;
  }

  absCells.forEach(([r, c]) => { board[r][c] = currentPlayerIndex; });

  const pieceName = PIECES[selectedPieceIndex].name;

  // Remember this as the last piece this player placed (needed for +5 bonus)
  lastPlacedPieceIndex[currentPlayerIndex] = selectedPieceIndex;

  // Remove the placed piece from this player's remaining inventory
  playerPieces[currentPlayerIndex] = playerPieces[currentPlayerIndex]
    .filter(i => i !== selectedPieceIndex);

  selectedPieceIndex = null;
  currentCells = null;
  ghostAnchor = null;

  renderBoard();
  renderPalette();
  // Auto-advance — no button needed
  advanceTurn();
}

// ── Player cards ──

function renderPlayerCards() {
  playerCardsEl.innerHTML = '';

  PLAYERS.forEach((player, index) => {
    const isActive = index === currentPlayerIndex;
    const isStuck  = stuckPlayers.has(index);

    let cls = 'player-card';
    if (isActive)                    cls += ' active';
    if (isStuck)                     cls += ' stuck';
    if (playerModes[index] === 'ai') cls += ' ai-mode';

    const card = document.createElement('div');
    card.className = cls;
    if (isActive) card.style.color = player.color;

    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    swatch.style.background = player.color;

    const label = document.createElement('div');
    label.className = 'player-name';
    label.textContent = player.name;

    card.appendChild(swatch);
    card.appendChild(label);

    if (isStuck) {
      const doneEl = document.createElement('div');
      doneEl.className = 'stuck-label';
      doneEl.textContent = 'done';
      card.appendChild(doneEl);
    }

    // Human / AI toggle button
    const isAi = playerModes[index] === 'ai';
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'mode-toggle' + (isAi ? ' ai' : '');
    toggleBtn.textContent = isAi ? 'AI' : 'Human';
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nowAi = playerModes[index] !== 'ai';
      playerModes[index] = nowAi ? 'ai' : 'human';
      renderPlayerCards();
      // If it's currently this player's turn, react immediately
      if (!gameOver && index === currentPlayerIndex) {
        if (nowAi) {
          // Just switched to AI — schedule a move
          if (aiTimeout !== null) clearTimeout(aiTimeout);
          setStatus(`${PLAYERS[index].name} (AI) is thinking...`);
          aiTimeout = setTimeout(() => doAiTurn(currentPlayerIndex), 400);
        } else {
          // Just switched to Human — cancel any pending AI move
          if (aiTimeout !== null) { clearTimeout(aiTimeout); aiTimeout = null; }
          setStatus(`${PLAYERS[index].name}'s turn — pick a piece.`);
        }
      }
    });
    card.appendChild(toggleBtn);

    playerCardsEl.appendChild(card);
  });

  turnNumberEl.textContent = turnNumber;
}

// ── Piece palette ──

function renderPalette() {
  paletteEl.innerHTML = '';

  // Build a Set of piece indices this player still has available
  const availableSet = new Set(playerPieces[currentPlayerIndex]);
  const remaining = availableSet.size;

  const heading = document.createElement('div');
  heading.textContent = `Pieces — ${remaining} of ${PIECES.length} remaining`;
  paletteEl.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'palette-grid';
  paletteEl.appendChild(grid);

  const playerColor = PLAYERS[currentPlayerIndex].color;

  // Show ALL 21 pieces; played ones are greyed out and non-interactive
  PIECES.forEach((piece, pieceIndex) => {
    const isAvailable = availableSet.has(pieceIndex);
    const isSelected  = pieceIndex === selectedPieceIndex;
    const displayCells = (isSelected && currentCells !== null) ? currentCells : piece.cells;

    let cls = 'piece-preview';
    if (isSelected)  cls += ' selected';
    if (!isAvailable) cls += ' played';   // greyed out via CSS

    const card = document.createElement('div');
    card.className = cls;
    card.title = piece.name;

    const maxCol = Math.max(...displayCells.map(([c]) => c));
    const maxRow = Math.max(...displayCells.map(([, r]) => r));
    const dim = Math.max(maxCol + 1, maxRow + 1);
    const filled = new Set(displayCells.map(([c, r]) => `${c},${r}`));

    // Played pieces use grey; available use the player's color
    const cellColor = isAvailable ? playerColor : '#bbb';

    const miniGrid = document.createElement('div');
    miniGrid.className = 'piece-mini-grid';
    miniGrid.style.gridTemplateColumns = `repeat(${dim}, 10px)`;

    for (let r = 0; r < dim; r++) {
      for (let c = 0; c < dim; c++) {
        const dot = document.createElement('div');
        dot.className = 'preview-cell';
        if (filled.has(`${c},${r}`)) {
          dot.classList.add('filled');
          dot.style.background = cellColor;
        }
        miniGrid.appendChild(dot);
      }
    }

    const nameEl = document.createElement('div');
    nameEl.className = 'piece-label';
    nameEl.textContent = piece.name;

    card.appendChild(miniGrid);
    card.appendChild(nameEl);

    // Only wire up clicks for pieces still in the player's hand
    if (isAvailable) {
      card.addEventListener('click', () => {
        if (selectedPieceIndex === pieceIndex) {
          selectedPieceIndex = null;
          currentCells = null;
          ghostAnchor = null;
          clearGhost();
          setStatus('Piece deselected.');
        } else {
          selectedPieceIndex = pieceIndex;
          currentCells = piece.cells.map(cell => [...cell]);
          if (ghostAnchor !== null) showGhost(ghostAnchor.row, ghostAnchor.col);
          setStatus(`Selected: ${piece.name} — hover board to preview, click to place.`);
        }
        renderPalette();
      });
    }

    grid.appendChild(card);
  });
}

// ── Status bar ──

function setStatus(msg) {
  statusTextEl.textContent = msg;
}

// ── Cell click ──

function onCellClick(row, col) {
  if (gameOver) return;
  if (playerModes[currentPlayerIndex] === 'ai') return; // AI handles its own turn

  if (selectedPieceIndex !== null && currentCells !== null) {
    // Validate and place — rules enforced via canPlace inside tryPlace.
    // On success, tryPlace calls advanceTurn() automatically.
    tryPlace(row, col);
  } else {
    setStatus('Select a piece from the palette first.');
  }
}

// ── Keyboard: R = rotate, F = flip ──
// After transforming, re-draw the ghost at the last known cursor position
// so the user sees the change without having to wiggle the mouse.

document.addEventListener('keydown', (e) => {
  if (selectedPieceIndex === null) return;
  if (playerModes[currentPlayerIndex] === 'ai') return;

  if (e.key === 'r' || e.key === 'R') {
    currentCells = rotateCW(currentCells);
    renderPalette();
    if (ghostAnchor !== null) showGhost(ghostAnchor.row, ghostAnchor.col);
    else setStatus(`${PIECES[selectedPieceIndex].name}: rotated. (R rotate, F flip)`);
  }

  if (e.key === 'f' || e.key === 'F') {
    currentCells = flipH(currentCells);
    renderPalette();
    if (ghostAnchor !== null) showGhost(ghostAnchor.row, ghostAnchor.col);
    else setStatus(`${PIECES[selectedPieceIndex].name}: flipped. (R rotate, F flip)`);
  }
});

// ── Board hover: ghost preview ──

function setupBoardHover() {
  boardEl.addEventListener('mouseover', (e) => {
    if (selectedPieceIndex === null || hintActive) return;
    const cell = e.target.closest('.cell');
    if (!cell) return;
    showGhost(parseInt(cell.dataset.row), parseInt(cell.dataset.col));
  });

  boardEl.addEventListener('mouseleave', () => {
    clearGhost();
    ghostAnchor = null; // cursor has left the board
  });
}

// ── Button: Hint (hold to show all valid placements) ──

btnHint.addEventListener('mousedown',  showHints);
btnHint.addEventListener('mouseup',    clearHints);
btnHint.addEventListener('mouseleave', clearHints);
btnHint.addEventListener('touchstart', (e) => { e.preventDefault(); showHints(); });
btnHint.addEventListener('touchend',   clearHints);

// ── Reset helper (shared by Reset button and Play Again) ──

function resetGame() {
  // Cancel any pending AI move before clearing state
  if (aiTimeout !== null) { clearTimeout(aiTimeout); aiTimeout = null; }

  document.getElementById('end-screen').classList.add('hidden');
  currentPlayerIndex = 0;
  turnNumber = 1;
  selectedPieceIndex = null;
  currentCells = null;
  ghostAnchor = null;
  initBoard(); // resets board, playerPieces, lastPlacedPieceIndex, stuckPlayers, gameOver
  renderBoard();
  renderPlayerCards();
  renderPalette();
  if (playerModes[0] === 'ai') {
    setStatus("Board reset. Blue (AI) is thinking...");
    aiTimeout = setTimeout(() => doAiTurn(0), 400);
  } else {
    setStatus("Board reset. Blue goes first.");
  }
}

// ── Button: Reset Board ──
btnReset.addEventListener('click', resetGame);

// ── Checkbox: Block opponents (AI rule) ──
document.getElementById('block-toggle').addEventListener('change', (e) => {
  blockOpponentsEnabled = e.target.checked;
});

// ── Button: Play Again (in end-screen overlay) ──
document.getElementById('btn-play-again').addEventListener('click', resetGame);

// ── Resize: update cell size without rebuilding the whole board ──

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(applyCellSize, 80);
});

// ── Start ──

function start() {
  initBoard();
  renderBoard();
  setupBoardHover();
  renderPlayerCards();
  renderPalette();
  setStatus("Blue's turn — pick a piece from the palette.");
}

start();
