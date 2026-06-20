'use client';

import React from 'react';
import MapEditor from '../../components/MapEditor';

export default function MapsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto flex flex-col">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-2">محرر الخرائط (Map Editor)</h1>
          <p className="text-slate-500 font-medium">قم بإضافة النقاط الملاحية على الخريطة مباشرة وحفظها لقاعدة البيانات.</p>
        </div>
      </div>

      <div className="min-h-0">
        <MapEditor />
      </div>
    </div>
  );
}
