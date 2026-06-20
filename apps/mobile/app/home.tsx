import React, { useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import VoiceService from '../src/services/VoiceService';
import HapticsService from '../src/services/HapticsService';

export default function HomeScreen() {
  const router = useRouter();
  const { language, isHighContrast } = useNavigationStore();

  useEffect(() => {
    const speakWelcome = () => {
      const msg = language === 'ar'
        ? 'القائمة الرئيسية. الشاشة تحتوي على ستة أزرار كبيرة: اختر وجهتك، امسح الرمز، أين أنا، طوارئ، بلاغ عن عائق، والإعدادات.'
        : 'Main Menu. The screen contains six large buttons: Select Destination, Scan QR, Where Am I, Emergency, Report Obstacle, and Settings.';
      VoiceService.speak(msg);
    };

    speakWelcome();
  }, [language]);

  const navigateTo = (path: any, nameAr: string, nameEn: string) => {
    HapticsService.trigger('continue');
    const speakMsg = language === 'ar' ? `فتح ${nameAr}` : `Opening ${nameEn}`;
    VoiceService.speak(speakMsg);
    router.push(path);
  };

  const styles = getStyles(isHighContrast);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.grid}>
        {/* Button 1: Select Destination */}
        <TouchableOpacity
          style={[styles.tile, styles.primaryTile]}
          onPress={() => navigateTo('/destination', 'اختيار الوجهة', 'Select Destination')}
          accessible={true}
          accessibilityLabel={language === 'ar' ? 'اختر وجهتك' : 'Select your destination'}
          accessibilityHint={language === 'ar' ? 'اضغط مرتين لفتح قائمة المباني والكليات' : 'Double tap to search for buildings or classrooms'}
        >
          <Text style={styles.tileEmoji}>🎯</Text>
          <Text style={styles.tileText}>
            {language === 'ar' ? 'اختر وجهتك' : 'Select Destination'}
          </Text>
        </TouchableOpacity>

        {/* Button 2: Scan QR */}
        <TouchableOpacity
          style={[styles.tile, styles.secondaryTile]}
          onPress={() => navigateTo('/qr-scanner', 'مسح الرمز', 'Scan QR Code')}
          accessible={true}
          accessibilityLabel={language === 'ar' ? 'امسح رمز كيو أر' : 'Scan QR Code'}
          accessibilityHint={language === 'ar' ? 'اضغط مرتين لفتح الكاميرا ومسح الملصقات الإرشادية' : 'Double tap to open camera for scanning indoor QR codes'}
        >
          <Text style={styles.tileEmoji}>📷</Text>
          <Text style={styles.tileText}>
            {language === 'ar' ? 'امسح رمز QR' : 'Scan QR Code'}
          </Text>
        </TouchableOpacity>

        {/* Button 3: Where Am I */}
        <TouchableOpacity
          style={styles.tile}
          onPress={() => navigateTo('/where-am-i', 'شاشة تحديد موقعك', 'Where Am I')}
          accessible={true}
          accessibilityLabel={language === 'ar' ? 'أين أنا؟' : 'Where am I?'}
          accessibilityHint={language === 'ar' ? 'اضغط مرتين لسماع موقعك الحالي وأقرب المرافق إليك' : 'Double tap to hear your current location and nearest points'}
        >
          <Text style={styles.tileEmoji}>📍</Text>
          <Text style={styles.tileText}>
            {language === 'ar' ? 'أين أنا؟' : 'Where Am I?'}
          </Text>
        </TouchableOpacity>

        {/* Button 4: Emergency SOS */}
        <TouchableOpacity
          style={[styles.tile, styles.dangerTile]}
          onPress={() => navigateTo('/emergency', 'شاشة الطوارئ', 'Emergency SOS')}
          accessible={true}
          accessibilityLabel={language === 'ar' ? 'طلب مساعدة طوارئ' : 'Emergency Assistance'}
          accessibilityHint={language === 'ar' ? 'اضغط مرتين لطلب المساعدة العاجلة وإرسال موقعك للأمن' : 'Double tap to request immediate security or support assistance'}
        >
          <Text style={styles.tileEmoji}>🚨</Text>
          <Text style={[styles.tileText, styles.dangerText]}>
            {language === 'ar' ? 'طوارئ SOS' : 'Emergency SOS'}
          </Text>
        </TouchableOpacity>

        {/* Button 5: Report Obstacle */}
        <TouchableOpacity
          style={styles.tile}
          onPress={() => navigateTo('/report', 'إبلاغ عن عائق', 'Report Obstacle')}
          accessible={true}
          accessibilityLabel={language === 'ar' ? 'بلاغ عن عائق' : 'Report an obstacle'}
          accessibilityHint={language === 'ar' ? 'اضغط مرتين لتقديم بلاغ عن طريق مغلق أو أعمال صيانة' : 'Double tap to report closed pathways or blocked areas'}
        >
          <Text style={styles.tileEmoji}>⚠️</Text>
          <Text style={styles.tileText}>
            {language === 'ar' ? 'بلاغ عن عائق' : 'Report Obstacle'}
          </Text>
        </TouchableOpacity>

        {/* Button 6: Settings */}
        <TouchableOpacity
          style={styles.tile}
          onPress={() => navigateTo('/settings', 'الإعدادات', 'Settings')}
          accessible={true}
          accessibilityLabel={language === 'ar' ? 'الإعدادات والخيارات' : 'Application Settings'}
          accessibilityHint={language === 'ar' ? 'اضغط مرتين لتعديل سرعة الصوت، الاهتزاز، أو التباين' : 'Double tap to configure speech rate, vibration, or contrast'}
        >
          <Text style={styles.tileEmoji}>⚙️</Text>
          <Text style={styles.tileText}>
            {language === 'ar' ? 'الإعدادات' : 'Settings'}
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
    padding: 16,
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: '48%',
    backgroundColor: '#1E272C',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#34495E',
    justifyContent: 'center',
  },
  primaryTile: {
    borderColor: highContrast ? '#FFFF00' : '#1A5F7A',
    backgroundColor: highContrast ? '#1A5F7A' : '#15333F',
  },
  secondaryTile: {
    borderColor: highContrast ? '#FFFF00' : '#1F8A70',
    backgroundColor: highContrast ? '#1F8A70' : '#143C34',
  },
  dangerTile: {
    borderColor: '#E74C3C',
    backgroundColor: '#3C1F1F',
    borderWidth: 3,
  },
  tileEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  tileText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dangerText: {
    color: '#E74C3C',
  },
});
