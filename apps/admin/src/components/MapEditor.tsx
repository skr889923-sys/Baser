"use client";

import dynamic from 'next/dynamic';

const MapEditorMap = dynamic(() => import('./MapEditorMap'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center w-full h-[600px] bg-gray-100 rounded-xl text-lg font-bold text-gray-500">جاري تحميل الخريطة...</div>
});

export default function MapEditor() {
  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden border border-gray-200 shadow-sm relative">
      <MapEditorMap />
    </div>
  );
}
