import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { RequestReceipt } from '@baser/types';
import * as Location from 'expo-location';
import { useNavigationStore } from '../src/store/useNavigationStore';
import RequestService from '../src/services/RequestService';
import { requestErrorMessage } from '../src/services/request-client';
import { requestCoordinates } from '../src/services/request-location';
import VoiceService from '../src/services/VoiceService';
import HapticsService from '../src/services/HapticsService';
import { getInterfaceTheme, HeroPanel, PrimaryButton, ScreenShell, StatusPill, surfaceStyle } from '../src/components/BlindInterface';

export default function EmergencyScreen() {
  const router = useRouter();
  const { language, isHighContrast } = useNavigationStore();
  const ar = language === 'ar';
  const theme = getInterfaceTheme(isHighContrast);
  const [receipt, setReceipt] = useState<RequestReceipt | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [description, setDescription] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const terminal = receipt?.status === 'resolved' || receipt?.status === 'cancelled';
  const statusText = receipt ? ({
    new: ar ? 'تم حفظ الطلب — بانتظار تأكيد استلام الأمن' : 'Request saved — awaiting staff acknowledgement',
    contacted: ar ? 'أكد فريق الأمن استلام الطلب' : 'Staff acknowledged your request',
    arrived: ar ? 'سجّل فريق الأمن وصوله' : 'Staff reported arrival',
    resolved: ar ? 'أُغلق الطلب بعد المعالجة' : 'Request resolved',
    cancelled: ar ? 'تم تأكيد إلغاء الطلب' : 'Cancellation confirmed',
    investigating: '', rejected: '',
  })[receipt.status] : '';

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    RequestService.resume('emergency').then(saved => {
      if (active) setReceipt(saved);
    }).catch(cause => {
      if (active) setError(requestErrorMessage(cause, language));
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [language]);

  useEffect(() => {
    if (statusText) VoiceService.speak(statusText);
  }, [statusText]);

  const refresh = async () => {
    if (locked.current) return;
    locked.current = true;
    try {
      const saved = await RequestService.resume('emergency');
      if (!saved) throw new Error('No receipt');
      if (mounted.current) { setReceipt(saved); setError(''); }
    } catch (cause) {
      if (mounted.current) setError(requestErrorMessage(cause, language));
    } finally { locked.current = false; }
  };

  useEffect(() => {
    if (!receipt || terminal) return;
    const poll = setInterval(refresh, 15000);
    const pulse = setInterval(() => HapticsService.trigger('emergency'), 3000);
    return () => { clearInterval(poll); clearInterval(pulse); };
  }, [receipt?.id, terminal, language]);

  const submit = async () => {
    if (locked.current || receipt || busy) return;
    locked.current = true;
    setBusy(true); setError('');
    try {
      const coordinates = await requestCoordinates(Location);
      const saved = await RequestService.submit('emergency', {
        ...coordinates,
        message: `${ar ? 'طلب مساعدة عاجلة' : 'Urgent help request'}. ${description.trim() || (ar ? 'لا يوجد وصف إضافي للمكان.' : 'No additional location description.')}`,
      });
      if (mounted.current) { setReceipt(saved); HapticsService.trigger('emergency'); }
    } catch (cause) {
      const message = requestErrorMessage(cause, language);
      if (mounted.current) { setError(message); VoiceService.speak(message); }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const cancel = async () => {
    if (locked.current || busy) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const saved = await RequestService.cancelEmergency();
      if (mounted.current) { setReceipt(saved); setConfirmCancel(false); }
    } catch (cause) {
      const message = requestErrorMessage(cause, language);
      if (mounted.current) { setError(message); VoiceService.speak(message); }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const newRequest = async () => {
    if (locked.current || busy) return;
    locked.current = true; setBusy(true); setError('');
    try {
      await RequestService.newRequest('emergency');
      if (mounted.current) { setReceipt(null); setDescription(''); }
    } catch (cause) {
      if (mounted.current) setError(requestErrorMessage(cause, language));
    } finally { locked.current = false; if (mounted.current) setBusy(false); }
  };

  return (
    <ScreenShell highContrast={isHighContrast}>
      <HeroPanel theme={theme} code="SOS"
        eyebrow={ar ? 'طلب مساعدة' : 'Request assistance'}
        title={receipt ? (ar ? 'متابعة طلب الطوارئ' : 'Track your SOS') : (ar ? 'هل تحتاج مساعدة؟' : 'Do you need help?')}
        subtitle={ar ? 'إذا كانت المساعدة عاجلة ولم يتأكد استلام الطلب، اطلبها مباشرة من فريق الموقع.' : 'If help is urgent and acknowledgement is unconfirmed, contact site staff directly.'} />
      {error ? <Text style={[styles.sosDescription, { color: theme.danger }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">{error}</Text> : null}
      {busy ? <ActivityIndicator size="large" color={theme.danger} accessibilityLabel={ar ? 'جاري التحقق من الطلب' : 'Checking request'} /> : null}
      {receipt ? (
        <View style={[styles.sosPanel, surfaceStyle(theme)]}>
          <StatusPill theme={theme} tone={terminal ? 'normal' : 'warning'} text={statusText} />
          <Text selectable style={[styles.sosDescription, { color: theme.text }]}>{ar ? 'رقم الطلب' : 'Request ID'}: {receipt.id}</Text>
          <Text style={[styles.sosDescription, { color: theme.textMuted }]}>{receipt.location_available
            ? (ar ? 'أُرسلت إحداثيات الموقع وقت إنشاء الطلب؛ الموقع لا يتحدث تلقائيًا.' : 'Coordinates were sent when the request was created; location is not updated automatically.')
            : (ar ? 'الموقع الجغرافي غير متاح. لم تُرسل إحداثيات؛ يحتاج الفريق إلى وصف مكانك.' : 'Location unavailable. No coordinates were sent; staff need a description of your position.')}</Text>
          {!terminal ? <PrimaryButton theme={theme} title={ar ? 'تحديث حالة الطلب' : 'Refresh status'} accessibilityLabel={ar ? 'تحديث حالة الطلب' : 'Refresh status'} onPress={refresh} disabled={busy} variant="secondary" /> : null}
        </View>
      ) : (
        <View style={[styles.sosPanel, surfaceStyle(theme)]}>
          <Text style={[styles.sosDescription, { color: theme.text }]}>{ar ? 'صف مكانك إن أمكن؛ قد يتعذر تحديد الموقع داخل المبنى.' : 'Describe your position if possible; location may be unavailable indoors.'}</Text>
          <TextInput value={description} onChangeText={setDescription} multiline maxLength={1500} editable={!busy}
            accessibilityLabel={ar ? 'وصف مكانك لفريق المساعدة' : 'Describe your position to responders'}
            placeholder={ar ? 'المبنى، الطابق، أقرب باب أو معلم…' : 'Building, floor, nearest door or landmark…'} placeholderTextColor={theme.textMuted}
            style={{ width: '100%', minHeight: 90, padding: 14, color: theme.text, borderColor: theme.border, borderWidth: 1, borderRadius: 12, marginBottom: 16, textAlign: ar ? 'right' : 'left' }} />
          <PrimaryButton theme={theme} title={ar ? 'تأكيد طلب المساعدة' : 'Confirm help request'} onPress={submit} variant="danger" disabled={busy}
            accessibilityLabel={ar ? 'تأكيد إرسال طلب مساعدة عاجلة' : 'Confirm urgent help request'} />
        </View>
      )}
      {receipt && !terminal ? (
        confirmCancel ? <View style={[styles.sosPanel, surfaceStyle(theme)]}>
          <Text style={[styles.sosDescription, { color: theme.text }]}>{ar ? 'هل لم تعد بحاجة إلى المساعدة؟ يبقى الطلب نشطًا حتى يتأكد الإلغاء من الخادم.' : 'Do you no longer need help? The request stays active until cancellation is confirmed.'}</Text>
          <PrimaryButton theme={theme} title={ar ? 'نعم، ألغِ طلب المساعدة' : 'Yes, cancel help request'} accessibilityLabel={ar ? 'تأكيد إلغاء الطلب' : 'Confirm cancellation'} onPress={cancel} disabled={busy} variant="danger" />
          <PrimaryButton theme={theme} title={ar ? 'أبقِ الطلب نشطًا' : 'Keep request active'} accessibilityLabel={ar ? 'أبقِ الطلب نشطًا' : 'Keep request active'} onPress={() => setConfirmCancel(false)} disabled={busy} variant="secondary" />
        </View> : <PrimaryButton theme={theme} title={ar ? 'لم أعد بحاجة إلى المساعدة' : 'I no longer need help'} accessibilityLabel={ar ? 'مراجعة إلغاء طلب المساعدة' : 'Review cancellation'} onPress={() => setConfirmCancel(true)} variant="secondary" disabled={busy} />
      ) : null}
      {terminal ? <PrimaryButton theme={theme} title={ar ? 'طلب مساعدة جديد' : 'New help request'} accessibilityLabel={ar ? 'بدء طلب جديد' : 'Start a new request'} onPress={newRequest} disabled={busy} /> : null}
      {receipt && !terminal ? <Text style={[styles.sosDescription, { color: theme.textMuted }]}>{ar ? 'الرجوع للرئيسية يوقف التنبيه اللمسي فقط؛ طلب المساعدة يبقى مفتوحًا.' : 'Returning home stops the haptic alert; the help request remains open.'}</Text> : null}
      <PrimaryButton theme={theme} title={ar ? 'الرجوع للرئيسية' : 'Return home'} accessibilityLabel={ar ? 'الرجوع للرئيسية دون إلغاء الطلب' : 'Return home without cancelling'} onPress={() => router.replace('/home')} variant="ghost" disabled={busy} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  sosPanel: {
    borderWidth: 1.5,
    borderRadius: 28,
    padding: 22,
    alignItems: 'center',
    marginBottom: 14,
  },
  sosTitle: {
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  sosDescription: {
    fontSize: 16,
    lineHeight: 25,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 22,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
});
