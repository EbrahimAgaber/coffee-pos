import React, { useState, useMemo } from 'react';
import { usePosStore, posStore } from '../state/store';
import { Order, Customer, PaymentMethod, PaymentSplit } from '../types';
import { QuickCashCalculator } from '../components/QuickCashCalculator';
import { ReceiptModal } from '../components/ReceiptModal';
import {
  CreditCard,
  Banknote,
  Users,
  CheckCircle2,
  Clock,
  Car,
  Bell,
  Search,
  Receipt,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Printer,
  ChevronRight,
  X,
  FileText,
  Check,
  Percent,
  Layers,
  ArrowRight,
  BadgeAlert,
  MapPin,
  Phone,
  Ban,
} from 'lucide-react';

type QueueFilterTab = 'READY' | 'PREPARING' | 'COMPLETED';

export const CashierStation: React.FC = () => {
  const store = usePosStore();

  // Active Tab Filter
  const [activeTab, setActiveTab] = useState<QueueFilterTab>('READY');

  // Search input (Car plate, order number, buzzer, customer)
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Order
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Modals & Drawers
  const [isCashDrawerOpen, setIsCashDrawerOpen] = useState<boolean>(false);
  const [cashTendered, setCashTendered] = useState<number>(0);

  const [isDebtModalOpen, setIsDebtModalOpen] = useState<boolean>(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [debtError, setDebtError] = useState<string | null>(null);

  const [isSplitModalOpen, setIsSplitModalOpen] = useState<boolean>(false);
  const [splitCashAmount, setSplitCashAmount] = useState<number>(0);
  const [splitMadaAmount, setSplitMadaAmount] = useState<number>(0);

  // Receipt Modal State
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  // Void confirmation
  const [isVoidModalOpen, setIsVoidModalOpen] = useState<boolean>(false);
  const [voidReason, setVoidReason] = useState<string>('طلب العميل الإلغاء');

  // Filter orders by tab
  const tabFilteredOrders = useMemo(() => {
    switch (activeTab) {
      case 'READY':
        return store.orders.filter((o) => o.status === 'READY_FOR_PICKUP');
      case 'PREPARING':
        return store.orders.filter((o) => o.status === 'IN_PREPARATION' || o.status === 'NEW_ORDER');
      case 'COMPLETED':
        return store.orders.filter((o) => o.status === 'COMPLETED');
      default:
        return store.orders;
    }
  }, [store.orders, activeTab]);

  // Apply search query
  const displayedOrders = useMemo(() => {
    if (!searchQuery.trim()) return tabFilteredOrders;
    const q = searchQuery.toLowerCase().trim();
    return tabFilteredOrders.filter((o) => {
      const numMatch = o.orderNumber.toString().includes(q) || o.formattedOrderNumber.toLowerCase().includes(q);
      const tagMatch = o.tagValue?.toLowerCase().includes(q);
      const vehicleMatch = o.vehicleModel?.toLowerCase().includes(q);
      const customerMatch = o.customerName?.toLowerCase().includes(q);
      return numMatch || tagMatch || vehicleMatch || customerMatch;
    });
  }, [tabFilteredOrders, searchQuery]);

  // Currently selected order object
  const selectedOrder = useMemo(() => {
    if (selectedOrderId) {
      const found = store.orders.find((o) => o.id === selectedOrderId);
      if (found) return found;
    }
    // Default to first displayed order
    return displayedOrders.length > 0 ? displayedOrders[0] : null;
  }, [store.orders, selectedOrderId, displayedOrders]);

  // Helper: Open Receipt
  const showReceipt = (order: Order) => {
    setReceiptOrder(order);
    setIsReceiptModalOpen(true);
  };

  // --- CHECKOUT ACTIONS ---

  // 1. MADA / CARD (1-Tap)
  const handleMadaCheckout = async () => {
    if (!selectedOrder) return;
    try {
      const result = await posStore.completeOrder(selectedOrder.id, {
        paymentMethod: 'MADA',
      });
      if (result.success) {
        showReceipt(result.order);
      }
    } catch (e) {
      console.error('Error during MADA checkout:', e);
    }
  };

  // 2. CASH CHECKOUT
  const handleOpenCashDrawer = () => {
    if (!selectedOrder) return;
    setCashTendered(selectedOrder.total);
    setIsCashDrawerOpen(true);
  };

  const handleConfirmCashCheckout = async () => {
    if (!selectedOrder) return;
    const changeDue = Math.max(0, cashTendered - selectedOrder.total);
    try {
      const result = await posStore.completeOrder(selectedOrder.id, {
        paymentMethod: 'CASH',
        cashTendered,
        changeDue,
      });
      if (result.success) {
        setIsCashDrawerOpen(false);
        showReceipt(result.order);
      }
    } catch (e) {
      console.error('Error during Cash checkout:', e);
    }
  };

  // 3. CUSTOMER DEBT (آجل)
  const handleOpenDebtModal = () => {
    if (!selectedOrder) return;
    setDebtError(null);
    setSelectedCustomerId(store.customers[0]?.id || null);
    setIsDebtModalOpen(true);
  };

  const handleConfirmDebtCheckout = async () => {
    if (!selectedOrder || !selectedCustomerId) return;
    setDebtError(null);

    const customer = store.customers.find((c) => c.id === selectedCustomerId);
    if (!customer) {
      setDebtError('العميل المحدد غير موجود');
      return;
    }

    if (customer.currentBalance + selectedOrder.total > customer.creditLimit) {
      setDebtError(
        `الحد الائتماني للعميل (${customer.creditLimit} ر.س) لا يكفي! الرصيد المستحق الحالي: ${customer.currentBalance} ر.س، الفاتورة: ${selectedOrder.total} ر.س.`
      );
      return;
    }

    try {
      const result = await posStore.chargeOrderToCustomer(selectedOrder.id, selectedCustomerId);
      if (result.success) {
        setIsDebtModalOpen(false);
        showReceipt(result.order);
      } else {
        setDebtError(result.error || 'تعذر تسجيل الآجل للعميل');
      }
    } catch (e) {
      setDebtError('حدث خطأ أثناء معالجة الطلب');
      console.error(e);
    }
  };

  // 4. SPLIT PAYMENT (نقد + مدى)
  const handleOpenSplitModal = () => {
    if (!selectedOrder) return;
    const half = Math.round((selectedOrder.total / 2) * 100) / 100;
    setSplitCashAmount(half);
    setSplitMadaAmount(Math.round((selectedOrder.total - half) * 100) / 100);
    setIsSplitModalOpen(true);
  };

  const handleConfirmSplitCheckout = async () => {
    if (!selectedOrder) return;
    const sum = Math.round((splitCashAmount + splitMadaAmount) * 100) / 100;
    if (Math.abs(sum - selectedOrder.total) > 0.01) {
      alert(`مجموع المبالغ (${sum} ر.س) لا يطابق إجمالي الفاتورة (${selectedOrder.total} ر.س)`);
      return;
    }

    const splits: PaymentSplit[] = [
      { method: 'CASH', amount: splitCashAmount },
      { method: 'MADA', amount: splitMadaAmount },
    ];

    try {
      const result = await posStore.completeOrder(selectedOrder.id, {
        paymentMethod: 'SPLIT',
        paymentSplits: splits,
      });
      if (result.success) {
        setIsSplitModalOpen(false);
        showReceipt(result.order);
      }
    } catch (e) {
      console.error('Error during Split checkout:', e);
    }
  };

  // 5. RECALL TO KITCHEN
  const handleRecallOrder = async () => {
    if (!selectedOrder) return;
    if (window.confirm(`هل تريد إعادة الطلب ${selectedOrder.formattedOrderNumber} إلى المطبخ للتحضير؟`)) {
      await posStore.recallOrder(selectedOrder.id);
    }
  };

  // 6. VOID ORDER
  const handleConfirmVoid = async () => {
    if (!selectedOrder) return;
    await posStore.voidOrder(selectedOrder.id, voidReason, 'الكاشير');
    setIsVoidModalOpen(false);
  };

  // Filter customers in Debt Modal
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return store.customers;
    const q = customerSearch.toLowerCase().trim();
    return store.customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.region.toLowerCase().includes(q)
    );
  }, [store.customers, customerSearch]);

  const readyOrdersCount = store.orders.filter((o) => o.status === 'READY_FOR_PICKUP').length;
  const prepOrdersCount = store.orders.filter((o) => o.status === 'IN_PREPARATION' || o.status === 'NEW_ORDER').length;
  const completedOrdersCount = store.orders.filter((o) => o.status === 'COMPLETED').length;

  return (
    <div className="space-y-4 pb-12">
      {/* Top Bar: Queue Switcher & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white border border-slate-200 p-3 sm:p-4 rounded-2xl">
        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('READY')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'READY'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>جاهز للتسليم والتحصيل</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'READY' ? 'bg-slate-50 text-emerald-400' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {readyOrdersCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PREPARING')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'PREPARING'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>قيد التحضير (المطبخ)</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'PREPARING' ? 'bg-slate-50 text-indigo-300' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {prepOrdersCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'COMPLETED'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>فواتير مكتملة اليوم</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'COMPLETED' ? 'bg-slate-50 text-sky-300' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {completedOrdersCount}
            </span>
          </button>
        </div>

        {/* Live Search Input */}
        <div className="relative min-w-[220px] sm:min-w-[280px]">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم الطلب، اللوحة، الرمز..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-8 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Dual-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (5 cols): Order Queue Cards */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              قائمة الطلبات ({displayedOrders.length})
            </span>
            <span className="text-[11px] text-slate-500">
              {activeTab === 'READY' ? 'مرتبة حسب الجاهزية للتسليم' : 'الفرز الزمني'}
            </span>
          </div>

          {displayedOrders.length === 0 ? (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-500 space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-slate-700 stroke-[1.5]" />
              <p className="text-sm font-medium">لا توجد طلبات في هذه القائمة حالياً</p>
              <p className="text-xs text-slate-600">
                {activeTab === 'READY'
                  ? 'بمجرد أن يضغط الباريستا "جاهز" في المطبخ، سيظهر الطلب هنا فوراً'
                  : 'جميع الطلبات محدثة'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {displayedOrders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                const isReady = order.status === 'READY_FOR_PICKUP';
                const isCompleted = order.status === 'COMPLETED';

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-right relative overflow-hidden ${
                      isSelected
                        ? 'bg-slate-100 border-indigo-500 shadow-lg shadow-indigo-500/20 scale-[1.01]'
                        : isReady
                        ? 'bg-white border-emerald-500/30 hover:border-emerald-500/60'
                        : 'bg-white border-slate-200 hover:border-slate-200'
                    }`}
                  >
                    {/* Top Order Row */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-50 font-mono font-black text-sky-400 text-sm border border-slate-200">
                          {order.formattedOrderNumber}
                        </span>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 text-slate-700 text-xs border border-slate-200">
                          {order.tagType === 'VEHICLE' ? (
                            <>
                              <Car className="w-3.5 h-3.5 text-sky-400" />
                              <span className="font-bold">{order.tagValue}</span>
                              {order.vehicleModel && (
                                <span className="text-slate-500 text-[10px]">({order.vehicleModel})</span>
                              )}
                            </>
                          ) : (
                            <>
                              <Bell className="w-3.5 h-3.5 text-indigo-400" />
                              <span className="font-bold">{order.tagValue}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status / Time Badge */}
                      <div>
                        {isReady ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            جاهز للتسليم
                          </span>
                        ) : isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                            مكتمل ({order.paymentMethod})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                            قيد التحضير
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Items Summary preview */}
                    <div className="text-xs text-slate-500 line-clamp-1 mb-2">
                      {order.items.map((it) => `${it.quantity}x ${it.nameAr}`).join(' • ')}
                    </div>

                    {/* Bottom Row: Total & Prep Time */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                      <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                        {order.prepDurationSeconds !== undefined && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            وقت التحضير: {Math.floor(order.prepDurationSeconds / 60)}د {order.prepDurationSeconds % 60}ث
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-sm font-black text-slate-900">
                        {order.total.toFixed(2)} <span className="text-xs font-normal text-slate-500">ر.س</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (7 cols): Order Inspector & Checkout Terminal */}
        <div className="lg:col-span-7">
          {selectedOrder ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5 sticky top-20 shadow-xl">
              {/* Order Header */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
                      {selectedOrder.formattedOrderNumber}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                        selectedOrder.status === 'READY_FOR_PICKUP'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : selectedOrder.status === 'COMPLETED'
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {selectedOrder.status === 'READY_FOR_PICKUP'
                        ? 'جاهز للتسليم والتحصيل'
                        : selectedOrder.status === 'COMPLETED'
                        ? 'فاتورة مسددة'
                        : 'قيد التحضير في المطبخ'}
                    </span>
                  </div>

                  {/* Vehicle / Buzzer Details */}
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-700">
                    {selectedOrder.tagType === 'VEHICLE' ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200">
                        <Car className="w-4 h-4 text-amber-400" />
                        <span className="font-bold text-slate-900">{selectedOrder.tagValue}</span>
                        {selectedOrder.vehicleModel && (
                          <span className="text-slate-500">({selectedOrder.vehicleModel})</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200">
                        <Bell className="w-4 h-4 text-purple-400" />
                        <span className="font-bold text-slate-900">{selectedOrder.tagValue}</span>
                      </div>
                    )}

                    {selectedOrder.customerName && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span>{selectedOrder.customerName}</span>
                        {selectedOrder.customerRegion && (
                          <span className="text-[10px] text-slate-500">({selectedOrder.customerRegion})</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Print Receipt / Actions */}
                <div className="flex items-center gap-2">
                  {selectedOrder.status === 'READY_FOR_PICKUP' && (
                    <button
                      type="button"
                      onClick={handleRecallOrder}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
                      title="إعادة للمطبخ للتحضير"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => showReceipt(selectedOrder)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
                    title="معاينة وطباعة الإيصال"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  {selectedOrder.status !== 'VOIDED' && (
                    <button
                      type="button"
                      onClick={() => setIsVoidModalOpen(true)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                      title="إلغاء الطلب (Void)"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Itemized Order Table */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-500">تفاصيل المشروبات والطلبات:</div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200 max-h-56 overflow-y-auto">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-amber-500/10 text-amber-400 font-bold flex items-center justify-center text-[11px]">
                            {item.quantity}×
                          </span>
                          <span className="font-bold text-slate-900">{item.nameAr}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                            الحجم {item.size}
                          </span>
                        </div>
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="text-[11px] text-slate-500 flex flex-wrap gap-1 pr-7">
                            {item.modifiers.map((m) => (
                              <span
                                key={m.id}
                                className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700"
                              >
                                + {m.nameAr} {m.priceDelta > 0 ? `(${m.priceDelta} ر.س)` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.specialInstructions && (
                          <div className="text-[10px] text-amber-300 pr-7">
                            ملاحظة: {item.specialInstructions}
                          </div>
                        )}
                      </div>
                      <div className="font-mono font-bold text-slate-800 whitespace-nowrap">
                        {item.totalPrice.toFixed(2)} ر.س
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals & Tax Summary */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>المجموع الفرعي (غير شامل الضريبة)</span>
                  <span className="font-mono">{selectedOrder.subtotal.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>ضريبة القيمة المضافة (15% VAT)</span>
                  <span className="font-mono">{selectedOrder.tax.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span className="text-amber-400">المبلغ الإجمالي المطلوب</span>
                  <span className="font-mono text-amber-400 text-lg">
                    {selectedOrder.total.toFixed(2)} ر.س
                  </span>
                </div>
              </div>

              {/* Fast Checkout Action Grid */}
              {selectedOrder.status === 'READY_FOR_PICKUP' ? (
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>طريقة الدفع والتحصيل الفوري:</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      دفع سريع بنقرة واحدة
                    </span>
                  </div>

                  {/* 3 Main Action Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* 1. MADA / CARD */}
                    <button
                      type="button"
                      onClick={handleMadaCheckout}
                      className="h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm flex flex-col items-center justify-center gap-1 shadow-lg shadow-indigo-600/25 active:scale-95 transition-all"
                    >
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="w-5 h-5 text-indigo-200" />
                        <span className="text-base">مدى / بطاقة</span>
                      </div>
                      <span className="text-[10px] font-normal text-indigo-200">
                        تحصيل مباشر بنقرة واحدة
                      </span>
                    </button>

                    {/* 2. CASH */}
                    <button
                      type="button"
                      onClick={handleOpenCashDrawer}
                      className="h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all"
                    >
                      <div className="flex items-center gap-1.5">
                        <Banknote className="w-5 h-5 text-emerald-200" />
                        <span className="text-base">نقد (كاش)</span>
                      </div>
                      <span className="text-[10px] font-normal text-emerald-200">
                        حاسبة الفكة السريعة
                      </span>
                    </button>

                    {/* 3. CUSTOMER DEBT (آجل) */}
                    <button
                      type="button"
                      onClick={handleOpenDebtModal}
                      className="h-16 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm flex flex-col items-center justify-center gap-1 shadow-lg shadow-purple-600/20 active:scale-95 transition-all"
                    >
                      <div className="flex items-center gap-1.5">
                        <Users className="w-5 h-5 text-purple-200" />
                        <span className="text-base">ذمم عملاء (آجل)</span>
                      </div>
                      <span className="text-[10px] font-normal text-purple-200">
                        تقييد على حساب وحي العميل
                      </span>
                    </button>
                  </div>

                  {/* Split payment option */}
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={handleOpenSplitModal}
                      className="text-xs text-slate-500 hover:text-amber-400 transition-colors inline-flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-slate-100"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>دفع مجزأ (جزء كاش + جزء مدى)</span>
                    </button>
                  </div>
                </div>
              ) : selectedOrder.status === 'COMPLETED' ? (
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-purple-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>تم تسديد الفاتورة بنجاح بواسطة ({selectedOrder.paymentMethod})</span>
                  </div>
                  {selectedOrder.cashTendered && (
                    <div className="text-xs text-slate-700">
                      المستلم: {selectedOrder.cashTendered.toFixed(2)} ر.س | الفكة:{' '}
                      {(selectedOrder.changeDue || 0).toFixed(2)} ر.س
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => showReceipt(selectedOrder)}
                    className="mt-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold inline-flex items-center gap-2"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>عرض وإعادة طباعة الفاتورة</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center text-xs text-amber-400 space-y-1">
                  <Clock className="w-5 h-5 mx-auto text-amber-400 mb-1" />
                  <p className="font-bold">الطلب لا يزال في مرحلة التحضير لدى الباريستا</p>
                  <p className="text-slate-500">
                    بمجرد اكتمال تحضير المشروبات وضغط "جاهز"، ستتاح أزرار التحصيل فوراً.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
              <Receipt className="w-12 h-12 mx-auto text-slate-700 stroke-[1.5] mb-3" />
              <p className="text-base font-bold text-slate-500">اختر طلباً لمعاينته وإتمام التحصيل</p>
              <p className="text-xs text-slate-600 mt-1">
                تظهر هنا تفاصيل الطلب وخيارات الدفع الفوري (كاش، مدى، آجل)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Quick Cash Calculator Drawer */}
      {isCashDrawerOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative">
            <button
              onClick={() => setIsCashDrawerOpen(false)}
              className="absolute top-4 left-4 text-slate-500 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-right mb-4">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-amber-400" />
                <span>تحصيل نقدي (كاش) — {selectedOrder.formattedOrderNumber}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                السيارة / الرمز: <span className="text-amber-400 font-bold">{selectedOrder.tagValue}</span>
              </p>
            </div>

            <QuickCashCalculator
              total={selectedOrder.total}
              tendered={cashTendered}
              onTenderedChange={setCashTendered}
              onQuickCheckout={handleConfirmCashCheckout}
            />

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setIsCashDrawerOpen(false)}
                className="w-1/3 h-11 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-700 font-bold text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={cashTendered < selectedOrder.total}
                onClick={handleConfirmCashCheckout}
                className="w-2/3 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <span>تأكيد استلام النقد وطباعة الإيصال</span>
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Customer Debt (آجل) Selector */}
      {isDebtModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative">
            <button
              onClick={() => setIsDebtModalOpen(false)}
              className="absolute top-4 left-4 text-slate-500 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-right mb-4">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                <span>تقييد على حساب عميل (آجل)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                مبلغ الفاتورة المطلوب تقييده:{' '}
                <span className="text-amber-400 font-bold font-mono">{selectedOrder.total.toFixed(2)} ر.س</span>
              </p>
            </div>

            {debtError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{debtError}</div>
              </div>
            )}

            {/* Customer Search Bar */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="ابحث بالاسم، رقم الجوال، أو الحي..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-900 placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Customers List */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {filteredCustomers.map((customer) => {
                const isSelected = selectedCustomerId === customer.id;
                const availableCredit = customer.creditLimit - customer.currentBalance;
                const wouldExceed = customer.currentBalance + selectedOrder.total > customer.creditLimit;

                return (
                  <div
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomerId(customer.id);
                      setDebtError(null);
                    }}
                    className={`p-3 rounded-xl border text-right cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-purple-600/10 border-purple-500 shadow-md shadow-purple-500/10'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{customer.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-slate-500" />
                          {customer.region}
                        </span>
                      </div>
                      <div className="text-left font-mono text-xs">
                        <span className="text-slate-500">الرصيد: </span>
                        <span className="font-bold text-amber-400">{customer.currentBalance.toFixed(2)} ر.س</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-200">
                      <div className="flex items-center gap-1 text-slate-500">
                        <Phone className="w-3 h-3" />
                        <span>{customer.phone}</span>
                      </div>
                      <div>
                        الحد الائتماني: {customer.creditLimit} ر.س |{' '}
                        {wouldExceed ? (
                          <span className="text-rose-400 font-bold">الحد لا يكفي (-{(customer.currentBalance + selectedOrder.total - customer.creditLimit).toFixed(2)})</span>
                        ) : (
                          <span className="text-emerald-400">المتاح: {availableCredit.toFixed(2)} ر.س</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setIsDebtModalOpen(false)}
                className="w-1/3 h-11 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-700 font-bold text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={!selectedCustomerId}
                onClick={handleConfirmDebtCheckout}
                className="w-2/3 h-11 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20"
              >
                <span>تقييد على حساب العميل وإصدار الفاتورة</span>
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Split Payment Modal */}
      {isSplitModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative">
            <button
              onClick={() => setIsSplitModalOpen(false)}
              className="absolute top-4 left-4 text-slate-500 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-right mb-4">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <span>دفع مجزأ (كاش + مدى)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                إجمالي الفاتورة:{' '}
                <span className="text-amber-400 font-bold font-mono">{selectedOrder.total.toFixed(2)} ر.س</span>
              </p>
            </div>

            <div className="space-y-3">
              {/* Cash part */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <label className="text-xs text-slate-500 block mb-1">المبلغ نقداً (Cash)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    value={splitCashAmount || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setSplitCashAmount(val);
                      setSplitMadaAmount(Math.max(0, Math.round((selectedOrder.total - val) * 100) / 100));
                    }}
                    className="w-full bg-transparent font-mono text-xl font-bold text-slate-900 focus:outline-none"
                  />
                  <span className="text-xs text-slate-500">ر.س</span>
                </div>
              </div>

              {/* Mada part */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <label className="text-xs text-slate-500 block mb-1">المبلغ عبر مدى / بطاقة (Mada)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    value={splitMadaAmount || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setSplitMadaAmount(val);
                      setSplitCashAmount(Math.max(0, Math.round((selectedOrder.total - val) * 100) / 100));
                    }}
                    className="w-full bg-transparent font-mono text-xl font-bold text-slate-900 focus:outline-none"
                  />
                  <span className="text-xs text-slate-500">ر.س</span>
                </div>
              </div>

              {/* Validation Status */}
              {Math.abs(splitCashAmount + splitMadaAmount - selectedOrder.total) < 0.01 ? (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs text-center font-bold">
                  ✓ مجموع الجزئين يطابق إجمالي الفاتورة تماماً
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center font-bold">
                  تنبيه: الفرق:{' '}
                  {(splitCashAmount + splitMadaAmount - selectedOrder.total).toFixed(2)} ر.س
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setIsSplitModalOpen(false)}
                className="w-1/3 h-11 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-700 font-bold text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={Math.abs(splitCashAmount + splitMadaAmount - selectedOrder.total) > 0.01}
                onClick={handleConfirmSplitCheckout}
                className="w-2/3 h-11 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
              >
                <span>تأكيد الدفع المجزأ</span>
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Void Reason Modal */}
      {isVoidModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-5 sm:p-6 shadow-2xl relative text-right">
            <button
              onClick={() => setIsVoidModalOpen(false)}
              className="absolute top-4 left-4 text-slate-500 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-rose-400 flex items-center gap-2 mb-2">
              <Ban className="w-5 h-5" />
              <span>إلغاء الفاتورة ({selectedOrder.formattedOrderNumber})</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              سيتم إعادة المخزون المستهلك واسترجاع القيود المالية المرتبطة بهذا الطلب.
            </p>

            <div className="space-y-2 mb-4">
              <label className="text-xs text-slate-700 block">سبب الإلغاء:</label>
              <select
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none"
              >
                <option value="طلب العميل الإلغاء">طلب العميل الإلغاء (Customer requested)</option>
                <option value="خطأ في المشروبات أو المقاس">خطأ في المشروبات أو المقاس (Wrong item)</option>
                <option value="مغادرة العميل دون استلام">مغادرة العميل دون استلام (Customer left)</option>
                <option value="طلب تجريبي / تدريب">طلب تجريبي / تدريب (Test order)</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(false)}
                className="w-1/2 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                className="w-1/2 h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                تأكيد الإلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Thermal / WhatsApp Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        order={receiptOrder}
        onClose={() => setIsReceiptModalOpen(false)}
      />
    </div>
  );
};

export default CashierStation;
