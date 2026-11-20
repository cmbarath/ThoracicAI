import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Safe environment accessor supporting both Vite (import.meta.env) and Node test runtimes
const globalScope = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {};
const nodeProcess = globalScope.process as { env?: Record<string, string | undefined> } | undefined;
const env = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env
  : (nodeProcess?.env || {});

// 1. Read Supabase project URL
const rawUrl = (env.VITE_SUPABASE_URL || '').trim();
const normalizedUrl = rawUrl.split('/rest/v1')[0].replace(/\/+$/, '');

// 2. Read public browser API key: prefer VITE_SUPABASE_PUBLISHABLE_KEY, fallback to VITE_SUPABASE_ANON_KEY
const publishableKey = (env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
const anonKey = (env.VITE_SUPABASE_ANON_KEY || '').trim();
const rawPublicKey = publishableKey || anonKey;

/**
 * Validates that a key is safe for client-side browser usage and not a secret / service-role key.
 *
 * Rules:
 * 1. Rejects modern Supabase secret key prefixes: `sb_secret_` and `sb_sec_`.
 * 2. Accepts modern Supabase publishable key prefixes: `sb_publishable_` and `sb_pub_`.
 * 3. Rejects plain text containing `service_role` or `secret`.
 * 4. For legacy JWT tokens (`eyJ...`), decodes the unverified payload and verifies `role !== "service_role"`,
 *    while accepting valid legacy `anon` tokens.
 */
export function isSafePublicKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  const lower = trimmed.toLowerCase();

  // 1. Explicitly reject modern Supabase secret-key prefixes
  if (lower.startsWith('sb_secret_') || lower.startsWith('sb_sec_')) {
    console.error(
      '[ThoracicAI] Security Violation: Modern Supabase secret key prefix (sb_secret_) detected! ' +
      'Secret keys must never be used in client-side code.'
    );
    return false;
  }

  // 2. Explicitly accept modern Supabase publishable key prefix
  if (lower.startsWith('sb_publishable_') || lower.startsWith('sb_pub_')) {
    return true;
  }

  // 3. Reject plain strings with 'service_role' or 'secret'
  if (lower.includes('service_role') || lower.includes('secret')) {
    console.error(
      '[ThoracicAI] Security Violation: Key containing "service_role" or "secret" detected! ' +
      'Only public/anon/publishable keys are permitted in frontend applications.'
    );
    return false;
  }

  // 4. For legacy Supabase JWT keys (eyJ...), decode unverified payload to ensure role !== 'service_role'
  if (trimmed.startsWith('eyJ') && trimmed.includes('.')) {
    try {
      const parts = trimmed.split('.');
      if (parts.length >= 2) {
        // Base64Url decode payload
        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4 !== 0) {
          base64 += '=';
        }
        let jsonStr = '';
        if (typeof atob === 'function') {
          jsonStr = atob(base64);
        } else {
          const globalBuffer = (globalScope as { Buffer?: { from: (s: string, enc: string) => { toString: (e: string) => string } } }).Buffer;
          if (globalBuffer) {
            jsonStr = globalBuffer.from(base64, 'base64').toString('utf-8');
          }
        }
        const payload = JSON.parse(jsonStr);
        if (payload && typeof payload.role === 'string') {
          const role = payload.role.toLowerCase();
          if (role === 'service_role') {
            console.error(
              '[ThoracicAI] Security Violation: Legacy Supabase JWT with role="service_role" detected! ' +
              'Service-role tokens must never be used in frontend applications.'
            );
            return false;
          }
          if (role === 'anon') {
            return true;
          }
        }
      }
    } catch {
      // If decoding fails, continue to length validation
    }
  }

  return true;
}

/**
 * Checks for missing Supabase configuration and returns a clear descriptive error message if missing.
 */
export function getSupabaseConfigError(): string | null {
  if (!normalizedUrl && !rawPublicKey) {
    return 'Supabase is not configured. Both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) are missing in environment variables.';
  }
  if (!normalizedUrl) {
    return 'Supabase URL is missing. VITE_SUPABASE_URL is not configured in environment variables.';
  }
  if (!rawPublicKey) {
    return 'Supabase API key is missing. Please configure VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY) in environment variables.';
  }
  if (!isSafePublicKey(rawPublicKey)) {
    return 'Invalid Supabase API key: Client-side keys must be publishable/anon keys, not service-role secrets.';
  }
  return null;
}

const initialConfigError = getSupabaseConfigError();
if (initialConfigError) {
  console.warn(`[ThoracicAI] ${initialConfigError}`);
}

export let isSupabaseConfigured: boolean = Boolean(
  normalizedUrl && rawPublicKey && isSafePublicKey(rawPublicKey)
);

export let supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(normalizedUrl, rawPublicKey)
  : null;

/**
 * Dynamically configure or update the Supabase client (e.g. from backend /api/auth/config fallback).
 */
export function configureSupabase(url: string, key: string): SupabaseClient | null {
  const cleanUrl = url.split('/rest/v1')[0].replace(/\/+$/, '');
  const cleanKey = key.trim();

  if (!isSafePublicKey(cleanKey)) {
    return null;
  }

  if (cleanUrl && cleanKey) {
    supabase = createClient(cleanUrl, cleanKey);
    isSupabaseConfigured = true;
    return supabase;
  }
  return null;
}

