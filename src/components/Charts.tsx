// Charts SVG livianos (sin librería) — donut, bar y line.
// Usan la paleta NarvoQ: ball (#D8F646) como color principal,
// tonos verdes complementarios y grafito para negativo.

const COLORS = ['#D8F646', '#A8C22E', '#5F7414', '#F4FF9E', '#6B7486', '#2A2E36'];

export function DonutChart({
  segments, size = 200, thickness = 30, centerLabel, centerSub
}: {
  segments: { label: string; value: number; color?: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size / 2) - thickness / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const paths = segments.map((s, i) => {
    const frac = total > 0 ? s.value / total : 0;
    const dash = frac * circ;
    const gap = circ - dash;
    const el = (
      <circle key={i} cx={cx} cy={cy} r={r} fill="none"
        stroke={s.color ?? COLORS[i % COLORS.length]}
        strokeWidth={thickness}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${cx} ${cy})`} />
    );
    offset += dash;
    return el;
  });

  return (
    <div className="relative inline-block">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1f28" strokeWidth={thickness} />
        {paths}
      </svg>
      {(centerLabel || centerSub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerLabel && <p className="font-display font-black text-3xl text-ball leading-none">{centerLabel}</p>}
          {centerSub && <p className="text-white/60 text-xs font-bold mt-1">{centerSub}</p>}
        </div>
      )}
    </div>
  );
}

export function ChartLegend({ segments }: { segments: { label: string; value: number; color?: string }[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <ul className="space-y-1.5">
      {segments.map((s, i) => (
        <li key={i} className="flex items-center gap-2 text-sm">
          <span className="w-3 h-3 rounded-sm shrink-0"
            style={{ background: s.color ?? COLORS[i % COLORS.length] }} />
          <span className="flex-1 text-white/80">{s.label}</span>
          <span className="text-white/60 font-bold">{s.value}</span>
          <span className="text-white/40 text-xs w-10 text-right">
            {total > 0 ? Math.round(s.value / total * 100) : 0}%
          </span>
        </li>
      ))}
    </ul>
  );
}

export function BarChart({
  bars, max, height = 160, showValues = true
}: {
  bars: { label: string; value: number; color?: string }[];
  max?: number;
  height?: number;
  showValues?: boolean;
}) {
  const M = max ?? Math.max(1, ...bars.map(b => b.value));
  return (
    <div className="w-full">
      <div className="flex items-end gap-2" style={{ height }}>
        {bars.map((b, i) => {
          const h = M > 0 ? (b.value / M) * (height - 30) : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
              {showValues && (
                <span className="text-white/70 text-[10px] font-black">{b.value}</span>
              )}
              <div className="w-full rounded-t-md relative overflow-hidden"
                style={{
                  height: `${h}px`,
                  background: b.color ?? COLORS[i % COLORS.length],
                  minHeight: b.value > 0 ? 4 : 0
                }}>
                {b.color === undefined && (
                  <div className="absolute inset-0 opacity-25"
                    style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.4) 0%, transparent 100%)' }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-2">
        {bars.map((b, i) => (
          <span key={i} className="flex-1 text-center text-white/50 text-[10px] font-bold uppercase truncate">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function LineChart({
  points, height = 120, color = '#D8F646'
}: {
  points: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map(p => p.value));
  const width = 320;
  const pad = 10;
  const stepX = (width - pad * 2) / Math.max(1, points.length - 1);
  const y = (v: number) => pad + (1 - v / max) * (height - pad * 2);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * stepX},${y(p.value)}`).join(' ');
  const area = `${d} L ${pad + (points.length - 1) * stepX},${height - pad} L ${pad},${height - pad} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lineGrad)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={pad + i * stepX} cy={y(p.value)} r="3" fill={color} />
      ))}
    </svg>
  );
}
