import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import NavigationService from '../src/services/NavigationService';
import VoiceService from '../src/services/VoiceService';
import HapticsService from '../src/services/HapticsService';
import * as Location from 'expo-location';
import { NavigationPoint } from '@baser/types';
import {
  getInterfaceTheme,
  HeroPanel,
  MetricCard,
  PrimaryButton,
  ScreenShell,
  StatusPill,
  surfaceStyle,
} from '../src/components/BlindInterface';

export default function WhereAmIScreen() {
  const router = useRouter();
  const { language, isHighContrast } = useNavigationStore();
  const theme = getInterfaceTheme(isHighContrast);

  const [nearestPoint, setNearestPoint] = useState<NavigationPoint | null>(null);
  const [distance, setDistance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const locateUser = async () => {
      setLoading(true);
      setError('');
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          const text = language === 'ar' ? 'نحتاج صلاحية الموقع لتحديد مكانك.' : 'Location permission is required.';
          setError(text);
          VoiceService.speak(text);
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        const coords = location.coords;
        const point = await NavigationService.getNearestPoint(coords.latitude, coords.longitude);

        if (!point) {
          const text = language === 'ar' ? 'تعذر تحديد أقرب نقطة ملاحية.' : 'Could not identify the nearest navigation point.';
          setError(text);
          VoiceService.speak(text);
          return;
        }

        setNearestPoint(point);

        let computedDistance = 0;
        if (point.latitude && point.longitude) {
          computedDistance = Math.round(NavigationService.getDistance(
            coords.latitude,
            coords.longitude,
            point.latitude,
            point.longitude
          ));
          setDistance(computedDistance);
        }

        const name = language === 'ar' ? point.name_ar : point.name_en;
        const desc = language === 'ar' ? point.description_ar : point.description_en;
        VoiceService.speak(
          language === 'ar'
            ? `أنت الآن بالقرب من ${name}. ${desc}. على بعد حوالي ${computedDistance} متر.`
            : `You are currently near ${name}. ${desc}. Approximately ${computedDistance} meters away.`
        );
      } catch (err) {
        console.error('Location error:', err);
        const text = language === 'ar' ? 'تعذر جلب موقعك الحالي.' : 'Failed to retrieve your current location.';
        setError(text);
        VoiceService.speak(text);
      } finally {
        setLoading(false);
      }
    };

    locateUser();
  }, [language]);

  const handleRouteToClosest = () => {
    if (nearestPoint) {
      router.push({
        pathname: '/details',
        params: { pointId: nearestPoint.id },
      });
    }
  };

  const repeatLocation = () => {
    HapticsService.trigger('continue');
    if (nearestPoint) {
      const name = language === 'ar' ? nearestPoint.name_ar : nearestPoint.name_en;
      VoiceService.speak(language === 'ar' ? `كرر الموقع: أنت بالقرب من ${name}` : `Location repeat: you are near ${name}`);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>
          {language === 'ar' ? 'جاري تحديد أقرب نقطة...' : 'Finding nearest point...'}
        </Text>
      </View>
    );
  }

  return (
    <ScreenShell highContrast={isHighContrast}>
      <HeroPanel
        theme={theme}
        eyebrow={language === 'ar' ? 'تحديد الموقع' : 'Position lock'}
        title={nearestPoint ? (language === 'ar' ? nearestPoint.name_ar : nearestPoint.name_en) : (language === 'ar' ? 'لم يتم تحديد الموقع' : 'Location unavailable')}
        subtitle={
          nearestPoint
            ? (language === 'ar' ? nearestPoint.description_ar : nearestPoint.description_en)
            : error
        }
        code="GPS"
      />

      {nearestPoint ? (
        <>
          <View style={styles.metricsRow}>
            <MetricCard
              theme={theme}
              value={`${distance} ${language === 'ar' ? 'م' : 'm'}`}
              label={language === 'ar' ? 'المسافة التقريبية' : 'Estimated distance'}
            />
            <MetricCard
              theme={theme}
              value={nearestPoint.is_accessible ? 'OK' : 'STD'}
              label={language === 'ar' ? 'تهيئة الوصول' : 'Access status'}
              tone={nearestPoint.is_accessible ? 'success' : 'warning'}
            />
          </View>

          <View style={[styles.panel, surfaceStyle(theme)]}>
            <View style={styles.statusRow}>
              <StatusPill
                theme={theme}
                tone={nearestPoint.is_accessible ? 'success' : 'warning'}
                text={nearestPoint.is_accessible ? (language === 'ar' ? 'نقطة مهيأة' : 'Accessible point') : (language === 'ar' ? 'نقطة عادية' : 'Standard point')}
              />
              <StatusPill theme={theme} text={nearestPoint.type.toUpperCase()} />
            </View>
            <Text style={[styles.panelText, { color: theme.textMuted }]}>
              {language === 'ar'
                ? 'استخدم زر تكرار الصوت إذا احتجت سماع الموقع مرة أخرى، أو خطط مساراً من هذه النقطة.'
                : 'Use repeat audio to hear this location again, or plan a route from this point.'}
            </Text>
          </View>

          <PrimaryButton
            theme={theme}
            title={language === 'ar' ? 'أعد نطق الموقع' : 'Repeat location audio'}
            onPress={repeatLocation}
            variant="secondary"
            accessibilityLabel={language === 'ar' ? 'كرر قراءة الموقع الحالي صوتياً' : 'Repeat current location audio'}
          />

          <PrimaryButton
            theme={theme}
            title={language === 'ar' ? 'خطط مساراً من هنا' : 'Plan route from here'}
            onPress={handleRouteToClosest}
            accessibilityLabel={language === 'ar' ? 'اعرض خيارات الإرشاد لهذه النقطة' : 'Show routing options for this point'}
          />
        </>
      ) : (
        <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
      )}

      <PrimaryButton
        theme={theme}
        title={language === 'ar' ? 'طلب مساعدة طوارئ' : 'Request SOS help'}
        onPress={() => router.push('/emergency')}
        variant="danger"
        accessibilityLabel={language === 'ar' ? 'طوارئ عاجلة' : 'Emergency SOS'}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    marginHorizontal: -5,
    marginBottom: 14,
  },
  panel: {
    borderWidth: 1.5,
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  panelText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 18,
  },
});
