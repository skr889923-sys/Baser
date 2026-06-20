import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import VoiceService from '../src/services/VoiceService';
import HapticsService from '../src/services/HapticsService';
import {
  ActionTile,
  getInterfaceTheme,
  HeroPanel,
  ScreenShell,
  StatusPill,
} from '../src/components/BlindInterface';

type RoutePath = '/destination' | '/qr-scanner' | '/where-am-i' | '/emergency' | '/report' | '/settings';

export default function HomeScreen() {
  const router = useRouter();
  const { language, isHighContrast, isMuted } = useNavigationStore();
  const theme = getInterfaceTheme(isHighContrast);

  useEffect(() => {
    const msg = language === 'ar'
      ? 'القائمة الرئيسية. اختر الوجهة، امسح رمز الموقع، اعرف أين أنت، أو افتح الطوارئ.'
      : 'Main menu. Select a destination, scan a location tag, identify where you are, or open emergency support.';
    VoiceService.speak(msg);
  }, [language]);

  const navigateTo = (path: RoutePath, nameAr: string, nameEn: string) => {
    HapticsService.trigger('continue');
    VoiceService.speak(language === 'ar' ? `فتح ${nameAr}` : `Opening ${nameEn}`);
    router.push(path);
  };

  const actions = [
    {
      path: '/destination' as RoutePath,
      label: 'GO',
      ar: 'اختر وجهتك',
      en: 'Select destination',
      descAr: 'ابحث عن قاعة أو مكتب أو مرفق وابدأ مسارك الصوتي.',
      descEn: 'Find a room, office, or facility and start audio routing.',
      hintAr: 'اضغط مرتين لفتح قائمة الوجهات',
      hintEn: 'Double tap to open destination search',
    },
    {
      path: '/qr-scanner' as RoutePath,
      label: 'QR',
      ar: 'امسح رمز الموقع',
      en: 'Scan location tag',
      descAr: 'استخدم ملصقات QR لتحديد موقعك بدقة داخل المبنى.',
      descEn: 'Use QR anchors to identify your exact indoor position.',
      hintAr: 'اضغط مرتين لفتح الكاميرا',
      hintEn: 'Double tap to open camera scanner',
    },
    {
      path: '/where-am-i' as RoutePath,
      label: 'GPS',
      ar: 'أين أنا؟',
      en: 'Where am I?',
      descAr: 'اسمع أقرب نقطة ملاحية والمسافة التقريبية إليها.',
      descEn: 'Hear the nearest navigation point and estimated distance.',
      hintAr: 'اضغط مرتين لسماع موقعك الحالي',
      hintEn: 'Double tap to hear your current location',
    },
    {
      path: '/report' as RoutePath,
      label: 'FIX',
      ar: 'بلاغ عن عائق',
      en: 'Report obstacle',
      descAr: 'أرسل بلاغاً عن ممر مغلق أو مصعد معطل أو أعمال صيانة.',
      descEn: 'Report a blocked corridor, broken elevator, or maintenance work.',
      hintAr: 'اضغط مرتين لإرسال بلاغ',
      hintEn: 'Double tap to report an issue',
    },
    {
      path: '/settings' as RoutePath,
      label: 'SET',
      ar: 'الإعدادات',
      en: 'Settings',
      descAr: 'غيّر اللغة، التباين، وتفضيل نوع المسار.',
      descEn: 'Change language, contrast, and route preference.',
      hintAr: 'اضغط مرتين لتعديل الإعدادات',
      hintEn: 'Double tap to change settings',
    },
  ];

  return (
    <ScreenShell highContrast={isHighContrast}>
      <HeroPanel
        theme={theme}
        eyebrow={language === 'ar' ? 'مركز التحكم الصوتي' : 'Voice command hub'}
        title={language === 'ar' ? 'ماذا تريد أن تفعل الآن؟' : 'What do you need now?'}
        subtitle={
          language === 'ar'
            ? 'أزرار كبيرة، وصف مسموع، ومسارات مصممة للتنقل داخل المباني بثقة.'
            : 'Large controls, spoken context, and routes designed for confident indoor movement.'
        }
        code="NAV"
      />

      <View style={styles.statusRow}>
        <StatusPill theme={theme} tone="success" text={language === 'ar' ? 'النظام جاهز' : 'System ready'} />
        <StatusPill
          theme={theme}
          tone={isMuted ? 'danger' : 'normal'}
          text={isMuted ? (language === 'ar' ? 'صامت' : 'Muted') : (language === 'ar' ? 'صوتي' : 'Voice on')}
        />
      </View>

      <ActionTile
        title={language === 'ar' ? 'طوارئ SOS' : 'Emergency SOS'}
        subtitle={language === 'ar' ? 'طلب مساعدة عاجلة وإرسال موقعك للأمن.' : 'Request urgent help and share your position with security.'}
        label="SOS"
        danger
        theme={theme}
        onPress={() => navigateTo('/emergency', 'الطوارئ', 'Emergency SOS')}
        accessibilityLabel={language === 'ar' ? 'طلب مساعدة طوارئ' : 'Emergency assistance'}
        accessibilityHint={language === 'ar' ? 'اضغط مرتين لطلب المساعدة العاجلة' : 'Double tap to request immediate assistance'}
      />

      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {language === 'ar' ? 'الإجراءات الأساسية' : 'Core actions'}
      </Text>

      {actions.map(action => (
        <ActionTile
          key={action.path}
          title={language === 'ar' ? action.ar : action.en}
          subtitle={language === 'ar' ? action.descAr : action.descEn}
          label={action.label}
          theme={theme}
          onPress={() => navigateTo(action.path, action.ar, action.en)}
          accessibilityLabel={language === 'ar' ? action.ar : action.en}
          accessibilityHint={language === 'ar' ? action.hintAr : action.hintEn}
        />
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
    marginTop: 4,
  },
});
