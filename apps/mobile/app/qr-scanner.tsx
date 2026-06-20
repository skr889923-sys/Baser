import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigationStore } from '../src/store/useNavigationStore';
import SupabaseService from '../src/services/SupabaseService';
import VoiceService from '../src/services/VoiceService';
import HapticsService from '../src/services/HapticsService';
import { NavigationPoint } from '@dallni/types';

export default function QRScannerScreen() {
  const router = useRouter();
  const { language, isHighContrast } = useNavigationStore();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [scannedPoint, setScannedPoint] = useState<NavigationPoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    VoiceService.speak(
      language === 'ar'
        ? 'شاشة مسح الرموز. وجه الكاميرا نحو ملصق كيو أر الإرشادي، أو اضغط زر المحاكاة.'
        : 'Scan QR tag screen. Point the camera at a guidance tag, or press the simulation button.'
    );
  }, [language]);

  const handleBarcodeScanned = async ({ type, data }: { type: string, data: string }) => {
    if (!scanning || loading) return;
    setScanning(false);
    setLoading(true);
    setErrorMsg(null);
    HapticsService.trigger('arrived');

    try {
      // First, look up the QR code by its content string
      const qrCode = await SupabaseService.getQRCodeByContent(data);
      if (qrCode && qrCode.navigation_point_id) {
        // Then, fetch the associated navigation point
        const point = await SupabaseService.getNavigationPointById(qrCode.navigation_point_id);
        if (point) {
          setScannedPoint(point);
          await SupabaseService.logQRScan(point.id);
          
          const welcomeSpeech = language === 'ar'
            ? `تم التعرف على الموقع بنجاح. أنت الآن عند: ${point.name_ar}. ${point.audio_instruction_ar}`
            : `Location identified successfully. You are currently at: ${point.name_en}. ${point.audio_instruction_en}`;
          
          VoiceService.speak(welcomeSpeech);
          setLoading(false);
          return;
        }
      }
      
      // If we reach here, the QR code wasn't recognized or linked
      setErrorMsg(language === 'ar' ? 'عذراً، هذا الرمز غير مسجل في النظام.' : 'Sorry, this QR code is not registered.');
      VoiceService.speak(language === 'ar' ? 'هذا الرمز غير معروف' : 'Unknown QR code');
      
    } catch (error) {
      console.error('Error scanning QR:', error);
      setErrorMsg(language === 'ar' ? 'حدث خطأ أثناء المسح.' : 'Error occurred while scanning.');
    } finally {
      setLoading(false);
    }
  };

  // Simulate scanning the College of Computer Science entrance QR code
  const handleSimulateScan = async () => {
    if (!scanning || loading) return;
    setScanning(false);
    setLoading(true);
    setErrorMsg(null);
    HapticsService.trigger('arrived');
    
    try {
      const csEntrancePointId = 'p1111111-1111-1111-1111-111111111002';
      const points = await SupabaseService.getNavigationPoints();
      const point = points.find(p => p.id === csEntrancePointId);
      
      if (point) {
        setScannedPoint(point);
        await SupabaseService.logQRScan(point.id);
        
        const welcomeSpeech = language === 'ar'
          ? `تم مسح الرمز بنجاح. أنت الآن عند: الباب التلقائي الرئيسي لكلية الحاسب. الدور الأرضي. المصعد في نهاية الممر على يسارك مسافة 25 متراً. ودورة المياه المهيأة على بعد 12 متراً في الممر الأيمن. اختر أحد الخيارات المتاحة للمتابعة.`
          : `Scan successful. You are currently at: CS Main Automatic Door, Ground Floor. The elevator is at the end of the left corridor, 25 meters away. The accessible restroom is 12 meters down the right corridor. Choose an option to proceed.`;
        
        VoiceService.speak(welcomeSpeech);
      } else {
        setErrorMsg('Simulation point not found in DB.');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setScannedPoint(null);
    setErrorMsg(null);
    setScanning(true);
    VoiceService.speak(language === 'ar' ? 'جاهز للمسح مجددًا.' : 'Ready to scan again.');
  };

  const handleStartRoutingFromHere = () => {
    router.replace({
      pathname: '/destination',
      params: { startPointId: scannedPoint?.id }
    });
  };

  const styles = getStyles(isHighContrast);

  return (
    <View style={styles.container}>
      {scanning ? (
        <View style={styles.scanContainer}>
          {Platform.OS !== 'web' && permission?.granted ? (
            <View style={styles.cameraBox}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={loading ? undefined : handleBarcodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ["qr"],
                }}
              />
              <View style={styles.aimer} />
            </View>
          ) : (
            <View style={styles.cameraBox}>
              <Text style={styles.cameraText}>
                {Platform.OS === 'web' 
                  ? (language === 'ar' ? 'الكاميرا غير مدعومة على متصفح الويب' : 'Camera not supported on Web')
                  : (!permission 
                      ? (language === 'ar' ? 'جاري طلب صلاحية الكاميرا...' : 'Requesting camera permission...')
                      : (language === 'ar' ? 'صلاحية الكاميرا مطلوبة' : 'Camera permission required')
                    )}
              </Text>
              {!permission?.granted && Platform.OS !== 'web' && (
                <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                  <Text style={styles.permissionBtnText}>
                    {language === 'ar' ? 'السماح بالكاميرا' : 'Grant Permission'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {errorMsg && (
            <Text style={styles.errorText}>{errorMsg}</Text>
          )}

          <TouchableOpacity
            style={styles.simulateBtn}
            onPress={handleSimulateScan}
            accessible={true}
            accessibilityLabel={language === 'ar' ? 'محاكاة مسح رمز مدخل كلية الحاسب' : 'Simulate scan of CS entrance tag'}
            accessibilityHint="اضغط مرتين لتخطي المسح بالكاميرا وتجربة النتيجة"
          >
            <Text style={styles.simulateBtnText}>
              {language === 'ar' ? '⚡ محاكاة مسح الرمز للمطورين' : '⚡ Simulate Scan (Dev)'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.resultContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#1A5F7A" />
          ) : (
            scannedPoint ? (
              <View style={styles.card}>
                <Text style={styles.successEmoji}>🎯</Text>
                <Text style={styles.successHeader}>
                  {language === 'ar' ? 'تم التعرف على النقطة المرجعية!' : 'Reference point identified!'}
                </Text>
                
                <Text style={styles.pointTitle}>
                  {language === 'ar' ? scannedPoint.name_ar : scannedPoint.name_en}
                </Text>
                <Text style={styles.pointDetail}>
                  {language === 'ar' ? scannedPoint.audio_instruction_ar : scannedPoint.audio_instruction_en}
                </Text>

                {/* Scanned Point Action Options */}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={handleStartRoutingFromHere}
                  accessible={true}
                  accessibilityLabel={language === 'ar' ? 'ابدأ توجيهًا ملاحيًا من هذه النقطة' : 'Start navigation from this location'}
                >
                  <Text style={styles.actionBtnText}>🚀 {language === 'ar' ? 'ابدأ توجيهًا من هنا' : 'Route from here'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.secondaryActionBtn]}
                  onPress={() => router.push('/destination')}
                  accessible={true}
                  accessibilityLabel={language === 'ar' ? 'استكشف وجهات أخرى' : 'Explore other destinations'}
                >
                  <Text style={styles.actionBtnText}>🔍 {language === 'ar' ? 'اختر وجهة جديدة' : 'Choose destination'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={handleReset}
                  accessible={true}
                  accessibilityLabel={language === 'ar' ? 'امسح ملصقًا آخر' : 'Scan another tag'}
                >
                  <Text style={styles.resetBtnText}>🔄 {language === 'ar' ? 'إعادة مسح' : 'Scan Again'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.successEmoji}>❌</Text>
                <Text style={styles.successHeader}>
                  {errorMsg || (language === 'ar' ? 'فشل المسح' : 'Scan Failed')}
                </Text>
                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={handleReset}
                >
                  <Text style={styles.resetBtnText}>🔄 {language === 'ar' ? 'حاول مرة أخرى' : 'Try Again'}</Text>
                </TouchableOpacity>
              </View>
            )
          )}
        </View>
      )}
    </View>
  );
}

const getStyles = (highContrast: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: highContrast ? '#000000' : '#121212',
    padding: 20,
    justifyContent: 'center',
  },
  scanContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  cameraBox: {
    width: '100%',
    flex: 1,
    maxHeight: 500,
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 32,
    overflow: 'hidden',
  },
  cameraText: {
    color: '#888',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 20,
  },
  permissionBtn: {
    backgroundColor: '#1A5F7A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  permissionBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  aimer: {
    width: 250,
    height: 250,
    borderColor: '#FFFF00',
    borderWidth: 3,
    borderStyle: 'dashed',
    position: 'absolute',
    borderRadius: 20,
  },
  simulateBtn: {
    backgroundColor: highContrast ? '#FFFF00' : '#1A5F7A',
    width: '100%',
    paddingVertical: 22,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  simulateBtnText: {
    color: highContrast ? '#000000' : '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  resultContainer: {
    alignItems: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: '#1E272C',
    padding: 24,
    borderRadius: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1A5F7A',
  },
  successEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  successHeader: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4ADE80',
    marginBottom: 16,
    textAlign: 'center',
  },
  pointTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  pointDetail: {
    fontSize: 16,
    color: '#A0AAB2',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  actionBtn: {
    backgroundColor: '#2E8B57',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryActionBtn: {
    backgroundColor: '#1A5F7A',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resetBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4A5054',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  resetBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
