"use client";

import dynamic from 'next/dynamic';

const MapEditorMap = dynamic(() => import('./MapEditorMap'), {
  ssr: false,
  loading: () => <div role="status" className="flex min-h-[520px] w-full items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-500 md:h-[760px]">جارٍ تجهيز أدوات الخريطة…</div>
});

export default function MapEditor() {
  return (
    <div className="relative min-h-[520px] w-full overflow-visible rounded-2xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(25,58,67,0.06)] md:h-[760px] md:overflow-hidden">
      <MapEditorMap />
    </div>
  );
}
