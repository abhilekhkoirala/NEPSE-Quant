function Sparkline({ data, width = 72, height = 22, color }) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data), max = Math.max(...data), range = (max - min) || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
  return (<svg width={width} height={height} style={{ display: "block" }}>
    <polyline points={pts} fill="none" stroke={color} strokeWidth={1.3} />
  </svg>);
}

export { Sparkline };
