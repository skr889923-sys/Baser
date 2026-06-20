import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigationStore } from '../src/store/useNavigationStore';
import SupabaseService from '../src/services/SupabaseService';
import VoiceService from '../src/services/VoiceService';
import HapticsService from '../src/services/HapticsService';
import { NavigationPoint } from '@baser/types';
import {
  getInterfaceTheme,
  PrimaryButton,
  ScreenShell,
  SignalGlyph,
  StatusPill,
  surfaceStyle,
} from '../src/components/BlindInterface';

export default function QRScannerScreen() {
  const router = useRouter();
  const { language, isHighContrast } = useNavigationStore();
  const theme = getInterfaceTheme(isHighContrast);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [scannedPoint, setScannedPoint] = useState<NavigationPoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    VoiceService.speak(
      language === 'ar'
        ? 'شاشة مسح الرموز. وجه الكاميرا نحو ملصق بصيره لتحديد موقعك داخل المبنى.'
        : 'QR scan screen. Point the camera at a Baseera tag to identify your indoor position.'
    );
  }, [language]);

  const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
    if (!scanning || loading) return;
    setScanning(false);
    setLoading(true);
    setErrorMsg(null);
    HapticsService.trigger('arrived');

    try {
      const qrCode = await SupabaseService.getQRCodeByContent(data);
      if (qrCode && qrCode.navigation_point_id) {
        const point = await SupabaseService.getNavigationPointById(qrCode.navigation_point_id);
        if (point) {
          setScannedPoint(point);
          await SupabaseService.logQRScan(point.id);

          VoiceService.speak(
            language === 'ar'
              ? `تم التعرف على الموقع. أنت الآن عند ${point.name_ar}. ${point.audio_instruction_ar}`
              : `Location identified. You are at ${point.name_en}. ${point.audio_instruction_en}`
          );
          return;
        }
      }

      setErrorMsg(language === 'ar' ? 'هذا الرمز غير مسجل في النظام.' : 'This QR code is not registered.');
      VoiceService.speak(language === 'ar' ? 'هذا الرمز غير معروف' : 'Unknown QR code');
    } catch (error) {
      console.error('Error scanning QR:', error);
      setErrorMsg(language === 'ar' ? 'حدث خطأ أثناء المسح.' : 'Scanning failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateScan = async () => {
    if (!scanning || loading) return;
    setScanning(false);
    setLoading(true);
    setErrorMsg(null);
    HapticsService.trigger('arrived');

    try {
      const points = await SupabaseService.getNavigationPoints();
      const point = points.find(p => p.type === 'entrance') || points[0];

      if (point) {
        setScannedPoint(point);
        await SupabaseService.logQRScan(point.id);
        VoiceService.speak(
          language === 'ar'
            ? `تم مسح الرمز بنجاح. أنت الآن عند ${point.name_ar}. اختر أحد الخيارات للمتابعة.`
            : `Scan successful. You are at ${point.name_en}. Choose an option to continue.`
        );
      } else {
        setErrorMsg(language === 'ar' ? 'لا توجد نقاط ملاحية متاحة للمحاكاة.' : 'No navigation points available for simulation.');
      }
    } catch (error) {
      console.error(error);
      setErrorMsg(language === 'ar' ? 'تعذرت المحاكاة.' : 'Simulation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setScannedPoint(null);
    setErrorMsg(null);
    setScanning(true);
    VoiceService.speak(language === 'ar' ? 'جاهز للمسح مجدداً.' : 'Ready to scan again.');
  };

  const handleStartRoutingFromHere = () => {
    router.replace({
      pathname: '/destination',
      params: { startPointId: scannedPoint?.id },
    });
  };

  if (scanning) {
    return (
      <ScreenShell highContrast={isHighContrast}>
        <View style={[styles.scanHeader, surfaceStyle(theme)]}>
          <View style={styles.headerTop}>
            <StatusPill theme={theme} tone="success" text={language === 'ar' ? 'جاهز للمسح' : 'Ready to scan'} />
            <SignalGlyph label="QR" theme={theme} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>
            {language === 'ar' ? 'ثبّت الرمز داخل الإطار' : 'Keep the tag inside the frame'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {language === 'ar' ? 'سيتم نطق الموقع تلقائياً بعد التعرف على الملصق.' : 'The location will be spoken automatically after the tag is recognized.'}
          </Text>
        </View>

        <View style={[styles.cameraBox, { borderColor: errorMsg ? theme.danger : theme.border }]}>
          {permission?.granted ? (
            <>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={loading ? undefined : handleBarcodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
              <View style={[styles.aimer, { borderColor: theme.accent }]} />
            </>
          ) : (
            <View style={styles.permissionBox}>
              <Text style={[styles.cameraText, { color: theme.textMuted }]}>
                {!permission
                  ? (language === 'ar' ? 'جاري التحقق من صلاحية الكاميرا...' : 'Checking camera permission...')
                  : (language === 'ar' ? 'صلاحية الكاميرا مطلوبة للمسح.' : 'Camera permission is required for scanning.')}
              </Text>
              {!permission?.granted ? (
                <PrimaryButton
                  theme={theme}
                  title={language === 'ar' ? 'السماح بالكاميرا' : 'Grant camera access'}
                  onPress={requestPermission}
                  accessibilityLabel={language === 'ar' ? 'السماح باستخدام الكاميرا' : 'Grant camera access'}
                />
              ) : null}
            </View>
          )}
        </View>

        {errorMsg ? <Text style={[styles.errorText, { color: theme.danger }]}>{errorMsg}</Text> : null}

        <PrimaryButton
          theme={theme}
          title={language === 'ar' ? 'محاكاة مسح للتجربة' : 'Simulate scan for testing'}
          onPress={handleSimulateScan}
          variant="secondary"
          accessibilityLabel={language === 'ar' ? 'محاكاة مسح رمز' : 'Simulate QR scan'}
          accessibilityHint={language === 'ar' ? 'اضغط مرتين لتجربة نتيجة المسح بدون كاميرا' : 'Double tap to test scan result without camera'}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell highContrast={isHighContrast}>
      {loading ? (
        <View style={[styles.resultCard, surfaceStyle(theme)]}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {language === 'ar' ? 'جاري تحليل الرمز...' : 'Analyzing tag...'}
          </Text>
        </View>
      ) : scannedPoint ? (
        <View style={[styles.resultCard, surfaceStyle(theme)]}>
          <SignalGlyph label="OK" theme={theme} />
          <Text style={[styles.successTitle, { color: theme.success }]}>
            {language === 'ar' ? 'تم تحديد النقطة المرجعية' : 'Reference point identified'}
          </Text>
          <Text style={[styles.pointTitle, { color: theme.text }]}>
            {language === 'ar' ? scannedPoint.name_ar : scannedPoint.name_en}
          </Text>
          <Text style={[styles.pointDetail, { color: theme.textMuted }]}>
            {language === 'ar' ? scannedPoint.audio_instruction_ar : scannedPoint.audio_instruction_en}
          </Text>

          <PrimaryButton
            theme={theme}
            title={language === 'ar' ? 'ابدأ توجيهاً من هنا' : 'Route from here'}
            onPress={handleStartRoutingFromHere}
            accessibilityLabel={language === 'ar' ? 'ابدأ توجيهاً من هذه النقطة' : 'Start navigation from this location'}
          />
          <PrimaryButton
            theme={theme}
            title={language === 'ar' ? 'اختر وجهة أخرى' : 'Choose another destination'}
            onPress={() => router.push('/destination')}
            variant="secondary"
            accessibilityLabel={language === 'ar' ? 'اختر وجهة جديدة' : 'Choose a new destination'}
          />
          <PrimaryButton
            theme={theme}
            title={language === 'ar' ? 'إعادة المسح' : 'Scan again'}
            onPress={handleReset}
            variant="ghost"
            accessibilityLabel={language === 'ar' ? 'امسح ملصقاً آخر' : 'Scan another tag'}
          />
        </View>
      ) : (
        <View style={[styles.resultCard, surfaceStyle(theme)]}>
          <SignalGlyph label="ERR" theme={theme} danger />
          <Text style={[styles.successTitle, { color: theme.danger }]}>
            {errorMsg || (language === 'ar' ? 'فشل المسح' : 'Scan failed')}
          </Text>
          <PrimaryButton
            theme={theme}
            title={language === 'ar' ? 'حاول مرة أخرى' : 'Try again'}
            onPress={handleReset}
            variant="secondary"
            accessibilityLabel={language === 'ar' ? 'حاول المسح مرة أخرى' : 'Try scanning again'}
          />
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scanHeader: {
    borderWidth: 1.5,
    borderRadius: 28,
    padding: 20,
    marginBottom: 14,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  cameraBox: {
    width: '100%',
    height: 430,
    backgroundColor: '#0b1114',
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 14,
    overflow: 'hidden',
  },
  permissionBox: {
    width: '100%',
    padding: 18,
    alignItems: 'center',
  },
  cameraText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 18,
  },
  aimer: {
    width: 238,
    height: 238,
    borderWidth: 3,
    borderStyle: 'dashed',
    position: 'absolute',
    borderRadius: 26,
  },
  errorText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
  },
  resultCard: {
    borderWidth: 1.5,
    borderRadius: 28,
    padding: 22,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    marginTop: 18,
    marginBottom: 12,
    textAlign: 'center',
  },
  pointTitle: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  pointDetail: {
    fontSize: 16,
    lineHeight: 25,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 22,
  },
});
