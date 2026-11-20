import { test, expect } from '@playwright/test';
import { isSafePublicKey, getSupabaseConfigError } from '../src/services/supabase';

test.describe('Supabase Public Key & Security Validation', () => {
  test('should reject modern Supabase secret key prefix sb_secret_', () => {
    expect(isSafePublicKey('sb_secret_prod_abcdef1234567890')).toBe(false);
    expect(isSafePublicKey('sb_secret_live_9999999999999999')).toBe(false);
  });

  test('should reject abbreviated modern Supabase secret key prefix sb_sec_', () => {
    expect(isSafePublicKey('sb_sec_prod_abcdef1234567890')).toBe(false);
  });

  test('should accept modern Supabase publishable key prefix sb_publishable_', () => {
    expect(isSafePublicKey('sb_publishable_live_abcdef1234567890')).toBe(true);
    expect(isSafePublicKey('sb_publishable_test_0000000000000000')).toBe(true);
  });

  test('should accept abbreviated modern Supabase publishable key prefix sb_pub_', () => {
    expect(isSafePublicKey('sb_pub_live_abcdef1234567890')).toBe(true);
  });

  test('should reject plain text containing service_role', () => {
    expect(isSafePublicKey('supabase_service_role_key_value')).toBe(false);
    expect(isSafePublicKey('my-service_role-token')).toBe(false);
  });

  test('should reject legacy Supabase JWT with role="service_role"', () => {
    // Header: {"alg":"HS256","typ":"JWT"} -> eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9
    // Payload: {"role":"service_role","iss":"supabase"} -> eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UifQ
    const legacyServiceRoleJwt = 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UifQ.signature123';
    expect(isSafePublicKey(legacyServiceRoleJwt)).toBe(false);
  });

  test('should accept valid legacy Supabase anon JWT with role="anon"', () => {
    // Header: {"alg":"HS256","typ":"JWT"} -> eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9
    // Payload: {"role":"anon","iss":"supabase"} -> eyJyb2xlIjogImFub24iLCAiaXNzIjogInN1cGFiYXNlIn0
    const legacyAnonJwt = 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImFub24iLCAiaXNzIjogInN1cGFiYXNlIn0.signature123';
    expect(isSafePublicKey(legacyAnonJwt)).toBe(true);
  });

  test('should reject empty or null inputs', () => {
    expect(isSafePublicKey('')).toBe(false);
    expect(isSafePublicKey(null as unknown as string)).toBe(false);
    expect(isSafePublicKey(undefined as unknown as string)).toBe(false);
  });

  test('getSupabaseConfigError should describe configuration status accurately', () => {
    const error = getSupabaseConfigError();
    if (error) {
      expect(typeof error).toBe('string');
      expect(error.toLowerCase()).toContain('supabase');
    }
  });
});
