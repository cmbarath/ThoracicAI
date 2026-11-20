import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const normalizedUrl = rawUrl.split('/rest/v1')[0].replace(/\/+$/, '');
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export let isSupabaseConfigured = Boolean(normalizedUrl && rawAnonKey);

export let supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(normalizedUrl, rawAnonKey)
  : null;

export function configureSupabase(url: string, anonKey: string): SupabaseClient | null {
  const cleanUrl = url.split('/rest/v1')[0].replace(/\/+$/, '');
  const cleanKey = anonKey.trim();
  if (cleanUrl && cleanKey) {
    supabase = createClient(cleanUrl, cleanKey);
    isSupabaseConfigured = true;
    return supabase;
  }
  return null;
}

