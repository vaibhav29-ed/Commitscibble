function Sun({ hour }: { hour: number }) {
  const height = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  const inner = 7.5;
  const outer = inner + 1.2 + height * 2.6;
  return (
    <>
      <circle cx="12" cy="12" r="4.25" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <line
            key={i}
            x1={Math.round(12 + Math.cos(a) * inner)}
            y1={Math.round(12 + Math.sin(a) * inner)}
            x2={Math.round(12 + Math.cos(a) * outer)}
            y2={Math.round(12 + Math.sin(a) * outer)}
          />
        );
      })}
    </>
  );
}

function Moon({ phase }: { phase: number }) {
  const r = 7;
  const rx = Math.round(Math.abs(Math.cos(phase * Math.PI * 2)) * r);
  const waxing = phase < 0.5;
  const crescent = phase < 0.25 || phase > 0.75;
  const outerSweep = waxing ? 1 : 0;
  const innerSweep = waxing === crescent ? 0 : 1;
  const d = `M12 ${12 - r}A${r} ${r} 0 0 ${outerSweep} 12 ${12 + r}A${rx} ${r} 0 0 ${innerSweep} 12 ${12 - r}Z`;
  return (
    <>
      <circle cx="12" cy="12" r={r} opacity={0.3} />
      <path d={d} fill="currentColor" stroke="none" />
    </>
  );
}

export { Sun, Moon };