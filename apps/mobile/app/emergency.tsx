import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import SupabaseService from '../src/services/SupabaseService';
import VoiceService from '../src/services/VoiceService';
import HapticsService from '../src/services/HapticsService';
import NavigationService from '../src/services/NavigationService';
import * as Location from 'expo-location';
import {
  getInterfaceTheme,
  HeroPanel,
  PrimaryButton,
  ScreenShell,
  SignalGlyph,
  StatusPill,
  surfaceStyle,
} from '../src/components/BlindInterface';

export default function EmergencyScreen() {
  const router = useRouter();
  const { language, isHighContrast } = useNavigationStore();
  const theme = getInterfaceTheme(isHighContrast);

  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [intervalId, setIntervalId] = useState<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    VoiceService.speak(
      language === 'ar'
        ? 'شاشة الطوارئ. اضغط زر تأكيد طلب المساعدة لإرسال موقعك للأمن الجامعي.'
        : 'Emergency screen. Press confirm help request to send your location to campus security.'
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
      let latitude = 30.622971;
      let longitude = 32.269073;
      let nearestPointId: string | null = null;
      let nearestBuildingId: string | null = null;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const currentLocation = await Location.getCurrentPositionAsync({});
          latitude = currentLocation.coords.latitude;
          longitude = currentLocation.coords.longitude;

          const nearestPoint = await NavigationService.getNearestPoint(latitude, longitude);
          nearestPointId = nearestPoint?.id || null;
          nearestBuildingId = nearestPoint?.building_id || null;
        }
      } catch (locationError) {
        console.warn('[EmergencyScreen] Falling back to default SOS coordinates:', locationError);
      }

      await SupabaseService.submitEmergency({
        user_id: null,
        latitude,
        longitude,
        nearest_point_id: nearestPointId,
        nearest_building_id: nearestBuildingId,
        message: language === 'ar' ? 'مستخدم كفيف يحتاج مساعدة عاجلة' : 'Blind user needs urgent assistance',
      });

      setConfirmed(true);
      VoiceService.speak(
        language === 'ar'
          ? 'تم إرسال بلاغ الطوارئ للأمن الجامعي. يرجى البقاء في مكانك. سيتم تفعيل اهتزازات متكررة لمساعدة فريق الاستجابة.'
          : 'Emergency request sent to campus security. Please stay where you are. Repeating vibrations are active for responders.'
      );

      const id = setInterval(() => {
        HapticsService.trigger('emergency');
      }, 3000);
      setIntervalId(id);
    } catch (error) {
      console.error(error);
      VoiceService.speak(language === 'ar' ? 'تعذر إرسال طلب الطوارئ.' : 'Could not send emergency request.');
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

  return (
    <ScreenShell highContrast={isHighContrast}>
      <HeroPanel
        theme={theme}
        eyebrow={language === 'ar' ? 'قناة استجابة عاجلة' : 'Urgent response channel'}
        title={confirmed ? (language === 'ar' ? 'منارة الطوارئ نشطة' : 'SOS beacon is active') : (language === 'ar' ? 'هل تحتاج مساعدة؟' : 'Do you need help?')}
        subtitle={
          confirmed
            ? (language === 'ar' ? 'تم إرسال موقعك. ابق في مكانك واستمع لأي تعليمات صوتية.' : 'Your location was shared. Stay in place and listen for instructions.')
            : (language === 'ar' ? 'سيتم إرسال موقعك وآخر نقطة قريبة إلى فريق الأمن.' : 'Your position and nearest known point will be sent to the security team.')
        }
        code="SOS"
      />

      {!confirmed ? (
        <View style={[styles.sosPanel, surfaceStyle(theme)]}>
          <SignalGlyph label="SOS" theme={theme} danger />
          <Text style={[styles.sosTitle, { color: theme.text }]}>
            {language === 'ar' ? 'تأكيد الإرسال مطلوب' : 'Confirmation required'}
          </Text>
          <Text style={[styles.sosDescription, { color: theme.textMuted }]}>
            {language === 'ar'
              ? 'اضغط الزر الأحمر فقط عند الحاجة لمساعدة عاجلة داخل الحرم أو المبنى.'
              : 'Press the red button only when you need urgent assistance on campus or inside a building.'}
          </Text>
          <PrimaryButton
            theme={theme}
            title={submitting ? (language === 'ar' ? 'جاري الإرسال...' : 'Sending...') : (language === 'ar' ? 'تأكيد طلب المساعدة' : 'Confirm help request')}
            onPress={handleConfirmSOS}
            variant="danger"
            disabled={submitting}
            accessibilityLabel={language === 'ar' ? 'تأكيد طلب المساعدة العاجلة وإرسال الموقع' : 'Confirm SOS request and send location'}
            accessibilityHint={language === 'ar' ? 'اضغط مرتين لتنبيه الأمن الجامعي فوراً' : 'Double tap to alert campus security immediately'}
          />
          {submitting ? <ActivityIndicator size="small" color={theme.danger} /> : null}
        </View>
      ) : (
        <View style={[styles.sosPanel, surfaceStyle(theme), { borderColor: theme.danger }]}>
          <View style={styles.statusRow}>
            <StatusPill theme={theme} tone="danger" text={language === 'ar' ? 'الطلب مرسل' : 'Request sent'} />
            <StatusPill theme={theme} tone="warning" text={language === 'ar' ? 'الاهتزاز نشط' : 'Pulse active'} />
          </View>
          <Text style={[styles.sosTitle, { color: theme.danger }]}>
            {language === 'ar' ? 'ابق في مكانك' : 'Stay in place'}
          </Text>
          <Text style={[styles.sosDescription, { color: theme.textMuted }]}>
            {language === 'ar'
              ? 'تمت مشاركة الإحداثيات. سيستمر التطبيق بإصدار اهتزازات دورية حتى إيقاف المنارة.'
              : 'Coordinates are shared. The app will keep pulsing until the beacon is stopped.'}
          </Text>
        </View>
      )}

      <PrimaryButton
        theme={theme}
        title={confirmed ? (language === 'ar' ? 'إيقاف المنارة وإلغاء الطلب' : 'Stop beacon and cancel') : (language === 'ar' ? 'إلغاء ورجوع' : 'Cancel and go back')}
        onPress={handleCancelSOS}
        variant={confirmed ? 'danger' : 'ghost'}
        accessibilityLabel={language === 'ar' ? 'إلغاء طلب الطوارئ' : 'Cancel emergency request'}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  sosPanel: {
    borderWidth: 1.5,
    borderRadius: 28,
    padding: 22,
    alignItems: 'center',
    marginBottom: 14,
  },
  sosTitle: {
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  sosDescription: {
    fontSize: 16,
    lineHeight: 25,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 22,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
});
