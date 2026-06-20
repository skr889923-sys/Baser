import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import SupabaseService from '../src/services/SupabaseService';
import { NavigationPoint } from '@baser/types';
import VoiceService from '../src/services/VoiceService';
import {
  getInterfaceTheme,
  ScreenShell,
  SignalGlyph,
  StatusPill,
  surfaceStyle,
} from '../src/components/BlindInterface';

type CategoryFilter = 'all' | 'college' | 'restroom' | 'elevator' | 'ramp' | 'services';

const categories: Array<{ key: CategoryFilter; ar: string; en: string; code: string }> = [
  { key: 'all', ar: 'الكل', en: 'All', code: 'ALL' },
  { key: 'college', ar: 'الكليات', en: 'Colleges', code: 'COL' },
  { key: 'elevator', ar: 'المصاعد', en: 'Elevators', code: 'LFT' },
  { key: 'restroom', ar: 'دورات المياه', en: 'Restrooms', code: 'WC' },
  { key: 'ramp', ar: 'المنحدرات', en: 'Ramps', code: 'RMP' },
  { key: 'services', ar: 'الخدمات', en: 'Services', code: 'SRV' },
];

function getPointCode(type: string) {
  if (type === 'elevator') return 'LFT';
  if (type === 'restroom') return 'WC';
  if (type === 'ramp') return 'RMP';
  if (type === 'office') return 'OFF';
  if (type === 'intersection') return 'JNC';
  return 'LOC';
}

export default function DestinationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const startPointId = params.startPointId as string | undefined;
  const { language, isHighContrast } = useNavigationStore();
  const theme = getInterfaceTheme(isHighContrast);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [points, setPoints] = useState<NavigationPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPoints = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await SupabaseService.getNavigationPoints();
        setPoints(data);
      } catch (loadError) {
        console.error(loadError);
        setError(language === 'ar' ? 'تعذر تحميل الوجهات.' : 'Could not load destinations.');
      } finally {
        setLoading(false);
      }
    };

    loadPoints();
    VoiceService.speak(
      language === 'ar'
        ? 'شاشة اختيار الوجهة. استخدم البحث أو اختر تصنيفاً ثم اضغط على الوجهة المطلوبة.'
        : 'Destination selection screen. Use search or select a category, then choose a destination.'
    );
  }, [language]);

  const filteredPoints = useMemo(() => {
    return points.filter(point => {
      const categoryMatch =
        selectedCategory === 'all' ||
        (selectedCategory === 'college' && (point.type === 'entrance' || point.type === 'hall' || point.building_id !== null)) ||
        (selectedCategory === 'restroom' && point.type === 'restroom') ||
        (selectedCategory === 'elevator' && point.type === 'elevator') ||
        (selectedCategory === 'ramp' && point.type === 'ramp') ||
        (selectedCategory === 'services' && (point.type === 'office' || point.type === 'hall'));

      const query = searchQuery.toLowerCase().trim();
      const searchText = [
        point.name_ar,
        point.name_en,
        point.description_ar || '',
        point.description_en || '',
      ].join(' ').toLowerCase();

      return categoryMatch && (query === '' || searchText.includes(query));
    });
  }, [points, searchQuery, selectedCategory]);

  const announceResultCount = () => {
    VoiceService.speak(
      language === 'ar'
        ? `وجدنا ${filteredPoints.length} وجهات مطابقة.`
        : `Found ${filteredPoints.length} matching destinations.`
    );
  };

  const handleSelectPoint = (point: NavigationPoint) => {
    VoiceService.stop();
    router.push({
      pathname: '/details',
      params: startPointId ? { pointId: point.id, startPointId } : { pointId: point.id },
    });
  };

  return (
    <ScreenShell highContrast={isHighContrast} padded={false}>
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <Text style={[styles.eyebrow, { color: theme.accent }]}>
          {language === 'ar' ? 'فهرس الوجهات' : 'Destination index'}
        </Text>
        <Text style={[styles.title, { color: theme.text }]}>
          {language === 'ar' ? 'إلى أين تريد الذهاب؟' : 'Where do you want to go?'}
        </Text>
        <View style={styles.statusRow}>
          <StatusPill theme={theme} text={language === 'ar' ? `${filteredPoints.length} نتيجة` : `${filteredPoints.length} results`} />
          {startPointId ? (
            <StatusPill theme={theme} tone="success" text={language === 'ar' ? 'بداية من QR' : 'QR start point'} />
          ) : null}
        </View>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder={language === 'ar' ? 'ابحث عن مبنى، قاعة، مكتب...' : 'Search building, room, office...'}
          placeholderTextColor={theme.textSoft}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={announceResultCount}
          accessible={true}
          accessibilityLabel={language === 'ar' ? 'حقل البحث عن الوجهة' : 'Destination search field'}
          accessibilityHint={language === 'ar' ? 'اكتب اسم الوجهة ثم اضغط إدخال لسماع عدد النتائج' : 'Type a destination and press enter to hear result count'}
        />
      </View>

      <View style={[styles.categories, { backgroundColor: theme.background }]}>
        {categories.map(category => {
          const selected = selectedCategory === category.key;
          return (
            <TouchableOpacity
              key={category.key}
              style={[
                styles.categoryButton,
                {
                  backgroundColor: selected ? theme.accentDark : theme.surface,
                  borderColor: selected ? theme.accent : theme.borderSoft,
                },
              ]}
              onPress={() => setSelectedCategory(category.key)}
              accessible={true}
              accessibilityLabel={language === 'ar' ? `تصنيف ${category.ar}` : `${category.en} category`}
              accessibilityState={{ selected }}
              activeOpacity={0.82}
            >
              <Text style={[styles.categoryCode, { color: selected ? theme.accent : theme.textSoft }]}>
                {category.code}
              </Text>
              <Text style={[styles.categoryText, { color: theme.text }]}>
                {language === 'ar' ? category.ar : category.en}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={[styles.stateBox, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.stateText, { color: theme.textMuted }]}>
            {language === 'ar' ? 'جاري تحميل الوجهات...' : 'Loading destinations...'}
          </Text>
        </View>
      ) : error ? (
        <View style={[styles.stateBox, { backgroundColor: theme.background }]}>
          <Text style={[styles.stateText, { color: theme.danger }]}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPoints}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContainer, { backgroundColor: theme.background }]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.pointItem, surfaceStyle(theme)]}
              onPress={() => handleSelectPoint(item)}
              accessible={true}
              accessibilityLabel={language === 'ar' ? item.name_ar : item.name_en}
              accessibilityHint={
                language === 'ar'
                  ? `اضغط مرتين لعرض تفاصيل المسار إلى ${item.name_ar}`
                  : `Double tap to open route details for ${item.name_en}`
              }
              activeOpacity={0.85}
            >
              <SignalGlyph label={getPointCode(item.type)} theme={theme} />
              <View style={styles.pointTitleCol}>
                <Text style={[styles.pointName, { color: theme.text }]}>
                  {language === 'ar' ? item.name_ar : item.name_en}
                </Text>
                <Text style={[styles.pointDescription, { color: theme.textMuted }]} numberOfLines={2}>
                  {language === 'ar' ? item.description_ar : item.description_en}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <Text style={[styles.stateText, { color: theme.textMuted }]}>
                {language === 'ar' ? 'لا توجد نتائج مطابقة. جرّب كلمة أخرى أو غيّر التصنيف.' : 'No matching results. Try another term or category.'}
              </Text>
            </View>
          }
        />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 18,
    paddingBottom: 12,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    marginBottom: 14,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 17,
    paddingHorizontal: 18,
    fontSize: 18,
    fontWeight: '800',
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  categoryButton: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 96,
  },
  categoryCode: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '900',
  },
  listContainer: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  pointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
  },
  pointTitleCol: {
    flex: 1,
    marginLeft: 14,
  },
  pointName: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    marginBottom: 5,
  },
  pointDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  stateBox: {
    flex: 1,
    minHeight: 260,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  stateText: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 12,
  },
  emptyView: {
    paddingVertical: 46,
  },
});
