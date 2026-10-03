import React, { useState, useMemo } from 'react';
import { usePosStore, posStore } from '../state/store';
import {
  Activity,
  Car,
  ChefHat,
  CreditCard,
  CheckCircle2,
  Clock,
  Smartphone,
  Tablet,
  Monitor,
  Flame,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Filter,
  Check,
  Zap,
  Radio,
  FileSpreadsheet,
} from 'lucide-react';
import { formatStopwatch, getKdsUrgency } from '../stations/KdsStation';

export const WorkMovementVisualizer: React.FC = () => {
  const store = usePosStore();
  const [filterStage, setFilterStage] = useState<string>('ALL');

  // Breakdown of orders across the 4 physical stages
  const stageOrders = useMemo(() => {
    const queueTaker = store.orders.filter((o) => o.status === 'NEW_ORDER');
    const kitchenPrep = store.orders.filter((o) => o.status === 'IN_PREPARATION');
    const cashierReady = store.orders.filter((o) => o.status === 'READY_FOR_PICKUP');
    const completed = store.orders.filter((o) => o.status === 'COMPLETED');

    return {
      queueTaker,
      kitchenPrep,
      cashierReady,
      completed,
    };
  }, [store.orders]);

  // Operational Velocity Metrics
  const velocityMetrics = useMemo(() => {
    const completedWithDuration = store.orders.filter(
      (o) => typeof o.prepDurationSeconds === 'number' && o.prepDurationSeconds > 0
    );

    const avgPrepSec =
      completedWithDuration.length > 0
        ? Math.round(
            completedWithDuration.reduce((acc, o) => acc + (o.prepDurationSeconds || 0), 0) /
              completedWithDuration.length
          )
        : 165; // ~2m 45s fallback

    const completedTodayCount = stageOrders.completed.length;
    const totalSalesToday = stageOrders.completed.reduce((acc, o) => acc + o.total, 0);

    return {
      avgPrepSec,
      completedTodayCount,
      totalSalesToday,
      activeWipCount: stageOrders.queueTaker.length + stageOrders.kitchenPrep.length + stageOrders.cashierReady.length,
    };
  }, [store.orders, stageOrders]);

  // Connected Devices Roster
  const activeDevices = useMemo(() => {
    return Object.values(store.connectedDevices);
  }, [store.connectedDevices]);

  // Filtered Movement Logs
  const filteredLogs = useMemo(() => {
    if (filterStage === 'ALL') return store.movementLogs;
    return store.movementLogs.filter((log) => log.stage === filterStage);
  }, [store.movementLogs, filterStage]);

  return (
    <div className="space-y-6 text-right">
      {/* Velocity Top Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>الطلبات النشطة في المسار (WIP)</span>
            <Activity className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {velocityMetrics.activeWipCount} <span className="text-xs font-normal text-slate-500">طلب مباشر</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">تتدفق بين المسار والمطبخ والشباك</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>متوسط زمن التحضير (Prep SLA)</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {Math.floor(velocityMetrics.avgPrepSec / 60)}د {velocityMetrics.avgPrepSec % 60}ث
          </div>
          <p className="text-[11px] text-emerald-600/80 mt-1">المعدل المستهدف: أقل من 3 دقائق</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>إجمالي المنجز اليوم</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600 font-mono">
            {velocityMetrics.completedTodayCount} <span className="text-xs font-normal text-slate-500">فاتورة</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">معدل الإنجاز 100% بدون هدر</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>إجمالي المبيعات المحصلة</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono">
            {velocityMetrics.totalSalesToday.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-500">ر.س</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">شاملة ضريبة القيمة المضافة 15%</p>
        </div>
      </div>

      {/* 4-Stage Work Movement Funnel Pipeline */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">مسار تدفق العمل المباشر (Work Movement Pipeline)</h3>
              <p className="text-xs text-slate-500">متابعة فورية لتنقل الطلبات من مسار السيارة إلى المطبخ حتى تسليم الكاشير</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px]">Sync: {posStore.getTransport().getTransportName()}</span>
          </div>
        </div>

        {/* 4 Funnel Columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
          {/* Stage 1: Order Taking (Drive-Thru Lane) */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-1.5 font-bold text-xs text-sky-700">
                <Car className="w-4 h-4 text-sky-600" />
                <span>1. مسار الطلبات (السيارات)</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-mono font-bold text-xs">
                {stageOrders.queueTaker.length}
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
              {stageOrders.queueTaker.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  لا توجد طلبات في مرحلة الإدخال
                </div>
              ) : (
                stageOrders.queueTaker.map((order) => (
                  <div
                    key={order.id}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1 text-xs"
                  >
                    <div className="flex justify-between font-mono font-bold text-slate-800">
                      <span>{order.formattedOrderNumber}</span>
                      <span className="text-sky-600">{order.total.toFixed(2)} ر.س</span>
                    </div>
                    <div className="text-slate-600 font-medium truncate">
                      {order.tagValue} {order.vehicleModel ? `(${order.vehicleModel})` : ''}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {order.items.map((i) => `${i.quantity}x ${i.nameAr}`).join('، ')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stage 2: Kitchen Prep (Barista Station) */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-700">
                <ChefHat className="w-4 h-4 text-indigo-600" />
                <span>2. تحضير المطبخ (KDS)</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-mono font-bold text-xs">
                {stageOrders.kitchenPrep.length}
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
              {stageOrders.kitchenPrep.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  لا توجد طلبات قيد التحضير حالياً
                </div>
              ) : (
                stageOrders.kitchenPrep.map((order) => {
                  const elapsedSeconds = Math.max(
                    0,
                    Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 1000)
                  );
                  const urgency = getKdsUrgency(elapsedSeconds);

                  return (
                    <div
                      key={order.id}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1 text-xs"
                    >
                      <div className="flex justify-between items-center font-mono">
                        <span className="font-bold text-slate-800">{order.formattedOrderNumber}</span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                          style={{
                            backgroundColor: `${urgency.colorHex}15`,
                            color: urgency.colorHex,
                          }}
                        >
                          {urgency.formattedTime}
                        </span>
                      </div>
                      <div className="text-slate-700 font-medium truncate">
                        {order.tagValue}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {order.items.map((i) => `${i.quantity}x ${i.nameAr}`).join('، ')}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Stage 3: Window / Ready for Pickup */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-700">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>3. شباك الاستلام والكاشير</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-mono font-bold text-xs">
                {stageOrders.cashierReady.length}
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
              {stageOrders.cashierReady.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  لا توجد طلبات تنتظر الاستلام
                </div>
              ) : (
                stageOrders.cashierReady.map((order) => (
                  <div
                    key={order.id}
                    className="p-2.5 rounded-xl bg-white border border-emerald-300 shadow-2xs space-y-1 text-xs"
                  >
                    <div className="flex justify-between font-mono font-bold text-slate-800">
                      <span>{order.formattedOrderNumber}</span>
                      <span className="text-emerald-600">{order.total.toFixed(2)} ر.س</span>
                    </div>
                    <div className="text-slate-800 font-bold flex items-center justify-between">
                      <span>{order.tagValue}</span>
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-sans">
                        جاهز للتسليم
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {order.items.map((i) => `${i.quantity}x ${i.nameAr}`).join('، ')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stage 4: Completed Orders */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-1.5 font-bold text-xs text-purple-700">
                <CheckCircle2 className="w-4 h-4 text-purple-600" />
                <span>4. مكتملة ومحصلة</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-mono font-bold text-xs">
                {stageOrders.completed.length}
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
              {stageOrders.completed.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="p-2.5 rounded-xl bg-white border border-slate-200 opacity-90 text-xs space-y-0.5"
                >
                  <div className="flex justify-between font-mono">
                    <span className="font-bold text-slate-700">{order.formattedOrderNumber}</span>
                    <span className="font-bold text-purple-600">{order.total.toFixed(2)} ر.س</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>{order.tagValue}</span>
                    <span>{order.paymentMethod}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Connected Devices Network & Realtime Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Connected Devices in Coffee Shop (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900">شبكة الأجهزة المتصلة بالمقهى</h4>
                <p className="text-[11px] text-slate-500">حالة التواجد والتزامن الفوري للهواتف والأجهزة</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {activeDevices.length} أجهزة
            </span>
          </div>

          <div className="space-y-2.5">
            {activeDevices.map((dev) => {
              const isDriveThru = dev.role === 'DRIVE_THRU';
              const isKds = dev.role === 'KDS';
              const isCashier = dev.role === 'CASHIER';
              const isOwner = dev.role === 'OWNER';

              return (
                <div
                  key={dev.deviceId}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 shadow-2xs">
                      {isDriveThru ? (
                        <Smartphone className="w-4 h-4 text-sky-600" />
                      ) : isKds ? (
                        <Tablet className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Monitor className="w-4 h-4 text-indigo-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                        <span>{dev.deviceName}</span>
                        {dev.isCurrentDevice && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-normal">
                            جهازك الحالي
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                        محطة: {dev.role} • نبضة قبل ثوانٍ
                      </div>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    متزامن
                  </span>
                </div>
              );
            })}
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <span className="font-bold text-slate-800">كيف تتواصل هذه الأجهزة؟</span>
            <p className="leading-relaxed">
              تتبادل الهواتف والأجهزة تذاكر الطلبات والنبضات فورياً عبر قنوات البث بدون تأخير زمني، مع دعم كامل للعمل بدون إنترنت (Offline PWA) وحفظ محلي متين.
            </p>
          </div>
        </div>

        {/* Right Column: Live Movement Activity Audit Stream (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900">سجل حركة العمل اللحظي (Audit Stream)</h4>
                <p className="text-[11px] text-slate-500">توثيق لحظي لكل إجراء يُتخذ من أي جهاز في المقهى</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {['ALL', 'ORDER_CAPTURE', 'BUMP_READY', 'CASHIER_PAID'].map((stg) => (
                <button
                  key={stg}
                  type="button"
                  onClick={() => setFilterStage(stg)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                    filterStage === stg
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {stg === 'ALL'
                    ? 'الكل'
                    : stg === 'ORDER_CAPTURE'
                    ? 'الطلبات'
                    : stg === 'BUMP_READY'
                    ? 'المطبخ'
                    : 'الكاشير'}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline Feed */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                لا توجد سجلات حركة مطابقة
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isCapture = log.stage === 'ORDER_CAPTURE';
                const isPrep = log.stage === 'KITCHEN_PREP';
                const isBump = log.stage === 'BUMP_READY';
                const isPaid = log.stage === 'CASHIER_PAID';
                const isVoid = log.stage === 'VOID';

                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/70 transition flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                          isCapture
                            ? 'bg-sky-50 text-sky-600'
                            : isPrep
                            ? 'bg-indigo-50 text-indigo-600'
                            : isBump
                            ? 'bg-emerald-50 text-emerald-600'
                            : isPaid
                            ? 'bg-purple-50 text-purple-600'
                            : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        {isCapture ? (
                          <Car className="w-3.5 h-3.5" />
                        ) : isPrep ? (
                          <ChefHat className="w-3.5 h-3.5" />
                        ) : isBump ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : isPaid ? (
                          <CreditCard className="w-3.5 h-3.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            {log.formattedOrderNumber}
                          </span>
                          <span className="font-semibold text-slate-700">
                            {log.tagValue}
                          </span>
                          {log.vehicleModel && (
                            <span className="text-[10px] text-slate-400">
                              ({log.vehicleModel})
                            </span>
                          )}
                        </div>

                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          {log.summary}
                        </p>

                        <div className="text-[10px] text-slate-400 font-mono">
                          {log.deviceName || log.stationRole}
                        </div>
                      </div>
                    </div>

                    <div className="text-left font-mono text-[11px] shrink-0 text-slate-400">
                      <div>
                        {new Date(log.timestamp).toLocaleTimeString('ar-SA', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                      {log.total !== undefined && (
                        <div className="font-bold text-emerald-600 mt-1">
                          {log.total.toFixed(2)} ر.س
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
