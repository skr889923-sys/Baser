import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

class VoiceService {
  private lastSpokenText: string = '';
  private rate: number = 0.9; // Slightly slower for better clarity
  private language: 'ar' | 'en' = 'ar';
  private isMuted: boolean = false;

  public async speak(text: string, forceLanguage?: 'ar' | 'en'): Promise<void> {
    this.lastSpokenText = text;
    if (this.isMuted) return; // Do not speak if muted

    const activeLanguage = forceLanguage || this.language;
    const langCode = activeLanguage === 'ar' ? 'ar-SA' : 'en-US';

    console.log(`[VoiceService] Speaking: "${text}" (${langCode})`);

    try {
      if (Platform.OS === 'web') {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = langCode;
          utterance.rate = this.rate;
          window.speechSynthesis.speak(utterance);
        }
      } else {
        const isSpeaking = await Speech.isSpeakingAsync();
        if (isSpeaking) {
          await Speech.stop();
        }
        Speech.speak(text, {
          language: langCode,
          rate: this.rate,
          pitch: 1.0,
        });
      }
    } catch (error) {
      console.warn('[VoiceService] Error playing speech:', error);
    }
  }

  public async stop(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      } else {
        await Speech.stop();
      }
    } catch (error) {
      console.warn('[VoiceService] Error stopping speech:', error);
    }
  }

  public repeatLastInstruction(): void {
    if (this.lastSpokenText) {
      this.speak(this.lastSpokenText);
    } else {
      this.speak(this.language === 'ar' ? 'لا توجد تعليمات سابقة لتكرارها' : 'No previous instructions to repeat.');
    }
  }

  public setSpeechRate(rate: number): void {
    this.rate = Math.max(0.5, Math.min(2.0, rate));
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stop();
    } else {
      this.speak(this.language === 'ar' ? 'تم تفعيل الصوت' : 'Voice enabled');
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setVoiceLanguage(lang: 'ar' | 'en'): void {
    this.language = lang;
  }

  public announceLocation(pointName: string, isAr: boolean = true): void {
    const text = isAr 
      ? `أنت الآن بالقرب من: ${pointName}` 
      : `You are currently near: ${pointName}`;
    this.speak(text);
  }

  public announceRouteSummary(routeName: string, distance: number, time: number, isAr: boolean = true): void {
    const text = isAr 
      ? `تم اختيار مسار: ${routeName}. المسافة الكلية ${distance} مترًا. الزمن المتوقع للوصول ${time} دقيقة.` 
      : `Selected route: ${routeName}. Total distance is ${distance} meters. Estimated arrival time is ${time} minutes.`;
    this.speak(text);
  }
}

export default new VoiceService();
