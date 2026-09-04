import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import SupabaseService from '../src/services/SupabaseService';
import { NavigationPoint } from '@baser/types';
import VoiceService from '../src/services/VoiceService';
import {
  getInterfaceTheme,
  ScreenShell,
  SignalGlyph,
  StatePanel,
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

  const loadPoints = useCallback(async () => {
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
  }, [language]);

  useEffect(() => {
    loadPoints();
  }, [loadPoints]);

  useEffect(() => {
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
              textAlign: language === 'ar' ? 'right' : 'left',
            },
          ]}
          placeholder={language === 'ar' ? 'ابحث عن مبنى، قاعة، مكتب...' : 'Search building, room, office...'}
          placeholderTextColor={theme.textSoft}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={announceResultCount}
          returnKeyType="search"
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
              accessibilityRole="button"
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
        <View
          style={styles.skeletonList}
          accessible={true}
          accessibilityLabel={language === 'ar' ? 'جاري تحميل الوجهات' : 'Loading destinations'}
        >
          {[0, 1, 2].map(item => (
            <View key={item} style={[styles.skeletonItem, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
              <View style={[styles.skeletonGlyph, { backgroundColor: theme.accentSoft }]} />
              <View style={styles.skeletonCopy}>
                <View style={[styles.skeletonLineStrong, { backgroundColor: theme.raised }]} />
                <View style={[styles.skeletonLine, { backgroundColor: theme.mutedSurface }]} />
              </View>
            </View>
          ))}
          <Text style={[styles.loadingLabel, { color: theme.textMuted }]}>
            {language === 'ar' ? 'نجهّز فهرس الوجهات' : 'Preparing destination index'}
          </Text>
        </View>
      ) : error ? (
        <StatePanel
          code="ERR"
          tone="danger"
          theme={theme}
          title={language === 'ar' ? 'تعذر الوصول إلى الوجهات' : 'Destinations are unavailable'}
          description={language === 'ar' ? 'تحقق من الاتصال ثم أعد المحاولة. لن نفقد بحثك الحالي.' : 'Check the connection and try again. Your current search will be preserved.'}
          actionTitle={language === 'ar' ? 'إعادة المحاولة' : 'Try again'}
          actionLabel={language === 'ar' ? 'إعادة تحميل الوجهات' : 'Reload destinations'}
          onAction={loadPoints}
        />
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
              accessibilityRole="button"
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
            <StatePanel
              code={searchQuery || selectedCategory !== 'all' ? 'ZERO' : 'SYNC'}
              tone={searchQuery || selectedCategory !== 'all' ? 'normal' : 'warning'}
              theme={theme}
              title={
                searchQuery || selectedCategory !== 'all'
                  ? (language === 'ar' ? 'لا توجد نتائج مطابقة' : 'No matching results')
                  : (language === 'ar' ? 'لا توجد وجهات متاحة الآن' : 'No destinations are available')
              }
              description={
                searchQuery || selectedCategory !== 'all'
                  ? (language === 'ar' ? 'غيّر عبارة البحث أو اعرض جميع التصنيفات.' : 'Change the search phrase or show every category.')
                  : (language === 'ar' ? 'أعد مزامنة البيانات أو استخدم مسح QR لتثبيت موقعك.' : 'Refresh campus data or use a QR tag to set your position.')
              }
              actionTitle={
                searchQuery || selectedCategory !== 'all'
                  ? (language === 'ar' ? 'مسح عوامل البحث' : 'Clear filters')
                  : (language === 'ar' ? 'مزامنة الوجهات' : 'Refresh destinations')
              }
              actionLabel={
                searchQuery || selectedCategory !== 'all'
                  ? (language === 'ar' ? 'مسح البحث والتصنيف' : 'Clear search and category')
                  : (language === 'ar' ? 'إعادة تحميل بيانات الوجهات' : 'Reload destination data')
              }
              onAction={() => {
                if (searchQuery || selectedCategory !== 'all') {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  return;
                }
                loadPoints();
              }}
            />
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
  skeletonList: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
  },
  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 94,
    padding: 16,
    borderWidth: 1.5,
    borderRadius: 22,
    marginBottom: 12,
    opacity: 0.82,
  },
  skeletonGlyph: {
    width: 60,
    height: 48,
    borderRadius: 16,
  },
  skeletonCopy: {
    flex: 1,
    marginLeft: 14,
    gap: 10,
  },
  skeletonLineStrong: {
    width: '68%',
    height: 15,
    borderRadius: 8,
  },
  skeletonLine: {
    width: '92%',
    height: 11,
    borderRadius: 6,
  },
  loadingLabel: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
});
