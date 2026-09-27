import React, { useEffect, useRef, useState } from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import type { CampusNetwork, NetworkPlan } from '@baser/navigation';
import type { RouteType } from '@baser/types';
import CampusNetworkService from '../src/services/CampusNetworkService';
import VoiceService from '../src/services/VoiceService';
import { useNavigationStore } from '../src/store/useNavigationStore';
import { ScreenShell, PrimaryButton, getInterfaceTheme } from '../src/components/BlindInterface';

export default function CampusScreen() {
  const router = useRouter();
  const { language, isHighContrast, routeTypePreference, setRoutePreference, startNavigation } = useNavigationStore();
  const ar = language === 'ar', theme = getInterfaceTheme(isHighContrast);
  const [networks, setNetworks] = useState<CampusNetwork[]>([]);
  const [networkId, setNetworkId] = useState('');
  const [start, setStart] = useState('');
  const [building, setBuilding] = useState('');
  const [plan, setPlan] = useState<NetworkPlan | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  const previousPreference = useRef(routeTypePreference);
  const network = networks.find(n => n.id === networkId);
  useEffect(() => () => { epoch.current++; }, []);
  const invalidate = () => { epoch.current++; setPlan(null); setMessage(''); setBusy(false); };
  const load = async () => {
    invalidate(); const version = epoch.current; setBusy(true);
    try {
      const data = await CampusNetworkService.list();
      if (epoch.current !== version) return;
      setNetworks(data); setNetworkId(data[0]?.id ?? ''); setStart(''); setBuilding('');
      if (!data.length) setMessage(ar ? 'لا توجد شبكة ميدانية منشورة وصالحة حاليًا. يمكن لفريق التشغيل تجهيزها من لوحة الإدارة.' : 'No current field-verified network has been published.');
    } catch (e) { if (epoch.current === version) setMessage(ar && e instanceof Error ? e.message : 'Could not load campus networks.'); }
    finally { if (epoch.current === version) setBusy(false); }
  };
  useEffect(() => { load(); }, [language]);
  useEffect(() => { if (previousPreference.current !== routeTypePreference) { previousPreference.current = routeTypePreference; invalidate(); } }, [routeTypePreference]);
  const calculate = async (begin: boolean) => {
    if (!networkId || !start || !building || busy) return;
    const version = ++epoch.current; setBusy(true); setMessage(''); setPlan(null);
    try {
      const next = await CampusNetworkService.plan(networkId, start, { buildingId: building }, routeTypePreference);
      if (epoch.current !== version) return;
      if (!next) {
        const text = ar ? 'لا يوجد مسار يطابق احتياجاتك من هذه البداية، أو أنك عند الوجهة بالفعل.' : 'No suitable path from this start, or you are already at the destination.';
        setMessage(text); VoiceService.speak(text); return;
      }
      setPlan(next);
      if (begin) {
        if (!startNavigation(next.route, next.steps, next.destination, next.network)) throw new Error('تعذر بدء الإرشاد لهذا المسار.');
        router.push('/navigation');
      } else {
        VoiceService.speak(ar ? `المسافة ${next.route.distance_meters} متر إلى ${next.destination.name_ar}.` : `${next.route.distance_meters} metres to ${next.destination.name_en}.`);
      }
    } catch (e) {
      if (epoch.current !== version) return;
      const text = ar && e instanceof Error ? e.message : 'Could not confirm route availability.';
      setMessage(text); VoiceService.speak(text);
    } finally { if (epoch.current === version) setBusy(false); }
  };
  const choice = (id: string, label: string, selected: boolean, action: () => void) => (
    <TouchableOpacity key={id} onPress={() => { invalidate(); action(); }} disabled={busy}
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled: busy }}
      style={{ padding: 18, marginVertical: 4, borderRadius: 16, borderWidth: 2, borderColor: selected ? theme.accent : theme.borderSoft, backgroundColor: theme.surface }}>
      <Text style={{ color: theme.text, fontSize: 18 }}>{selected ? '✓ ' : ''}{label}</Text>
    </TouchableOpacity>
  );
  const heading = (text: string) => <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', marginVertical: 18 }}>{text}</Text>;
  return <ScreenShell highContrast={isHighContrast}>
    {heading(ar ? 'الملاحة الخارجية' : 'Outdoor navigation')}
    <Text style={{ color: theme.textMuted, fontSize: 17, lineHeight: 26 }}>{ar ? 'اختر نقطة تقف عندها فعليًا، ثم المبنى المطلوب. سنختار المدخل الذي يناسب احتياجاتك.' : 'Choose the point where you are physically standing, then a building. We will select a suitable entrance.'}</Text>
    {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{ color: theme.warning, fontSize: 18, marginVertical: 16 }}>{message}</Text> : null}
    {networks.map(n => choice(n.id, ar ? n.name_ar : n.name_en, n.id === networkId, () => { setNetworkId(n.id); setStart(''); setBuilding(''); }))}
    {network ? <>
      {heading(ar ? 'أنا أقف الآن عند' : 'I am standing at')}
      {network.nodes.features.filter(n => n.properties.status === 'active' && n.properties.name_ar.trim() && n.properties.name_en.trim()).map(n => choice(n.properties.id, (ar ? n.properties.name_ar : n.properties.name_en) || n.properties.id, start === n.properties.id, () => setStart(n.properties.id)))}
      {heading(ar ? 'الوجهة' : 'Destination')}
      {network.buildings.features.map(b => choice(b.properties.id, ar ? b.properties.name_ar : b.properties.name_en, building === b.properties.id, () => setBuilding(b.properties.id)))}
      {heading(ar ? 'احتياجات المسار' : 'Route needs')}
      {([
        ['safe_accessible', 'مهيأ للكراسي والتوجيه الصوتي', 'Wheelchair and voice guidance'],
        ['wheelchair', 'كرسي متحرك', 'Wheelchair'],
        ['blind_friendly', 'مكفوف أو ضعيف بصر', 'Blind or low vision'],
        ['fastest', 'أقصر مسار — قد يحتوي على سلالم', 'Shortest route — may include stairs'],
      ] as [RouteType, string, string][]).map(([id, arabic, english]) => choice(id, ar ? arabic : english, routeTypePreference === id, () => setRoutePreference(id)))}
      <PrimaryButton theme={theme} title={busy ? (ar ? 'نتحقق من المسار...' : 'Checking route...') : (ar ? 'عرض المسار' : 'Preview route')}
        accessibilityLabel={ar ? 'حساب المسار المناسب' : 'Calculate suitable route'} disabled={busy || !start || !building} onPress={() => calculate(false)} />
    </> : null}
    {plan ? <View style={{ marginVertical: 16 }}>
      {heading(ar ? `${plan.destination.name_ar} · ${plan.route.distance_meters} متر` : `${plan.destination.name_en} · ${plan.route.distance_meters} m`)}
      {plan.steps.map(step => <Text key={step.id} style={{ color: theme.text, fontSize: 18, lineHeight: 28, marginBottom: 12 }}>{step.step_order}. {ar ? step.instruction_ar : step.instruction_en}</Text>)}
      <PrimaryButton theme={theme} title={ar ? 'أنا عند البداية — ابدأ الإرشاد' : 'I am at the start — begin guidance'}
        accessibilityLabel={ar ? 'تأكيد موقعي عند البداية وبدء الإرشاد' : 'Confirm I am at the start and begin guidance'} disabled={busy} onPress={() => calculate(true)} />
    </View> : null}
    <PrimaryButton theme={theme} title={ar ? 'تحديث الشبكات' : 'Refresh networks'} accessibilityLabel={ar ? 'تحديث شبكات الحرم' : 'Refresh campus networks'} disabled={busy} onPress={load} variant="secondary" />
  </ScreenShell>;
}
