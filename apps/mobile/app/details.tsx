import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import SupabaseService from '../src/services/SupabaseService';
import NavigationService from '../src/services/NavigationService';
import { NavigationPoint, Route, RouteStep } from '@baser/types';
import VoiceService from '../src/services/VoiceService';
import {
  getInterfaceTheme,
  HeroPanel,
  MetricCard,
  PrimaryButton,
  ScreenShell,
  StatusPill,
  surfaceStyle,
} from '../src/components/BlindInterface';

export default function DetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const pointId = params.pointId as string;
  const startPointId = params.startPointId as string | undefined;

  const { language, routeTypePreference, setRoutePreference, startNavigation, isHighContrast } = useNavigationStore();
  const theme = getInterfaceTheme(isHighContrast);
  const [point, setPoint] = useState<NavigationPoint | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRouteData = async () => {
      setLoading(true);
      try {
        const points = await SupabaseService.getNavigationPoints();
        const dest = points.find(p => p.id === pointId);

        if (!dest) return;
        setPoint(dest);

        const fallbackStartPoint = points.find(p => p.type === 'entrance' && p.id !== dest.id) || points.find(p => p.id !== dest.id);
        const effectiveStartPointId = startPointId && startPointId !== dest.id ? startPointId : fallbackStartPoint?.id;

        if (!effectiveStartPointId) {
          VoiceService.speak(language === 'ar' ? 'نحتاج نقطة بداية مختلفة عن الوجهة لحساب المسار.' : 'A different start point is required to calculate a route.');
          return;
        }

        const routes = await NavigationService.getRoutesToDestination(effectiveStartPointId, dest.id);
        const bestRoute = NavigationService.selectBestRoute(routes, routeTypePreference);

        if (bestRoute) {
          setRoute(bestRoute);
          const routeSteps = await SupabaseService.getRouteSteps(bestRoute.id);
          setSteps(routeSteps);

          const name = language === 'ar' ? dest.name_ar : dest.name_en;
          const stairsText = bestRoute.has_stairs
            ? (language === 'ar' ? 'يحتوي على سلالم' : 'contains stairs')
            : (language === 'ar' ? 'خالي من السلالم' : 'has no stairs');
          const vocalSummary = language === 'ar'
            ? `تفاصيل الوجهة: ${name}. المسافة ${bestRoute.distance_meters} متر. الزمن المتوقع ${bestRoute.estimated_minutes} دقيقة. المسار ${stairsText}. اضغط زر بدء الإرشاد للمتابعة.`
            : `Destination details: ${name}. Distance ${bestRoute.distance_meters} meters. Estimated time ${bestRoute.estimated_minutes} minutes. The path ${stairsText}. Press start guidance to continue.`;

          VoiceService.speak(vocalSummary);
        } else {
          VoiceService.speak(language === 'ar' ? 'نعتذر، لم نجد مساراً مسجلاً لهذه الوجهة حالياً.' : 'Sorry, no registered path found for this destination.');
        }
      } catch (error) {
        console.error('Error loading route details:', error);
      } finally {
        setLoading(false);
      }
    };

    if (pointId) loadRouteData();
  }, [pointId, startPointId, routeTypePreference, language]);

  const handleStartNav = () => {
    if (route && point) {
      startNavigation(route, steps, point);
      router.push('/navigation');
    }
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          {language === 'ar' ? 'جاري حساب أفضل مسار...' : 'Calculating optimal path...'}
        </Text>
      </View>
    );
  }

  if (!point || !route) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.danger }]}>
          {language === 'ar' ? 'لا يوجد مسار جاهز لهذه الوجهة حالياً.' : 'No ready route is available for this destination.'}
        </Text>
      </View>
    );
  }

  const hasCaution = route.has_stairs || !route.visually_impaired_friendly;

  return (
    <ScreenShell highContrast={isHighContrast}>
      <HeroPanel
        theme={theme}
        eyebrow={language === 'ar' ? 'تأكيد المسار' : 'Route confirmation'}
        title={language === 'ar' ? point.name_ar : point.name_en}
        subtitle={language === 'ar' ? point.description_ar : point.description_en}
        code="PATH"
      />

      <View style={styles.metricsRow}>
        <MetricCard
          theme={theme}
          value={`${route.estimated_minutes} ${language === 'ar' ? 'د' : 'm'}`}
          label={language === 'ar' ? 'زمن الوصول' : 'Duration'}
        />
        <MetricCard
          theme={theme}
          value={`${route.distance_meters} ${language === 'ar' ? 'م' : 'm'}`}
          label={language === 'ar' ? 'المسافة' : 'Distance'}
        />
      </View>

      <View style={styles.statusRow}>
        <StatusPill
          theme={theme}
          tone={route.visually_impaired_friendly ? 'success' : 'warning'}
          text={route.visually_impaired_friendly ? (language === 'ar' ? 'مناسب للمكفوفين' : 'Blind-friendly') : (language === 'ar' ? 'يحتاج انتباه' : 'Needs caution')}
        />
        <StatusPill
          theme={theme}
          tone={route.has_stairs ? 'warning' : 'success'}
          text={route.has_stairs ? (language === 'ar' ? 'به سلالم' : 'Has stairs') : (language === 'ar' ? 'بدون سلالم' : 'No stairs')}
        />
        <StatusPill
          theme={theme}
          tone={route.wheelchair_accessible ? 'success' : 'normal'}
          text={route.wheelchair_accessible ? (language === 'ar' ? 'مهيأ للكراسي' : 'Wheelchair ready') : (language === 'ar' ? 'تهيئة عادية' : 'Standard access')}
        />
      </View>

      <View style={[styles.panel, surfaceStyle(theme)]}>
        <Text style={[styles.panelTitle, { color: theme.text }]}>
          {language === 'ar' ? 'خصائص السلامة' : 'Safety profile'}
        </Text>
        <Text style={[styles.panelText, { color: theme.textMuted }]}>
          {route.visually_impaired_friendly
            ? (language === 'ar' ? 'المسار مفضل للتوجيه الصوتي ويحتوي على خطوات مناسبة للتنقل الداخلي.' : 'This route is preferred for voice guidance and indoor step navigation.')
            : (language === 'ar' ? 'المسار متاح، لكن يفضل طلب مساعدة إذا كنت غير معتاد على الموقع.' : 'The route is available, but assistance is recommended if the area is unfamiliar.')}
        </Text>
        {hasCaution ? (
          <Text style={[styles.warningText, { color: theme.warning }]}>
            {language === 'ar' ? 'تنبيه: استمع للتعليمات كاملة قبل الحركة.' : 'Caution: listen to each instruction fully before moving.'}
          </Text>
        ) : null}
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {language === 'ar' ? 'تفضيل حساب المسار' : 'Route preference'}
      </Text>

      <View style={styles.preferenceRow}>
        <TouchableOpacity
          style={[
            styles.preferenceButton,
            {
              backgroundColor: routeTypePreference === 'safe_accessible' ? theme.accentDark : theme.surface,
              borderColor: routeTypePreference === 'safe_accessible' ? theme.accent : theme.borderSoft,
            },
          ]}
          onPress={() => setRoutePreference('safe_accessible')}
          accessible={true}
          accessibilityLabel={language === 'ar' ? 'تفضيل مسار آمن ومهيأ' : 'Prefer safe accessible route'}
          accessibilityState={{ selected: routeTypePreference === 'safe_accessible' }}
        >
          <Text style={[styles.preferenceCode, { color: theme.accent }]}>SAFE</Text>
          <Text style={[styles.preferenceText, { color: theme.text }]}>{language === 'ar' ? 'آمن ومهيأ' : 'Safe route'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.preferenceButton,
            {
              backgroundColor: routeTypePreference === 'fastest' ? theme.accentDark : theme.surface,
              borderColor: routeTypePreference === 'fastest' ? theme.accent : theme.borderSoft,
            },
          ]}
          onPress={() => setRoutePreference('fastest')}
          accessible={true}
          accessibilityLabel={language === 'ar' ? 'تفضيل أسرع مسار' : 'Prefer fastest route'}
          accessibilityState={{ selected: routeTypePreference === 'fastest' }}
        >
          <Text style={[styles.preferenceCode, { color: theme.accent }]}>FAST</Text>
          <Text style={[styles.preferenceText, { color: theme.text }]}>{language === 'ar' ? 'أسرع مسار' : 'Fastest'}</Text>
        </TouchableOpacity>
      </View>

      <PrimaryButton
        theme={theme}
        title={language === 'ar' ? 'ابدأ الإرشاد الصوتي' : 'Start voice guidance'}
        onPress={handleStartNav}
        accessibilityLabel={language === 'ar' ? 'ابدأ الإرشاد الملاحي الصوتي الآن' : 'Start voice navigation now'}
        accessibilityHint={language === 'ar' ? 'اضغط مرتين لبدء التوجيه خطوة بخطوة بالصوت والاهتزاز' : 'Double tap to begin turn-by-turn speech and haptics'}
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
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 26,
  },
  metricsRow: {
    flexDirection: 'row',
    marginHorizontal: -5,
    marginBottom: 14,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  panel: {
    borderWidth: 1.5,
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },
  panelTitle: {
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 10,
  },
  panelText: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
  },
  warningText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '900',
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  preferenceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  preferenceButton: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 14,
    minHeight: 92,
    justifyContent: 'center',
  },
  preferenceCode: {
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '900',
    marginBottom: 8,
  },
  preferenceText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
});
