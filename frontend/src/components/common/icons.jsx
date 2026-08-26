// Minimal 16px stroke icons for sidebar navigation. Hand-drawn rather
// than pulled from an icon library — keeps the bundle small and every
// glyph at a consistent weight/scale. currentColor throughout, so
// active/hover states are handled entirely by the parent's text color.
const common = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };

function OverviewIcon() {
  return (<svg {...common}><rect x="1.5" y="1.5" width="6" height="6" rx="1" /><rect x="8.5" y="1.5" width="6" height="4" rx="1" /><rect x="8.5" y="7.5" width="6" height="7" rx="1" /><rect x="1.5" y="9.5" width="6" height="5" rx="1" /></svg>);
}
function SignalsIcon() {
  return (<svg {...common}><path d="M1.5 9.5l3-4 2.5 3 3-6 4.5 6.5" /></svg>);
}
function RegimeIcon() {
  return (<svg {...common}><circle cx="4.5" cy="5" r="1.6" /><circle cx="11.5" cy="4.5" r="1.6" /><circle cx="8" cy="10.5" r="1.6" /><circle cx="13" cy="12" r="1.3" /><path d="M5.8 5.9L7 9.3M10.2 5.4L8.9 9.2M12.6 5.9l0.2 4.7" /></svg>);
}
function IPOIcon() {
  return (<svg {...common}><path d="M2 13.5h12" /><path d="M4 13.5V8.5M8 13.5V5M12 13.5v-6" /><path d="M9.5 2.5H13v3.5" /><path d="M13 2.5L8 7.5" /></svg>);
}
function PortfolioIcon() {
  return (<svg {...common}><rect x="1.5" y="4" width="13" height="9.5" rx="1.2" /><path d="M1.5 6.5h13" /><path d="M5 4V2.8c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3V4" /></svg>);
}
function OptimalIcon() {
  return (<svg {...common}><path d="M8 1.5l1.8 3.7 4 .6-3 2.9.7 4-3.5-1.9-3.5 1.9.7-4-3-2.9 4-.6z" /></svg>);
}
function CashIcon() {
  return (<svg {...common}><rect x="1.5" y="3.5" width="13" height="9" rx="1.3" /><circle cx="8" cy="8" r="2.1" /><path d="M4 6v0M12 10v0" /></svg>);
}
function BridgeIcon() {
  return (<svg {...common}><path d="M1.5 11.5c1-3 2.8-4.5 4-4.5s1.6 1.3 2.5 1.3S9.5 7 10.5 7s3 1.5 4 4.5" /><path d="M1.5 13.5h13" /><path d="M4 11.5V9M12 11.5V9" /></svg>);
}
function AIIcon() {
  return (<svg {...common}><rect x="3" y="4.5" width="10" height="7.5" rx="1.5" /><path d="M8 4.5V2.3" /><circle cx="8" cy="1.7" r="0.7" fill="currentColor" stroke="none" /><circle cx="5.8" cy="8" r="0.9" fill="currentColor" stroke="none" /><circle cx="10.2" cy="8" r="0.9" fill="currentColor" stroke="none" /><path d="M6 12v1.2M10 12v1.2" /></svg>);
}

export { OverviewIcon, SignalsIcon, RegimeIcon, IPOIcon, PortfolioIcon, OptimalIcon, CashIcon, BridgeIcon, AIIcon };
