'use client';

import React, { useState } from 'react';

// Seed data reference list
const INITIAL_ROUTES = [
  {
    id: 'r1111111-1111-1111-1111-111111111111',
    name_ar: 'من بوابة الحرم إلى كلية الحاسب',
    name_en: 'From Main Gate to Computer Science',
    type: 'safe_accessible',
    distance: 90,
    duration: 2.5,
    steps_count: 3,
    status: 'active'
  },
  {
    id: 'r2222222-2222-2222-2222-222222222222',
    name_ar: 'من مدخل كلية الحاسب إلى القاعة 101',
    name_en: 'From CS Entrance to Classroom 101',
    type: 'blind_friendly',
    distance: 20,
    duration: 0.5,
    steps_count: 2,
    status: 'active'
  },
  {
    id: 'r3333333-3333-3333-3333-333333333333',
    name_ar: 'من مدخل كلية الحاسب إلى المصعد',
    name_en: 'From CS Entrance to Elevator',
    type: 'safe_accessible',
    distance: 30,
    duration: 0.8,
    steps_count: 2,
    status: 'active'
  },
  {
    id: 'r4444444-4444-4444-4444-444444444444',
    name_ar: 'من البهو إلى دورة المياه المهيأة',
    name_en: 'From Lobby to Accessible Restroom',
    type: 'wheelchair',
    distance: 12,
    duration: 0.3,
    steps_count: 1,
    status: 'active'
  }
];

const ROUTE_STEPS_DETAILS: Record<string, any[]> = {
  'r1111111-1111-1111-1111-111111111111': [
    { order: 1, text: 'تحرك للأمام مباشرة مسافة 50 مترًا لتصل إلى التقاطع الرئيسي للحرم.', direction: 'straight', haptic: 'continue' },
    { order: 2, text: 'عند التقاطع، انعطف يسارًا وسر مسافة 30 مترًا، ستجد منحدر الكلية على يسارك.', direction: 'left', haptic: 'turn_left' },
    { order: 3, text: 'انتبه لوجود منحدر. اصعد المنحدر للأمام مسافة 10 أمتار لتصل إلى باب الكلية التلقائي.', direction: 'straight', haptic: 'warning' }
  ],
  'r2222222-2222-2222-2222-222222222222': [
    { order: 1, text: 'اعبر الباب الرئيسي للأمام مباشرة مسافة 5 أمتار لتصل إلى بهو الكلية الرئيسي.', direction: 'straight', haptic: 'continue' },
    { order: 2, text: 'انعطف يمينًا من البهو، وامشِ للأمام مسافة 15 مترًا. ستجد باب القاعة 101 على يسارك.', direction: 'right', haptic: 'turn_right' }
  ],
  'r3333333-3333-3333-3333-333333333333': [
    { order: 1, text: 'اعبر الباب الرئيسي للأمام مسافة 5 أمتار لتصل إلى البهو الرئيسي.', direction: 'straight', haptic: 'continue' },
    { order: 2, text: 'انعطف يسارًا من البهو، وسر للأمام مسافة 25 مترًا في الممر. المصعد أمامك في نهاية الممر.', direction: 'left', haptic: 'turn_left' }
  ],
  'r4444444-4444-4444-4444-444444444444': [
    { order: 1, text: 'انعطف يمينًا من البهو، وامشِ مسافة 12 مترًا. ستجد دورة المياه المهيأة على يمينك.', direction: 'right', haptic: 'turn_right' }
  ]
};

export default function RoutesPage() {
  const [routes, setRoutes] = useState(INITIAL_ROUTES);
  const [selectedRouteId, setSelectedRouteId] = useState('r1111111-1111-1111-1111-111111111111');
  const [showAddForm, setShowAddForm] = useState(false);

  // Add Route form state
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [type, setType] = useState('safe_accessible');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');

  const handleAddRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr || !nameEn || !distance) return;

    const newRoute = {
      id: 'r' + Math.random().toString(36).substring(7),
      name_ar: nameAr,
      name_en: nameEn,
      type,
      distance: parseFloat(distance),
      duration: parseFloat(duration) || 1.0,
      steps_count: 0,
      status: 'active'
    };

    setRoutes([newRoute, ...routes]);
    setShowAddForm(false);

    setNameAr('');
    setNameEn('');
    setDistance('');
    setDuration('');
  };

  const selectedRouteSteps = ROUTE_STEPS_DETAILS[selectedRouteId] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-800">إدارة المسارات الملاحية</h3>
          <p className="text-sm text-slate-500 mt-1">توليد المسارات التي تربط نقاط الخريطة خطوة بخطوة وتنسيق أنماط الحركة الصامتة والاهتزازات.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-sky-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-sky-700 transition-colors shadow-sm text-sm"
        >
          {showAddForm ? 'إلغاء الإضافة ✕' : '➕ إضافة مسار جديد'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Routes List Table (Col-span 2) */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="p-4">اسم المسار</th>
                  <th className="p-4">نوع المسار</th>
                  <th className="p-4">المسافة / الزمن</th>
                  <th className="p-4">الخطوات</th>
                  <th className="p-4">التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {routes.map(r => (
                  <tr 
                    key={r.id} 
                    onClick={() => setSelectedRouteId(r.id)}
                    className={`cursor-pointer hover:bg-slate-50/50 transition-colors ${selectedRouteId === r.id ? 'bg-sky-50/50 font-semibold border-r-4 border-sky-600' : ''}`}
                  >
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{r.name_ar}</div>
                      <div className="text-xs text-slate-400 font-semibold mt-1">{r.name_en}</div>
                    </td>
                    <td className="p-4">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-bold font-mono uppercase">
                        {r.type}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">
                      <div>{r.distance} م</div>
                      <div className="text-xs text-slate-400 mt-1">{r.duration} دقيقة</div>
                    </td>
                    <td className="p-4">
                      <span className="bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold px-2 py-0.5 rounded-full">
                        {r.steps_count} خطوات
                      </span>
                    </td>
                    <td className="p-4">
                      <button className="text-sky-600 hover:text-sky-800 font-bold text-xs">تعديل ⚙️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Steps Display Panel for selected route */}
          {selectedRouteId && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h4 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span>📋</span> الخطوات التفصيلية للمسار المختار
              </h4>
              
              {selectedRouteSteps.length > 0 ? (
                <div className="space-y-4">
                  {selectedRouteSteps.map((step, idx) => (
                    <div key={idx} className="flex gap-4 items-start p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                      <span className="w-8 h-8 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center shrink-0">
                        {step.order}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800 leading-6">{step.text}</p>
                        <div className="flex gap-4 mt-2">
                          <span className="text-xs text-slate-500 font-semibold">🔄 الاتجاه: <span className="text-slate-700 font-mono font-bold capitalize">{step.direction}</span></span>
                          <span className="text-xs text-slate-500 font-semibold">📳 الاهتزاز: <span className="text-slate-700 font-mono font-bold capitalize">{step.haptic}</span></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                  لا توجد خطوات مسجلة لهذا المسار حاليًا. اضغط تعديل لإضافة خطوات.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add Route Form Sidebar */}
        <div className={showAddForm ? 'block' : 'hidden xl:block'}>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h4 className="text-base font-bold text-slate-800 mb-6 pb-3 border-b border-slate-100">
              🛠️ إضافة مسار ملاحي جديد
            </h4>

            <form onSubmit={handleAddRoute} className="space-y-4">
              {/* Name Ar */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">الاسم بالعربية</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 font-semibold"
                  placeholder="مثال: من مدخل الكلية إلى قاعة 101"
                  value={nameAr}
                  onChange={e => setNameAr(e.target.value)}
                  required
                />
              </div>

              {/* Name En */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">الاسم بالإنجليزية</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 font-semibold"
                  placeholder="Example: CS entrance to Hall 101"
                  value={nameEn}
                  onChange={e => setNameEn(e.target.value)}
                  required
                />
              </div>

              {/* Route Preference Type */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">نوع المسار وتفضيلاته</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 font-semibold"
                  value={type}
                  onChange={e => setType(e.target.value)}
                >
                  <option value="safe_accessible">مسار آمن ومهيأ بالكامل ♿</option>
                  <option value="blind_friendly">مسار تكتيلي مهيأ للمكفوفين 🕶️</option>
                  <option value="fastest">أسرع مسار (سلالم معتدلة)</option>
                  <option value="wheelchair">مسار مخصص للكراسي المتحركة فقط</option>
                </select>
              </div>

              {/* Parameters */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">المسافة الكلية (متر)</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 text-center font-bold"
                    placeholder="25"
                    value={distance}
                    onChange={e => setDistance(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">الزمن المتوقع (دقيقة)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 text-center font-bold"
                    placeholder="0.8"
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm text-sm"
              >
                💾 حفظ المسار الملاحي
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
