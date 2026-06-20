import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import NavigationService from '../src/services/NavigationService';
import SupabaseService from '../src/services/SupabaseService';
import VoiceService from '../src/services/VoiceService';
import HapticsService from '../src/services/HapticsService';
import * as Location from 'expo-location';
import { NavigationPoint } from '@baser/types';

export default function WhereAmIScreen() {
  const router = useRouter();
  const { language, isHighContrast } = useNavigationStore();

  const [nearestPoint, setNearestPoint] = useState<NavigationPoint | null>(null);
  const [distance, setDistance] = useState<number>(0);
  
  useEffect(() => {
    const locateUser = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          VoiceService.speak(language === 'ar' ? 'عذراً، نحتاج صلاحية الموقع لتحديد مكانك.' : 'Location permission is required.');
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        const coords = location.coords;
        const point = await NavigationService.getNearestPoint(coords.latitude, coords.longitude);
      
      if (!point) {
        setNearestPoint(null);
        VoiceService.speak(language === 'ar' ? 'تعذر الاتصال بقاعدة البيانات لتحديد الموقع.' : 'Failed to connect to database to determine location.');
        return;
      }

      setNearestPoint(point);

      if (point.latitude && point.longitude) {
        const dist = NavigationService.getDistance(
          coords.latitude,
          coords.longitude,
          point.latitude,
          point.longitude
        );
        setDistance(Math.round(dist));
      }

      // Voice announcement
      const name = language === 'ar' ? point.name_ar : point.name_en;
      const desc = language === 'ar' ? point.description_ar : point.description_en;
      
      const vocalText = language === 'ar'
        ? `أنت الآن بالقرب من: ${name}. تفاصيل الموقع: ${desc}. على بعد حوالي ${Math.round(distance)} أمتار.`
        : `You are currently near: ${name}. Location details: ${desc}. Approximately ${Math.round(distance)} meters away.`;
      
      VoiceService.speak(vocalText);
      } catch (err) {
        console.error('Location error:', err);
        VoiceService.speak(language === 'ar' ? 'تعذر جلب موقعك الحالي من نظام الـ GPS.' : 'Failed to retrieve your current GPS location.');
      }
    };

    locateUser();
  }, [language]);

  const handleRouteToClosest = () => {
    if (nearestPoint) {
      router.push({
        pathname: '/details',
        params: { pointId: nearestPoint.id }
      });
    }
  };

  const styles = getStyles(isHighContrast);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>
          {language === 'ar' ? 'الموقع الحالي المقدر' : 'Estimated Current Location'}
        </Text>
        
        {nearestPoint && (
          <>
            <Text style={styles.pointName} accessibilityRole="header">
              📍 {language === 'ar' ? nearestPoint.name_ar : nearestPoint.name_en}
            </Text>
            
            <Text style={styles.distanceIndicator}>
              {language === 'ar' 
                ? `على بعد ${distance} أمتار منك` 
                : `${distance} meters away from you`}
            </Text>

            <Text style={styles.description}>
              {language === 'ar' ? nearestPoint.description_ar : nearestPoint.description_en}
            </Text>
            
            <View style={styles.specs}>
              <Text style={styles.specText}>
                {language === 'ar' 
                  ? `النوع: ${nearestPoint.type === 'intersection' ? 'تقاطع ممرات' : nearestPoint.type === 'restroom' ? 'دورة مياه' : 'مدخل كليات'}`
                  : `Type: ${nearestPoint.type}`}
              </Text>
              <Text style={styles.specText}>
                {language === 'ar'
                  ? `التهيئة: ${nearestPoint.is_accessible ? 'مهيأة بالكامل' : 'غير مهيأة'}`
                  : `Accessibility: ${nearestPoint.is_accessible ? 'Fully Accessible' : 'Standard'}`}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Trigger Speech synthesis again */}
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => {
          HapticsService.trigger('continue');
          if (nearestPoint) {
            const name = language === 'ar' ? nearestPoint.name_ar : nearestPoint.name_en;
            VoiceService.speak(language === 'ar' ? `كرر الموقع: أنت عند ${name}` : `Location: you are at ${name}`);
          }
        }}
        accessible={true}
        accessibilityLabel={language === 'ar' ? 'كرر قراءة الموقع الحالي صوتيًا' : 'Repeat current location audio'}
      >
        <Text style={styles.actionBtnText}>🔊 {language === 'ar' ? 'أعد نطق الموقع' : 'Repeat Speech'}</Text>
      </TouchableOpacity>

      {/* Nav to Details */}
      <TouchableOpacity
        style={[styles.actionBtn, styles.primaryActionBtn]}
        onPress={handleRouteToClosest}
        accessible={true}
        accessibilityLabel={language === 'ar' ? 'اعرض خيارات الإرشاد لهذه النقطة' : 'Show routing parameters'}
      >
        <Text style={styles.actionBtnText}>🗺️ {language === 'ar' ? 'خطط مسار من هنا' : 'Plan Route from here'}</Text>
      </TouchableOpacity>

      {/* Emergency quick link */}
      <TouchableOpacity
        style={styles.sosBtn}
        onPress={() => router.push('/emergency')}
        accessible={true}
        accessibilityLabel={language === 'ar' ? 'طوارئ عاجلة' : 'SOS Emergency'}
      >
        <Text style={styles.sosBtnText}>🚨 {language === 'ar' ? 'تحتاج لمساعدة؟ اطلب الطوارئ' : 'Need help? Request SOS'}</Text>
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
  card: {
    backgroundColor: '#1E272C',
    borderRadius: 24,
    padding: 24,
    borderWidth: 2,
    borderColor: '#34495E',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#FFFF00',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
  },
  pointName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  distanceIndicator: {
    fontSize: 18,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#E0E0E0',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  specs: {
    borderTopWidth: 1,
    borderTopColor: '#34495E',
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  specText: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '500',
  },
  actionBtn: {
    backgroundColor: '#2C3E50',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#34495E',
  },
  primaryActionBtn: {
    backgroundColor: highContrast ? '#FFFF00' : '#1A5F7A',
    borderColor: highContrast ? '#FFFF00' : '#1A5F7A',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scenarioBtn: {
    backgroundColor: '#2E3133',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4A5054',
    marginBottom: 24,
  },
  scenarioBtnText: {
    color: '#FFFF00',
    fontSize: 15,
    fontWeight: 'bold',
  },
  sosBtn: {
    backgroundColor: '#3C1F1F',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#C0392B',
  },
  sosBtnText: {
    color: '#E74C3C',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
