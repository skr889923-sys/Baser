import React, { useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import VoiceService from '../src/services/VoiceService';
import HapticsService from '../src/services/HapticsService';

export default function SettingsScreen() {
  const router = useRouter();
  const { 
    language, 
    setLanguage, 
    isHighContrast, 
    toggleHighContrast, 
    routeTypePreference, 
    setRoutePreference 
  } = useNavigationStore();

  useEffect(() => {
    VoiceService.speak(
      language === 'ar'
        ? 'شاشة الإعدادات. يمكنك تعديل خيارات اللغة والتباين وتفضيلات الملاحة، أو تفعيل اختبار الصوت والاهتزاز بالأسفل.'
        : 'Settings screen. You can customize language, contrast, route choices, or trigger a test check below.'
    );
  }, [language]);

  const toggleLanguage = () => {
    const nextLang = language === 'ar' ? 'en' : 'ar';
    setLanguage(nextLang);
    VoiceService.setVoiceLanguage(nextLang);
    VoiceService.speak(
      nextLang === 'ar' ? 'تم تحويل التطبيق للغة العربية' : 'Application switched to English'
    );
  };

  const handleTestFeatures = () => {
    HapticsService.trigger('arrived');
    const msg = language === 'ar' 
      ? 'تم اختبار الصوت ونظام الاهتزاز بنجاح، التطبيق جاهز للعمل.' 
      : 'Speech synthesis and haptics system tested successfully. The app is ready.';
    VoiceService.speak(msg);
  };

  const handleBack = () => {
    HapticsService.trigger('continue');
    router.replace('/home');
  };

  const styles = getStyles(isHighContrast);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* 1. Language Toggle */}
      <View style={styles.settingCard}>
        <Text style={styles.cardTitle}>{language === 'ar' ? 'لغة التطبيق:' : 'Application Language:'}</Text>
        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={toggleLanguage}
          accessible={true}
          accessibilityLabel={language === 'ar' ? 'لغة التطبيق الحالية: العربية. اضغط للتحويل إلى الإنجليزية' : 'Current language: English. Tap to switch to Arabic'}
        >
          <Text style={styles.toggleBtnText}>
            🌐 {language === 'ar' ? 'العربية (اضغط للتحويل)' : 'English (Tap to switch)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. High Contrast Option */}
      <View style={styles.settingCard}>
        <Text style={styles.cardTitle}>{language === 'ar' ? 'وضع التباين العالي (Accessibility):' : 'High Contrast Mode:'}</Text>
        <TouchableOpacity
          style={[styles.toggleBtn, isHighContrast && styles.activeToggleBtn]}
          onPress={() => {
            toggleHighContrast();
            HapticsService.trigger('continue');
            VoiceService.speak(
              language === 'ar'
                ? `تم ${!isHighContrast ? 'تفعيل' : 'تعطيل'} وضع التباين العالي`
                : `High contrast mode ${!isHighContrast ? 'enabled' : 'disabled'}`
            );
          }}
          accessible={true}
          accessibilityLabel={language === 'ar' ? `وضع التباين العالي: ${isHighContrast ? 'نشط' : 'غير نشط'}` : `High contrast mode: ${isHighContrast ? 'On' : 'Off'}`}
        >
          <Text style={styles.toggleBtnText}>
            👁️ {isHighContrast ? (language === 'ar' ? 'تعطيل التباين العالي' : 'Disable High Contrast') : (language === 'ar' ? 'تفعيل التباين العالي' : 'Enable High Contrast')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Navigation Route Preference */}
      <View style={styles.settingCard}>
        <Text style={styles.cardTitle}>{language === 'ar' ? 'تفضيلات المسار الملاحي:' : 'Routing Preferences:'}</Text>
        <View style={styles.row}>
          {[
            { key: 'safe_accessible', ar: 'مهيأ وآمن', en: 'Accessible' },
            { key: 'fastest', ar: 'الأسرع', en: 'Fastest' }
          ].map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.subBtn, routeTypePreference === opt.key && styles.activeSubBtn]}
              onPress={() => {
                setRoutePreference(opt.key as any);
                HapticsService.trigger('continue');
                VoiceService.speak(
                  language === 'ar' ? `تم تفضيل المسار ${opt.ar}` : `Preferred route option: ${opt.en}`
                );
              }}
              accessible={true}
              accessibilityLabel={language === 'ar' ? `خيار المسار: ${opt.ar}` : `Routing choice: ${opt.en}`}
            >
              <Text style={styles.subBtnText}>
                {language === 'ar' ? opt.ar : opt.en}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 4. Test System Button */}
      <TouchableOpacity
        style={styles.testBtn}
        onPress={handleTestFeatures}
        accessible={true}
        accessibilityLabel={language === 'ar' ? 'بدء اختبار الصوت والاهتزاز' : 'Test voice and haptics feedback'}
      >
        <Text style={styles.testBtnText}>🔔 {language === 'ar' ? 'اختبر الصوت والاهتزاز' : 'Test Speech & Haptics'}</Text>
      </TouchableOpacity>

      {/* Save & Close */}
      <TouchableOpacity style={styles.saveBtn} onPress={handleBack}>
        <Text style={styles.saveBtnText}>{language === 'ar' ? 'حفظ وإغلاق' : 'Save & Exit'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const getStyles = (highContrast: boolean) => StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: highContrast ? '#000000' : '#121212',
    padding: 20,
    justifyContent: 'center',
  },
  settingCard: {
    backgroundColor: '#1E272C',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#34495E',
  },
  cardTitle: {
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  toggleBtn: {
    backgroundColor: '#2C3E50',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  activeToggleBtn: {
    backgroundColor: highContrast ? '#1A5F7A' : '#1F8A70',
  },
  toggleBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subBtn: {
    flex: 1,
    backgroundColor: '#2C3E50',
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  activeSubBtn: {
    backgroundColor: highContrast ? '#1A5F7A' : '#1F8A70',
  },
  subBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  testBtn: {
    backgroundColor: '#2E3133',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#4A5054',
    marginBottom: 32,
  },
  testBtnText: {
    color: '#FFFF00',
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveBtn: {
    backgroundColor: highContrast ? '#FFFF00' : '#1A5F7A',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    color: highContrast ? '#000000' : '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
});
