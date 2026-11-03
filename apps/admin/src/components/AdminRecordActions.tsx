'use client';
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { isAdministrator, manageRecord, administrationError, type ManagedTable, type ManagedRecord, type RecordField } from '@/lib/administration';
import { useAdminRole } from './AdminRoleContext';
import { useAdminDialogFocus } from './useAdminDialogFocus';

type Props = { table: ManagedTable; record: object & { id: string }; label: string; fields?: RecordField[]; deleteNotice: string;
  disabled?: boolean; onSaved?: (row: ManagedRecord) => void | Promise<void>; onDeleted: (id: string) => void | Promise<void> };
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900';

export default function AdminRecordActions({ table, record, label, fields = [], deleteNotice, disabled, onSaved, onDeleted }: Props) {
  const { role, userId } = useAdminRole();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState(record as ManagedRecord);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const dialogRef = useAdminDialogFocus(editing && isAdministrator(role), () => setEditing(false), saving);
  if (!isAdministrator(role)) return null;
  const row = record as ManagedRecord;
  if (table === 'profiles' && role === 'university_admin' && userId !== row.id && ['super_admin','university_admin'].includes(String(row.role))) {
    return <p className="text-sm text-slate-600">إدارة هذا الحساب متاحة لمدير النظام.</p>;
  }
  const open = () => {
    setOriginal(row);
    setDraft(Object.fromEntries(fields.map(field => [field.key, row[field.key] == null ? '' : String(row[field.key])])));
    setError(''); setMessage(''); setEditing(true);
  };
  const perform = async (patch: Record<string, unknown> | null) => {
    if (lock.current) return;
    lock.current = true; setSaving(true); setError(''); setMessage('');
    try {
      const saved = await manageRecord(supabase, table, patch ? original : row, fields, patch);
      if (patch) { setEditing(false); await onSaved?.(saved); setMessage('تم حفظ التعديلات.'); }
      else { await onDeleted(saved.id); }
    } catch (cause) { setError(administrationError(cause)); }
    finally { lock.current = false; setSaving(false); }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const patch: Record<string, unknown> = {};
    for (const field of fields) {
      const value = (draft[field.key] || '').trim();
      if (field.required && !value) { setError(`أدخل ${field.label}.`); return; }
      if (field.type === 'number' && value && !Number.isFinite(Number(value))) { setError('القيمة الرقمية غير صالحة.'); return; }
      patch[field.key] = field.type === 'number' ? value ? Number(value) : null : value;
    }
    void perform(patch);
  };
  return <div onClick={event => event.stopPropagation()} className="flex flex-wrap items-center gap-2 text-sm">
    {fields.length > 0 && <button type="button" disabled={disabled || saving} onClick={open} aria-label={`تعديل ${label}`} className="min-h-11 rounded-lg border border-sky-200 px-3 py-2 font-semibold text-sky-800 disabled:opacity-50">تعديل</button>}
    <button type="button" disabled={disabled || saving || (table === 'profiles' && userId === row.id)} aria-label={`حذف ${label}`} className="min-h-11 rounded-lg border border-red-200 px-3 py-2 font-semibold text-red-700 disabled:opacity-50"
      onClick={() => { if (window.confirm(`حذف «${label}» نهائيًا؟ ${deleteNotice} لا يمكن التراجع عن الحذف.`)) void perform(null); }}>حذف</button>
    {!editing && error && <p role="alert" className="w-full rounded-lg bg-red-50 p-2 text-red-800">{error}</p>}
    {message && <p role="status" className="w-full text-emerald-800">{message}</p>}
    {editing && createPortal(<div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/50 p-4" dir="rtl">
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={`تعديل ${label}`} className="max-h-[90dvh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-5 text-xl font-bold">تعديل {label}</h2>
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
        <form onSubmit={submit}><fieldset disabled={saving} className="space-y-4">
          {fields.map(field => <label key={field.key} className="block text-sm font-semibold">{field.label}{field.required ? ' *' : ''}
            {field.type === 'select' ? <select className={inputClass} value={draft[field.key]} required={field.required} onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))}>{!field.required && <option value="">غير محدد</option>}{field.options?.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select>
              : field.type === 'textarea' ? <textarea rows={3} className={inputClass} value={draft[field.key]} required={field.required} onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))}/>
                : <input autoFocus={field === fields[0]} type={field.type === 'number' ? 'number' : 'text'} step="any" className={inputClass} value={draft[field.key]} required={field.required} onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))}/>}
          </label>)}
          <div className="flex gap-3 border-t pt-4"><button type="submit" className="primary-action">{saving ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}</button><button type="button" className="secondary-action" onClick={() => setEditing(false)}>إلغاء</button></div>
        </fieldset></form>
      </section>
    </div>, document.body)}
  </div>;
}
