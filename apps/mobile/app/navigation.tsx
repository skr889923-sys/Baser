import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import VoiceService from '../src/services/VoiceService';
import HapticsService from '../src/services/HapticsService';
import * as Location from 'expo-location';
import MapWrapper from '../src/components/MapWrapper';
import {
  getInterfaceTheme,
  MetricCard,
  PrimaryButton,
  ScreenShell,
  SignalGlyph,
  StatusPill,
  surfaceStyle,
} from '../src/components/BlindInterface';

function directionCode(direction: string) {
  if (direction === 'left' || direction === 'slight_left') return 'LEFT';
  if (direction === 'right' || direction === 'slight_right') return 'RGHT';
  if (direction === 'stairs_up') return 'STUP';
  if (direction === 'stairs_down') return 'STDN';
  if (direction === 'elevator_up') return 'ELUP';
  if (direction === 'elevator_down') return 'ELDN';
  return 'FWD';
}

export default function NavigationScreen() {
  const router = useRouter();
  const {
    activeRoute,
    routeSteps,
    currentStepIndex,
    isGuiding,
    destinationPoint,
    language,
    nextStep,
    prevStep,
    stopNavigation,
    isHighContrast,
  } = useNavigationStore();

  const theme = getInterfaceTheme(isHighContrast);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [mapError, setMapError] = useState<string>('');
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMapError(language === 'ar' ? 'صلاحية الموقع مطلوبة' : 'Location permission needed');
        return;
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 1,
        },
        newLocation => setLocation(newLocation)
      );
    };

    if (isGuiding) startTracking();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, [isGuiding, currentStepIndex, language]);

  const handleCancel = () => {
    HapticsService.trigger('continue');
    VoiceService.speak(language === 'ar' ? 'تم إلغاء الرحلة الملاحية' : 'Navigation cancelled');
    stopNavigation();
    router.replace('/home');
  };

  const handleRepeat = () => {
    HapticsService.trigger('continue');
    VoiceService.repeatLastInstruction();
  };

  const handleSOS = () => {
    HapticsService.trigger('emergency');
    router.push('/emergency');
  };

  if (!isGuiding || !activeRoute || routeSteps.length === 0 || !destinationPoint) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>
          {language === 'ar' ? 'لا توجد رحلة نشطة حالياً.' : 'No active navigation session.'}
        </Text>
        <PrimaryButton
          theme={theme}
          title={language === 'ar' ? 'الرجوع للرئيسية' : 'Go to home'}
          onPress={() => router.replace('/home')}
          accessibilityLabel={language === 'ar' ? 'الرجوع إلى الرئيسية' : 'Go to home'}
        />
      </View>
    );
  }

  const currentStep = routeSteps[currentStepIndex];
  const isFloorTransition = ['elevator_up', 'elevator_down', 'stairs_up', 'stairs_down'].includes(currentStep.direction);
  const progressText = `${currentStepIndex + 1}/${routeSteps.length}`;

  return (
    <ScreenShell highContrast={isHighContrast}>
      <View style={[styles.hudHeader, surfaceStyle(theme)]}>
        <View style={styles.headerTop}>
          <StatusPill theme={theme} tone="success" text={language === 'ar' ? 'إرشاد نشط' : 'Guidance active'} />
          <SignalGlyph label={directionCode(currentStep.direction)} theme={theme} danger={currentStep.warning_level !== 'none'} />
        </View>
        <Text style={[styles.destination, { color: theme.text }]}>
          {language === 'ar' ? destinationPoint.name_ar : destinationPoint.name_en}
        </Text>
        <Text style={[styles.stepCounter, { color: theme.textMuted }]}>
          {language === 'ar' ? `الخطوة ${progressText}` : `Step ${progressText}`}
        </Text>
      </View>

      <View style={[styles.instructionCard, surfaceStyle(theme), currentStep.warning_level !== 'none' && { borderColor: theme.danger }]}>
        <Text style={[styles.instructionLabel, { color: currentStep.warning_level !== 'none' ? theme.danger : theme.accent }]}>
          {currentStep.warning_level !== 'none'
            ? (language === 'ar' ? 'تنبيه قبل الحركة' : 'Caution before moving')
            : (language === 'ar' ? 'التعليمات التالية' : 'Next instruction')}
        </Text>
        <Text style={[styles.instructionText, { color: theme.text }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          {language === 'ar' ? currentStep.instruction_ar : currentStep.instruction_en}
        </Text>
      </View>

      <View style={styles.metricsRow}>
        <MetricCard
          theme={theme}
          value={`${currentStep.distance_meters} ${language === 'ar' ? 'م' : 'm'}`}
          label={language === 'ar' ? 'مسافة الخطوة' : 'Step distance'}
        />
        <MetricCard
          theme={theme}
          value={progressText}
          label={language === 'ar' ? 'التقدم' : 'Progress'}
          tone="success"
        />
      </View>

      <View style={[styles.mapContainer, { borderColor: mapError ? theme.danger : theme.borderSoft }]}>
        <MapWrapper
          location={location}
          isMapReady={isMapReady}
          setIsMapReady={setIsMapReady}
        />
      </View>
      {mapError ? <Text style={[styles.mapError, { color: theme.warning }]}>{mapError}</Text> : null}

      <PrimaryButton
        theme={theme}
        title={language === 'ar' ? 'أعد التعليمات الصوتية' : 'Repeat voice instruction'}
        onPress={handleRepeat}
        variant="secondary"
        accessibilityLabel={language === 'ar' ? 'إعادة قراءة التعليمات صوتياً' : 'Repeat audio instruction'}
      />

      {isFloorTransition ? (
        <PrimaryButton
          theme={theme}
          title={language === 'ar' ? 'وصلت للطابق الجديد' : 'Arrived at new floor'}
          onPress={() => {
            HapticsService.trigger('continue');
            VoiceService.speak(language === 'ar' ? 'تم تأكيد وصولك للطابق الجديد. لنكمل المسار.' : 'Floor transition confirmed. Continuing route.');
            setTimeout(() => nextStep(), 1600);
          }}
          accessibilityLabel={language === 'ar' ? 'تأكيد الوصول للطابق الجديد' : 'Confirm arrival at new floor'}
        />
      ) : (
        <View style={styles.stepButtons}>
          <View style={styles.stepButtonWrap}>
            <PrimaryButton
              theme={theme}
              title={language === 'ar' ? 'السابق' : 'Previous'}
              onPress={prevStep}
              variant="secondary"
              disabled={currentStepIndex === 0}
              accessibilityLabel={language === 'ar' ? 'الخطوة السابقة' : 'Previous step'}
            />
          </View>
          <View style={styles.stepButtonWrap}>
            <PrimaryButton
              theme={theme}
              title={currentStepIndex === routeSteps.length - 1 ? (language === 'ar' ? 'وصلت' : 'Arrived') : (language === 'ar' ? 'التالي' : 'Next')}
              onPress={nextStep}
              accessibilityLabel={language === 'ar' ? 'الخطوة التالية' : 'Next step'}
            />
          </View>
        </View>
      )}

      <PrimaryButton
        theme={theme}
        title={language === 'ar' ? 'طلب طوارئ SOS' : 'Emergency SOS'}
        onPress={handleSOS}
        variant="danger"
        accessibilityLabel={language === 'ar' ? 'طلب مساعدة طوارئ' : 'Request emergency help'}
      />

      <PrimaryButton
        theme={theme}
        title={language === 'ar' ? 'إيقاف الرحلة' : 'Stop navigation'}
        onPress={handleCancel}
        variant="ghost"
        accessibilityLabel={language === 'ar' ? 'إيقاف وإلغاء الرحلة' : 'Stop and cancel navigation'}
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
  errorText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 18,
  },
  hudHeader: {
    borderWidth: 1.5,
    borderRadius: 28,
    padding: 20,
    marginBottom: 14,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  destination: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  stepCounter: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
  },
  instructionCard: {
    borderWidth: 1.5,
    borderRadius: 28,
    padding: 22,
    marginBottom: 14,
  },
  instructionLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 28,
    lineHeight: 39,
    fontWeight: '900',
    textAlign: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    marginHorizontal: -5,
    marginBottom: 14,
  },
  mapContainer: {
    width: '100%',
    height: 240,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1.5,
  },
  mapError: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  stepButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  stepButtonWrap: {
    flex: 1,
  },
});
