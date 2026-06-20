'use client';

import React, { useState } from 'react';

const INITIAL_USERS = [
  { id: 'usr1', name: 'م. هشام أحمد', email: 'h.ahmad@ksu.edu.sa', role: 'super_admin', last_active: 'نشط الآن' },
  { id: 'usr2', name: 'د. خالد سليمان', email: 'k.soliman@ksu.edu.sa', role: 'university_admin', last_active: 'منذ ساعة' },
  { id: 'usr3', name: 'أ. فهد منصور', email: 'f.mansour@ksu.edu.sa', role: 'building_manager', last_active: 'منذ يومين' },
  { id: 'usr4', name: 'سعد العتيبي', email: 's.otaibi@ksu.edu.sa', role: 'security_staff', last_active: 'منذ دقيقتين' }
];

export default function UsersPage() {
  const [users, setUsers] = useState(INITIAL_USERS);
  const [showAddForm, setShowAddForm] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('building_manager');

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    const newUser = {
      id: 'usr_' + Math.random().toString(36).substring(7),
      name,
      email,
      role,
      last_active: 'لم يسجل دخول بعد'
    };

    setUsers([newUser, ...users]);
    setShowAddForm(false);
    
    setName('');
    setEmail('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-800">إدارة المستخدمين والصلاحيات</h3>
          <p className="text-sm text-slate-500 mt-1">تنسيق وتفويض المهام والأدوار لمشرفي المباني وموظفي الاستجابة للأمن والسلامة.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-sky-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-sky-700 transition-colors shadow-sm text-sm"
        >
          {showAddForm ? 'إلغاء الإضافة ✕' : '➕ إضافة موظف جديد'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Users list (Col-span 2) */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="p-4">اسم الموظف / البريد الإلكتروني</th>
                  <th className="p-4">الصلاحية</th>
                  <th className="p-4">آخر نشاط</th>
                  <th className="p-4">التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{u.name}</div>
                      <div className="text-xs text-slate-400 font-semibold mt-1">{u.email}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        u.role === 'super_admin' ? 'bg-red-50 text-red-700 border border-red-200' :
                        u.role === 'university_admin' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                        u.role === 'security_staff' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {u.role === 'super_admin' ? 'مدير النظام' :
                         u.role === 'university_admin' ? 'إداري الجامعة' :
                         u.role === 'security_staff' ? 'حارس أمن' : 'مشرف مبنى'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 font-medium">
                      {u.last_active}
                    </td>
                    <td className="p-4">
                      <button className="text-red-600 hover:text-red-800 font-bold text-xs">سحب الصلاحية ✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add User Form Sidebar */}
        <div className={showAddForm ? 'block' : 'hidden xl:block'}>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h4 className="text-base font-bold text-slate-800 mb-6 pb-3 border-b border-slate-100">
              👥 إضافة مستخدم بصلاحية إدارية
            </h4>

            <form onSubmit={handleAddUser} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">الاسم الكامل</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 font-semibold"
                  placeholder="مثال: م. فهد المقرن"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">البريد الإلكتروني الجامعي</label>
                <input 
                  type="email" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 font-semibold"
                  placeholder="name@ksu.edu.sa"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Role select */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">الصلاحية الإدارية</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 font-semibold"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                >
                  <option value="super_admin">مدير النظام الرئيسي (Super Admin)</option>
                  <option value="university_admin">إداري الجامعة (University Admin)</option>
                  <option value="building_manager">مشرف مباني الكليات (Building Manager)</option>
                  <option value="security_staff">موظف أمن واستجابة طوارئ (Security)</option>
                </select>
              </div>

              <button 
                type="submit" 
                className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm text-sm"
              >
                💾 حفظ الموظف ومنح الصلاحية
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
