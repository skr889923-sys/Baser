import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import SupabaseService from '../src/services/SupabaseService';
import NavigationService from '../src/services/NavigationService';
import { NavigationPoint, Route, RouteStep } from '@dallni/types';
import VoiceService from '../src/services/VoiceService';

export default function DetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const pointId = params.pointId as string;

  const { language, routeTypePreference, setRoutePreference, startNavigation, isHighContrast } = useNavigationStore();
  const [point, setPoint] = useState<NavigationPoint | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [loading, setLoading] = useState(true);

  // We default to the main campus gate as the starting point for seed demonstration
  const START_POINT_ID = '00000000-0000-0000-0000-000000000000'; 

  useEffect(() => {
    const loadRouteData = async () => {
      setLoading(true);
      try {
        const points = await SupabaseService.getNavigationPoints();
        const dest = points.find(p => p.id === pointId);
        
        if (dest) {
          setPoint(dest);
          
          // Fetch route from Gate to this point
          // In actual use, this start point would be current location or last scanned QR
          const routes = await NavigationService.getRoutesToDestination(START_POINT_ID, dest.id);
          const bestRoute = NavigationService.selectBestRoute(routes, routeTypePreference);
          
          if (bestRoute) {
            setRoute(bestRoute);
            const routeSteps = await SupabaseService.getRouteSteps(bestRoute.id);
            setSteps(routeSteps);

            // Announce details to user
            const name = language === 'ar' ? dest.name_ar : dest.name_en;
            const dist = bestRoute.distance_meters;
            const time = bestRoute.estimated_minutes;
            const stairsTxt = bestRoute.has_stairs 
              ? (language === 'ar' ? 'يحتوي على سلالم' : 'contains stairs') 
              : (language === 'ar' ? 'خالي من السلالم' : 'no stairs');
            const rampTxt = bestRoute.has_ramp 
              ? (language === 'ar' ? 'يوجد منحدر كراسي' : 'ramp available') 
              : '';

            const vocalSummary = language === 'ar'
              ? `تفاصيل الوجهة: ${name}. المسافة ${dist} مترًا. الزمن المتوقع ${time} دقيقة. المسار ${stairsTxt}. ${rampTxt}. اضغط أسفل الشاشة لبدء الرحلة.`
              : `Destination details: ${name}. Distance ${dist} meters. Estimated walk is ${time} minutes. Path is ${stairsTxt}. ${rampTxt}. Double tap the bottom button to start navigation.`;
            
            VoiceService.speak(vocalSummary);
          } else {
            VoiceService.speak(language === 'ar' ? 'نعتذر، لم نجد مسارًا مسجلاً لهذه الوجهة حاليًا.' : 'Sorry, no registered path found for this destination.');
          }
        }
      } catch (error) {
        console.error('Error loading route details:', error);
      } finally {
        setLoading(false);
      }
    };

    if (pointId) {
      loadRouteData();
    }
  }, [pointId, routeTypePreference, language]);

  const handleStartNav = () => {
    if (route && point) {
      startNavigation(route, steps, point);
      router.push('/navigation');
    }
  };

  const styles = getStyles(isHighContrast);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1A5F7A" />
        <Text style={styles.loadingText}>
          {language === 'ar' ? 'جاري حساب أفضل مسار...' : 'Calculating optimal path...'}
        </Text>
      </View>
    );
  }

  if (!point || !route) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          {language === 'ar' ? 'حدث خطأ في تحميل تفاصيل الموقع.' : 'Error loading location details.'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {language === 'ar' ? point.name_ar : point.name_en}
      </Text>
      
      <Text style={styles.description}>
        {language === 'ar' ? point.description_ar : point.description_en}
      </Text>

      {/* Route parameters cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>⏱️</Text>
          <Text style={styles.statVal}>{route.estimated_minutes} د</Text>
          <Text style={styles.statLbl}>{language === 'ar' ? 'زمن الوصول' : 'Duration'}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>📏</Text>
          <Text style={styles.statVal}>{route.distance_meters} م</Text>
          <Text style={styles.statLbl}>{language === 'ar' ? 'المسافة' : 'Distance'}</Text>
        </View>
      </View>

      {/* Path Features List */}
      <View style={styles.featuresSection}>
        <Text style={styles.featuresTitle}>
          {language === 'ar' ? 'خصائص المسار:' : 'Path properties:'}
        </Text>

        <View style={styles.featureItem}>
          <Text style={styles.featureBullet}>♿</Text>
          <Text style={styles.featureText}>
            {route.wheelchair_accessible 
              ? (language === 'ar' ? 'مناسب للكراسي المتحركة والمنحدرات' : 'Wheelchair accessible (ramps available)')
              : (language === 'ar' ? 'غير مهيأ بالكامل للكراسي المتحركة' : 'Not fully wheelchair friendly')}
          </Text>
        </View>

        <View style={styles.featureItem}>
          <Text style={styles.featureBullet}>🪜</Text>
          <Text style={styles.featureText}>
            {route.has_stairs 
              ? (language === 'ar' ? 'انتبه: يحتوي المسار على درجات سلم' : 'Caution: Path contains steps/stairs')
              : (language === 'ar' ? 'خالي تمامًا من السلالم والعقبات المرتفعة' : 'No stairs or high steps')}
          </Text>
        </View>

        <View style={styles.featureItem}>
          <Text style={styles.featureBullet}>🕶️</Text>
          <Text style={styles.featureText}>
            {route.visually_impaired_friendly 
              ? (language === 'ar' ? 'مجهز بمسارات لمسية أرضية للمكفوفين' : 'Tactile floor paths available')
              : (language === 'ar' ? 'مسار رملي أو تقليدي بدون علامات أرضية' : 'Standard pathway without tactile blocks')}
          </Text>
        </View>
      </View>

      {/* Navigation Preference Buttons */}
      <View style={styles.preferenceRow}>
        <TouchableOpacity
          style={[styles.prefBtn, routeTypePreference === 'safe_accessible' && styles.activePrefBtn]}
          onPress={() => setRoutePreference('safe_accessible')}
          accessible={true}
          accessibilityLabel={language === 'ar' ? 'تفضيل مسار آمن ومهيأ' : 'Prefer accessible path'}
          accessibilityState={{ selected: routeTypePreference === 'safe_accessible' }}
        >
          <Text style={styles.prefBtnText}>🛡️ {language === 'ar' ? 'آمن ومهيأ' : 'Safe & Accessible'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.prefBtn, routeTypePreference === 'fastest' && styles.activePrefBtn]}
          onPress={() => setRoutePreference('fastest')}
          accessible={true}
          accessibilityLabel={language === 'ar' ? 'تفضيل أسرع مسار' : 'Prefer fastest path'}
          accessibilityState={{ selected: routeTypePreference === 'fastest' }}
        >
          <Text style={styles.prefBtnText}>⚡ {language === 'ar' ? 'أسرع مسار' : 'Fastest'}</Text>
        </TouchableOpacity>
      </View>

      {/* Start Button */}
      <TouchableOpacity
        style={styles.startBtn}
        onPress={handleStartNav}
        accessible={true}
        accessibilityLabel={language === 'ar' ? 'ابدأ الإرشاد الملاحي الصوتي الآن' : 'Start voice navigation now'}
        accessibilityHint={language === 'ar' ? 'اضغط مرتين لبدء رحلة التوجيه خطوة بخطوة بالصوت والاهتزاز' : 'Double tap to initiate turn-by-turn guidance'}
      >
        <Text style={styles.startBtnText}>
          {language === 'ar' ? 'ابدأ الإرشاد 🚀' : 'Start Navigation 🚀'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const getStyles = (highContrast: boolean) => StyleSheet.create({
  centerContainer: {
    flex: 1,
    backgroundColor: highContrast ? '#000000' : '#121212',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginTop: 16,
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 18,
    textAlign: 'center',
  },
  container: {
    flexGrow: 1,
    backgroundColor: highContrast ? '#000000' : '#121212',
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#CCCCCC',
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E272C',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 8,
    borderWidth: 1.5,
    borderColor: '#34495E',
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  statVal: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  statLbl: {
    color: '#B0B0B0',
    fontSize: 13,
    marginTop: 2,
  },
  featuresSection: {
    backgroundColor: '#161E22',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2C3E50',
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureBullet: {
    fontSize: 20,
    marginRight: 12,
  },
  featureText: {
    color: '#E0E0E0',
    fontSize: 15,
    flex: 1,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  prefBtn: {
    flex: 1,
    backgroundColor: '#2C3E50',
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#34495E',
  },
  activePrefBtn: {
    backgroundColor: highContrast ? '#1A5F7A' : '#1F8A70',
    borderColor: highContrast ? '#FFFF00' : '#1F8A70',
  },
  prefBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  startBtn: {
    backgroundColor: highContrast ? '#FFFF00' : '#1A5F7A',
    paddingVertical: 22,
    borderRadius: 18,
    alignItems: 'center',
  },
  startBtnText: {
    color: highContrast ? '#000000' : '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
});
