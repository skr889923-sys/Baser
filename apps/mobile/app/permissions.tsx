import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import VoiceService from '../src/services/VoiceService';
import * as Location from 'expo-location';
import { useCameraPermissions } from 'expo-camera';
import {
  ActionTile,
  getInterfaceTheme,
  HeroPanel,
  PrimaryButton,
  ScreenShell,
  StatusPill,
} from '../src/components/BlindInterface';

export default function PermissionsScreen() {
  const router = useRouter();
  const { language, isHighContrast } = useNavigationStore();
  const theme = getInterfaceTheme(isHighContrast);

  const [locationGranted, setLocationGranted] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const cameraGranted = cameraPermission?.granted ?? false;

  useEffect(() => {
    const msg = language === 'ar'
      ? 'شاشة الصلاحيات. فعّل الموقع لتحديد نقطة البداية، وفعّل الكاميرا لمسح رموز الملاحة داخل المباني.'
      : 'Permissions screen. Enable location to identify the start point, and camera to scan indoor navigation tags.';
    VoiceService.speak(msg);
  }, [language]);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setLocationGranted(granted);
      VoiceService.speak(
        granted
          ? (language === 'ar' ? 'تم منح صلاحية الموقع بنجاح' : 'Location permission granted successfully')
          : (language === 'ar' ? 'تم رفض صلاحية الموقع' : 'Location permission denied')
      );
    } catch (err) {
      console.warn('Location request error', err);
    }
  };

  const requestCamera = async () => {
    try {
      const result = await requestCameraPermission();
      VoiceService.speak(
        result.granted
          ? (language === 'ar' ? 'تم منح صلاحية الكاميرا بنجاح' : 'Camera permission granted successfully')
          : (language === 'ar' ? 'تم رفض صلاحية الكاميرا' : 'Camera permission denied')
      );
    } catch (err) {
      console.warn('Camera request error', err);
    }
  };

  const handleContinue = () => {
    VoiceService.stop();
    router.replace('/home');
  };

  return (
    <ScreenShell highContrast={isHighContrast}>
      <HeroPanel
        theme={theme}
        eyebrow={language === 'ar' ? 'إعداد الوصول' : 'Access setup'}
        title={language === 'ar' ? 'فعّل أدوات الملاحة' : 'Enable navigation tools'}
        subtitle={
          language === 'ar'
            ? 'بصيره يعمل بالصوت أولاً، ويحتاج هذه الصلاحيات لبناء مسار دقيق وآمن.'
            : 'Baseera is voice-first and needs these permissions to build accurate, safe guidance.'
        }
        code="PERM"
      />

      <View style={styles.statusRow}>
        <StatusPill
          theme={theme}
          tone={locationGranted ? 'success' : 'warning'}
          text={locationGranted ? (language === 'ar' ? 'الموقع مفعل' : 'Location enabled') : (language === 'ar' ? 'الموقع مطلوب' : 'Location needed')}
        />
        <StatusPill
          theme={theme}
          tone={cameraGranted ? 'success' : 'warning'}
          text={cameraGranted ? (language === 'ar' ? 'الكاميرا مفعلة' : 'Camera enabled') : (language === 'ar' ? 'الكاميرا مطلوبة' : 'Camera needed')}
        />
      </View>

      <ActionTile
        title={language === 'ar' ? 'تحديد الموقع' : 'Location access'}
        subtitle={
          language === 'ar'
            ? 'يساعد على معرفة أقرب نقطة ملاحية وتسجيل موقع الطوارئ والبلاغات.'
            : 'Used to find the nearest navigation point and attach location to SOS and reports.'
        }
        label="GPS"
        theme={theme}
        selected={locationGranted}
        onPress={requestLocation}
        accessibilityLabel={
          language === 'ar'
            ? `صلاحية الموقع. الحالة: ${locationGranted ? 'تم المنح' : 'مطلوبة'}`
            : `Location permission. Status: ${locationGranted ? 'Granted' : 'Required'}`
        }
        accessibilityHint={language === 'ar' ? 'اضغط مرتين لمنح صلاحية الموقع' : 'Double tap to grant location access'}
      />

      <ActionTile
        title={language === 'ar' ? 'كاميرا رموز QR' : 'QR camera access'}
        subtitle={
          language === 'ar'
            ? 'تحدد موقعك داخل المبنى عند مسح الملصقات الإرشادية.'
            : 'Identifies your indoor position when scanning guidance tags.'
        }
        label="QR"
        theme={theme}
        selected={cameraGranted}
        onPress={requestCamera}
        accessibilityLabel={
          language === 'ar'
            ? `صلاحية الكاميرا. الحالة: ${cameraGranted ? 'تم المنح' : 'مطلوبة'}`
            : `Camera permission. Status: ${cameraGranted ? 'Granted' : 'Required'}`
        }
        accessibilityHint={language === 'ar' ? 'اضغط مرتين لمنح صلاحية الكاميرا' : 'Double tap to grant camera access'}
      />

      <PrimaryButton
        theme={theme}
        title={language === 'ar' ? 'متابعة إلى مركز التحكم' : 'Continue to command hub'}
        onPress={handleContinue}
        accessibilityLabel={language === 'ar' ? 'متابعة إلى القائمة الرئيسية' : 'Continue to main menu'}
        accessibilityHint={language === 'ar' ? 'اضغط مرتين لفتح التطبيق' : 'Double tap to open the application'}
      />
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
});
