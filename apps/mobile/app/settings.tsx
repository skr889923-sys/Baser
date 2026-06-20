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
  PrimaryButton,
  ScreenShell,
  StatusPill,
} from '../src/components/BlindInterface';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    language,
    setLanguage,
    isHighContrast,
    toggleHighContrast,
    routeTypePreference,
    setRoutePreference,
    isMuted,
  } = useNavigationStore();
  const theme = getInterfaceTheme(isHighContrast);

  useEffect(() => {
    VoiceService.speak(
      language === 'ar'
        ? 'شاشة الإعدادات. يمكنك تعديل اللغة، التباين، وتفضيل المسار، أو اختبار الصوت والاهتزاز.'
        : 'Settings screen. You can change language, contrast, route preference, or test voice and haptics.'
    );
  }, [language]);

  const toggleLanguage = () => {
    const nextLang = language === 'ar' ? 'en' : 'ar';
    setLanguage(nextLang);
    VoiceService.setVoiceLanguage(nextLang);
    VoiceService.speak(nextLang === 'ar' ? 'تم تحويل التطبيق للغة العربية' : 'Application switched to English');
  };

  const handleTestFeatures = () => {
    HapticsService.trigger('arrived');
    VoiceService.speak(
      language === 'ar'
        ? 'تم اختبار الصوت والاهتزاز بنجاح. التطبيق جاهز.'
        : 'Speech and haptics tested successfully. The app is ready.'
    );
  };

  const handleBack = () => {
    HapticsService.trigger('continue');
    router.replace('/home');
  };

  return (
    <ScreenShell highContrast={isHighContrast}>
      <HeroPanel
        theme={theme}
        eyebrow={language === 'ar' ? 'إعدادات الوصول' : 'Accessibility settings'}
        title={language === 'ar' ? 'اضبط تجربة التوجيه' : 'Tune your guidance experience'}
        subtitle={
          language === 'ar'
            ? 'اختر اللغة والتباين ونوع المسار بما يناسب طريقة استخدامك اليومية.'
            : 'Choose language, contrast, and route behavior for your daily use.'
        }
        code="SET"
      />

      <View style={styles.statusRow}>
        <StatusPill theme={theme} text={language === 'ar' ? 'العربية' : 'English'} />
        <StatusPill theme={theme} tone={isHighContrast ? 'success' : 'normal'} text={isHighContrast ? (language === 'ar' ? 'تباين عال' : 'High contrast') : (language === 'ar' ? 'تباين عادي' : 'Standard contrast')} />
        <StatusPill theme={theme} tone={isMuted ? 'danger' : 'success'} text={isMuted ? (language === 'ar' ? 'صامت' : 'Muted') : (language === 'ar' ? 'الصوت نشط' : 'Voice on')} />
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {language === 'ar' ? 'التشغيل' : 'Operation'}
      </Text>

      <ActionTile
        title={language === 'ar' ? 'لغة التطبيق' : 'Application language'}
        subtitle={language === 'ar' ? 'الحالية: العربية. اضغط للتحويل إلى الإنجليزية.' : 'Current: English. Tap to switch to Arabic.'}
        label="LANG"
        theme={theme}
        compact
        onPress={toggleLanguage}
        accessibilityLabel={language === 'ar' ? 'لغة التطبيق الحالية العربية. اضغط للتحويل إلى الإنجليزية' : 'Current language English. Tap to switch to Arabic'}
      />

      <ActionTile
        title={language === 'ar' ? 'التباين العالي' : 'High contrast'}
        subtitle={isHighContrast ? (language === 'ar' ? 'نشط لتحسين وضوح النصوص والحدود.' : 'Enabled for clearer text and borders.') : (language === 'ar' ? 'اضغط لتفعيل ألوان عالية التباين.' : 'Tap to enable high contrast colors.')}
        label="VIEW"
        theme={theme}
        selected={isHighContrast}
        compact
        onPress={() => {
          toggleHighContrast();
          HapticsService.trigger('continue');
          VoiceService.speak(
            language === 'ar'
              ? `تم ${!isHighContrast ? 'تفعيل' : 'تعطيل'} وضع التباين العالي`
              : `High contrast mode ${!isHighContrast ? 'enabled' : 'disabled'}`
          );
        }}
        accessibilityLabel={language === 'ar' ? `وضع التباين العالي: ${isHighContrast ? 'نشط' : 'غير نشط'}` : `High contrast mode: ${isHighContrast ? 'On' : 'Off'}`}
      />

      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {language === 'ar' ? 'تفضيل المسار' : 'Route preference'}
      </Text>

      <View style={styles.preferenceGrid}>
        <ActionTile
          title={language === 'ar' ? 'مهيأ وآمن' : 'Accessible'}
          subtitle={language === 'ar' ? 'يفضل المسارات المريحة للمكفوفين.' : 'Prioritizes blind-friendly paths.'}
          label="SAFE"
          theme={theme}
          selected={routeTypePreference === 'safe_accessible'}
          compact
          onPress={() => {
            setRoutePreference('safe_accessible');
            HapticsService.trigger('continue');
            VoiceService.speak(language === 'ar' ? 'تم تفضيل المسار الآمن والمهيأ' : 'Accessible route preference selected');
          }}
          accessibilityLabel={language === 'ar' ? 'تفضيل مسار مهيأ وآمن' : 'Prefer accessible route'}
        />
        <ActionTile
          title={language === 'ar' ? 'الأسرع' : 'Fastest'}
          subtitle={language === 'ar' ? 'يقلل الزمن عند توفر مسار مناسب.' : 'Reduces time when a suitable route exists.'}
          label="FAST"
          theme={theme}
          selected={routeTypePreference === 'fastest'}
          compact
          onPress={() => {
            setRoutePreference('fastest');
            HapticsService.trigger('continue');
            VoiceService.speak(language === 'ar' ? 'تم تفضيل أسرع مسار' : 'Fastest route preference selected');
          }}
          accessibilityLabel={language === 'ar' ? 'تفضيل أسرع مسار' : 'Prefer fastest route'}
        />
      </View>

      <PrimaryButton
        theme={theme}
        title={language === 'ar' ? 'اختبر الصوت والاهتزاز' : 'Test speech and haptics'}
        onPress={handleTestFeatures}
        variant="secondary"
        accessibilityLabel={language === 'ar' ? 'بدء اختبار الصوت والاهتزاز' : 'Test speech and haptics feedback'}
      />

      <PrimaryButton
        theme={theme}
        title={language === 'ar' ? 'حفظ وإغلاق' : 'Save and exit'}
        onPress={handleBack}
        accessibilityLabel={language === 'ar' ? 'حفظ الإعدادات والرجوع للرئيسية' : 'Save settings and return home'}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
    marginTop: 4,
  },
  preferenceGrid: {
    gap: 12,
    marginBottom: 4,
  },
});
