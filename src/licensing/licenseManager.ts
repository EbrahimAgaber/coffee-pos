import { StationRole } from '../types';

export interface LicensePayload {
  shopName: string;
  tenantId: string;
  maxDevices: number;
  licenseType: 'TRIAL' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
  issuedAt: string;
  expiresAt: string;
  features: string[];
  signature: string;
}

export interface LicenseValidationResult {
  isValid: boolean;
  isExpired: boolean;
  daysRemaining: number;
  payload: LicensePayload | null;
  error?: string;
}

export interface ConnectedDeviceRecord {
  deviceId: string;
  deviceName: string;
  role: StationRole;
  lastPingMs: number;
  userAgent: string;
  isCurrentDevice?: boolean;
}

const LICENSE_STORAGE_KEY = 'coffee_pos_license_key_v1';
const DEVICE_ID_KEY = 'coffee_pos_device_id_v1';
const DEVICE_NAME_KEY = 'coffee_pos_device_name_v1';

// Secret salt for tamper-evident hash validation in-browser
const LICENSE_SALT = 'SMART_BARISTA_KSA_2026_SECURE_TOKEN';

/**
 * Simple portable hash function (djb2 + salt) for tamper check
 */
function computeSignature(shop: string, maxDev: number, expMs: number, tenant: string): string {
  const raw = `${shop}::${maxDev}::${expMs}::${tenant}::${LICENSE_SALT}`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) + raw.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  return hex.slice(0, 6);
}

/**
 * Generate a commercial license key:
 * Format: SB-[SHOP_SLUG]-D[DEVICES]-[DURATION]-[SIGNATURE]
 * Encoded base64 compact token
 */
export function generateLicenseKey(options: {
  shopName: string;
  tenantId: string;
  maxDevices: number;
  durationDays: number;
  licenseType?: 'TRIAL' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
}): string {
  const now = new Date();
  const issuedAt = now.toISOString();
  const expDate = new Date(now.getTime() + options.durationDays * 24 * 60 * 60 * 1000);
  const expiresAt = expDate.toISOString();
  const sig = computeSignature(options.shopName, options.maxDevices, expDate.getTime(), options.tenantId);

  const payload: LicensePayload = {
    shopName: options.shopName.trim(),
    tenantId: options.tenantId.trim(),
    maxDevices: options.maxDevices,
    licenseType: options.licenseType || (options.durationDays === 365 ? 'YEARLY' : options.durationDays === 30 ? 'MONTHLY' : 'CUSTOM'),
    issuedAt,
    expiresAt,
    features: ['DRIVE_THRU', 'KDS', 'CASHIER', 'OWNER_REPORTS', 'ZATCA_INVOICING', 'OFFLINE_SYNC', 'CUSTOMER_LEDGER'],
    signature: sig,
  };

  const jsonStr = JSON.stringify(payload);
  const base64 = typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(jsonStr))) : Buffer.from(jsonStr).toString('base64');
  return `SB-${base64}`;
}

/**
 * Parse and validate a license key string
 */
export function validateLicenseKey(keyStr: string): LicenseValidationResult {
  if (!keyStr || !keyStr.startsWith('SB-')) {
    return {
      isValid: false,
      isExpired: false,
      daysRemaining: 0,
      payload: null,
      error: 'تنسيق المفتاح غير صالح (يجب أن يبدأ بـ SB-)',
    };
  }

  try {
    const base64 = keyStr.replace(/^SB-/, '').trim();
    const jsonStr = typeof atob !== 'undefined' ? decodeURIComponent(escape(atob(base64))) : Buffer.from(base64, 'base64').toString('utf-8');
    const payload = JSON.parse(jsonStr) as LicensePayload;

    if (!payload.shopName || !payload.maxDevices || !payload.expiresAt || !payload.signature) {
      return {
        isValid: false,
        isExpired: false,
        daysRemaining: 0,
        payload: null,
        error: 'بيانات الترخيص ناقصة أو تالفة',
      };
    }

    const expMs = new Date(payload.expiresAt).getTime();
    const expectedSig = computeSignature(payload.shopName, payload.maxDevices, expMs, payload.tenantId);

    if (expectedSig !== payload.signature) {
      return {
        isValid: false,
        isExpired: false,
        daysRemaining: 0,
        payload: null,
        error: 'فشل التحقق من صحة المفتاح (تم التعديل عليه أو التوقيع غير مطابق)',
      };
    }

    const nowMs = Date.now();
    const diffMs = expMs - nowMs;
    const isExpired = diffMs <= 0;
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

    return {
      isValid: true,
      isExpired,
      daysRemaining,
      payload,
      error: isExpired ? 'انتهت صلاحية هذا الترخيص' : undefined,
    };
  } catch (e) {
    return {
      isValid: false,
      isExpired: false,
      daysRemaining: 0,
      payload: null,
      error: 'رمز الترخيص غير قابل للقراءة أو غير صحيح',
    };
  }
}

/**
 * Persistent Device ID Provider
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'dev_server';
  let devId = localStorage.getItem(DEVICE_ID_KEY);
  if (!devId) {
    const platform = /iphone|ipad|ipod/i.test(navigator.userAgent)
      ? 'ios'
      : /android/i.test(navigator.userAgent)
      ? 'android'
      : 'desk';
    const rand = Math.random().toString(36).slice(2, 8);
    devId = `dev_${platform}_${rand}`;
    localStorage.setItem(DEVICE_ID_KEY, devId);
  }
  return devId;
}

export function getDeviceCustomName(): string {
  if (typeof window === 'undefined') return 'محطة العمل';
  const saved = localStorage.getItem(DEVICE_NAME_KEY);
  if (saved) return saved;

  const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent);
  return isMobile ? 'هاتف طلبات / سيارات' : 'محطة الكاشير الرئيسية';
}

export function setDeviceCustomName(name: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(DEVICE_NAME_KEY, name.trim());
  }
}

/**
 * Default Business License (Pre-configured for Barista Sip Cafe, 5 Devices, 90 Days)
 */
export function getDefaultLicenseKey(): string {
  return generateLicenseKey({
    shopName: 'مقهى رشفة البارستا المختصة',
    tenantId: 'barista_sip_ksa_01',
    maxDevices: 5,
    durationDays: 90,
    licenseType: 'CUSTOM',
  });
}

export function getActiveLicenseKey(): string {
  if (typeof window === 'undefined') return getDefaultLicenseKey();
  const saved = localStorage.getItem(LICENSE_STORAGE_KEY);
  if (saved && saved.startsWith('SB-')) {
    const check = validateLicenseKey(saved);
    if (check.isValid && !check.isExpired) {
      return saved;
    }
  }
  const defaultKey = getDefaultLicenseKey();
  localStorage.setItem(LICENSE_STORAGE_KEY, defaultKey);
  return defaultKey;
}

export function saveActiveLicenseKey(newKey: string): LicenseValidationResult {
  const result = validateLicenseKey(newKey);
  if (result.isValid && !result.isExpired && typeof window !== 'undefined') {
    localStorage.setItem(LICENSE_STORAGE_KEY, newKey.trim());
  }
  return result;
}
