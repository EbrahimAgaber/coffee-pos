import { LicenseService } from '../src/licensing/LicenseService';
import { generateLicenseKey } from '../src/licensing/licenseManager';

console.log('=== Starting LicenseService Unit & Boundary Tests ===');

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✔ PASS: ${msg}`);
  } else {
    failedCount++;
    console.error(`  ✖ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// 1. Generate standard valid key with 30 duration days and 5 devices
const validKey = generateLicenseKey({
  shopName: 'مقهى الاختبار النموذجي',
  tenantId: 'tenant-test-123',
  durationDays: 30,
  maxDevices: 5,
});

const service = new LicenseService({
  enforceExpiration: true,
  enforceDeviceLimit: true,
  gracePeriodDays: 0,
});

// Test 1: Valid active license within limits
const eval1 = service.validate(validKey, { activeDeviceCount: 3 });
assert(eval1.isValid === true, 'eval1 is valid');
assert(eval1.isExpired === false, 'eval1 is not expired');
assert(eval1.isDeviceLimitExceeded === false, 'eval1 device limit not exceeded');
assert(eval1.isAllowed === true, 'eval1 access is allowed');
assert(eval1.status === 'ACTIVE', 'eval1 status is ACTIVE');
assert(eval1.effectiveMaxDevices === 5, 'eval1 max devices is 5');

// Test 2: Device limit reached and exceeded
const eval2Exact = service.validate(validKey, { activeDeviceCount: 5 });
assert(eval2Exact.isAllowed === true, 'exact device limit is allowed');
assert(eval2Exact.isDeviceLimitExceeded === false, 'exact device count does not exceed limit');

const eval2Exceeded = service.validate(validKey, { activeDeviceCount: 6 });
assert(eval2Exceeded.isAllowed === false, 'exceeded device count is blocked');
assert(eval2Exceeded.isDeviceLimitExceeded === true, 'device limit exceeded flag is true');
assert(eval2Exceeded.status === 'DEVICE_LIMIT_EXCEEDED', 'status is DEVICE_LIMIT_EXCEEDED');

// Test 3: Device limit override
const eval3Override = service.validate(validKey, {
  activeDeviceCount: 7,
  config: { deviceLimitOverride: 10 },
});
assert(eval3Override.isAllowed === true, 'deviceLimitOverride of 10 permits 7 devices');
assert(eval3Override.effectiveMaxDevices === 10, 'effectiveMaxDevices reflects override');

// Test 4: Disabling enforceDeviceLimit permits any device count
const eval4NoEnforce = service.validate(validKey, {
  activeDeviceCount: 99,
  config: { enforceDeviceLimit: false },
});
assert(eval4NoEnforce.isAllowed === true, 'enforceDeviceLimit: false permits 99 devices');
assert(eval4NoEnforce.isDeviceLimitExceeded === false, 'isDeviceLimitExceeded is false when disabled');

// Test 5: Expired license key (negative duration days)
const expiredKey = generateLicenseKey({
  shopName: 'مقهى منتهي الصلاحية',
  tenantId: 'tenant-expired-1',
  durationDays: -5,
  maxDevices: 3,
});

const eval5Expired = service.validate(expiredKey, { activeDeviceCount: 1 });
assert(eval5Expired.isValid === true, 'expired key has valid signature');
assert(eval5Expired.isExpired === true, 'expired key is marked isExpired');
assert(eval5Expired.isAllowed === false, 'expired key access is blocked');
assert(eval5Expired.status === 'EXPIRED', 'expired key status is EXPIRED');

// Test 6: Expiration date override extending expiration
const eval6Extended = service.validate(expiredKey, {
  activeDeviceCount: 1,
  config: { expirationDateOverride: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() },
});
assert(eval6Extended.isExpired === false, 'expiration override extends past expiry');
assert(eval6Extended.isAllowed === true, 'extended license is allowed');

// Test 7: Disabling enforceExpiration permits access
const eval7NoEnforceExp = service.validate(expiredKey, {
  activeDeviceCount: 1,
  config: { enforceExpiration: false },
});
assert(eval7NoEnforceExp.isExpired === false, 'isExpired is false when enforceExpiration is false');
assert(eval7NoEnforceExp.isAllowed === true, 'access allowed when enforceExpiration is false');

// Test 8: Grace period
const recentExpiredKey = generateLicenseKey({
  shopName: 'مقهى في فترة السماح',
  tenantId: 'tenant-grace-1',
  durationDays: -1,
  maxDevices: 2,
});

const eval8GraceBlocked = service.validate(recentExpiredKey, {
  config: { gracePeriodDays: 0 },
});
assert(eval8GraceBlocked.isExpired === true, '0 grace days blocks 1 day expired key');

const eval8GraceAllowed = service.validate(recentExpiredKey, {
  config: { gracePeriodDays: 3 },
});
assert(eval8GraceAllowed.isExpired === false, '3 grace days permits 1 day expired key');
assert(eval8GraceAllowed.isAllowed === true, 'access granted during grace period');

// Test 9: Tampered or invalid key string
const eval9Malformed = service.validate('INVALID-LICENSE-STRING-1234');
assert(eval9Malformed.isValid === false, 'malformed key isValid is false');
assert(eval9Malformed.isAllowed === false, 'malformed key is not allowed');
assert(eval9Malformed.status === 'INVALID_KEY', 'malformed key status is INVALID_KEY');

// Test 10: Near-expiration warning calculation (duration 3 days)
const nearKey = generateLicenseKey({
  shopName: 'مقهى قارب الانتهاء',
  tenantId: 'tenant-near-1',
  durationDays: 3,
  maxDevices: 5,
});

const eval10Near = service.validate(nearKey, {
  config: { warningDaysThreshold: 7 },
});
assert(eval10Near.isAllowed === true, 'near expiry license is still allowed');
assert(eval10Near.isNearExpiration === true, 'isNearExpiration is true when <= 7 days');
assert(eval10Near.status === 'NEAR_EXPIRATION', 'status is NEAR_EXPIRATION');

// Test 11: Instant trial key generator
const trialResult = service.activateInstantTrial('مقهى تجريبي جديد', 14, 4);
assert(trialResult.isValid === true, 'instant trial generated is valid');
assert(trialResult.payload?.shopName === 'مقهى تجريبي جديد', 'trial shop name matches');
assert(trialResult.payload?.maxDevices === 4, 'trial device count matches');

console.log(`\n=== All ${passedCount} LicenseService Tests Passed! (${failedCount} failures) ===\n`);
