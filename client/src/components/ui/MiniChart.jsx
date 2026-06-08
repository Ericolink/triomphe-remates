import { useState } from 'react';

const W = 500;
const H = 160;
const PAD = { top: 12, right: 8, bottom: 28, left: 32 };
const CHART_W = W - PAD.left - PAD.right;
const CHART_H = H - PAD.top - PAD.bottom;

function ticks(max, count = 4) {
  if (max === 0) return [0];
  const step = Math.ceil(max / count);
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

function Tooltip({ x, y, label, value, color }) {
  const bw = 80, bh = 44, r = 7;
  const tx = Math.min(Math.max(x - bw / 2, 0), CHART_W - bw + PAD.left);
  const ty = y - bh - 8;
  return (
    <g>
      <rect x={tx} y={ty} width={bw} height={bh} rx={r} fill="white"
        filter="drop-shadow(0 2px 6px rgba(0,0,0,0.13))" stroke="#e5e7eb" strokeWidth={1} />
      <text x={tx + bw / 2} y={ty + 15} textAnchor="middle" fontSize={10} fill="#6b7280">{label}</text>
      <text x={tx + bw / 2} y={ty + 31} textAnchor="middle" fontSize={13} fontWeight="700" fill={color}>{value}</text>
    </g>
  );
}

export function BarChart({ data = [], color = '#1a3a5c' }) {
  const [hover, setHover] = useState(null);
  if (!data.length) return <EmptyChart />;

  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const ts = ticks(maxVal);
  const barW = Math.max(4, CHART_W / data.length * 0.55);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Grid + Y-axis */}
      {ts.map((t) => {
        const y = PAD.top + CHART_H - (t / (ts[ts.length - 1] || 1)) * CHART_H;
        return (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#f3f4f6" strokeWidth={1} />
            <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{t}</text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const x = PAD.left + (i / data.length) * CHART_W + (CHART_W / data.length - barW) / 2;
        const barH = (d.count / (ts[ts.length - 1] || 1)) * CHART_H;
        const y = PAD.top + CHART_H - barH;
        const isHovered = hover === i;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'default' }}>
            <rect x={x} y={y} width={barW} height={Math.max(barH, 2)} rx={3}
              fill={isHovered ? color : color + 'cc'} style={{ transition: 'fill 0.15s' }} />
            <text x={x + barW / 2} y={H - PAD.bottom + 11} textAnchor="middle" fontSize={9} fill="#9ca3af">{d.label}</text>
            {isHovered && <Tooltip x={x + barW / 2 + PAD.left} y={y + PAD.top} label={d.label} value={d.count} color={color} />}
          </g>
        );
      })}
    </svg>
  );
}

export function AreaChart({ data = [], color = '#7c3aed' }) {
  const [hover, setHover] = useState(null);
  if (!data.length) return <EmptyChart />;

  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const ts = ticks(maxVal);
  const maxT = ts[ts.length - 1] || 1;

  const xPos = (i) => PAD.left + (i / (data.length - 1 || 1)) * CHART_W;
  const yPos = (v) => PAD.top + CHART_H - (v / maxT) * CHART_H;

  const points = data.map((d, i) => `${xPos(i)},${yPos(d.count)}`).join(' ');
  const areaPath = data.length > 1
    ? `M${xPos(0)},${PAD.top + CHART_H} L${points} L${xPos(data.length - 1)},${PAD.top + CHART_H} Z`
    : '';
  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Grid + Y-axis */}
      {ts.map((t) => {
        const y = yPos(t);
        return (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#f3f4f6" strokeWidth={1} />
            <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{t}</text>
          </g>
        );
      })}

      {/* Area fill */}
      {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}

      {/* Line */}
      {data.length > 1 && (
        <polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      )}

      {/* Dots + X labels */}
      {data.map((d, i) => {
        const x = xPos(i), y = yPos(d.count);
        const isHovered = hover === i;
        // La primera y última etiqueta se alinean hacia adentro para no chocar
        // con el eje Y (el "0") ni desbordarse del borde derecho
        const isFirst = i === 0;
        const isLast = i === data.length - 1;
        const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
        const labelX = isFirst ? x + 6 : isLast ? x - 6 : x;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'default' }}>
            <circle cx={x} cy={y} r={isHovered ? 5 : 3.5} fill={color} stroke="white" strokeWidth={1.5} style={{ transition: 'r 0.15s' }} />
            <text x={labelX} y={H - PAD.bottom + 11} textAnchor={anchor} fontSize={9} fill="#9ca3af">{d.label}</text>
            {isHovered && <Tooltip x={x} y={y} label={d.label} value={d.count} color={color} />}
          </g>
        );
      })}
    </svg>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center text-gray-300 dark:text-gray-600 text-xs" style={{ height: H }}>
      Sin datos
    </div>
  );
}
