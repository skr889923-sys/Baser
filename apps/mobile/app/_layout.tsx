import React, { useEffect } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useNavigationStore } from '../src/store/useNavigationStore';
import VoiceService from '../src/services/VoiceService';

export default function RootLayout() {
  const { language, isHighContrast, isMuted, toggleMute } = useNavigationStore();

  useEffect(() => {
    // Set initial voice service configs
    VoiceService.setVoiceLanguage(language);
  }, [language]);

  return (
    <>
      <StatusBar style={isHighContrast ? 'light' : 'auto'} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: isHighContrast ? '#000000' : '#1A5F7A',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 22,
          },
          headerTitleAlign: 'center',
          animation: 'slide_from_right',
          headerRight: () => (
            <TouchableOpacity 
              onPress={toggleMute}
              style={{ marginRight: 15 }}
              accessible={true}
              accessibilityLabel={language === 'ar' ? (isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت') : (isMuted ? 'Unmute voice' : 'Mute voice')}
            >
              <Text style={{ fontSize: 24 }}>{isMuted ? '🔇' : '🔊'}</Text>
            </TouchableOpacity>
          ),
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="permissions" options={{ title: language === 'ar' ? 'الصلاحيات المطلوبة' : 'Required Permissions' }} />
        <Stack.Screen name="home" options={{ title: language === 'ar' ? 'الرئيسية' : 'Home' }} />
        <Stack.Screen name="destination" options={{ title: language === 'ar' ? 'اختر الوجهة' : 'Select Destination' }} />
        <Stack.Screen name="details" options={{ title: language === 'ar' ? 'تفاصيل الوجهة' : 'Destination Details' }} />
        <Stack.Screen name="navigation" options={{ title: language === 'ar' ? 'شاشة الإرشاد الملاحي' : 'Navigation HUD' }} />
        <Stack.Screen name="qr-scanner" options={{ title: language === 'ar' ? 'مسح الرمز QR' : 'Scan QR Code' }} />
        <Stack.Screen name="where-am-i" options={{ title: language === 'ar' ? 'أين أنا؟' : 'Where Am I?' }} />
        <Stack.Screen name="emergency" options={{ title: language === 'ar' ? 'طوارئ SOS' : 'Emergency SOS' }} />
        <Stack.Screen name="report" options={{ title: language === 'ar' ? 'إبلاغ عن عائق' : 'Report Obstacle' }} />
        <Stack.Screen name="settings" options={{ title: language === 'ar' ? 'الإعدادات' : 'Settings' }} />
      </Stack>
    </>
  );
}
