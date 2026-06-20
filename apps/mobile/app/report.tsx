import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigationStore } from '../src/store/useNavigationStore';
import SupabaseService from '../src/services/SupabaseService';
import NavigationService from '../src/services/NavigationService';
import VoiceService from '../src/services/VoiceService';
import HapticsService from '../src/services/HapticsService';
import { ReportType } from '@baser/types';
import * as Location from 'expo-location';

export default function ReportScreen() {
  const router = useRouter();
  const { language, isHighContrast } = useNavigationStore();

  const [reportType, setReportType] = useState<ReportType>('obstacle');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    VoiceService.speak(
      language === 'ar'
        ? 'شاشة الإبلاغ عن عائق. تصفح خيارات الإبلاغ الأربعة الكبيرة على الشاشة لتحديد نوع المشكلة، أو اكتب تفاصيل في حقل النص بالأسفل.'
        : 'Report obstacle screen. Browse the four large options to choose the issue type, or type details in the text field.'
    );
  }, [language]);

  const handleSelectType = (type: ReportType, nameAr: string, nameEn: string) => {
    HapticsService.trigger('continue');
    setReportType(type);
    VoiceService.speak(language === 'ar' ? `تم اختيار: ${nameAr}` : `Selected: ${nameEn}`);
  };

  const handleSubmit = async () => {
    setLoading(true);
    HapticsService.trigger('continue');

    try {
      let latitude: number | null = null;
      let longitude: number | null = null;
      let navigationPointId: string | null = null;
      let buildingId: string | null = null;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const currentLocation = await Location.getCurrentPositionAsync({});
          latitude = currentLocation.coords.latitude;
          longitude = currentLocation.coords.longitude;

          const nearestPoint = await NavigationService.getNearestPoint(latitude, longitude);
          navigationPointId = nearestPoint?.id || null;
          buildingId = nearestPoint?.building_id || null;
        }
      } catch (locationError) {
        console.warn('[ReportScreen] Report submitted without live location:', locationError);
      }

      await SupabaseService.submitReport({
        user_id: null,
        report_type: reportType,
        title: language === 'ar' ? `تقرير عائق: ${reportType}` : `Obstacle report: ${reportType}`,
        description: description || (language === 'ar' ? 'بلاغ مرسل من الجوال بدون تفاصيل إضافية' : 'Report sent from mobile without additional details'),
        latitude,
        longitude,
        navigation_point_id: navigationPointId,
        building_id: buildingId
      });

      const successMsg = language === 'ar'
        ? 'تم إرسال بلاغك للأمان بنجاح. نشكرك على مساعدتنا في الحفاظ على سلامة الجميع.'
        : 'Your report has been successfully submitted. Thank you for keeping the campus safe.';
      
      VoiceService.speak(successMsg);
      router.replace('/home');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const styles = getStyles(isHighContrast);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionHeader}>
        {language === 'ar' ? 'اختر نوع المشكلة:' : 'Select issue type:'}
      </Text>

      {/* Grid of Report Types */}
      <View style={styles.grid}>
        {[
          { key: 'obstacle', ar: '🚧 عائق في الممر', en: '🚧 Obstacle on way' },
          { key: 'closed_door', ar: '🚪 باب مغلق', en: '🚪 Closed door' },
          { key: 'broken_elevator', ar: '🛗 مصعد معطل', en: '🛗 Broken elevator' },
          { key: 'maintenance_work', ar: '🛠️ أعمال صيانة', en: '🛠️ Maintenance work' },
        ].map(item => (
          <TouchableOpacity
            key={item.key}
            style={[styles.tileBtn, reportType === item.key && styles.activeTileBtn]}
            onPress={() => handleSelectType(item.key as ReportType, item.ar, item.en)}
            accessible={true}
            accessibilityLabel={language === 'ar' ? item.ar : item.en}
            accessibilityState={{ selected: reportType === item.key }}
          >
            <Text style={styles.tileBtnText}>
              {language === 'ar' ? item.ar : item.en}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Additional Text Info */}
      <Text style={styles.sectionHeader}>
        {language === 'ar' ? 'تفاصيل إضافية (اختياري):' : 'Additional details (optional):'}
      </Text>
      <TextInput
        style={styles.textInput}
        multiline={true}
        numberOfLines={3}
        placeholder={language === 'ar' ? 'اكتب هنا تفاصيل مثل: الممر المقابل للقاعة 101...' : 'Type details here like: Corridor in front of Class 101...'}
        placeholderTextColor="#888"
        value={description}
        onChangeText={setDescription}
        accessible={true}
        accessibilityLabel={language === 'ar' ? 'حقل كتابة تفاصيل البلاغ' : 'Additional details text input'}
      />

      {/* Submit Button */}
      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleSubmit}
        disabled={loading}
        accessible={true}
        accessibilityLabel={language === 'ar' ? 'إرسال البلاغ الآن' : 'Submit report now'}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <Text style={styles.submitBtnText}>
            {language === 'ar' ? 'إرسال البلاغ' : 'Submit Report'}
          </Text>
        )}
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
  sectionHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  tileBtn: {
    width: '48%',
    backgroundColor: '#1E272C',
    paddingVertical: 22,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#34495E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  activeTileBtn: {
    backgroundColor: highContrast ? '#1A5F7A' : '#1F8A70',
    borderColor: highContrast ? '#FFFF00' : '#1F8A70',
  },
  tileBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  textInput: {
    backgroundColor: '#1E272C',
    color: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#34495E',
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 32,
  },
  submitBtn: {
    backgroundColor: highContrast ? '#FFFF00' : '#1F8A70',
    paddingVertical: 22,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: highContrast ? '#000000' : '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
});
