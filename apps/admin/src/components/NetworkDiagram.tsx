'use client';
import type { CampusNetwork, NetworkPath } from '@baser/navigation';

export default function NetworkDiagram({ network, path, selected, onSelect }: {
  network: CampusNetwork; path: NetworkPath | null; selected: string; onSelect: (id: string) => void;
}) {
  const coords = network.nodes.features.map(n => n.geometry.coordinates);
  const xs = coords.map(c => c[0]), ys = coords.map(c => c[1]);
  const minX = Math.min(...xs), maxY = Math.max(...ys);
  const cos = Math.cos(coords[0][1] * Math.PI / 180);
  const width = Math.max(...xs) - minX, height = maxY - Math.min(...ys);
  const scale = Math.min(660 / Math.max(width * cos, 0.00001), 430 / Math.max(height, 0.00001));
  const xy = (c: number[]) => [35 + (c[0] - minX) * cos * scale, 35 + (maxY - c[1]) * scale];
  const active = new Set(path?.legs.map(l => l.edge.properties.id));
  return <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4">
    <svg viewBox="0 0 730 500" role="img" aria-label="مخطط شبكة الممرات. اختر المقطع من القائمة أدناه لتحريره." className="w-full max-h-[520px]">
      {network.buildings.features.map(b => <polygon key={b.properties.id} points={b.geometry.coordinates[0].map(c=>xy(c).join(',')).join(' ')} fill="#18373d" stroke="#45616a" />)}
      {network.edges.features.map(e => {
        const p = e.properties;
        const color = p.status === 'closed' || p.status === 'maintenance' ? '#f87171' : active.has(p.id) ? '#facc15' : p.survey_status === 'verified' ? '#6ee7b7' : '#94a3b8';
        return <polyline key={p.id} points={e.geometry.coordinates.map(c=>xy(c).join(',')).join(' ')} fill="none" stroke={color}
          strokeWidth={selected===p.id ? 7 : active.has(p.id) ? 5 : 3} strokeDasharray={p.survey_status==='verified' ? undefined : '7 5'}
          onClick={()=>onSelect(p.id)} style={{cursor:'pointer'}}><title>{p.id} · {p.length_m} متر</title></polyline>;
      })}
      {network.nodes.features.map(n => {const [x,y]=xy(n.geometry.coordinates);return <g key={n.properties.id}>
        <circle cx={x} cy={y} r="5" fill="#e2e8f0" />
        <text x={x+8} y={y-8} fill="#e2e8f0" fontSize="10">{n.properties.id.replace(/^n_/, '')}</text>
      </g>;})}
    </svg>
    <p className="text-sm text-slate-300">أخضر: بيانات موسومة بالتحقق · رمادي متقطع: غير متحقق · أحمر: مغلق · أصفر: مسار المعاينة. المخطط لا يتضمن صور أقمار صناعية.</p>
  </div>;
}
