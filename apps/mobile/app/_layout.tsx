import React, { useEffect } from 'react';
import { Platform, StyleSheet, TouchableOpacity, Text, View } from 'react-native';
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

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    document.title = language === 'ar' ? 'بصيره | Baseera' : 'Baseera';

    const ensureHeadLink = (rel: string, href: string) => {
      if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
      const link = document.createElement('link');
      link.rel = rel;
      link.href = href;
      document.head.appendChild(link);
    };

    const ensureMeta = (name: string, content: string) => {
      const existing = document.querySelector(`meta[name="${name}"]`);
      if (existing) {
        existing.setAttribute('content', content);
        return;
      }
      const meta = document.createElement('meta');
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
    };

    ensureHeadLink('manifest', '/manifest.webmanifest');
    ensureHeadLink('apple-touch-icon', '/icons/icon-192.svg');
    ensureMeta('theme-color', '#121212');
    ensureMeta('apple-mobile-web-app-capable', 'yes');
    ensureMeta('apple-mobile-web-app-title', 'Baseera');
    ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(error => {
        console.warn('[Baseera Mobile] Service worker registration failed:', error);
      });
    }
  }, [language]);

  return (
    <>
      <StatusBar style={isHighContrast ? 'light' : 'auto'} />
      <View style={styles.appFrame}>
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
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  appFrame: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    ...(Platform.OS === 'web' ? {
      maxWidth: 900,
      minHeight: '100%',
    } : null),
  },
});
