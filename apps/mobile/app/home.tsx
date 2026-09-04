import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import VoiceService from '../src/services/VoiceService';
import HapticsService from '../src/services/HapticsService';
import {
  ActionTile,
  getInterfaceTheme,
  HeroPanel,
  ScreenShell,
  SectionHeader,
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

  const quickActions = [
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
  ];

  const supportActions = [
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
        <StatusPill theme={theme} tone="success" text={language === 'ar' ? 'واجهة صوتية جاهزة' : 'Voice interface ready'} />
        <StatusPill
          theme={theme}
          tone={isMuted ? 'danger' : 'normal'}
          text={isMuted ? (language === 'ar' ? 'صامت' : 'Muted') : (language === 'ar' ? 'صوتي' : 'Voice on')}
        />
      </View>

      <ActionTile
        title={language === 'ar' ? 'ابدأ باختيار وجهتك' : 'Start with a destination'}
        subtitle={language === 'ar' ? 'ابحث عن قاعة أو مكتب أو مرفق، ثم راجع المسار قبل بدء التوجيه الصوتي.' : 'Find a room, office, or facility, then review the route before voice guidance begins.'}
        label="GO"
        theme={theme}
        onPress={() => navigateTo('/destination', 'اختيار الوجهة', 'destination selection')}
        accessibilityLabel={language === 'ar' ? 'اختر وجهتك' : 'Select destination'}
        accessibilityHint={language === 'ar' ? 'اضغط مرتين لفتح قائمة الوجهات' : 'Double tap to open destination search'}
      />

      <SectionHeader
        theme={theme}
        eyebrow={language === 'ar' ? 'تثبيت الموقع' : 'Position anchors'}
        title={language === 'ar' ? 'حدد نقطة البداية' : 'Set your starting point'}
        meta={language === 'ar' ? 'خياران' : '2 options'}
      />

      <View style={styles.actionGrid}>
        {quickActions.map(action => (
          <View key={action.path} style={styles.actionCell}>
            <ActionTile
              title={language === 'ar' ? action.ar : action.en}
              subtitle={language === 'ar' ? action.descAr : action.descEn}
              label={action.label}
              compact
              theme={theme}
              onPress={() => navigateTo(action.path, action.ar, action.en)}
              accessibilityLabel={language === 'ar' ? action.ar : action.en}
              accessibilityHint={language === 'ar' ? action.hintAr : action.hintEn}
            />
          </View>
        ))}
      </View>

      <SectionHeader
        theme={theme}
        eyebrow={language === 'ar' ? 'الدعم والتحكم' : 'Support and control'}
        title={language === 'ar' ? 'أدوات إضافية' : 'More tools'}
      />

      <View style={styles.actionGrid}>
        {supportActions.map(action => (
          <View key={action.path} style={styles.actionCell}>
            <ActionTile
              title={language === 'ar' ? action.ar : action.en}
              subtitle={language === 'ar' ? action.descAr : action.descEn}
              label={action.label}
              compact
              theme={theme}
              onPress={() => navigateTo(action.path, action.ar, action.en)}
              accessibilityLabel={language === 'ar' ? action.ar : action.en}
              accessibilityHint={language === 'ar' ? action.hintAr : action.hintEn}
            />
          </View>
        ))}
      </View>

      <ActionTile
        title={language === 'ar' ? 'طوارئ SOS' : 'Emergency SOS'}
        subtitle={language === 'ar' ? 'اطلب مساعدة عاجلة وشارك موقعك مع فريق الأمن.' : 'Request urgent help and share your position with security.'}
        label="SOS"
        danger
        compact
        theme={theme}
        onPress={() => navigateTo('/emergency', 'الطوارئ', 'Emergency SOS')}
        accessibilityLabel={language === 'ar' ? 'طلب مساعدة طوارئ' : 'Emergency assistance'}
        accessibilityHint={language === 'ar' ? 'اضغط مرتين لطلب المساعدة العاجلة' : 'Double tap to request immediate assistance'}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginHorizontal: -1,
  },
  actionCell: {
    flexGrow: 1,
    flexBasis: 160,
    minWidth: 150,
  },
});
