import { create } from 'zustand';
import { Route, RouteStep, NavigationPoint } from '@baser/types';
import NavigationService from '../services/NavigationService';

interface NavigationState {
  currentLocation: { latitude: number; longitude: number } | null;
  activeRoute: Route | null;
  routeSteps: RouteStep[];
  currentStepIndex: number;
  isGuiding: boolean;
  destinationPoint: NavigationPoint | null;
  deviationCount: number;
  language: 'ar' | 'en';
  routeTypePreference: 'fastest' | 'safe_accessible' | 'wheelchair' | 'blind_friendly';
  isHighContrast: boolean;
  isMuted: boolean;

  setCurrentLocation: (lat: number, lon: number) => void;
  startNavigation: (route: Route, steps: RouteStep[], destination: NavigationPoint) => void;
  stopNavigation: () => void;
  nextStep: () => void;
  prevStep: () => void;
  incrementDeviation: () => void;
  setLanguage: (lang: 'ar' | 'en') => void;
  setRoutePreference: (pref: 'fastest' | 'safe_accessible' | 'wheelchair' | 'blind_friendly') => void;
  toggleHighContrast: () => void;
  toggleMute: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  currentLocation: null,
  activeRoute: null,
  routeSteps: [],
  currentStepIndex: 0,
  isGuiding: false,
  destinationPoint: null,
  deviationCount: 0,
  language: 'ar',
  routeTypePreference: 'safe_accessible',
  isHighContrast: false,
  isMuted: false,

  setCurrentLocation: (latitude, longitude) => set({ currentLocation: { latitude, longitude } }),

  startNavigation: (route, steps, destination) => {
    set({
      activeRoute: route,
      routeSteps: steps,
      currentStepIndex: 0,
      isGuiding: true,
      destinationPoint: destination,
      deviationCount: 0,
    });
    
    // Announce summary on start
    const isAr = get().language === 'ar';
    const text = isAr 
      ? `بدء التوجيه إلى ${destination.name_ar}. المسافة الإجمالية ${route.distance_meters} مترًا.`
      : `Starting guidance to ${destination.name_en}. Total distance is ${route.distance_meters} meters.`;
    
    // Play audio/haptics
    NavigationService.speakStep(steps[0], isAr);
    NavigationService.triggerHaptic(steps[0]);
  },

  stopNavigation: () => {
    set({
      activeRoute: null,
      routeSteps: [],
      currentStepIndex: 0,
      isGuiding: false,
      destinationPoint: null,
    });
  },

  nextStep: () => {
    const { routeSteps, currentStepIndex, language } = get();
    if (currentStepIndex < routeSteps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      set({ currentStepIndex: nextIndex });
      
      const step = routeSteps[nextIndex];
      NavigationService.speakStep(step, language === 'ar');
      NavigationService.triggerHaptic(step);
    } else {
      // Arrived at the final destination
      set({ isGuiding: false });
      NavigationService.announceArrival(language === 'ar');
    }
  },

  prevStep: () => {
    const { routeSteps, currentStepIndex, language } = get();
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      set({ currentStepIndex: prevIndex });
      
      const step = routeSteps[prevIndex];
      NavigationService.speakStep(step, language === 'ar');
      NavigationService.triggerHaptic(step);
    }
  },

  incrementDeviation: () => {
    set(state => ({ deviationCount: state.deviationCount + 1 }));
    NavigationService.announceDeviation(get().language === 'ar');
  },

  setLanguage: (language) => set({ language }),
  setRoutePreference: (routeTypePreference) => set({ routeTypePreference }),
  toggleHighContrast: () => set(state => ({ isHighContrast: !state.isHighContrast })),
  toggleMute: () => {
    const isMutedNow = VoiceService.toggleMute();
    set({ isMuted: isMutedNow });
  },
}));
