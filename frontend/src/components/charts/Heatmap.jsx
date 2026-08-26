import { K } from "../common/theme.js";

function Heatmap({ corr, n }) {
  // corr is a flat array (row-major n×n), as returned by GET /api/regime.
  // Positive corr → accent blue, negative → loss red, diagonal
  // (self-correlation) rendered as inert border-colored fill.
  const sz = 270, cell = sz / n;
  const cells = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = corr[i * n + j];
      cells.push(
        <rect key={`${i}-${j}`} x={j * cell} y={i * cell} width={cell - 0.5} height={cell - 0.5} fill={i === j ? K.border : v > 0 ? `rgba(91,141,239,${(Math.abs(v) * 0.85).toFixed(2)})` : `rgba(229,72,77,${(Math.abs(v) * 0.85).toFixed(2)})`} />
      );
    }
  }
  return <svg width={sz} height={sz}>{cells}</svg>;
}

export { Heatmap };
