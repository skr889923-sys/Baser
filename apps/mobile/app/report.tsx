import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import RequestService from '../src/services/RequestService';
import { requestErrorMessage } from '../src/services/request-client';
import { requestCoordinates } from '../src/services/request-location';
import VoiceService from '../src/services/VoiceService';
import HapticsService from '../src/services/HapticsService';
import { ReportType, RequestReceipt } from '@baser/types';
import * as Location from 'expo-location';
import {
  ActionTile,
  getInterfaceTheme,
  HeroPanel,
  PrimaryButton,
  ScreenShell,
} from '../src/components/BlindInterface';

const reportTypes: Array<{ key: ReportType; ar: string; en: string; code: string; descAr: string; descEn: string }> = [
  {
    key: 'obstacle',
    ar: 'عائق في الممر',
    en: 'Obstacle on path',
    code: 'OBS',
    descAr: 'كرسي، حاجز، صندوق، أو أي جسم يعيق الحركة.',
    descEn: 'Chair, barrier, box, or any object blocking movement.',
  },
  {
    key: 'closed_door',
    ar: 'باب مغلق',
    en: 'Closed door',
    code: 'DOR',
    descAr: 'باب أو بوابة مغلقة على مسار معلن.',
    descEn: 'A door or gate closed on a listed route.',
  },
  {
    key: 'broken_elevator',
    ar: 'مصعد معطل',
    en: 'Broken elevator',
    code: 'LFT',
    descAr: 'مصعد لا يعمل أو غير آمن للاستخدام.',
    descEn: 'Elevator unavailable or unsafe to use.',
  },
  {
    key: 'maintenance_work',
    ar: 'أعمال صيانة',
    en: 'Maintenance work',
    code: 'MNT',
    descAr: 'منطقة عمل أو ضوضاء أو أرضية غير مستقرة.',
    descEn: 'Work area, noise, or unstable flooring.',
  },
];

const reportStatusLabels: Partial<Record<RequestReceipt['status'], { ar: string; en: string }>> = {
  new: { ar: 'بانتظار المراجعة', en: 'Awaiting review' },
  investigating: { ar: 'قيد المعالجة', en: 'Under investigation' },
  resolved: { ar: 'تم الحل بحسب الإدارة', en: 'Resolved by staff' },
  rejected: { ar: 'لم يُقبل البلاغ', en: 'Report rejected' },
};

export default function ReportScreen() {
  const router = useRouter();
  const { language, isHighContrast } = useNavigationStore();
  const theme = getInterfaceTheme(isHighContrast);

  const [reportType, setReportType] = useState<ReportType>('obstacle');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<RequestReceipt | null>(null);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    RequestService.resume('report').then(saved => { if (mounted.current) setReceipt(saved); })
      .catch(cause => { if (mounted.current) setError(requestErrorMessage(cause, language)); })
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    VoiceService.speak(
      language === 'ar'
        ? 'شاشة الإبلاغ عن عائق. اختر نوع المشكلة، ويمكنك إضافة وصف مختصر قبل الإرسال.'
        : 'Report obstacle screen. Choose the issue type, and optionally add a short description before sending.'
    );
  }, [language]);

  const handleSelectType = (type: ReportType, nameAr: string, nameEn: string) => {
    HapticsService.trigger('continue');
    setReportType(type);
    VoiceService.speak(language === 'ar' ? `تم اختيار ${nameAr}` : `Selected ${nameEn}`);
  };

  const handleSubmit = async () => {
    if (locked.current || loading || receipt) return;
    locked.current = true;
    setLoading(true); setError('');
    try {
      const coordinates = await requestCoordinates(Location);
      const saved = await RequestService.submit('report', {
        ...coordinates,
        report_type: reportType,
        title: language === 'ar' ? `بلاغ عائق: ${reportType}` : `Obstacle report: ${reportType}`,
        description: description.trim() || (language === 'ar' ? 'بلاغ بدون تفاصيل إضافية' : 'Report without additional details'),
      });
      if (mounted.current) {
        setReceipt(saved);
        HapticsService.trigger('arrived');
        VoiceService.speak(language === 'ar' ? 'تم تأكيد حفظ البلاغ. يمكنك الاحتفاظ برقمه للمتابعة.' : 'Report saved. Keep its reference for follow-up.');
      }
    } catch (cause) {
      const message = requestErrorMessage(cause, language);
      if (mounted.current) { setError(message); VoiceService.speak(message); }
    } finally { locked.current = false; if (mounted.current) setLoading(false); }
  };

  const startNewReport = async () => {
    if (locked.current || loading) return;
    locked.current = true; setLoading(true); setError('');
    try {
      await RequestService.newRequest('report');
      if (mounted.current) { setReceipt(null); setDescription(''); }
    } catch (cause) { if (mounted.current) setError(requestErrorMessage(cause, language)); }
    finally { locked.current = false; if (mounted.current) setLoading(false); }
  };

  const refreshReceipt = async () => {
    if (locked.current || loading) return;
    locked.current = true; setLoading(true); setError('');
    try {
      const saved = await RequestService.resume('report');
      if (!saved) throw new Error(language === 'ar' ? 'تعذر العثور على إيصال البلاغ.' : 'Report receipt could not be found.');
      if (mounted.current) setReceipt(saved);
    } catch (cause) {
      if (mounted.current) setError(requestErrorMessage(cause, language));
    } finally { locked.current = false; if (mounted.current) setLoading(false); }
  };

  if (receipt) return (
    <ScreenShell highContrast={isHighContrast}>
      <HeroPanel theme={theme} code="RPT" eyebrow={language === 'ar' ? 'إيصال البلاغ' : 'Report receipt'}
        title={language === 'ar' ? 'تم تأكيد حفظ البلاغ' : 'Report saved'}
        subtitle={language === 'ar' ? 'حفظ البلاغ لا يعني إزالة العائق. تجنب المرور بالمكان غير الآمن حتى تتأكد إتاحته.' : 'A saved report does not mean the obstacle is removed. Avoid an unsafe path until its availability is confirmed.'} />
      <Text selectable style={{ color: theme.text, marginBottom: 16 }}>{language === 'ar' ? 'رقم البلاغ' : 'Report ID'}: {receipt.id}</Text>
      <Text accessibilityLiveRegion="polite" style={{ color: theme.text, marginBottom: 16 }}>
        {language === 'ar' ? 'آخر حالة مؤكدة' : 'Last confirmed status'}: {reportStatusLabels[receipt.status]?.[language === 'ar' ? 'ar' : 'en'] || (language === 'ar' ? 'غير معروفة' : 'Unknown')}
      </Text>
      <Text style={{ color: theme.textMuted, marginBottom: 16 }}>{receipt.location_available
        ? (language === 'ar' ? 'أُرفقت إحداثيات الموقع وقت الإرسال.' : 'Coordinates were attached at submission.')
        : (language === 'ar' ? 'لم تتوفر إحداثيات؛ يعتمد تحديد المكان على وصفك.' : 'Coordinates unavailable; your description identifies the location.')}</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text> : null}
      <PrimaryButton theme={theme} title={language === 'ar' ? 'تحديث حالة البلاغ' : 'Refresh report status'} accessibilityLabel={language === 'ar' ? 'تحديث حالة البلاغ' : 'Refresh report status'} onPress={refreshReceipt} disabled={loading} variant="secondary" />
      <PrimaryButton theme={theme} title={language === 'ar' ? 'بلاغ آخر' : 'Another report'} accessibilityLabel={language === 'ar' ? 'إنشاء بلاغ آخر' : 'Create another report'} onPress={startNewReport} disabled={loading} />
      <PrimaryButton theme={theme} title={language === 'ar' ? 'الرجوع للرئيسية' : 'Return home'} accessibilityLabel={language === 'ar' ? 'الرجوع للرئيسية' : 'Return home'} onPress={() => router.replace('/home')} variant="secondary" />
    </ScreenShell>
  );

  return (
    <ScreenShell highContrast={isHighContrast}>
      <HeroPanel
        theme={theme}
        eyebrow={language === 'ar' ? 'سلامة المسار' : 'Route safety'}
        title={language === 'ar' ? 'أبلغ عن مشكلة في الطريق' : 'Report a route issue'}
        subtitle={
          language === 'ar'
            ? 'البلاغات تساعد الإدارة على تحديث المسارات الصوتية وإزالة العوائق بسرعة.'
            : 'Reports help admins update audio routes and remove obstacles quickly.'
        }
        code="RPT"
      />

      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{ color: theme.danger, marginBottom: 16 }}>{error}</Text> : null}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {language === 'ar' ? 'نوع المشكلة' : 'Issue type'}
      </Text>

      {reportTypes.map(item => (
        <ActionTile
          key={item.key}
          title={language === 'ar' ? item.ar : item.en}
          subtitle={language === 'ar' ? item.descAr : item.descEn}
          label={item.code}
          theme={theme}
          selected={reportType === item.key}
          disabled={loading}
          compact
          onPress={() => handleSelectType(item.key, item.ar, item.en)}
          accessibilityLabel={language === 'ar' ? item.ar : item.en}
        />
      ))}

      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {language === 'ar' ? 'تفاصيل إضافية' : 'Additional details'}
      </Text>
      <TextInput
        style={[
          styles.textInput,
          {
            backgroundColor: theme.surface,
            color: theme.text,
            borderColor: theme.borderSoft,
          },
        ]}
        multiline={true}
        maxLength={4000}
        editable={!loading}
        numberOfLines={4}
        placeholder={language === 'ar' ? 'مثال: العائق أمام قاعة 101 في الجهة اليمنى...' : 'Example: obstacle in front of room 101 on the right side...'}
        placeholderTextColor={theme.textSoft}
        value={description}
        onChangeText={setDescription}
        accessible={true}
        accessibilityLabel={language === 'ar' ? 'حقل كتابة تفاصيل البلاغ' : 'Additional report details'}
      />

      <PrimaryButton
        theme={theme}
        title={loading ? (language === 'ar' ? 'جاري إرسال البلاغ...' : 'Submitting report...') : (language === 'ar' ? 'إرسال البلاغ' : 'Submit report')}
        onPress={handleSubmit}
        disabled={loading}
        accessibilityLabel={language === 'ar' ? 'إرسال البلاغ الآن' : 'Submit report now'}
      />
      {loading ? <ActivityIndicator size="small" color={theme.accent} /> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
    marginTop: 4,
  },
  textInput: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 118,
    textAlignVertical: 'top',
    marginBottom: 16,
    fontWeight: '700',
  },
});
