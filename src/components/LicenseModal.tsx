import React, { useState, useEffect } from 'react';
import { usePosStore, posStore } from '../state/store';
import {
  generateLicenseKey,
  validateLicenseKey,
  LicensePayload,
} from '../licensing/licenseManager';
import QRCode from 'qrcode';
import {
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  QrCode,
  Calendar,
  Smartphone,
  Sparkles,
  RefreshCw,
  X,
  Plus,
  Clock,
  Layers,
  CheckCircle2,
} from 'lucide-react';

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({ isOpen, onClose }) => {
  const store = usePosStore();

  // Active Tab: 'STATUS' | 'ACTIVATE' | 'GENERATOR'
  const [activeTab, setActiveTab] = useState<'STATUS' | 'ACTIVATE' | 'GENERATOR'>('STATUS');

  // Activation input state
  const [inputKey, setInputKey] = useState<string>('');
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState<boolean>(false);

  // Generator form state
  const [genShopName, setGenShopName] = useState<string>('مقهى أريج المختصة');
  const [genTenantId, setGenTenantId] = useState<string>('shop_' + Math.random().toString(36).slice(2, 6));
  const [genMaxDevices, setGenMaxDevices] = useState<number>(5);
  const [genDurationType, setGenDurationType] = useState<'30' | '90' | '365' | 'CUSTOM'>('30');
  const [genCustomDays, setGenCustomDays] = useState<number>(60);
  const [generatedKey, setGeneratedKey] = useState<string>('');
  const [generatedQrUrl, setGeneratedQrUrl] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  // Active devices count
  const activeDevicesList = Object.values(store.connectedDevices);
  const maxDevices = store.licenseValidation.payload?.maxDevices || 1;
  const isOverQuota = activeDevicesList.length > maxDevices;

  // Generate QR Code when a key is generated or active
  useEffect(() => {
    const keyToQr = generatedKey || store.activeLicenseKey;
    if (keyToQr) {
      QRCode.toDataURL(keyToQr, { width: 220, margin: 1 })
        .then((url) => setGeneratedQrUrl(url))
        .catch(() => {});
    }
  }, [generatedKey, store.activeLicenseKey]);

  if (!isOpen) return null;

  const handleActivate = async () => {
    setActivationError(null);
    setActivationSuccess(false);

    if (!inputKey.trim()) {
      setActivationError('يرجى إدخال مفتاح الترخيص');
      return;
    }

    const res = await posStore.updateLicenseKey(inputKey.trim());
    if (res.isValid && !res.isExpired) {
      setActivationSuccess(true);
      setTimeout(() => {
        setActivationSuccess(false);
        setActiveTab('STATUS');
      }, 1500);
    } else {
      setActivationError(res.error || 'المفتاح غير صالح أو منتهي الصلاحية');
    }
  };

  const handleGenerateKey = () => {
    const days =
      genDurationType === '30'
        ? 30
        : genDurationType === '90'
        ? 90
        : genDurationType === '365'
        ? 365
        : genCustomDays;

    const key = generateLicenseKey({
      shopName: genShopName,
      tenantId: genTenantId,
      maxDevices: genMaxDevices,
      durationDays: days,
      licenseType: days === 365 ? 'YEARLY' : days === 30 ? 'MONTHLY' : 'CUSTOM',
    });

    setGeneratedKey(key);
    setCopiedKey(false);
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const licensePayload = store.licenseValidation.payload;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 text-right">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-900">نظام إدارة التراخيص وتنسيق الأجهزة</h2>
              <p className="text-xs text-slate-500">حصة الأجهزة، مدة الاشتراك، والتزامن الذكي بين الفروع</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-100 bg-slate-50/60">
          <button
            type="button"
            onClick={() => setActiveTab('STATUS')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-lg transition border-b-2 ${
              activeTab === 'STATUS'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            حالة الترخيص الحالي
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVATE')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-lg transition border-b-2 ${
              activeTab === 'ACTIVATE'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            تفعيل مفتاح جديد
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('GENERATOR');
              if (!generatedKey) handleGenerateKey();
            }}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-lg transition border-b-2 flex items-center gap-1.5 ${
              activeTab === 'GENERATOR'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>مولّد التراخيص (للمالك/المشرف)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-sm">
          {/* TAB 1: STATUS */}
          {activeTab === 'STATUS' && (
            <div className="space-y-4">
              {/* License Status Card */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  store.licenseValidation.isValid && !store.licenseValidation.isExpired
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-rose-50 border-rose-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-xl ${
                        store.licenseValidation.isValid && !store.licenseValidation.isExpired
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm">
                          {licensePayload?.shopName || 'ترخيص تجاري'}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white border border-emerald-200 text-emerald-700">
                          {store.licenseValidation.isExpired ? 'منتهي' : 'ساري ونشط'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Tenant: {licensePayload?.tenantId || 'default'}
                      </p>
                    </div>
                  </div>

                  <div className="text-left font-mono">
                    <span className="text-xs text-slate-500 block">المتبقي</span>
                    <span className="text-lg font-black text-emerald-600">
                      {store.licenseValidation.daysRemaining} يوم
                    </span>
                  </div>
                </div>

                {/* Device Quota Progress Bar */}
                <div className="mt-4 pt-3 border-t border-emerald-200/60">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-indigo-600" />
                      <span>الأجهزة المتصلة حالياً:</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {activeDevicesList.length} / {maxDevices} أجهزة مصرح بها
                    </span>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isOverQuota ? 'bg-rose-500' : 'bg-indigo-600'
                      }`}
                      style={{
                        width: `${Math.min(100, (activeDevicesList.length / maxDevices) * 100)}%`,
                      }}
                    />
                  </div>

                  {isOverQuota && (
                    <div className="mt-2 text-xs text-rose-600 font-semibold flex items-center gap-1 bg-rose-100/60 p-2 rounded-lg">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>تم تجاوز حصة الأجهزة المرخصة. يُرجى ترقية الترخيص أو فصل أحد الأجهزة.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Connected Devices Details */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>شبكة الأجهزة المسجلة في هذا المقهى ({activeDevicesList.length}):</span>
                  <span className="text-[11px] text-slate-500">تحديث تلقائي بالنبضات اللحظية</span>
                </div>

                <div className="space-y-2">
                  {activeDevicesList.map((dev) => (
                    <div
                      key={dev.deviceId}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-slate-900">
                            <span>{dev.deviceName}</span>
                            {dev.isCurrentDevice && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">
                                (هذا الجهاز)
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            المحطة: {dev.role} • ID: {dev.deviceId.slice(0, 12)}
                          </div>
                        </div>
                      </div>

                      <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        متصل الآن
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Current Device Settings */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  تسمية هذا الجهاز لتسهيل تتبعه (مثال: آيفون مسار السيارات 1):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    defaultValue={store.deviceName}
                    onBlur={(e) => {
                      if (e.target.value.trim()) {
                        posStore.setCustomDeviceName(e.target.value.trim());
                      }
                    }}
                    placeholder="اسم الجهاز..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => posStore.broadcastHeartbeat()}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition"
                    title="تحديث نبضة الاتصال"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>تحديث النبضة</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACTIVATE */}
          {activeTab === 'ACTIVATE' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs text-slate-700 space-y-1">
                <p className="font-bold text-indigo-900">تفعيل ترخيص مقهى جديد:</p>
                <p className="text-slate-600 leading-relaxed">
                  ألصق مفتاح الترخيص المشفر الممنوح من إدارة النظام أو امسح رمز الـ QR لتفعيل الأجهزة وربطها بنفس المتجر.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  رمز الترخيص (License Key):
                </label>
                <textarea
                  rows={3}
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="SB-eyJzaG9wTmFtZSI6..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              {activationError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{activationError}</span>
                </div>
              )}

              {activationSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>تم تفعيل الترخيص بنجاح وتحديث صلاحيات جميع الأجهزة!</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleActivate}
                className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-98"
              >
                <KeyRound className="w-4 h-4" />
                <span>التحقق وتفعيل الترخيص الآن</span>
              </button>
            </div>
          )}

          {/* TAB 3: GENERATOR (For Owner / Vendor) */}
          {activeTab === 'GENERATOR' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <span className="font-bold">أداة المزوّد والمالك:</span>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    يمكنك توليد مفاتيح مشفرة وموقعة رقمياً بالمدة وعدد الأجهزة التي ترغب في ترخيصها لأي مقهى أو فرع.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">اسم المقهى / العميل:</label>
                  <input
                    type="text"
                    value={genShopName}
                    onChange={(e) => setGenShopName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">معرّف الفرع (Tenant ID):</label>
                  <input
                    type="text"
                    value={genTenantId}
                    onChange={(e) => setGenTenantId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">عدد الأجهزة المرخصة (Quota):</label>
                  <select
                    value={genMaxDevices}
                    onChange={(e) => setGenMaxDevices(parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  >
                    <option value={1}>1 جهاز (فردي)</option>
                    <option value={3}>3 أجهزة (سيارات + مطبخ + كاشير)</option>
                    <option value={5}>5 أجهزة (مقاهي متوسطة)</option>
                    <option value={10}>10 أجهزة (فروع متعددة المسارات)</option>
                    <option value={20}>20 جهاز (سلسلة فروع)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">فترة الصلاحية:</label>
                  <select
                    value={genDurationType}
                    onChange={(e) => setGenDurationType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="30">شهر واحد (30 يوماً)</option>
                    <option value="90">3 أشهر (90 يوماً)</option>
                    <option value="365">سنة كاملة (365 يوماً)</option>
                    <option value="CUSTOM">أيام مخصصة...</option>
                  </select>
                </div>
              </div>

              {genDurationType === 'CUSTOM' && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">حدد عدد الأيام المخصصة:</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={genCustomDays}
                    onChange={(e) => setGenCustomDays(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerateKey}
                className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>توليد مفتاح الترخيص والـ QR الآن</span>
              </button>

              {/* Generated Result */}
              {generatedKey && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>المفتاح المولد للمقهى:</span>
                    <button
                      type="button"
                      onClick={() => handleCopyKey(generatedKey)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 text-[11px] font-bold transition"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey ? 'تم النسخ!' : 'نسخ المفتاح'}</span>
                    </button>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 font-mono text-[11px] break-all text-slate-800 select-all">
                    {generatedKey}
                  </div>

                  {/* QR Code for Fast Mobile Activation */}
                  {generatedQrUrl && (
                    <div className="flex items-center gap-4 pt-2 border-t border-slate-200">
                      <img
                        src={generatedQrUrl}
                        alt="License QR"
                        className="w-24 h-24 rounded-xl border border-slate-200 bg-white p-1 shrink-0"
                      />
                      <div className="text-xs text-slate-600 space-y-1">
                        <p className="font-bold text-slate-900 flex items-center gap-1">
                          <QrCode className="w-4 h-4 text-indigo-600" />
                          <span>تفعيل سريع عبر مسح الـ QR</span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          امسح هذا الرمز من كاميرا الهاتف لتفعيل الترخيص فوراً دون الحاجة لكتابة الرمز يدوياً.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            posStore.updateLicenseKey(generatedKey);
                            setActiveTab('STATUS');
                          }}
                          className="mt-1 text-[11px] text-indigo-600 hover:underline font-bold"
                        >
                          تطبيق هذا الترخيص على التطبيق الحالي مباشرةً ←
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
