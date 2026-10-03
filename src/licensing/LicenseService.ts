import { StationRole } from '../types';
import {
  LicensePayload,
  LicenseValidationResult,
  generateLicenseKey,
  validateLicenseKey,
  getActiveLicenseKey,
  saveActiveLicenseKey,
  getDefaultLicenseKey,
  getOrCreateDeviceId,
  getDeviceCustomName,
  setDeviceCustomName,
} from './licenseManager';

export interface LicenseServiceConfig {
  /** Whether to block access when the license expires */
  enforceExpiration: boolean;
  /** Whether to block access when active devices exceed the license limit */
  enforceDeviceLimit: boolean;
  /** Grace period in days permitted after expiration */
  gracePeriodDays: number;
  /** Custom expiration date override (e.g. from backend or tenant setting) */
  expirationDateOverride?: string | Date | null;
  /** Custom device limit override */
  deviceLimitOverride?: number | null;
  /** Days threshold before expiration to trigger near-expiry warnings */
  warningDaysThreshold: number;
}

export type LicenseStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'DEVICE_LIMIT_EXCEEDED'
  | 'INVALID_KEY'
  | 'NEAR_EXPIRATION';

export interface LicenseValidationEvaluation {
  isValid: boolean;
  isExpired: boolean;
  isDeviceLimitExceeded: boolean;
  isNearExpiration: boolean;
  isAllowed: boolean;
  status: LicenseStatus;
  daysRemaining: number;
  effectiveExpiresAt: string | null;
  effectiveMaxDevices: number;
  activeDeviceCount: number;
  shopName: string;
  tenantId: string;
  error?: string;
  errorAr?: string;
  payload: LicensePayload | null;
  key: string;
}

export interface ValidateOptions {
  activeDeviceCount?: number;
  config?: Partial<LicenseServiceConfig>;
}

const DEFAULT_CONFIG: LicenseServiceConfig = {
  enforceExpiration: true,
  enforceDeviceLimit: true,
  gracePeriodDays: 0,
  expirationDateOverride: null,
  deviceLimitOverride: null,
  warningDaysThreshold: 7,
};

const CONFIG_STORAGE_KEY = 'coffee_pos_license_service_config_v1';

export class LicenseService {
  private config: LicenseServiceConfig;
  private listeners = new Set<(evaluation: LicenseValidationEvaluation) => void>();

  constructor(initialConfig: Partial<LicenseServiceConfig> = {}) {
    this.config = this.loadConfig(initialConfig);
  }

  private loadConfig(defaults: Partial<LicenseServiceConfig>): LicenseServiceConfig {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...DEFAULT_CONFIG, ...parsed, ...defaults };
        }
      } catch (e) {
        console.warn('[LicenseService] Failed loading saved config:', e);
      }
    }
    return { ...DEFAULT_CONFIG, ...defaults };
  }

  private persistConfig(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
      } catch (e) {
        console.warn('[LicenseService] Failed persisting config:', e);
      }
    }
  }

  public getConfig(): LicenseServiceConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<LicenseServiceConfig>): LicenseValidationEvaluation {
    this.config = { ...this.config, ...newConfig };
    this.persistConfig();
    const evaluation = this.validateCurrent();
    this.notify(evaluation);
    return evaluation;
  }

  /**
   * Validates a license key against configurable expiration dates and device limits.
   */
  public validate(keyStr: string, options: ValidateOptions = {}): LicenseValidationEvaluation {
    const effectiveConfig = { ...this.config, ...(options.config || {}) };
    const baseValidation = validateLicenseKey(keyStr);
    const activeDeviceCount = Math.max(1, options.activeDeviceCount ?? 1);

    if (!baseValidation.isValid || !baseValidation.payload) {
      return {
        isValid: false,
        isExpired: false,
        isDeviceLimitExceeded: false,
        isNearExpiration: false,
        isAllowed: false,
        status: 'INVALID_KEY',
        daysRemaining: 0,
        effectiveExpiresAt: null,
        effectiveMaxDevices: 0,
        activeDeviceCount,
        shopName: '',
        tenantId: '',
        error: baseValidation.error || 'Invalid or malformed license key format',
        errorAr: baseValidation.error || 'مفتاح الترخيص غير صالح أو تالف',
        payload: null,
        key: keyStr,
      };
    }

    const payload = baseValidation.payload;
    const nowMs = Date.now();

    // 1. Resolve Effective Expiration Date (payload or override)
    let expirationMs: number;
    let effectiveExpiresAt: string;

    if (effectiveConfig.expirationDateOverride) {
      const overrideDate = new Date(effectiveConfig.expirationDateOverride);
      expirationMs = overrideDate.getTime();
      effectiveExpiresAt = overrideDate.toISOString();
    } else {
      const payloadDate = new Date(payload.expiresAt);
      expirationMs = payloadDate.getTime();
      effectiveExpiresAt = payload.expiresAt;
    }

    // Add grace period if configured
    const graceMs = effectiveConfig.gracePeriodDays * 24 * 60 * 60 * 1000;
    const diffMs = (expirationMs + graceMs) - nowMs;
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

    const isExpired = effectiveConfig.enforceExpiration ? diffMs <= 0 : false;

    // 2. Resolve Effective Device Limit (payload or override)
    const effectiveMaxDevices = effectiveConfig.deviceLimitOverride !== null && effectiveConfig.deviceLimitOverride !== undefined
      ? Math.max(1, effectiveConfig.deviceLimitOverride)
      : Math.max(1, payload.maxDevices);

    const isDeviceLimitExceeded = effectiveConfig.enforceDeviceLimit
      ? activeDeviceCount > effectiveMaxDevices
      : false;

    // 3. Near expiration check
    const isNearExpiration = !isExpired && daysRemaining <= effectiveConfig.warningDaysThreshold && daysRemaining > 0;

    // 4. Overall permission status
    let status: LicenseStatus = 'ACTIVE';
    let error: string | undefined;
    let errorAr: string | undefined;

    if (isExpired) {
      status = 'EXPIRED';
      error = `License expired on ${new Date(expirationMs).toLocaleDateString()}`;
      errorAr = `انتهت صلاحية هذا الترخيص بتاريخ ${new Date(expirationMs).toLocaleDateString('ar-SA')}`;
    } else if (isDeviceLimitExceeded) {
      status = 'DEVICE_LIMIT_EXCEEDED';
      error = `Device quota exceeded: ${activeDeviceCount} connected devices (maximum allowed: ${effectiveMaxDevices})`;
      errorAr = `تم تجاوز الحد الأقصى للأجهزة: متصل حالياً ${activeDeviceCount} أجهزة (الحد المرخص: ${effectiveMaxDevices})`;
    } else if (isNearExpiration) {
      status = 'NEAR_EXPIRATION';
    }

    const isAllowed = !isExpired && !isDeviceLimitExceeded;

    return {
      isValid: true,
      isExpired,
      isDeviceLimitExceeded,
      isNearExpiration,
      isAllowed,
      status,
      daysRemaining,
      effectiveExpiresAt,
      effectiveMaxDevices,
      activeDeviceCount,
      shopName: payload.shopName,
      tenantId: payload.tenantId,
      error,
      errorAr,
      payload,
      key: keyStr,
    };
  }

  /**
   * Validates the currently stored active license key.
   */
  public validateCurrent(activeDeviceCount?: number): LicenseValidationEvaluation {
    const key = getActiveLicenseKey();
    return this.validate(key, { activeDeviceCount });
  }

  /**
   * Activates a new license key in persistent storage.
   */
  public activate(newKey: string, activeDeviceCount?: number): LicenseValidationEvaluation {
    const cleanKey = newKey.trim();
    const evaluation = this.validate(cleanKey, { activeDeviceCount });

    if (evaluation.isValid && !evaluation.isExpired && typeof window !== 'undefined') {
      saveActiveLicenseKey(cleanKey);
    }

    this.notify(evaluation);
    return evaluation;
  }

  /**
   * Generates a signed tamper-evident commercial license key.
   */
  public generate(options: {
    shopName: string;
    tenantId: string;
    maxDevices: number;
    durationDays: number;
    licenseType?: 'TRIAL' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
  }): string {
    return generateLicenseKey(options);
  }

  /**
   * Resets to an emergency or instant trial key (30 days, 5 devices).
   */
  public activateInstantTrial(shopName = 'مقهى البارستا الذكي', days = 30, devices = 5): LicenseValidationEvaluation {
    const trialKey = this.generate({
      shopName,
      tenantId: `trial_${Date.now().toString(36)}`,
      maxDevices: devices,
      durationDays: days,
      licenseType: 'TRIAL',
    });
    return this.activate(trialKey);
  }

  /**
   * Subscribes to license validation changes.
   */
  public subscribe(callback: (evaluation: LicenseValidationEvaluation) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(evaluation: LicenseValidationEvaluation): void {
    this.listeners.forEach((listener) => {
      try {
        listener(evaluation);
      } catch (err) {
        console.error('[LicenseService] Listener execution failed:', err);
      }
    });
  }

  public getDeviceId(): string {
    return getOrCreateDeviceId();
  }

  public getDeviceName(): string {
    return getDeviceCustomName();
  }

  public setDeviceName(name: string): void {
    setDeviceCustomName(name);
  }
}

// Global Singleton Instance
export const licenseService = new LicenseService();
export default licenseService;
