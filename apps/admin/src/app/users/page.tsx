'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '@baser/types';
import { supabase } from '@/lib/supabase';
import AdminRecordActions from '@/components/AdminRecordActions';
import { useAdminRole } from '@/components/AdminRoleContext';
import { administrationError, roleOptions } from '@/lib/administration';

export default function UsersPage() {
  const { role: actorRole, userId } = useAdminRole();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', role: 'building_manager' });
  const lock = useRef(false);
  const roles = actorRole==='super_admin'?roleOptions:roleOptions.filter(([role])=>!['super_admin','university_admin'].includes(role));
  const load = async () => {
    setLoading(true);setError('');
    try {
      const {data,error}=await supabase.from('profiles').select('*').order('created_at',{ascending:false});
      if(error)throw error;setUsers(data||[]);
    }catch(cause){setError(administrationError(cause));}finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);
  const add = async (event:React.FormEvent) => {
    event.preventDefault();if(lock.current)return;
    lock.current=true;setSaving(true);setError('');setMessage('');
    try {
      const {data,error}=await supabase.rpc('admin_attach_user_profile',{user_email:draft.email.trim(),user_name:draft.name.trim(),user_role:draft.role});
      if(error)throw error;if(!data?.id)throw new Error('لم تُؤكّد إضافة الصلاحية.');
      setUsers(current=>[data,...current]);setShowForm(false);setDraft({name:'',email:'',role:'building_manager'});setMessage('تمت إضافة ملف الحساب وصلاحياته.');
    }catch(cause){setError(administrationError(cause));}finally{lock.current=false;setSaving(false);}
  };
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl font-bold">إدارة المستخدمين والصلاحيات</h2><p className="mt-2 text-sm text-slate-600">تعديل بيانات الحسابات وأدوارها أو حذف حساب من النظام.</p></div>
      <div className="flex gap-3"><button className="secondary-action" disabled={saving||loading} onClick={load}>تحديث المستخدمين</button><button className="primary-action" disabled={saving||loading} onClick={()=>setShowForm(value=>!value)}>إضافة صلاحية لحساب مسجل</button></div></div>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {message&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{message}</p>}
    {showForm&&<form onSubmit={add} className="surface-panel"><fieldset disabled={saving} className="space-y-4">
      <p className="text-sm text-slate-600">يجب وجود حساب دخول بالبريد نفسه. لا تُنشئ هذه العملية حسابًا أو ترسل دعوة.</p>
      <label className="block">الاسم<input required className="mt-1 w-full rounded-lg border p-3" value={draft.name} onChange={event=>setDraft(current=>({...current,name:event.target.value}))}/></label>
      <label className="block">البريد المسجل<input required type="email" dir="ltr" className="mt-1 w-full rounded-lg border p-3" value={draft.email} onChange={event=>setDraft(current=>({...current,email:event.target.value}))}/></label>
      <label className="block">الصلاحية<select className="mt-1 w-full rounded-lg border p-3" value={draft.role} onChange={event=>setDraft(current=>({...current,role:event.target.value}))}>{roles.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <div className="flex gap-3"><button className="primary-action" type="submit">{saving?'جارٍ الحفظ…':'حفظ الصلاحية'}</button><button className="secondary-action" type="button" onClick={()=>setShowForm(false)}>إلغاء</button></div>
    </fieldset></form>}
    {loading?<p role="status">جارٍ تحميل الحسابات…</p>:users.length===0?<p className="surface-panel">لا توجد حسابات ظاهرة.</p>:<div className="grid gap-4 md:grid-cols-2">{users.map(user=><article key={user.id} className="surface-panel space-y-4">
      <h3 className="font-bold">{user.full_name}</h3><p className="break-all text-sm" dir="ltr">{user.email}</p><p className="text-sm text-slate-600">{roleOptions.find(([role])=>role===user.role)?.[1]}</p>
      <AdminRecordActions table="profiles" record={user} label={user.full_name||user.email} disabled={saving}
        fields={[{key:'full_name',label:'الاسم',required:true},{key:'phone',label:'الهاتف'},{key:'language',label:'اللغة',type:'select',required:true,options:[['ar','العربية'],['en','الإنجليزية']]},{key:'role',label:'الصلاحية',type:'select',required:true,options:userId===user.id?roleOptions.filter(([role])=>role===user.role):roles}]}
        deleteNotice="سيُحذف حساب الدخول وملفه نهائيًا. تبقى البلاغات والطلبات السابقة مع إزالة ارتباطها بالحساب."
        onSaved={row=>setUsers(current=>current.map(value=>value.id===row.id?row as unknown as UserProfile:value))}
        onDeleted={id=>setUsers(current=>current.filter(value=>value.id!==id))}/>
    </article>)}</div>}
  </div>;
}
