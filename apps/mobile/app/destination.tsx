import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import SupabaseService from '../src/services/SupabaseService';
import { NavigationPoint } from '@dallni/types';
import VoiceService from '../src/services/VoiceService';

type CategoryFilter = 'all' | 'college' | 'restroom' | 'elevator' | 'ramp' | 'services';

export default function DestinationScreen() {
  const router = useRouter();
  const { language, isHighContrast } = useNavigationStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [points, setPoints] = useState<NavigationPoint[]>([]);

  useEffect(() => {
    // Load points
    const loadPoints = async () => {
      const data = await SupabaseService.getNavigationPoints();
      setPoints(data);
    };
    loadPoints();

    VoiceService.speak(
      language === 'ar'
        ? 'شاشة اختيار الوجهة. اكتب اسم وجهتك في مربع البحث، أو تصفح القوائم أدناه.'
        : 'Select destination screen. Search by typing, or browse through the categories below.'
    );
  }, [language]);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  // Filter logic
  const filteredPoints = points.filter(p => {
    // Category match
    const categoryMatch = 
      selectedCategory === 'all' || 
      (selectedCategory === 'college' && (p.type === 'entrance' || p.type === 'hall' || p.building_id !== null)) ||
      (selectedCategory === 'restroom' && p.type === 'restroom') ||
      (selectedCategory === 'elevator' && p.type === 'elevator') ||
      (selectedCategory === 'ramp' && p.type === 'ramp') ||
      (selectedCategory === 'services' && (p.type === 'office' || p.type === 'hall'));

    // Search query match
    const query = searchQuery.toLowerCase().trim();
    const searchMatch = 
      query === '' ||
      p.name_ar.toLowerCase().includes(query) ||
      p.name_en.toLowerCase().includes(query) ||
      p.description_ar.toLowerCase().includes(query) ||
      p.description_en.toLowerCase().includes(query);

    return categoryMatch && searchMatch;
  });

  const announceResultCount = () => {
    const count = filteredPoints.length;
    const msg = language === 'ar'
      ? `وجدنا ${count} وجهات مطابقة.`
      : `Found ${count} matching destinations.`;
    VoiceService.speak(msg);
  };

  const handleSelectPoint = (point: NavigationPoint) => {
    VoiceService.stop();
    // Navigate to details screen with the point ID
    router.push({
      pathname: '/details',
      params: { pointId: point.id }
    });
  };

  const styles = getStyles(isHighContrast);

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder={language === 'ar' ? '🔍 ابحث عن مبنى، قاعة، أو مكتب...' : '🔍 Search for building, room, or office...'}
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={handleSearchChange}
          onSubmitEditing={announceResultCount}
          accessible={true}
          accessibilityLabel={language === 'ar' ? 'حقل البحث عن الوجهة' : 'Search destination query'}
          accessibilityHint={language === 'ar' ? 'اكتب هنا ثم اضغط إدخال لسماع عدد النتائج' : 'Type here and press enter to hear count of matches'}
        />
      </View>

      {/* Category Tabs */}
      <View style={styles.tabScrollContainer}>
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {[
            { key: 'all', ar: 'الكل', en: 'All' },
            { key: 'college', ar: 'الكليات', en: 'Colleges' },
            { key: 'elevator', ar: 'المصاعد', en: 'Elevators' },
            { key: 'restroom', ar: 'دورات المياه', en: 'Restrooms' },
            { key: 'ramp', ar: 'المنحدرات', en: 'Ramps' },
            { key: 'services', ar: 'الخدمات', en: 'Services' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, selectedCategory === tab.key && styles.activeTab]}
              onPress={() => setSelectedCategory(tab.key as CategoryFilter)}
              accessible={true}
              accessibilityLabel={language === 'ar' ? `تصنيف ${tab.ar}` : `${tab.en} category`}
              accessibilityState={{ selected: selectedCategory === tab.key }}
            >
              <Text style={styles.tabText}>
                {language === 'ar' ? tab.ar : tab.en}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* FlatList of Points */}
      <FlatList
        data={filteredPoints}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.pointItem}
            onPress={() => handleSelectPoint(item)}
            accessible={true}
            accessibilityLabel={language === 'ar' ? item.name_ar : item.name_en}
            accessibilityHint={
              language === 'ar' 
                ? `اضغط مرتين لعرض تفاصيل المسار والبدء إلى ${item.name_ar}` 
                : `Double tap to open route details for ${item.name_en}`
            }
          >
            <View style={styles.pointHeader}>
              <Text style={styles.pointEmoji}>
                {item.type === 'elevator' ? '🛗' : item.type === 'restroom' ? '🚻' : item.type === 'ramp' ? '♿' : '🏢'}
              </Text>
              <View style={styles.pointTitleCol}>
                <Text style={styles.pointName}>
                  {language === 'ar' ? item.name_ar : item.name_en}
                </Text>
                <Text style={styles.pointDescription} numberOfLines={2}>
                  {language === 'ar' ? item.description_ar : item.description_en}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyView}>
            <Text style={styles.emptyText}>
              {language === 'ar' ? 'لا توجد نتائج مطابقة لبحثك.' : 'No matching results found.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const getStyles = (highContrast: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: highContrast ? '#000000' : '#121212',
  },
  searchSection: {
    padding: 16,
    backgroundColor: highContrast ? '#000000' : '#1E272C',
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    color: '#000000',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 14,
    fontSize: 20,
    fontWeight: 'bold',
  },
  tabScrollContainer: {
    height: 60,
    marginVertical: 10,
  },
  tabsRow: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  tab: {
    backgroundColor: '#2C3E50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#34495E',
  },
  activeTab: {
    backgroundColor: highContrast ? '#1A5F7A' : '#1F8A70',
    borderColor: highContrast ? '#FFFF00' : '#1F8A70',
  },
  tabText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  pointItem: {
    backgroundColor: '#1E272C',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#34495E',
  },
  pointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  pointTitleCol: {
    flex: 1,
  },
  pointName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pointDescription: {
    color: '#B0B0B0',
    fontSize: 14,
  },
  emptyView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#CCCCCC',
    fontSize: 18,
    textAlign: 'center',
  },
});
