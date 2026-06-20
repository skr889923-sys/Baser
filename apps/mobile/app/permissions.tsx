import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import VoiceService from '../src/services/VoiceService';
import * as Location from 'expo-location';
import { useCameraPermissions } from 'expo-camera';

export default function PermissionsScreen() {
  const router = useRouter();
  const { language, isHighContrast } = useNavigationStore();

  const [locationGranted, setLocationGranted] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const cameraGranted = cameraPermission?.granted ?? false;

  useEffect(() => {
    const speakInstructions = () => {
      const msg = language === 'ar'
        ? 'شاشة الصلاحيات. التطبيق يتطلب صلاحية الموقع لتحديد مسارك، وصلاحية الكاميرا لمسح الرموز. اضغط على الأزرار لمنح الصلاحية ثم اضغط زر المتابعة.'
        : 'Permissions screen. The application requires location access for path planning, and camera access for scanning. Tap the buttons to grant permissions, then tap continue.';
      VoiceService.speak(msg);
    };

    speakInstructions();
  }, [language]);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationGranted(true);
        const msg = language === 'ar' ? 'تم منح صلاحية الموقع بنجاح' : 'Location permission granted successfully';
        VoiceService.speak(msg);
      } else {
        const msg = language === 'ar' ? 'تم رفض صلاحية الموقع' : 'Location permission denied';
        VoiceService.speak(msg);
      }
    } catch (err) {
      console.warn("Location request error", err);
    }
  };

  const requestCamera = async () => {
    try {
      const result = await requestCameraPermission();
      if (result.granted) {
        const msg = language === 'ar' ? 'تم منح صلاحية الكاميرا بنجاح' : 'Camera permission granted successfully';
        VoiceService.speak(msg);
      } else {
        const msg = language === 'ar' ? 'تم رفض صلاحية الكاميرا' : 'Camera permission denied';
        VoiceService.speak(msg);
      }
    } catch (err) {
      console.warn("Camera request error", err);
    }
  };

  const handleContinue = () => {
    VoiceService.stop();
    router.replace('/home');
  };

  const styles = getStyles(isHighContrast);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>
        {language === 'ar' ? 'تفعيل الصلاحيات' : 'Enable Permissions'}
      </Text>

      <Text style={styles.intro}>
        {language === 'ar' 
          ? 'يحتاج التطبيق للصلاحيات التالية لمساعدتك على التنقل بشكل مستقل وآمن.' 
          : 'The app needs these permissions to guide you safely and independently.'}
      </Text>

      {/* Location Permission Box */}
      <TouchableOpacity
        style={[styles.permissionBox, locationGranted && styles.grantedBox]}
        onPress={requestLocation}
        accessible={true}
        accessibilityLabel={
          language === 'ar'
            ? `صلاحية الموقع. الحالة: ${locationGranted ? 'تم المنح' : 'مطلوبة'}`
            : `Location permission. Status: ${locationGranted ? 'Granted' : 'Required'}`
        }
        accessibilityHint={
          language === 'ar'
            ? 'اضغط مرتين لمنح صلاحية تحديد الموقع الجغرافي للحرم'
            : 'Double tap to grant access to campus GPS location'
        }
      >
        <Text style={styles.boxTitle}>
          {language === 'ar' ? '📍 تحديد الموقع (GPS)' : '📍 GPS Location'}
        </Text>
        <Text style={styles.boxDescription}>
          {language === 'ar'
            ? 'مطلوب لتحديد موقعك في الساحات الخارجية وتوجيهك خطوة بخطوة.'
            : 'Required to track your position outdoors and guide you step-by-step.'}
        </Text>
        <Text style={styles.statusText}>
          {locationGranted 
            ? (language === 'ar' ? '✓ تم التفعيل' : '✓ Enabled') 
            : (language === 'ar' ? 'اضغط للتفعيل' : 'Tap to Enable')}
        </Text>
      </TouchableOpacity>

      {/* Camera Permission Box */}
      <TouchableOpacity
        style={[styles.permissionBox, cameraGranted && styles.grantedBox]}
        onPress={requestCamera}
        accessible={true}
        accessibilityLabel={
          language === 'ar'
            ? `صلاحية الكاميرا. الحالة: ${cameraGranted ? 'تم المنح' : 'مطلوبة'}`
            : `Camera permission. Status: ${cameraGranted ? 'Granted' : 'Required'}`
        }
        accessibilityHint={
          language === 'ar'
            ? 'اضغط مرتين لمنح صلاحية الكاميرا لمسح الرموز داخل المباني'
            : 'Double tap to grant camera access to scan anchors indoors'
        }
      >
        <Text style={styles.boxTitle}>
          {language === 'ar' ? '📷 الكاميرا (مسح الرموز)' : '📷 Camera (QR Scan)'}
        </Text>
        <Text style={styles.boxDescription}>
          {language === 'ar'
            ? 'مطلوب لمسح ملصقات الرموز داخل المباني لمعرفة موقعك الدقيق.'
            : 'Required to scan QR tags inside buildings to pinpoint your location.'}
        </Text>
        <Text style={styles.statusText}>
          {cameraGranted 
            ? (language === 'ar' ? '✓ تم التفعيل' : '✓ Enabled') 
            : (language === 'ar' ? 'اضغط للتفعيل' : 'Tap to Enable')}
        </Text>
      </TouchableOpacity>

      {/* Continue Button */}
      <TouchableOpacity
        style={styles.continueBtn}
        onPress={handleContinue}
        accessible={true}
        accessibilityLabel={language === 'ar' ? 'متابعة إلى القائمة الرئيسية' : 'Continue to main menu'}
        accessibilityHint={
          language === 'ar' 
            ? 'اضغط مرتين لفتح التطبيق' 
            : 'Double tap to open the dashboard'
        }
      >
        <Text style={styles.continueBtnText}>
          {language === 'ar' ? 'متابعة' : 'Continue'}
        </Text>
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
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  intro: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  permissionBox: {
    backgroundColor: '#1E272C',
    borderWidth: 2,
    borderColor: '#34495E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  grantedBox: {
    borderColor: highContrast ? '#FFFF00' : '#1F8A70',
    backgroundColor: '#153E35',
  },
  boxTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  boxDescription: {
    fontSize: 15,
    color: '#CCCCCC',
    lineHeight: 22,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFF00',
    textAlign: 'right',
  },
  continueBtn: {
    backgroundColor: highContrast ? '#FFFF00' : '#1A5F7A',
    paddingVertical: 22,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  continueBtnText: {
    color: highContrast ? '#000000' : '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
});
