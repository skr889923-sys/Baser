import { create } from 'zustand';
import { canStartNavigation } from '@baser/navigation';
import type { NetworkPlan } from '@baser/navigation';
import CampusNetworkService from '../services/CampusNetworkService';
import { Route, RouteStep, NavigationPoint } from '@baser/types';
import NavigationService from '../services/NavigationService';
import VoiceService from '../services/VoiceService';

interface NavigationState {
  activeNetwork: NetworkPlan['network'] | null;
  isCheckingRoute: boolean;
  routeError: string;
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
  startNavigation: (route: Route, steps: RouteStep[], destination: NavigationPoint, network?: NetworkPlan['network']) => boolean;
  stopNavigation: () => void;
  nextStep: () => Promise<void>;
  prevStep: () => Promise<void>;
  incrementDeviation: () => void;
  setLanguage: (lang: 'ar' | 'en') => void;
  setRoutePreference: (pref: 'fastest' | 'safe_accessible' | 'wheelchair' | 'blind_friendly') => void;
  toggleHighContrast: () => void;
  toggleMute: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  activeNetwork: null,
  isCheckingRoute: false,
  routeError: '',
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

  startNavigation: (route, steps, destination, network) => {
    if (route.id.startsWith('network:') && !network) return false;
    if (destination.id !== route.end_point_id || !canStartNavigation(route, steps, get().routeTypePreference)) return false;
    set({
      activeNetwork: network ?? null,
      isCheckingRoute: false,
      routeError: '',
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
    return true;
  },

  stopNavigation: () => {
    set({
      activeNetwork: null,
      isCheckingRoute: false,
      routeError: '',
      activeRoute: null,
      routeSteps: [],
      currentStepIndex: 0,
      isGuiding: false,
      destinationPoint: null,
    });
  },

  nextStep: async () => {
    if (!get().isGuiding || get().isCheckingRoute) return;
    const active = get().activeRoute;
    const reference = get().activeNetwork;
    if (reference) {
      set({ isCheckingRoute: true });
      try { await CampusNetworkService.checkActive(reference); }
      catch (cause) {
        if (get().activeRoute !== active) return;
        const message = get().language === 'ar' && cause instanceof Error ? cause.message : 'Route availability could not be confirmed. Stop and recalculate or request assistance.';
        set({ isGuiding: false, routeError: message });
        VoiceService.speak(message);
        return;
      } finally { if (get().activeRoute === active) set({ isCheckingRoute: false }); }
      if (get().activeRoute !== active || !get().isGuiding) return;
    }
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

  prevStep: async () => {
    if (!get().isGuiding || get().isCheckingRoute) return;
    const active = get().activeRoute;
    const reference = get().activeNetwork;
    if (reference) {
      set({ isCheckingRoute: true });
      try { await CampusNetworkService.checkActive(reference); }
      catch (cause) {
        if (get().activeRoute !== active) return;
        const message = get().language === 'ar' && cause instanceof Error ? cause.message : 'Route availability could not be confirmed. Stop and recalculate or request assistance.';
        set({ isGuiding: false, routeError: message });
        VoiceService.speak(message);
        return;
      } finally { if (get().activeRoute === active) set({ isCheckingRoute: false }); }
      if (get().activeRoute !== active || !get().isGuiding) return;
    }
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
