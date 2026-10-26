import { useState } from 'react';
import { formatMoney, monthLabel } from '../lib/format';
import type { Currency } from '../lib/types';

// Palette catégorielle validée (contraste, daltonisme) sur la surface sombre de l'application
const SERIES = [
  { key: 'invoiced', label: 'Facturé', color: '#3987e5' },
  { key: 'collected', label: 'Encaissé', color: '#d95926' },
  { key: 'expenses', label: 'Dépenses', color: '#199e70' },
] as const;

type Row = { month: string; invoiced: number; collected: number; expenses: number | null };

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v) as number;
};

export default function MonthlyChart({ data, currency }: { data: Row[]; currency: Currency }) {
  const [hover, setHover] = useState<number | null>(null);
  const series = SERIES.filter((s) => s.key !== 'expenses' || data.some((d) => d.expenses !== null));
  const max = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0))));

  const W = 720;
  const H = 240;
  const pad = { top: 12, right: 8, bottom: 28, left: 64 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const band = plotW / data.length;
  const barW = Math.max(3, Math.min(14, (band * 0.7 - 2 * (series.length - 1)) / series.length));
  const groupW = series.length * barW + (series.length - 1) * 2;
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  const bar = (x: number, v: number) => {
    const h = Math.max(0, (v / max) * plotH);
    if (h <= 0) return '';
    const r = Math.min(4, h, barW / 2);
    const top = pad.top + plotH - h;
    const bottom = pad.top + plotH;
    // Coins arrondis uniquement en haut, ancrés sur la ligne de base
    return `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + barW - r}Q${x + barW},${top} ${x + barW},${top + r}V${bottom}Z`;
  };

  const active = hover !== null ? data[hover] : null;

  return (
    <div className="chart">
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>
        ))}
      </div>
      <div className="chart-wrap" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Évolution mensuelle">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className="chart-grid" />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="chart-axis">
                {t >= 1000 ? `${(t / 1000).toLocaleString('fr-FR')} k` : t.toLocaleString('fr-FR')}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const gx = pad.left + i * band + (band - groupW) / 2;
            return (
              <g key={d.month}>
                {hover === i && <rect x={pad.left + i * band} y={pad.top} width={band} height={plotH} className="chart-hover" />}
                {series.map((s, si) => (
                  <path key={s.key} d={bar(gx + si * (barW + 2), Number(d[s.key]) || 0)} fill={s.color} />
                ))}
                <text x={pad.left + i * band + band / 2} y={H - 8} textAnchor="middle" className="chart-axis">{monthLabel(d.month)}</text>
                {/* Zone de survol plus large que les barres */}
                <rect x={pad.left + i * band} y={pad.top} width={band} height={plotH + pad.bottom} fill="transparent"
                  onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
        {active && hover !== null && (
          <div className="chart-tooltip" style={{
            left: `${((pad.left + (hover + 0.5) * band) / W) * 100}%`,
            // Garde l'infobulle dans le cadre près des bords
            transform: `translateX(${hover > data.length * 0.7 ? '-100%' : hover < data.length * 0.3 ? '0' : '-50%'})`,
          }}>
            <strong>{monthLabel(active.month)}</strong>
            {series.map((s) => (
              <div key={s.key}><i style={{ background: s.color }} />{s.label} <b>{formatMoney(Number(active[s.key]) || 0, currency)}</b></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
