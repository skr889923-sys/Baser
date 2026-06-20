import React, { useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import VoiceService from '../src/services/VoiceService';

export default function WelcomeScreen() {
  const router = useRouter();
  const { language, setLanguage, isHighContrast } = useNavigationStore();

  useEffect(() => {
    // Vocal welcome message when screen loads
    const timer = setTimeout(() => {
      VoiceService.speak(
        'مرحبًا بك في تطبيق بصير للملاحة الجامعية. اضغط في منتصف الشاشة لاختيار اللغة، أو اضغط أسفل الشاشة للبدء.'
      );
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const selectLanguage = (lang: 'ar' | 'en') => {
    setLanguage(lang);
    VoiceService.setVoiceLanguage(lang);
    if (lang === 'ar') {
      VoiceService.speak('تم تفعيل اللغة العربية');
    } else {
      VoiceService.speak('English language activated');
    }
  };

  const handleStart = () => {
    VoiceService.stop();
    router.push('/permissions');
  };

  const styles = getStyles(isHighContrast);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          بصير | Baser
        </Text>
        <Text style={styles.subtitle}>
          {language === 'ar' 
            ? 'مساعدك الملاحي الصوتي الذكي داخل الحرم الجامعي' 
            : 'Your smart audio navigation assistant on campus'}
        </Text>

        <View style={styles.languageSection}>
          <Text style={styles.sectionLabel} accessibilityLabel="اختر اللغة، Choose language">
            {language === 'ar' ? 'اختر اللغة / Select Language' : 'Select Language / اختر اللغة'}
          </Text>
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.langBtn, language === 'ar' && styles.activeLangBtn]}
              onPress={() => selectLanguage('ar')}
              accessible={true}
              accessibilityLabel="اللغة العربية"
              accessibilityHint="اضغط مرتين لتفعيل اللغة العربية"
              accessibilityState={{ selected: language === 'ar' }}
            >
              <Text style={styles.langBtnText}>العربية</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.langBtn, language === 'en' && styles.activeLangBtn]}
              onPress={() => selectLanguage('en')}
              accessible={true}
              accessibilityLabel="English Language"
              accessibilityHint="Double tap to activate English language"
              accessibilityState={{ selected: language === 'en' }}
            >
              <Text style={styles.langBtnText}>English</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.startBtn}
          onPress={handleStart}
          accessible={true}
          accessibilityLabel={language === 'ar' ? 'ابدأ الاستخدام' : 'Start Application'}
          accessibilityHint={language === 'ar' ? 'اضغط مرتين للانتقال إلى شاشة الصلاحيات' : 'Double tap to proceed to permissions screen'}
        >
          <Text style={styles.startBtnText}>
            {language === 'ar' ? 'البدء' : 'Start'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const getStyles = (highContrast: boolean) => StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: highContrast ? '#000000' : '#121212',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: highContrast ? '#FFFF00' : '#1A5F7A',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    color: '#E0E0E0',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 28,
  },
  languageSection: {
    width: '100%',
    marginBottom: 48,
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 18,
    color: '#B0B0B0',
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  langBtn: {
    flex: 1,
    backgroundColor: '#2C3E50',
    paddingVertical: 20,
    marginHorizontal: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#34495E',
    alignItems: 'center',
  },
  activeLangBtn: {
    borderColor: highContrast ? '#FFFF00' : '#1A5F7A',
    backgroundColor: highContrast ? '#1A5F7A' : '#1F8A70',
  },
  langBtnText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  startBtn: {
    width: '100%',
    backgroundColor: highContrast ? '#FFFF00' : '#1A5F7A',
    paddingVertical: 24,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  startBtnText: {
    color: highContrast ? '#000000' : '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
});
