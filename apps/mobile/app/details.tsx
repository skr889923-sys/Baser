import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import SupabaseService from '../src/services/SupabaseService';
import NavigationService from '../src/services/NavigationService';
import { canStartNavigation } from '@baser/navigation';
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

  const [error, setError] = useState('');
  const requestVersion = useRef(0);

  useEffect(() => {
    const version = ++requestVersion.current;
    let cancelled = false;
    const current = () => !cancelled && requestVersion.current === version;
    setRoute(null);
    setSteps([]);
    setPoint(null);
    setError('');
    const loadRouteData = async () => {
      setLoading(true);
      try {
        const points = await SupabaseService.getNavigationPoints();
        if (!current()) return;
        const dest = points.find(p => p.id === pointId);
        setPoint(dest ?? null);
        if (!dest) throw new Error(language === 'ar' ? 'الوجهة غير متاحة.' : 'Destination unavailable.');
        if (!startPointId || startPointId === dest.id || !points.some(p => p.id === startPointId)) {
          throw new Error(language === 'ar' ? 'امسح رمز QR في موقعك لتحديد نقطة بداية صحيحة، ثم اختر الوجهة.' : 'Scan a QR tag at your position to set a valid start, then choose your destination.');
        }
        const routes = await NavigationService.getRoutesToDestination(startPointId, dest.id);
        const bestRoute = NavigationService.selectBestRoute(routes, routeTypePreference);
        if (!bestRoute) throw new Error(language === 'ar' ? 'لا يوجد مسار متاح يطابق احتياجاتك الحالية.' : 'No available route meets your current needs.');
        const routeSteps = await SupabaseService.getRouteSteps(bestRoute.id);
        if (!canStartNavigation(bestRoute, routeSteps, routeTypePreference)) {
          throw new Error(language === 'ar' ? 'خطوات المسار غير مكتملة أو غير مناسبة. تعذر بدء الإرشاد.' : 'Route steps are incomplete or unsuitable. Guidance is unavailable.');
        }
        if (!current()) return;
        setRoute(bestRoute);
        setSteps(routeSteps);
        VoiceService.speak(language === 'ar'
          ? `المسافة إلى ${dest.name_ar} هي ${bestRoute.distance_meters} متر. اضغط بدء الإرشاد للمتابعة.`
          : `Distance to ${dest.name_en} is ${bestRoute.distance_meters} metres. Press start guidance to continue.`);
      } catch (cause) {
        if (!current()) return;
        const message = cause instanceof Error ? cause.message : (language === 'ar' ? 'تعذر تحميل المسار.' : 'Could not load route.');
        setError(message);
        VoiceService.speak(message);
      } finally {
        if (current()) setLoading(false);
      }
    };
    loadRouteData();
    return () => { cancelled = true; requestVersion.current++; };
  }, [pointId, startPointId, routeTypePreference, language]);

  const handleStartNav = async () => {
    if (!route || !point || !steps.length) return;
    const version = requestVersion.current;
    setLoading(true);
    try {
      // Recheck availability immediately before starting; a route may have closed since preview.
      const routes = await NavigationService.getRoutesToDestination(route.start_point_id, point.id);
      const fresh = routes.find(candidate => candidate.id === route.id);
      const freshSteps = fresh ? await SupabaseService.getRouteSteps(fresh.id) : [];
      if (version !== requestVersion.current) return;
      if (!fresh || !startNavigation(fresh, freshSteps, point)) {
        setRoute(null);
        const message = language === 'ar' ? 'تغيرت حالة المسار أو لم يعد مناسباً. أعد اختيار الوجهة.' : 'The route changed or is no longer suitable. Select your destination again.';
        setError(message);
        VoiceService.speak(message);
        return;
      }
      router.push('/navigation');
    } catch {
      if (version !== requestVersion.current) return;
      setRoute(null);
      const message = language === 'ar' ? 'تعذر تأكيد إتاحة المسار. تحقق من الاتصال ثم أعد المحاولة.' : 'Could not confirm route availability. Check your connection and retry.';
      setError(message);
      VoiceService.speak(message);
    } finally {
      if (version === requestVersion.current) setLoading(false);
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
          {error || (language === 'ar' ? 'لا يوجد مسار جاهز لهذه الوجهة حالياً.' : 'No ready route is available for this destination.')}
        </Text>
        <PrimaryButton theme={theme} title={language === 'ar' ? 'تحديد البداية عبر QR' : 'Set start with QR'}
          accessibilityLabel={language === 'ar' ? 'مسح رمز الموقع' : 'Scan location tag'} onPress={() => router.replace('/qr-scanner')} />
        <PrimaryButton theme={theme} title={language === 'ar' ? 'الوجهات' : 'Destinations'}
          accessibilityLabel={language === 'ar' ? 'العودة للوجهات' : 'Back to destinations'} onPress={() => router.back()} />
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
