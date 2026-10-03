/**
 * Tier 5: LicenseService & LicenseGate Verification Suite
 * Tests configurable expiration date, device limits, grace period, tampering, and gate evaluation
 */

import { describe, test, expect } from './e2e_harness';
import { LicenseService } from '../src/licensing/LicenseService';
import { generateLicenseKey } from '../src/licensing/licenseManager';

export function registerTier5Tests(): void {
  describe('Tier 5 - LicenseService & LicenseGate Security & Entitlements', () => {
    const service = new LicenseService({
      enforceExpiration: true,
      enforceDeviceLimit: true,
      gracePeriodDays: 0,
    });

    test('T5.1.1: Valid license key within limits grants access with ACTIVE status', () => {
      const key = generateLicenseKey({
        shopName: 'مقهى البارستا الذكي',
        tenantId: 'tenant-101',
        durationDays: 30,
        maxDevices: 5,
      });

      const res = service.validate(key, { activeDeviceCount: 3 });
      expect(res.isValid).toBe(true);
      expect(res.isExpired).toBe(false);
      expect(res.isDeviceLimitExceeded).toBe(false);
      expect(res.isAllowed).toBe(true);
      expect(res.status).toBe('ACTIVE');
      expect(res.effectiveMaxDevices).toBe(5);
      expect(res.shopName).toBe('مقهى البارستا الذكي');
    });

    test('T5.1.2: Exact device quota limit is allowed', () => {
      const key = generateLicenseKey({
        shopName: 'مقهى السحاب',
        tenantId: 'tenant-102',
        durationDays: 30,
        maxDevices: 4,
      });

      const res = service.validate(key, { activeDeviceCount: 4 });
      expect(res.isAllowed).toBe(true);
      expect(res.isDeviceLimitExceeded).toBe(false);
    });

    test('T5.1.3: Exceeding device limit transitions status to DEVICE_LIMIT_EXCEEDED and blocks access', () => {
      const key = generateLicenseKey({
        shopName: 'مقهى السحاب',
        tenantId: 'tenant-102',
        durationDays: 30,
        maxDevices: 4,
      });

      const res = service.validate(key, { activeDeviceCount: 5 });
      expect(res.isAllowed).toBe(false);
      expect(res.isDeviceLimitExceeded).toBe(true);
      expect(res.status).toBe('DEVICE_LIMIT_EXCEEDED');
      expect(res.errorAr?.includes('تم تجاوز الحد الأقصى للأجهزة')).toBe(true);
    });

    test('T5.1.4: Configurable deviceLimitOverride dynamically updates allowed device threshold', () => {
      const key = generateLicenseKey({
        shopName: 'مقهى النخيل',
        tenantId: 'tenant-103',
        durationDays: 30,
        maxDevices: 2,
      });

      // Override device limit to 6
      const res = service.validate(key, {
        activeDeviceCount: 5,
        config: { deviceLimitOverride: 6 },
      });
      expect(res.isAllowed).toBe(true);
      expect(res.effectiveMaxDevices).toBe(6);
      expect(res.isDeviceLimitExceeded).toBe(false);
    });

    test('T5.1.5: enforceDeviceLimit: false bypasses quota check for unlimited development/testing', () => {
      const key = generateLicenseKey({
        shopName: 'مقهى التطوير',
        tenantId: 'tenant-104',
        durationDays: 30,
        maxDevices: 1,
      });

      const res = service.validate(key, {
        activeDeviceCount: 50,
        config: { enforceDeviceLimit: false },
      });
      expect(res.isAllowed).toBe(true);
      expect(res.isDeviceLimitExceeded).toBe(false);
    });

    test('T5.1.6: Expired license key transitions to EXPIRED status and blocks access', () => {
      const key = generateLicenseKey({
        shopName: 'مقهى التراث',
        tenantId: 'tenant-105',
        durationDays: -5,
        maxDevices: 3,
      });

      const res = service.validate(key, { activeDeviceCount: 1 });
      expect(res.isValid).toBe(true);
      expect(res.isExpired).toBe(true);
      expect(res.isAllowed).toBe(false);
      expect(res.status).toBe('EXPIRED');
      expect(res.errorAr?.includes('انتهت صلاحية هذا الترخيص')).toBe(true);
    });

    test('T5.1.7: Configurable expirationDateOverride extends access for expiring tenants', () => {
      const key = generateLicenseKey({
        shopName: 'مقهى التراث',
        tenantId: 'tenant-105',
        durationDays: -5,
        maxDevices: 3,
      });

      const futureOverride = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const res = service.validate(key, {
        activeDeviceCount: 1,
        config: { expirationDateOverride: futureOverride },
      });
      expect(res.isExpired).toBe(false);
      expect(res.isAllowed).toBe(true);
      expect(res.status).toBe('ACTIVE');
    });

    test('T5.1.8: enforceExpiration: false bypasses expiration blocking', () => {
      const key = generateLicenseKey({
        shopName: 'مقهى التراث',
        tenantId: 'tenant-105',
        durationDays: -10,
        maxDevices: 3,
      });

      const res = service.validate(key, {
        activeDeviceCount: 1,
        config: { enforceExpiration: false },
      });
      expect(res.isExpired).toBe(false);
      expect(res.isAllowed).toBe(true);
    });

    test('T5.1.9: Grace period permits temporary operation past expiration date', () => {
      const key = generateLicenseKey({
        shopName: 'مقهى الأصالة',
        tenantId: 'tenant-106',
        durationDays: -2, // expired 2 days ago
        maxDevices: 3,
      });

      // 0 grace days -> blocked
      const resBlocked = service.validate(key, {
        config: { gracePeriodDays: 0 },
      });
      expect(resBlocked.isExpired).toBe(true);
      expect(resBlocked.isAllowed).toBe(false);

      // 5 grace days -> allowed
      const resGrace = service.validate(key, {
        config: { gracePeriodDays: 5 },
      });
      expect(resGrace.isExpired).toBe(false);
      expect(resGrace.isAllowed).toBe(true);
    });

    test('T5.1.10: Near-expiration warning triggers when remaining days <= threshold', () => {
      const key = generateLicenseKey({
        shopName: 'مقهى الأفق',
        tenantId: 'tenant-107',
        durationDays: 4,
        maxDevices: 3,
      });

      const res = service.validate(key, {
        config: { warningDaysThreshold: 7 },
      });
      expect(res.isAllowed).toBe(true);
      expect(res.isNearExpiration).toBe(true);
      expect(res.status).toBe('NEAR_EXPIRATION');
      expect(res.daysRemaining).toBe(4);
    });

    test('T5.1.11: Malformed and tampered license strings fail verification securely', () => {
      const tamperedKey = 'SB-INVALID-BASE64-TAMPERED-PAYLOAD';
      const res = service.validate(tamperedKey);
      expect(res.isValid).toBe(false);
      expect(res.isAllowed).toBe(false);
      expect(res.status).toBe('INVALID_KEY');
    });

    test('T5.1.12: Instant trial generation provides valid 30-day credential', () => {
      const trial = service.activateInstantTrial('مقهى الروابي', 30, 3);
      expect(trial.isValid).toBe(true);
      expect(trial.payload?.shopName).toBe('مقهى الروابي');
      expect(trial.payload?.maxDevices).toBe(3);
      expect(trial.payload?.licenseType).toBe('TRIAL');
    });
  });
}
