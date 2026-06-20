import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import SupabaseService from '../src/services/SupabaseService';
import NavigationService from '../src/services/NavigationService';
import VoiceService from '../src/services/VoiceService';
import HapticsService from '../src/services/HapticsService';
import { ReportType } from '@baser/types';
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

export default function ReportScreen() {
  const router = useRouter();
  const { language, isHighContrast } = useNavigationStore();
  const theme = getInterfaceTheme(isHighContrast);

  const [reportType, setReportType] = useState<ReportType>('obstacle');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    HapticsService.trigger('continue');

    try {
      let latitude: number | null = null;
      let longitude: number | null = null;
      let navigationPointId: string | null = null;
      let buildingId: string | null = null;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const currentLocation = await Location.getCurrentPositionAsync({});
          latitude = currentLocation.coords.latitude;
          longitude = currentLocation.coords.longitude;

          const nearestPoint = await NavigationService.getNearestPoint(latitude, longitude);
          navigationPointId = nearestPoint?.id || null;
          buildingId = nearestPoint?.building_id || null;
        }
      } catch (locationError) {
        console.warn('[ReportScreen] Report submitted without live location:', locationError);
      }

      await SupabaseService.submitReport({
        user_id: null,
        report_type: reportType,
        title: language === 'ar' ? `بلاغ عائق: ${reportType}` : `Obstacle report: ${reportType}`,
        description: description || (language === 'ar' ? 'بلاغ مرسل من الجوال بدون تفاصيل إضافية' : 'Report sent from mobile without additional details'),
        latitude,
        longitude,
        navigation_point_id: navigationPointId,
        building_id: buildingId,
      });

      VoiceService.speak(
        language === 'ar'
          ? 'تم إرسال البلاغ بنجاح. شكراً لمساعدتك في تحسين سلامة المسارات.'
          : 'Report submitted successfully. Thank you for helping improve route safety.'
      );
      router.replace('/home');
    } catch (error) {
      console.error(error);
      VoiceService.speak(language === 'ar' ? 'تعذر إرسال البلاغ.' : 'Could not submit report.');
    } finally {
      setLoading(false);
    }
  };

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
