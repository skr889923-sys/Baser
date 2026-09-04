import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import VoiceService from '../src/services/VoiceService';
import {
  ActionTile,
  getInterfaceTheme,
  HeroPanel,
  PrimaryButton,
  ScreenShell,
  SectionHeader,
  StatusPill,
} from '../src/components/BlindInterface';

export default function WelcomeScreen() {
  const router = useRouter();
  const { language, setLanguage, isHighContrast, isMuted } = useNavigationStore();
  const theme = getInterfaceTheme(isHighContrast);

  useEffect(() => {
    const timer = setTimeout(() => {
      const welcomeMsg = language === 'ar'
        ? 'مرحباً بك في بصيره. واجهة صوتية مصممة للمكفوفين. اختر اللغة أو اضغط زر البدء للمتابعة.'
        : 'Welcome to Baseera. A voice-first interface designed for blind users. Choose a language or press start to continue.';
      VoiceService.speak(welcomeMsg);
    }, 800);
    return () => clearTimeout(timer);
  }, [language]);

  const selectLanguage = (lang: 'ar' | 'en') => {
    setLanguage(lang);
    VoiceService.setVoiceLanguage(lang);
    VoiceService.speak(lang === 'ar' ? 'تم تفعيل اللغة العربية' : 'English language activated');
  };

  const handleStart = () => {
    VoiceService.stop();
    router.push('/permissions');
  };

  return (
    <ScreenShell highContrast={isHighContrast}>
      <HeroPanel
        theme={theme}
        eyebrow={language === 'ar' ? 'ملاحة تُسمع وتُحس' : 'Navigation you can hear and feel'}
        title={language === 'ar' ? 'المكان أوضح عندما ينطق' : 'A clearer place, spoken aloud'}
        subtitle={
          language === 'ar'
            ? 'بصيره يحوّل نقاط المكان إلى تعليمات صوتية ولمسية مختصرة، من المدخل حتى الوجهة.'
            : 'Baseera turns place anchors into concise spoken and haptic guidance, from entrance to destination.'
        }
        code="B01"
      />

      <View style={styles.statusRow}>
        <StatusPill
          theme={theme}
          tone={isMuted ? 'danger' : 'success'}
          text={isMuted ? (language === 'ar' ? 'الصوت مكتوم' : 'Voice muted') : (language === 'ar' ? 'الصوت نشط' : 'Voice active')}
        />
        <StatusPill
          theme={theme}
          text={language === 'ar' ? 'عربي / English' : 'Arabic / English'}
        />
      </View>

      <SectionHeader
        theme={theme}
        eyebrow={language === 'ar' ? 'الإعداد الأول' : 'First setup'}
        title={language === 'ar' ? 'اختر لغة الإرشاد' : 'Choose guidance language'}
      />

      <View style={styles.languageGrid}>
        <View style={styles.languageCell}>
          <ActionTile
            title="العربية"
            subtitle="صوت وتعليمات عربية"
            label="AR"
            theme={theme}
            selected={language === 'ar'}
            compact
            onPress={() => selectLanguage('ar')}
            accessibilityLabel="اللغة العربية"
            accessibilityHint="اضغط مرتين لتفعيل اللغة العربية"
          />
        </View>
        <View style={styles.languageCell}>
          <ActionTile
            title="English"
            subtitle="Spoken English guidance"
            label="EN"
            theme={theme}
            selected={language === 'en'}
            compact
            onPress={() => selectLanguage('en')}
            accessibilityLabel="English Language"
            accessibilityHint="Double tap to activate English"
          />
        </View>
      </View>

      <PrimaryButton
        theme={theme}
        title={language === 'ar' ? 'ابدأ الإعداد' : 'Start setup'}
        onPress={handleStart}
        accessibilityLabel={language === 'ar' ? 'ابدأ استخدام تطبيق بصيره' : 'Start Baseera application'}
        accessibilityHint={language === 'ar' ? 'اضغط مرتين للانتقال إلى شاشة الصلاحيات' : 'Double tap to proceed to permissions'}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 22,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  languageCell: {
    flexGrow: 1,
    flexBasis: 160,
    minWidth: 150,
  },
});
