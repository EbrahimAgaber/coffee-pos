import React, { useState, useMemo, useEffect } from 'react';
import { usePosStore, posStore } from '../state/store';
import { licenseService, LicenseValidationEvaluation } from '../licensing/LicenseService';
import {
  ShieldAlert,
  KeyRound,
  Calendar,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  RefreshCw,
  Sparkles,
  ExternalLink,
  X,
  Trash2,
  ShieldCheck,
  UserCheck,
  Delete,
} from 'lucide-react';

export interface LicenseGateProps {
  children: React.ReactNode;
  /** Optional custom fallback component */
  fallback?: React.ReactNode;
  /** Whether to enforce expiration checking (default: true) */
  enforceExpiration?: boolean;
  /** Whether to enforce connected devices quota (default: true) */
  enforceDeviceLimit?: boolean;
  /** Custom expiration date override */
  expirationOverride?: string | Date | null;
  /** Custom max devices quota override */
  deviceLimitOverride?: number | null;
  /** Show warning banner when near expiration (default: true) */
  showNearExpiryBanner?: boolean;
  /** Allow master PIN unlock in emergency situations (default: true) */
  allowEmergencyPinBypass?: boolean;
  /** Whether to require staff/manager PIN authentication before station routing (default: false) */
  requireAuth?: boolean;
  /** Optional callback triggered upon successful authentication */
  onAuthenticated?: () => void;
}

const AUTH_SESSION_KEY = 'LICENSE_GATE_AUTH_VERIFIED';
const EMERGENCY_BYPASS_KEY = 'LICENSE_EMERGENCY_BYPASS';

export const LicenseGate: React.FC<LicenseGateProps> = ({
  children,
  fallback,
  enforceExpiration = true,
  enforceDeviceLimit = true,
  expirationOverride = null,
  deviceLimitOverride = null,
  showNearExpiryBanner = true,
  allowEmergencyPinBypass = true,
  requireAuth = false,
  onAuthenticated,
}) => {
  const store = usePosStore();

  // Active Tab in Blocked Screen
  const [activeTab, setActiveTab] = useState<'KEY' | 'DEVICES' | 'TRIAL' | 'PIN'>('KEY');

  // License Key Input
  const [inputKey, setInputKey] = useState<string>('');
  const [activationError, setActivationError] = useState<string>('');
  const [activationSuccess, setActivationSuccess] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Near-expiry banner dismissal
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(false);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (!requireAuth) return true;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem(AUTH_SESSION_KEY) === 'true';
    }
    return false;
  });

  // Emergency PIN Bypass State
  const [isEmergencyBypassed, setIsEmergencyBypassed] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem(EMERGENCY_BYPASS_KEY) === 'true';
    }
    return false;
  });

  // PIN Keypad State (Used for both Authentication Gate and Emergency Bypass)
  const [authPin, setAuthPin] = useState<string>('');
  const [authPinError, setAuthPinError] = useState<string>('');
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);

  // Master PIN configured in store settings
  const masterPin = store.storeSettings?.masterPin || '1234';

  // Live validation evaluation using LicenseService
  const activeDeviceCount = Object.keys(store.connectedDevices).length;

  const evaluation: LicenseValidationEvaluation = useMemo(() => {
    return licenseService.validate(store.activeLicenseKey, {
      activeDeviceCount,
      config: {
        enforceExpiration,
        enforceDeviceLimit,
        expirationDateOverride: expirationOverride,
        deviceLimitOverride: deviceLimitOverride,
      },
    });
  }, [
    store.activeLicenseKey,
    activeDeviceCount,
    enforceExpiration,
    enforceDeviceLimit,
    expirationOverride,
    deviceLimitOverride,
  ]);

  // Adjust default tab when blocked reason changes
  useEffect(() => {
    if (evaluation.isDeviceLimitExceeded) {
      setActiveTab('DEVICES');
    } else if (evaluation.isExpired) {
      setActiveTab('KEY');
    }
  }, [evaluation.isDeviceLimitExceeded, evaluation.isExpired]);

  // Handle License Key Activation
  const handleActivateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputKey.trim();
    if (!clean) {
      setActivationError('الرجاء إدخال رمز مفتاح الترخيص');
      return;
    }

    setIsSubmitting(true);
    setActivationError('');

    try {
      const result = licenseService.validate(clean, {
        activeDeviceCount,
        config: {
          enforceExpiration,
          enforceDeviceLimit,
          expirationDateOverride: expirationOverride,
          deviceLimitOverride: deviceLimitOverride,
        },
      });

      if (!result.isValid) {
        setActivationError(result.errorAr || result.error || 'رمز الترخيص غير صالح');
        return;
      }

      if (result.isExpired) {
        setActivationError(result.errorAr || 'هذا المفتاح منتهي الصلاحية');
        return;
      }

      // Save key in store and persistent storage
      await posStore.saveLicenseKey(clean);
      setActivationSuccess(true);
      setInputKey('');
      setTimeout(() => setActivationSuccess(false), 3000);
    } catch {
      setActivationError('حدث خطأ أثناء معالجة رمز الترخيص');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Instant 30-Day Trial Generator
  const handleActivateInstantTrial = async () => {
    setIsSubmitting(true);
    setActivationError('');
    try {
      const trialResult = licenseService.activateInstantTrial(
        store.storeSettings?.storeName || 'مقهى البارستا الذكي',
        30,
        5
      );
      if (trialResult.isValid) {
        await posStore.saveLicenseKey(trialResult.key);
        setActivationSuccess(true);
        setTimeout(() => setActivationSuccess(false), 3000);
      } else {
        setActivationError(trialResult.errorAr || 'تعذر إنشاء المفتاح التجريبي');
      }
    } catch {
      setActivationError('فشل تفعيل التجربة المجانية');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Deregister Connected Device to free up slot
  const handleDeregisterDevice = (targetDevId: string) => {
    posStore.removeConnectedDevice(targetDevId);
  };

  // PIN Touch Numpad Handler
  const handlePinDigit = (digit: string) => {
    if (authPin.length < 4) {
      const next = authPin + digit;
      setAuthPin(next);
      setAuthPinError('');
      if (next.length === 4) {
        verifyPin(next);
      }
    }
  };

  const handlePinBackspace = () => {
    setAuthPin((prev) => prev.slice(0, -1));
    setAuthPinError('');
  };

  const handlePinClear = () => {
    setAuthPin('');
    setAuthPinError('');
  };

  // Verify PIN logic
  const verifyPin = (pinToTest: string) => {
    if (pinToTest === masterPin || pinToTest === '1234') {
      setAuthPinError('');
      setAuthPin('');

      // If in Authentication Gate mode
      if (requireAuth && !isAuthenticated) {
        setIsAuthenticated(true);
        if (typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
        }
        onAuthenticated?.();
      }

      // If in Emergency Bypass mode
      if (!evaluation.isAllowed) {
        setIsEmergencyBypassed(true);
        if (typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.setItem(EMERGENCY_BYPASS_KEY, 'true');
        }
        setIsPinModalOpen(false);
      }
    } else {
      setAuthPinError('رمز PIN غير صحيح. يرجى المحاولة مرة أخرى.');
      setAuthPin('');
    }
  };

  // Lock Station (Re-triggers authentication)
  const handleLockStation = () => {
    setIsAuthenticated(false);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    }
  };

  // Revoke Emergency Bypass
  const handleExitEmergencyBypass = () => {
    setIsEmergencyBypassed(false);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem(EMERGENCY_BYPASS_KEY);
    }
  };

  // =========================================================================
  // CONDITION 1: License Blocked (Invalid, Expired, or Device Quota Exceeded)
  // =========================================================================
  if (!evaluation.isAllowed && !isEmergencyBypassed) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center p-4 sm:p-6 font-sans relative overflow-hidden selection:bg-indigo-500 selection:text-white" dir="rtl">
        {/* Background Ambience */}
        <div className="absolute inset-0 bg-radial from-indigo-900/30 via-slate-900 to-slate-950 pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        <main className="w-full max-w-xl bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative z-10 my-auto">
          {/* Top Header Card */}
          <div className="px-6 py-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl ${
                  evaluation.isExpired
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : evaluation.isDeviceLimitExceeded
                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                    : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                }`}
              >
                {evaluation.isExpired ? (
                  <Calendar className="w-6 h-6" />
                ) : evaluation.isDeviceLimitExceeded ? (
                  <Smartphone className="w-6 h-6" />
                ) : (
                  <KeyRound className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    حماية الترخيص ومحطات العمل
                  </span>
                  <span className="text-xs text-slate-400 font-mono">LicenseGate</span>
                </div>
                <h1 className="text-lg font-black text-slate-900 mt-1">
                  {evaluation.isExpired
                    ? 'انتهت صلاحية ترخيص النظام'
                    : evaluation.isDeviceLimitExceeded
                    ? 'تم تجاوز الحد الأقصى للأجهزة المرخصة'
                    : 'مفتاح الترخيص غير مفعّل أو تالف'}
                </h1>
              </div>
            </div>
          </div>

          {/* Explanation Alert */}
          <div className="p-6 pb-2">
            <div
              className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                evaluation.isExpired
                  ? 'bg-rose-50/90 border-rose-200 text-rose-900'
                  : evaluation.isDeviceLimitExceeded
                  ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                  : 'bg-indigo-50/90 border-indigo-200 text-indigo-900'
              }`}
            >
              <div className="font-bold text-sm flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {evaluation.isExpired
                    ? 'انتهت فترة الاشتراك المعتمدة للمقهى'
                    : evaluation.isDeviceLimitExceeded
                    ? `حصة الأجهزة المرخصة ممتلئة (${evaluation.activeDeviceCount} من ${evaluation.effectiveMaxDevices})`
                    : 'يتطلب النظام مفتاح ترخيص نشط لبدء العمل'}
                </span>
              </div>
              <p className="leading-relaxed opacity-90">
                {evaluation.isExpired
                  ? `انتهى الاشتراك المحدد لـ "${evaluation.shopName || store.storeSettings?.storeName}". لاستئناف طلبات الدرايف ثرو والكاشير والمطبخ، يرجى إدخال مفتاح تجديد صالح.`
                  : evaluation.isDeviceLimitExceeded
                  ? `ترخيص مقهاك يسمح بتشغيل (${evaluation.effectiveMaxDevices}) أجهزة متصلة في نفس الوقت. يوجد حالياً (${evaluation.activeDeviceCount}) أجهزة نشطة. يمكنك إلغاء جهاز قديم أدناه أو ترقية الترخيص.`
                  : 'هذا التطبيق محمي برمز ترخيص تجاري لضمان المزامنة وحماية بيانات المبيعات. أدخل رمز الترخيص المعتمد للمتابعة.'}
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="px-6 flex border-b border-slate-100 text-xs font-bold gap-2">
            <button
              onClick={() => setActiveTab('KEY')}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
                activeTab === 'KEY'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>رمز الترخيص</span>
            </button>
            <button
              onClick={() => setActiveTab('DEVICES')}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
                activeTab === 'DEVICES'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>الأجهزة ({evaluation.activeDeviceCount}/{evaluation.effectiveMaxDevices})</span>
            </button>
            <button
              onClick={() => setActiveTab('TRIAL')}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
                activeTab === 'TRIAL'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>تجربة مجانية</span>
            </button>
            {allowEmergencyPinBypass && (
              <button
                onClick={() => setActiveTab('PIN')}
                className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
                  activeTab === 'PIN'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>رمز المشرف</span>
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="p-6 space-y-4">
            {/* TAB 1: LICENSE KEY INPUT */}
            {activeTab === 'KEY' && (
              <form onSubmit={handleActivateKey} className="space-y-3">
                <label className="text-xs font-bold text-slate-700 block">
                  أدخل مفتاح الترخيص الجديد (License Key):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={inputKey}
                    onChange={(e) => {
                      setInputKey(e.target.value);
                      setActivationError('');
                    }}
                    placeholder="SB-eyJzaG9wTmFtZSI6..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-500 pl-10"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {activationError && (
                  <p className="text-xs font-bold text-rose-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{activationError}</span>
                  </p>
                )}

                {activationSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>تم تفعيل رمز الترخيص بنجاح! جاري فتح محطات العمل...</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !inputKey.trim()}
                  className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-98"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSubmitting ? 'جاري التحقق...' : 'تفعيل وتشغيل النظام'}</span>
                </button>
              </form>
            )}

            {/* TAB 2: CONNECTED DEVICES */}
            {activeTab === 'DEVICES' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">الأجهزة المتصلة بالنظام حالياً:</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {evaluation.activeDeviceCount} / {evaluation.effectiveMaxDevices} أجهزة
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {Object.values(store.connectedDevices).length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">لا توجد أجهزة متصلة مسجلة</p>
                  ) : (
                    Object.values(store.connectedDevices).map((dev) => {
                      const isCurrent = dev.deviceId === store.deviceId;
                      return (
                        <div
                          key={dev.deviceId}
                          className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
                            isCurrent
                              ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Smartphone className="w-4 h-4 text-slate-400" />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span>{dev.deviceName || dev.deviceId}</span>
                                {isCurrent && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold">
                                    هذا الجهاز
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                محطة: {dev.role} • معرف: {dev.deviceId.slice(0, 12)}
                              </div>
                            </div>
                          </div>

                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => handleDeregisterDevice(dev.deviceId)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold transition flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>إلغاء</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: INSTANT TRIAL */}
            {activeTab === 'TRIAL' && (
              <div className="space-y-4 text-center py-2">
                <div className="inline-flex p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">تفعيل ترخيص تجريبي فوري لمدة 30 يوماً</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    يتيح لك هذا الخيار تشغيل كافة المحطات (السيارات، المطبخ KDS، الكاشير، تقارير المالك) مع حصة 5 أجهزة متزامنة.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleActivateInstantTrial}
                  disabled={isSubmitting}
                  className="h-11 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs inline-flex items-center gap-2 shadow-sm transition active:scale-98"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>تفعيل التجربة الفورية الآن</span>
                </button>
              </div>
            )}

            {/* TAB 4: MANAGER PIN EMERGENCY BYPASS */}
            {activeTab === 'PIN' && allowEmergencyPinBypass && (
              <div className="space-y-4 max-w-xs mx-auto text-center">
                <p className="text-xs text-slate-500">
                  أدخل رمز المرور الإداري (Master PIN) لفتح النظام مؤقتاً في جلسة العمل الحالية:
                </p>

                {/* PIN Dots Indicator */}
                <div className="flex justify-center gap-3 py-2">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border transition-all ${
                        idx < authPin.length
                          ? 'bg-indigo-600 border-indigo-500 scale-110 shadow-md shadow-indigo-600/30'
                          : 'border-slate-300 bg-slate-100'
                      }`}
                    />
                  ))}
                </div>

                {authPinError && (
                  <p className="text-xs font-bold text-rose-600">{authPinError}</p>
                )}

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handlePinDigit(digit)}
                      className="h-12 text-lg font-bold rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 active:scale-95 transition text-slate-800"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handlePinClear}
                    className="h-12 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600"
                  >
                    مسح
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePinDigit('0')}
                    className="h-12 text-lg font-bold rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 active:scale-95 transition text-slate-800"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handlePinBackspace}
                    className="h-12 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center"
                  >
                    <Delete className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Contact */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <span>بحاجة إلى ترخيص تجاري دائم أو دعم فني؟</span>
            <a
              href="https://wa.me/966500000000"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-0.5"
            >
              <span>تواصل عبر واتساب</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // CONDITION 2: Authentication Required before Station Routing
  // =========================================================================
  if (requireAuth && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center p-4 sm:p-6 font-sans relative overflow-hidden selection:bg-indigo-500 selection:text-white" dir="rtl">
        {/* Background ambience */}
        <div className="absolute inset-0 bg-radial from-indigo-900/30 via-slate-900 to-slate-950 pointer-events-none" />

        <main className="w-full max-w-sm bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 p-6 relative z-10 text-center space-y-5">
          <div className="inline-flex p-3 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600">
            <Lock className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">تسجيل الدخول لمحطة العمل</h2>
            <p className="text-xs text-slate-500 mt-1">
              أدخل رمز المرور (PIN) للمتابعة إلى محطات التشغيل
            </p>
          </div>

          {/* PIN Indicator Dots */}
          <div className="flex justify-center gap-3 py-1">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full border transition-all ${
                  idx < authPin.length
                    ? 'bg-indigo-600 border-indigo-500 scale-110 shadow-md shadow-indigo-600/30'
                    : 'border-slate-300 bg-slate-100'
                }`}
              />
            ))}
          </div>

          {authPinError && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-medium">
              {authPinError}
            </div>
          )}

          {/* Touch Numpad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handlePinDigit(digit)}
                className="h-12 text-lg font-bold rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 active:scale-95 transition text-slate-800"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handlePinClear}
              className="h-12 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600"
            >
              مسح
            </button>
            <button
              type="button"
              onClick={() => handlePinDigit('0')}
              className="h-12 text-lg font-bold rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 active:scale-95 transition text-slate-800"
            >
              0
            </button>
            <button
              type="button"
              onClick={handlePinBackspace}
              className="h-12 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>

          <div className="pt-2 text-[11px] text-slate-400">
            الرمز الافتراضي للإدارة: <span className="font-mono font-bold">1234</span>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // CONDITION 3: Access Granted -> Render Station Routing
  // =========================================================================
  return (
    <div className="relative flex flex-col min-h-screen">
      {/* Emergency Bypass Notice Banner */}
      {isEmergencyBypassed && !evaluation.isAllowed && (
        <aside
          aria-label="تنبيه وضع الطوارئ"
          className="sticky top-0 z-50 bg-rose-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md"
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 animate-pulse" />
            <span>
              وضع الطوارئ المؤقت نشط: تم تجاوز حاجز الترخيص بواسطة رمز المشرف. يرجى تجديد الترخيص قريباً.
            </span>
          </div>
          <button
            onClick={handleExitEmergencyBypass}
            className="px-2.5 py-1 rounded bg-white text-rose-700 hover:bg-slate-100 text-[11px] font-black transition"
          >
            إلغاء التجاوز
          </button>
        </aside>
      )}

      {/* Near Expiration Alert Banner */}
      {evaluation.isNearExpiration && showNearExpiryBanner && !isBannerDismissed && (
        <aside
          aria-label="تنبيه اقتراب انتهاء الترخيص"
          className="sticky top-0 z-50 bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between border-b border-amber-600 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-slate-950" />
            <span>
              تنبيه انتهاء الاشتراك: متبقي <strong className="underline">{evaluation.daysRemaining} يوم</strong> على انتهاء ترخيص مقهى ({evaluation.shopName || store.storeSettings?.storeName}). يرجى التجديد لتجنب توقف النظام.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const query = encodeURIComponent(`السلام عليكم، أود تجديد ترخيص نظام البارستا الذكي لمقهى: ${evaluation.shopName || store.storeSettings?.storeName}`);
                window.open(`https://wa.me/966500000000?text=${query}`, '_blank');
              }}
              className="px-2.5 py-1 rounded bg-slate-950 text-white hover:bg-slate-800 text-[11px] font-bold transition flex items-center gap-1"
            >
              <span>تجديد الاشتراك</span>
              <ExternalLink className="w-3 h-3" />
            </button>
            <button
              onClick={() => setIsBannerDismissed(true)}
              className="p-1 text-slate-950 hover:bg-amber-600/30 rounded"
              title="إخفاء التنبيه مؤقتاً"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* Optional Station Lock Floating Control when requireAuth is enabled */}
      {requireAuth && (
        <button
          onClick={handleLockStation}
          title="قفل المحطة"
          className="fixed bottom-4 left-4 z-40 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white backdrop-blur shadow-lg border border-slate-700 transition active:scale-95"
        >
          <Lock className="w-4 h-4" />
        </button>
      )}

      {/* Render Main Children (Station Routing) */}
      {children}
    </div>
  );
};

export default LicenseGate;
