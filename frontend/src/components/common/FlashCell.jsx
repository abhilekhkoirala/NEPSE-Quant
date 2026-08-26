import { useState, useEffect, useRef } from "react";

// Flashes gain/loss color on value change, fades back to base — used for
// live watchlist ticks. There's no streaming price feed in this app (it's
// a backtest/research tool), so "update" here means a new backtest run
// produced a different price for this ticker; the mechanism is the same
// either way. Moved verbatim from src/App.jsx.
function FlashCell({ value, format, style }) {
  const prevRef = useRef(value);
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    const prev = prevRef.current;
    if (prev != null && value != null && prev !== value) {
      setFlash(value > prev ? "gain" : "loss");
      const t = setTimeout(() => setFlash(null), 700);
      prevRef.current = value;
      return () => clearTimeout(t);
    }
    prevRef.current = value;
  }, [value]);
  return <span className={flash ? `tick-flash-${flash}` : undefined} style={style}>{format ? format(value) : value}</span>;
}

export { FlashCell };
