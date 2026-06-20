import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import VoiceService from '../src/services/VoiceService';
import HapticsService from '../src/services/HapticsService';
import NavigationService from '../src/services/NavigationService';
import * as Location from 'expo-location';

import MapWrapper from '../src/components/MapWrapper';

export default function NavigationScreen() {
  const router = useRouter();
  const { 
    activeRoute, 
    routeSteps, 
    currentStepIndex, 
    isGuiding, 
    destinationPoint, 
    deviationCount, 
    language, 
    nextStep, 
    prevStep, 
    incrementDeviation,
    stopNavigation,
    isHighContrast 
  } = useNavigationStore();

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [mapError, setMapError] = useState<string>('');
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
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
        (newLocation) => {
          setLocation(newLocation);
          
          // Cross-Track Error Calculation (Live Deviation)
          if (activeRoute && routeSteps.length > 0 && currentStepIndex < routeSteps.length) {
            const currentStep = routeSteps[currentStepIndex];
            // Mock start/end for the step until we have real coordinates in DB:
            // Since RouteStep in types doesn't have start/end coords directly, 
            // we'd use the points. For now, if we had them:
            /*
            const crossTrackError = NavigationService.getCrossTrackDistance(
              newLocation.coords.latitude, newLocation.coords.longitude,
              currentStep.start_lat, currentStep.start_lon,
              currentStep.end_lat, currentStep.end_lon
            );
            if (crossTrackError > 10) { // 10 meters deviation threshold
               NavigationService.announceDeviation(language === 'ar');
               incrementDeviation();
            }
            */
          }
        }
      );
    };

    if (isGuiding) {
      startTracking();
    }

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
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

  const styles = getStyles(isHighContrast);

  if (!isGuiding || !activeRoute || routeSteps.length === 0 || !destinationPoint) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          {language === 'ar' ? 'لا توجد رحلة نشطة حاليًا.' : 'No active navigation session.'}
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/home')}>
          <Text style={styles.backBtnText}>{language === 'ar' ? 'الرجوع للرئيسية' : 'Go to Home'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStep = routeSteps[currentStepIndex];
  const isFloorTransition = ['elevator_up', 'elevator_down', 'stairs_up', 'stairs_down'].includes(currentStep.direction);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header Info */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {language === 'ar' ? 'رحلة ملاحية نشطة' : 'Active Navigation'}
        </Text>
        <Text style={styles.destText}>
          {language === 'ar' ? `الوجهة: ${destinationPoint.name_ar}` : `Destination: ${destinationPoint.name_en}`}
        </Text>
        <Text style={styles.stepCounter}>
          {language === 'ar' 
            ? `الخطوة ${currentStepIndex + 1} من ${routeSteps.length}` 
            : `Step ${currentStepIndex + 1} of ${routeSteps.length}`}
        </Text>
      </View>

      {/* Main Instruction Display Card */}
      <View style={[styles.instructionCard, currentStep.warning_level !== 'none' && styles.warningCard]}>
        <Text style={styles.directionIcon}>
          {currentStep.direction === 'left' || currentStep.direction === 'slight_left' ? '⬅️' :
           currentStep.direction === 'right' || currentStep.direction === 'slight_right' ? '➡️' :
           currentStep.direction === 'stairs_up' || currentStep.direction === 'elevator_up' ? '⬆️' :
           currentStep.direction === 'stairs_down' || currentStep.direction === 'elevator_down' ? '⬇️' : '⬆️'}
        </Text>
        <Text style={styles.instructionText} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          {language === 'ar' ? currentStep.instruction_ar : currentStep.instruction_en}
        </Text>
        <Text style={styles.distanceText}>
          {language === 'ar' 
            ? `المسافة المقدرة لهذه الخطوة: ${currentStep.distance_meters} متر` 
            : `Distance for this step: ${currentStep.distance_meters} meters`}
        </Text>
      </View>

      {/* Real Map Integration */}
      <View style={styles.mapContainer}>
        <MapWrapper 
          location={location} 
          isMapReady={isMapReady} 
          setIsMapReady={setIsMapReady} 
        />
      </View>

      {/* Repeat voice button */}
      <TouchableOpacity style={styles.repeatBtn} onPress={handleRepeat} accessible={true}>
        <Text style={styles.repeatBtnText}>🔊 {language === 'ar' ? 'أعد المقطع الصوتي' : 'Repeat Audio'}</Text>
      </TouchableOpacity>

      {/* Manual Step controller */}
      {isFloorTransition ? (
        <TouchableOpacity
          style={[styles.ctrlBtn, { backgroundColor: '#27AE60', paddingVertical: 24, marginBottom: 16 }]}
          onPress={() => {
            HapticsService.trigger('continue');
            VoiceService.speak(language === 'ar' ? 'تم تأكيد وصولك للطابق الجديد. لنكمل المسار.' : 'Floor transition confirmed. Continuing route.');
            setTimeout(() => nextStep(), 2500);
          }}
          accessible={true}
        >
          <Text style={[styles.ctrlBtnText, { fontSize: 20 }]}>✅ {language === 'ar' ? 'لقد وصلت للطابق الجديد' : 'I arrived at the new floor'}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.stepControllerRow}>
          <TouchableOpacity
            style={[styles.ctrlBtn, currentStepIndex === 0 && styles.disabledBtn]}
            onPress={prevStep}
            disabled={currentStepIndex === 0}
            accessible={true}
          >
            <Text style={styles.ctrlBtnText}>{language === 'ar' ? '◀ الخطوة السابقة' : '◀ Prev'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ctrlBtn} onPress={nextStep} accessible={true}>
            <Text style={styles.ctrlBtnText}>
              {currentStepIndex === routeSteps.length - 1 
                ? (language === 'ar' ? 'الوصول 🏁' : 'Arrived 🏁') 
                : (language === 'ar' ? 'التالي ▶' : 'Next ▶')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SOS Emergency and Simulation Tools */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.sosBtn} onPress={handleSOS} accessible={true}>
          <Text style={styles.sosBtnText}>🚨 SOS</Text>
        </TouchableOpacity>
      </View>

      {/* Cancel Navigation Button */}
      <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} accessible={true}>
        <Text style={styles.cancelBtnText}>✕ {language === 'ar' ? 'إيقاف وإلغاء الرحلة' : 'Stop & Cancel'}</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const getStyles = (highContrast: boolean) => StyleSheet.create({
  centerContainer: { flex: 1, backgroundColor: highContrast ? '#000000' : '#121212', justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#CCCCCC', fontSize: 18, textAlign: 'center', marginBottom: 20 },
  backBtn: { backgroundColor: '#1A5F7A', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 10 },
  backBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  container: { flexGrow: 1, backgroundColor: highContrast ? '#000000' : '#121212', padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 18, color: '#B0B0B0', fontWeight: 'bold', textTransform: 'uppercase' },
  destText: { fontSize: 22, color: '#FFFFFF', fontWeight: 'bold', marginVertical: 6, textAlign: 'center' },
  stepCounter: { fontSize: 16, color: '#FFFF00', fontWeight: 'bold' },
  instructionCard: { backgroundColor: '#1E272C', borderRadius: 24, padding: 24, borderWidth: 2, borderColor: '#34495E', alignItems: 'center', marginBottom: 20 },
  warningCard: { borderColor: '#E74C3C', backgroundColor: '#3C2222' },
  directionIcon: { fontSize: 64, marginBottom: 16 },
  instructionText: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold', textAlign: 'center', lineHeight: 36, marginBottom: 16 },
  distanceText: { color: '#B0B0B0', fontSize: 16 },
  mapContainer: { width: '100%', height: 250, borderRadius: 20, overflow: 'hidden', marginBottom: 20, borderWidth: 2, borderColor: '#34495E' },
  map: { width: '100%', height: '100%' },
  webMapFallback: { width: '100%', padding: 20, backgroundColor: '#2C3E50', borderRadius: 16, marginBottom: 20, alignItems: 'center' },
  webMapText: { color: '#BDC3C7', fontSize: 14, textAlign: 'center' },
  repeatBtn: { backgroundColor: '#2C3E50', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginBottom: 20, borderWidth: 1.5, borderColor: '#34495E' },
  repeatBtnText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  stepControllerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  ctrlBtn: { flex: 1, backgroundColor: '#1A5F7A', paddingVertical: 18, borderRadius: 14, marginHorizontal: 6, alignItems: 'center' },
  disabledBtn: { opacity: 0.4 },
  ctrlBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  deviateBtn: { flex: 2, backgroundColor: '#7F8C8D', paddingVertical: 16, borderRadius: 12, marginRight: 8, alignItems: 'center', justifyContent: 'center' },
  sosBtn: { flex: 1, backgroundColor: '#C0392B', paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
  sosBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  cancelBtn: { backgroundColor: '#2E3133', paddingVertical: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#4A5054' },
  cancelBtnText: { color: '#E74C3C', fontSize: 18, fontWeight: 'bold' },
  deviationCounter: { color: '#E74C3C', fontSize: 15, textAlign: 'center', marginTop: 16, fontWeight: 'bold' },
});
