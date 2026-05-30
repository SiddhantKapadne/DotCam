/**
 * Grid layout for bullseye rendering.
 */
export const GRID_COLS = 21;
export const GRID_ROWS = 35;

export function buildGridLayout(width, height, cols = GRID_COLS, rows = GRID_ROWS) {
  const cellW = width / cols;
  const cellH = height / rows;
  const cells = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        cx: c * cellW + cellW / 2,
        cy: r * cellH + cellH / 2,
        cellW,
        cellH,
        sampleX: Math.floor(c * cellW),
        sampleY: Math.floor(r * cellH),
        sampleW: Math.max(1, Math.ceil(cellW)),
        sampleH: Math.max(1, Math.ceil(cellH)),
        seed: r * cols + c,
      });
    }
  }

  return { cols, rows, cells, width, height };
}
