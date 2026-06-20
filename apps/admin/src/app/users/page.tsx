'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('building_manager');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error && data) {
      setUsers(data);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    // Notice: Due to security rules, actual user creation should ideally happen via Supabase Auth signup.
    // For demo purposes, we will just insert into profiles here assuming Auth user was created.
    const newUser = {
      id: crypto.randomUUID(), // Fallback UUID if no auth user
      full_name: name,
      email,
      role,
      phone: '' // Added phone to match schema if needed
    };

    const { error } = await supabase.from('profiles').insert([newUser]);
    if (!error) {
      fetchUsers();
      setShowAddForm(false);
      setName('');
      setEmail('');
    } else {
      console.error(error);
      alert('حدث خطأ أثناء الإضافة: ' + error.message);
    }
  };

  const getRoleLabel = (userRole: string) => (
    userRole === 'super_admin' ? 'مدير النظام' :
    userRole === 'university_admin' ? 'إداري الجامعة' :
    userRole === 'security_staff' ? 'حارس أمن' : 'مشرف مبنى'
  );

  const getRoleClass = (userRole: string) => (
    userRole === 'super_admin' ? 'bg-red-50 text-red-700 border border-red-200' :
    userRole === 'university_admin' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
    userRole === 'security_staff' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
    'bg-slate-100 text-slate-700'
  );

  const deleteUser = async (id: string) => {
    await supabase.from('profiles').delete().eq('id', id);
    fetchUsers();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-800">إدارة المستخدمين والصلاحيات</h3>
          <p className="text-sm text-slate-500 mt-1">تنسيق وتفويض المهام والأدوار لمشرفي المباني وموظفي الاستجابة للأمن والسلامة.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-full sm:w-auto bg-sky-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-sky-700 transition-colors shadow-sm text-sm"
        >
          {showAddForm ? 'إلغاء الإضافة' : 'إضافة موظف جديد'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Users list (Col-span 2) */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="md:hidden divide-y divide-slate-100">
              {users.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  لا يوجد مستخدمين. يرجى إضافة مستخدمين أو التأكد من إضافتهم لجدول profiles في Supabase.
                </div>
              ) : users.map((u: any) => (
                <div key={u.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate">{u.full_name || u.name || 'بدون اسم'}</div>
                      <div className="text-xs text-slate-400 font-semibold mt-1 truncate">{u.email}</div>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${getRoleClass(u.role)}`}>
                      {getRoleLabel(u.role)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs font-bold text-slate-500 mb-1">آخر نشاط</div>
                      <div className="font-semibold text-slate-700 truncate">{u.last_active || 'نشط'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteUser(u.id)}
                      className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 hover:bg-red-100"
                    >
                      سحب الصلاحية
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
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
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">لا يوجد مستخدمين. يرجى إضافة مستخدمين أو التأكد من إضافتهم لجدول profiles في Supabase.</td>
                  </tr>
                ) : users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{u.full_name || u.name || 'بدون اسم'}</div>
                      <div className="text-xs text-slate-400 font-semibold mt-1">{u.email}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getRoleClass(u.role)}`}>
                        {getRoleLabel(u.role)}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 font-medium">
                      {u.last_active || 'نشط'}
                    </td>
                    <td className="p-4">
                      <button 
                        onClick={() => deleteUser(u.id)}
                        className="text-red-600 hover:text-red-800 font-bold text-xs"
                      >
                        سحب الصلاحية
                      </button>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Add User Form Sidebar */}
        <div className={showAddForm ? 'block' : 'hidden xl:block'}>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h4 className="text-base font-bold text-slate-800 mb-6 pb-3 border-b border-slate-100">
              إضافة مستخدم بصلاحية إدارية
            </h4>

            <form onSubmit={handleAddUser} className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 block">الاسم الكامل</label>
                <input 
                  type="text" 
                  placeholder="مثال: أ.رغد" 
                  className="w-full border-slate-200 rounded-xl p-4 text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#00A651]/20 focus:border-[#00A651] transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                حفظ الموظف ومنح الصلاحية
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
