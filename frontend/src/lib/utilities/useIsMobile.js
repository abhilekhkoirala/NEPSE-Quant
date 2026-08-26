import { useState, useEffect } from "react";

// Tracks the 767px mobile breakpoint (matches index.css) so components can
// pick sensible defaults (e.g. collapsed-by-default secondary panels)
// without duplicating the breakpoint value. Moved verbatim from
// src/App.jsx.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = e => setIsMobile(e.matches);
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange); };
  }, []);
  return isMobile;
}

export { useIsMobile };
