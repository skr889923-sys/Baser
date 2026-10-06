'use client';

import React from 'react';
import MapEditor from '../../components/MapEditor';

export default function MapsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto flex flex-col">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold text-[#176d66]">بناء شبكة الملاحة</p>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">محرر الخريطة</h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-500">استكشف الحرم بالشوارع أو صور القمر الصناعي، وحدد النقاط والمسارات بمساعدة موقع جهازك أثناء المسح الميداني.</p>
        </div>
      </div>

      <div className="min-h-0">
        <MapEditor />
      </div>
    </div>
  );
}
