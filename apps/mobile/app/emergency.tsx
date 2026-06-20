import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import SupabaseService from '../src/services/SupabaseService';
import VoiceService from '../src/services/VoiceService';
import HapticsService from '../src/services/HapticsService';

export default function EmergencyScreen() {
  const router = useRouter();
  const { language, isHighContrast } = useNavigationStore();
  
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    VoiceService.speak(
      language === 'ar'
        ? 'شاشة طوارئ الأمن الجامعي. هل تحتاج لمساعدة عاجلة؟ اضغط مرتين على الزر الأحمر في منتصف الشاشة لتأكيد إرسال موقعك ورسالتك.'
        : 'Emergency SOS screen. Do you need immediate assistance? Double tap the red button in the center to send your location to security.'
    );

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [language, intervalId]);

  const handleConfirmSOS = async () => {
    if (confirmed) return;
    
    setSubmitting(true);
    HapticsService.trigger('emergency');

    try {
      // Create a mock SOS trigger
      await SupabaseService.submitEmergency({
        user_id: null,
        latitude: 30.622971, // Suez Canal University coordinates
        longitude: 32.269073,
        nearest_point_id: null,
        nearest_building_id: null,
        message: language === 'ar' ? 'طالب كفيف يحتاج مساعدة عند بوابة المشاة الرئيسية' : 'Visually impaired student needs assistance at main gate'
      });

      setConfirmed(true);
      
      const vocalText = language === 'ar'
        ? 'تم إرسال بلاغ الطوارئ للأمن الجامعي. تم تحديد موقعك عند بوابة الحرم الرئيسية. سيتم التواصل معك أو إرسال دورية فورًا. يرجى البقاء في مكانك.'
        : 'Emergency request sent to campus security. Your position is marked at Main Gate. Help is on the way. Please stay in your current location.';
      
      VoiceService.speak(vocalText);

      // Start a repeating pulse vibration to indicate active rescue beacon
      const id = setInterval(() => {
        HapticsService.trigger('emergency');
      }, 3000);
      setIntervalId(id);

    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSOS = () => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    
    HapticsService.trigger('continue');
    VoiceService.speak(language === 'ar' ? 'تم إلغاء طلب الطوارئ. الرجوع للرئيسية.' : 'Emergency request cancelled. Returning home.');
    router.replace('/home');
  };

  const styles = getStyles(isHighContrast);

  return (
    <View style={styles.container}>
      {!confirmed ? (
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.sosButton}
            onPress={handleConfirmSOS}
            accessible={true}
            accessibilityLabel={language === 'ar' ? 'تأكيد طلب المساعدة العاجلة وإرسال الموقع' : 'Confirm SOS request and send location'}
            accessibilityHint={language === 'ar' ? 'اضغط مرتين لتنبيه الأمن الجامعي فورًا' : 'Double tap to alert campus security immediately'}
          >
            {submitting ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.sosEmoji}>🚨</Text>
                <Text style={styles.sosBtnText}>
                  {language === 'ar' ? 'اضغط لتأكيد طلب المساعدة' : 'Tap to Confirm SOS'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelSOS}>
            <Text style={styles.cancelBtnText}>
              {language === 'ar' ? 'إلغاء وتراجع' : 'Cancel & Go Back'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.beaconActiveCard}>
            <Text style={styles.beaconEmoji}>📡</Text>
            <Text style={styles.beaconTitle}>
              {language === 'ar' ? 'منارة الطوارئ نشطة!' : 'SOS Beacon Active!'}
            </Text>
            <Text style={styles.beaconDescription}>
              {language === 'ar'
                ? 'تم إرسال إحداثياتك بنجاح. سنقوم بإصدار اهتزازات متكررة لمساعدتنا على الوصول إليك.'
                : 'Your coordinates have been shared. We are pulsing vibrations to guide responders to you.'}
            </Text>
            
            <View style={styles.locationSummary}>
              <Text style={styles.locLabel}>{language === 'ar' ? 'الموقع المشترك:' : 'Shared Location:'}</Text>
              <Text style={styles.locVal}>{language === 'ar' ? 'بوابة الحرم الرئيسية' : 'Main Campus Gate'}</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.cancelBtn, styles.stopBeaconBtn]} onPress={handleCancelSOS}>
            <Text style={styles.stopBeaconText}>
              {language === 'ar' ? 'إيقاف المنارة وإلغاء الطلب' : 'Stop Beacon & Cancel'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const getStyles = (highContrast: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: highContrast ? '#000000' : '#121212',
    padding: 24,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  sosButton: {
    backgroundColor: '#C0392B',
    width: 280,
    height: 280,
    borderRadius: 140,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 8,
    borderColor: '#E74C3C',
    shadowColor: '#C0392B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 12,
    marginBottom: 40,
  },
  sosEmoji: {
    fontSize: 72,
    marginBottom: 8,
  },
  sosBtnText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  cancelBtn: {
    backgroundColor: '#2E3133',
    paddingVertical: 18,
    width: '100%',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4A5054',
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  beaconActiveCard: {
    backgroundColor: '#1E272C',
    borderRadius: 24,
    padding: 24,
    borderWidth: 3,
    borderColor: '#C0392B',
    alignItems: 'center',
    width: '100%',
    marginBottom: 40,
  },
  beaconEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  beaconTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginBottom: 12,
  },
  beaconDescription: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  locationSummary: {
    backgroundColor: '#161E22',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  locLabel: {
    fontSize: 12,
    color: '#FFFF00',
    fontWeight: 'bold',
  },
  locVal: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginTop: 4,
  },
  stopBeaconBtn: {
    backgroundColor: '#C0392B',
    borderColor: '#E74C3C',
  },
  stopBeaconText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
