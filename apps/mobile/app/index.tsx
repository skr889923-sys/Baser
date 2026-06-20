import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import VoiceService from '../src/services/VoiceService';
import {
  ActionTile,
  getInterfaceTheme,
  HeroPanel,
  PrimaryButton,
  ScreenShell,
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
        eyebrow={language === 'ar' ? 'ملاحة داخلية صوتية' : 'Voice indoor navigation'}
        title={language === 'ar' ? 'بصيره ترى المكان بصوت واضح' : 'Baseera turns place into clear audio'}
        subtitle={
          language === 'ar'
            ? 'مسح QR، تعليمات خطوة بخطوة، اهتزازات إرشادية، واستجابة طوارئ في واجهة واحدة.'
            : 'QR anchors, turn-by-turn speech, haptic cues, and emergency response in one focused interface.'
        }
        code="A11Y"
      />

      <View style={styles.statusRow}>
        <StatusPill
          theme={theme}
          tone={isMuted ? 'danger' : 'success'}
          text={isMuted ? (language === 'ar' ? 'الصوت مكتوم' : 'Voice muted') : (language === 'ar' ? 'الصوت نشط' : 'Voice active')}
        />
        <StatusPill
          theme={theme}
          text={language === 'ar' ? 'جاهز للمسح' : 'Scan ready'}
        />
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {language === 'ar' ? 'اختر لغة التشغيل' : 'Choose operating language'}
      </Text>

      <View style={styles.languageGrid}>
        <ActionTile
          title="العربية"
          subtitle="توجيه صوتي عربي كامل"
          label="AR"
          theme={theme}
          selected={language === 'ar'}
          compact
          onPress={() => selectLanguage('ar')}
          accessibilityLabel="اللغة العربية"
          accessibilityHint="اضغط مرتين لتفعيل اللغة العربية"
        />
        <ActionTile
          title="English"
          subtitle="Full English guidance"
          label="EN"
          theme={theme}
          selected={language === 'en'}
          compact
          onPress={() => selectLanguage('en')}
          accessibilityLabel="English Language"
          accessibilityHint="Double tap to activate English"
        />
      </View>

      <PrimaryButton
        theme={theme}
        title={language === 'ar' ? 'بدء تجربة بصيره' : 'Start Baseera'}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  languageGrid: {
    gap: 12,
    marginBottom: 10,
  },
});
