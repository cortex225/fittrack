import { Platform } from 'react-native';

// Sur le web, les appels IA passent par les fonctions serveur Cloudflare
// (dossier functions/, routes /api/…) : les clés restent côté serveur.
// EXPO_PUBLIC_API_BASE permet aussi de passer par ce serveur depuis le
// téléphone (ex. https://fit.jlgouaho.com/api).
export const API_BASE: string =
  process.env.EXPO_PUBLIC_API_BASE ?? (Platform.OS === 'web' ? '/api' : '');

export const usesServerAi = (): boolean => API_BASE.length > 0;
