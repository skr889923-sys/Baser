import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { RequestClient } from './request-client';

// Web receipts survive reloads in this tab. Native receipts survive app restarts.
const storage = {
  async getItem(key: string) {
    return Platform.OS === 'web' ? window.sessionStorage.getItem(key) : SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') window.sessionStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    if (Platform.OS === 'web') window.sessionStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};

export default new RequestClient(
  (name, args, signal) => supabase.rpc(name, args).abortSignal(signal),
  storage,
  async () => Array.from(await Crypto.getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, '0')).join(''),
);
