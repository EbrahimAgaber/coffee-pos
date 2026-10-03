import React, { useState, useEffect, useMemo } from 'react';
import { usePosStore, posStore } from '../state/store';
import { Order, OrderStatus } from '../types';
import { chimeSynth } from '../audio/chimeSynth';
import {
  ChefHat,
  Volume2,
  VolumeX,
  History,
  RotateCcw,
  CheckCircle,
  Clock,
  Car,
  Bell,
  User,
  AlertTriangle,
  Flame,
  CheckCheck,
  X,
} from 'lucide-react';

interface BumpedRecord {
  order: Order;
  bumpedAtMs: number;
}

export function formatStopwatch(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.floor(Math.max(0, seconds) % 60);
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function getKdsUrgency(elapsedSeconds: number): {
  urgency: 'green' | 'yellow' | 'red';
  colorHex: string;
  isPulsating: boolean;
  labelAr: string;
  formattedTime: string;
} {
  const s = Math.max(0, elapsedSeconds);
  const formattedTime = formatStopwatch(s);
  if (s < 180) {
    return {
      urgency: 'green',
      colorHex: '#10B981',
      isPulsating: false,
      labelAr: 'طبيعي (< 3 د)',
      formattedTime,
    };
  }
  if (s < 300) {
    return {
      urgency: 'yellow',
      colorHex: '#F59E0B',
      isPulsating: false,
      labelAr: 'تنبيه (3-5 د)',
      formattedTime,
    };
  }
  return {
    urgency: 'red',
    colorHex: '#EF4444',
    isPulsating: true,
    labelAr: 'متأخر جداً (Rush!)',
    formattedTime,
  };
}

export const KdsStation: React.FC = () => {
  const store = usePosStore();

  // Audio Mute state
  const [isMuted, setIsMuted] = useState<boolean>(() => chimeSynth.getMuted());

  // Recent Bumps for 60-Second Undo
  const [recentBumps, setRecentBumps] = useState<BumpedRecord[]>([]);
  const [isRecentDrawerOpen, setIsRecentDrawerOpen] = useState<boolean>(false);

  // Active Filter Tab: 'ALL' | 'PREP' | 'READY' | 'RUSH'
  const [filterTab, setFilterTab] = useState<'ALL' | 'PREP' | 'READY' | 'RUSH'>('ALL');

  // Current Timestamp for Stopwatches (increments every 1 second)
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(() => Date.now());

  // Timer Interval: Re-render every second for live MM:SS stopwatches
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Web Audio Autoplay Unlock on user interaction & Realtime Order Chime Listener
  useEffect(() => {
    // Unlock Web Audio on first tap/click on KDS
    const handleFirstInteraction = () => {
      chimeSynth.unlock();
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    window.addEventListener('pointerdown', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);

    // Subscribe to ORDER_CREATED events to play chime
    const unsubscribe = posStore.getTransport().subscribe<Order>('ORDER_CREATED', (envelope) => {
      if (envelope.payload) {
        chimeSynth.playNewOrderChime();
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  // Toggle Mute
  const handleToggleMute = () => {
    const nextMuted = chimeSynth.toggleMute();
    setIsMuted(nextMuted);
  };

  // Bump Order to READY_FOR_PICKUP
  const handleBumpOrder = async (order: Order) => {
    try {
      chimeSynth.playBumpChime();
      const res = await posStore.bumpOrder(order.id);

      if (res.success) {
        // Record in recent bumps for 60-second undo
        const newRecord: BumpedRecord = {
          order: res.order,
          bumpedAtMs: Date.now(),
        };
        setRecentBumps((prev) => [newRecord, ...prev.filter((r) => r.order.id !== order.id)]);
      }
    } catch (e) {
      console.error('[KDS] Failed to bump order:', e);
    }
  };

  // Start Preparation (if in NEW_ORDER)
  const handleStartPrep = async (order: Order) => {
    try {
      await posStore.startPreparationOrder(order.id);
    } catch (e) {
      console.error('[KDS] Failed to start prep:', e);
    }
  };

  // Recall / Undo Bump (within 60s)
  const handleRecallOrder = async (record: BumpedRecord) => {
    const elapsedSeconds = (Date.now() - record.bumpedAtMs) / 1000;
    if (elapsedSeconds >= 60) {
      alert('انتهت مهلة التراجع المسموحة (60 ثانية).');
      return;
    }

    try {
      const res = await posStore.recallOrder(record.order.id);
      if (res.success) {
        // Remove from recent bumps
        setRecentBumps((prev) => prev.filter((r) => r.order.id !== record.order.id));
      }
    } catch (e) {
      console.error('[KDS] Failed to recall order:', e);
    }
  };

  // Prune expired bumps older than 2 minutes from drawer display
  const validRecentBumps = useMemo(() => {
    return recentBumps.filter((b) => (currentTimeMs - b.bumpedAtMs) / 1000 < 120);
  }, [recentBumps, currentTimeMs]);

  // Active Undoable Count (< 60s)
  const activeUndoableCount = useMemo(() => {
    return recentBumps.filter((b) => (currentTimeMs - b.bumpedAtMs) / 1000 < 60).length;
  }, [recentBumps, currentTimeMs]);

  // Chronologically Sorted Active Kitchen Tickets (NEW_ORDER & IN_PREPARATION)
  const activeTickets = useMemo(() => {
    return store.orders
      .filter((o) => o.status === 'NEW_ORDER' || o.status === 'IN_PREPARATION')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [store.orders]);

  // Ready Tickets (For KDS overview or Ready filter)
  const readyTickets = useMemo(() => {
    return store.orders
      .filter((o) => o.status === 'READY_FOR_PICKUP')
      .sort((a, b) => new Date(b.readyAt || b.updatedAt).getTime() - new Date(a.readyAt || a.updatedAt).getTime());
  }, [store.orders]);

  // Count Delayed Tickets (>= 5 mins)
  const delayedTicketsCount = useMemo(() => {
    return activeTickets.filter((o) => {
      const elapsed = Math.floor((currentTimeMs - new Date(o.createdAt).getTime()) / 1000);
      return elapsed >= 300;
    }).length;
  }, [activeTickets, currentTimeMs]);

  // Displayed Tickets based on Filter Tab
  const displayedTickets = useMemo(() => {
    if (filterTab === 'PREP') {
      return activeTickets.filter((o) => o.status === 'IN_PREPARATION');
    }
    if (filterTab === 'READY') {
      return readyTickets;
    }
    if (filterTab === 'RUSH') {
      return activeTickets.filter((o) => {
        const elapsed = Math.floor((currentTimeMs - new Date(o.createdAt).getTime()) / 1000);
        return elapsed >= 300;
      });
    }
    return activeTickets;
  }, [filterTab, activeTickets, readyTickets, currentTimeMs]);

  return (
    <div
      style={{ backgroundColor: '#FFFFFF' }}
      className="min-h-[calc(100vh-5.5rem)] rounded-2xl border border-slate-200 text-slate-900 flex flex-col overflow-hidden shadow-2xl"
    >
      {/* KDS Station Header */}
      <div className="bg-white backdrop-blur-md border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20">
        {/* Title and Active Counts */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-base text-slate-900 tracking-wide">
                شاشة إدارة المطبخ والبار (KDS)
              </h2>
              {delayedTicketsCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold animate-pulse">
                  <Flame className="w-3 h-3 text-rose-400" />
                  {delayedTicketsCount} متأخر
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTickets.length} تذكرة قيد التنفيذ • {readyTickets.length} جاهز للتسليم
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilterTab('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterTab === 'ALL'
                ? 'bg-slate-100 text-white shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            الكل ({activeTickets.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('RUSH')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterTab === 'RUSH'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-rose-300'
            }`}
          >
            المتأخرة ({delayedTicketsCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('READY')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterTab === 'READY'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-blue-300'
            }`}
          >
            جاهز للاستلام ({readyTickets.length})
          </button>
        </div>

        {/* Action Controls: Sound Toggle & Recent Bumps Drawer */}
        <div className="flex items-center gap-2">
          {/* Sound Mute / Unmute Button */}
          <button
            type="button"
            onClick={handleToggleMute}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              isMuted
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
            }`}
            title={isMuted ? 'تفعيل رنين الطلبات الجديدة' : 'كتم رنين الطلبات الجديدة'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline">
              {isMuted ? 'الصوت مكتوم' : 'الصوت مفعّل'}
            </span>
          </button>

          {/* Recent Bumps Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsRecentDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold transition-all relative"
            title="سجل التذاكر المسلّمة وخيار التراجع (60 ثانية)"
          >
            <History className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">التذاكر المسلّمة</span>
            {activeUndoableCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[11px] font-black flex items-center justify-center font-mono animate-bounce">
                {activeUndoableCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Kanban Grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        {displayedTickets.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-center text-slate-500">
            <CheckCheck className="w-16 h-16 stroke-1 mb-3 text-emerald-400/50" />
            <h3 className="text-base font-bold text-slate-700">لا توجد طلبات معلّقة حالياً</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              تم تحضير وتسليم جميع التذاكر! ستظهر الطلبات الجديدة هنا فور وصولها مع رنين التنبيه.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {displayedTickets.map((ticket) => {
              const elapsedSeconds = Math.floor(
                (currentTimeMs - new Date(ticket.createdAt).getTime()) / 1000
              );
              const urgency = getKdsUrgency(elapsedSeconds);
              const isReady = ticket.status === 'READY_FOR_PICKUP';
              const isNew = ticket.status === 'NEW_ORDER';

              // Urgency border & card styles
              let cardStyle = 'border-slate-200 bg-slate-100 shadow-md';
              let headerBadgeStyle = 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';

              if (!isReady) {
                if (urgency.urgency === 'green') {
                  cardStyle = 'border-emerald-500/60 bg-slate-100 shadow-emerald-500/10 shadow-lg';
                  headerBadgeStyle = 'bg-emerald-950 text-emerald-300 border-emerald-500/50';
                } else if (urgency.urgency === 'yellow') {
                  cardStyle = 'border-amber-500/80 bg-slate-100 shadow-amber-500/15 shadow-lg';
                  headerBadgeStyle = 'bg-amber-950 text-amber-300 border-amber-500/50';
                } else if (urgency.urgency === 'red') {
                  cardStyle =
                    'border-rose-600 bg-rose-950/20 shadow-rose-600/30 shadow-xl ring-1 ring-rose-500 animate-pulse';
                  headerBadgeStyle = 'bg-rose-950 text-rose-300 border-rose-500';
                }
              } else {
                cardStyle = 'border-blue-500/50 bg-slate-100 opacity-90';
                headerBadgeStyle = 'bg-blue-950 text-blue-300 border-blue-500/40';
              }

              return (
                <div
                  key={ticket.id}
                  style={{ backgroundColor: '#1E293B' }}
                  className={`rounded-2xl border-2 flex flex-col justify-between overflow-hidden transition-all ${cardStyle}`}
                >
                  {/* Card Header: Order #, Tag, and Stopwatch Timer */}
                  <div className="p-3.5 border-b border-slate-200 bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xl text-amber-400">
                          {ticket.formattedOrderNumber}
                        </span>
                        {isNew && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold animate-pulse">
                            جديد
                          </span>
                        )}
                      </div>

                      {/* Live MM:SS Stopwatch Badge */}
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border font-mono font-bold text-xs ${headerBadgeStyle}`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{urgency.formattedTime}</span>
                      </div>
                    </div>

                    {/* Tag Information: Plate / Buzzer / Name */}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                        {ticket.tagType === 'VEHICLE' ? (
                          <>
                            <Car className="w-3.5 h-3.5 text-amber-400" />
                            <span className="font-mono tracking-wide">{ticket.tagValue}</span>
                            {ticket.vehicleModel && (
                              <span className="text-slate-500 text-[11px]">
                                ({ticket.vehicleModel})
                              </span>
                            )}
                          </>
                        ) : ticket.tagType === 'BUZZER' ? (
                          <>
                            <Bell className="w-3.5 h-3.5 text-blue-400" />
                            <span className="font-mono">{ticket.tagValue}</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3.5 h-3.5 text-purple-400" />
                            <span>{ticket.tagValue}</span>
                          </>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-500 font-mono">
                        {ticket.createdAt ? new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>

                  {/* Card Body: Items List & Modifiers */}
                  <div className="p-3.5 space-y-3 flex-1 overflow-y-auto max-h-80">
                    {ticket.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col gap-1.5"
                      >
                        {/* Item Name & Quantity Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {/* Prominent Quantity Badge */}
                            <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black font-mono text-sm flex items-center justify-center shadow-sm">
                              {item.quantity}x
                            </span>
                            <span className="font-bold text-sm text-slate-900">
                              {item.nameAr}
                            </span>
                          </div>

                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-amber-300 font-mono font-bold">
                            {item.size}
                          </span>
                        </div>

                        {/* Modifiers Colored Chips */}
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5 pr-9">
                            {item.modifiers.map((m, mIdx) => {
                              let chipColor = 'bg-slate-100 text-slate-700 border-slate-200';
                              if (m.category === 'MILK') {
                                chipColor = 'bg-blue-950/80 text-blue-300 border-blue-500/40';
                              } else if (m.category === 'EXTRA_SHOT') {
                                chipColor = 'bg-rose-950/80 text-rose-300 border-rose-500/40';
                              } else if (m.category === 'SWEETNESS') {
                                chipColor = 'bg-pink-950/80 text-pink-300 border-pink-500/40';
                              } else if (m.category === 'TEMPERATURE') {
                                chipColor = 'bg-orange-950/80 text-orange-300 border-orange-500/40';
                              } else if (m.category === 'SYRUP') {
                                chipColor = 'bg-purple-950/80 text-purple-300 border-purple-500/40';
                              }

                              return (
                                <span
                                  key={mIdx}
                                  className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${chipColor}`}
                                >
                                  {m.nameAr}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Callout Barista Notes */}
                        {item.specialInstructions && (
                          <div className="flex items-start gap-1.5 mt-1 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span className="font-semibold">
                              ملاحظة: {item.specialInstructions}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Card Bottom: Single-Tap Bump Button */}
                  <div className="p-3 border-t border-slate-200 bg-white">
                    {isReady ? (
                      <div className="h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 font-bold text-xs flex items-center justify-center gap-2">
                        <CheckCheck className="w-4 h-4 text-blue-400" />
                        <span>جاهز بانتظار استلام الكاشير</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {isNew && (
                          <button
                            type="button"
                            onClick={() => handleStartPrep(ticket)}
                            className="h-12 px-3 rounded-xl bg-slate-100 hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs active:scale-95 transition-all"
                            title="بدء التحضير"
                          >
                            بدء
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleBumpOrder(ticket)}
                          className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 active:scale-98 shadow-lg shadow-emerald-600/20 transition-all"
                        >
                          <CheckCircle className="w-5 h-5" />
                          <span>جاهز للتقديم (Bump Ready)</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RECENT BUMPS DRAWER (60-Second Undo) */}
      {isRecentDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white border-r border-slate-200 h-full flex flex-col shadow-2xl p-5 overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-slate-900">
                  سجل التذاكر المسلّمة حديثاً
                </h3>
              </div>
              <button
                onClick={() => setIsRecentDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2 mb-4">
              يمكنك استعادة أي تذكرة تم تسليمها بالخطأ وإعادتها لقائمة التحضير خلال مهلة 60 ثانية.
            </p>

            {/* Bumps List */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {validRecentBumps.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-center">
                  <RotateCcw className="w-8 h-8 mb-2 opacity-30 text-amber-400" />
                  <p className="text-xs">لا توجد تذاكر مسلّمة في الذاكرة المؤقتة</p>
                </div>
              ) : (
                validRecentBumps.map((record) => {
                  const elapsedSeconds = Math.floor((currentTimeMs - record.bumpedAtMs) / 1000);
                  const remainingUndoSeconds = Math.max(0, 60 - elapsedSeconds);
                  const canUndo = remainingUndoSeconds > 0;

                  return (
                    <div
                      key={record.order.id}
                      className={`p-3 rounded-xl border transition-all ${
                        canUndo
                          ? 'bg-slate-100 border-slate-200'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400 text-sm">
                            {record.order.formattedOrderNumber}
                          </span>
                          <span className="text-xs text-slate-700 font-medium">
                            {record.order.tagValue}
                          </span>
                        </div>

                        {canUndo ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono font-semibold">
                            متبقي: {remainingUndoSeconds} ثانية
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">انتهت المهلة</span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 mb-3">
                        {record.order.items.map((it) => `${it.quantity}x ${it.nameAr}`).join(' + ')}
                      </div>

                      {canUndo && (
                        <button
                          type="button"
                          onClick={() => handleRecallOrder(record)}
                          className="w-full h-10 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-98 transition-all"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>إلغاء التسليم واستعادة التذكرة (Undo Bump)</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
