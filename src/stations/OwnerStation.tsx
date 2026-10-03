import React, { useState, useMemo } from 'react';
import { usePosStore, posStore } from '../state/store';
import { Customer, RawIngredient, CashierShift, Order } from '../types';
import {
  TrendingUp,
  Package,
  Users,
  Clock,
  Banknote,
  CreditCard,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  DollarSign,
  FileText,
  Lock,
  Unlock,
  RefreshCw,
  X,
  Check,
  ChevronDown,
  Layers,
  MapPin,
  Phone,
  BarChart3,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  AlertCircle,
  Archive,
  ShoppingBag,
} from 'lucide-react';

type OwnerSection = 'FINANCIAL' | 'INVENTORY' | 'DEBT_CUSTOMERS';

export const OwnerStation: React.FC = () => {
  const store = usePosStore();

  // Active Navigation Section
  const [activeSection, setActiveSection] = useState<OwnerSection>('FINANCIAL');

  // --- Financial & Shift State ---
  const [isXReportOpen, setIsXReportOpen] = useState<boolean>(false);
  const [isZReportOpen, setIsZReportOpen] = useState<boolean>(false);
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [newShiftCashierName, setNewShiftCashierName] = useState<string>('محمد أحمد');
  const [newShiftStartingCash, setNewShiftStartingCash] = useState<number>(500);

  // --- Inventory State ---
  const [replenishItem, setReplenishItem] = useState<RawIngredient | null>(null);
  const [replenishAmount, setReplenishAmount] = useState<string>('');
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState<boolean>(false);

  // --- Debt & Regional Customers State ---
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('ALL');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [settlementCustomer, setSettlementCustomer] = useState<Customer | null>(null);
  const [settlementAmount, setSettlementAmount] = useState<string>('');
  const [settlementNotes, setSettlementNotes] = useState<string>('سداد دفعة نقدية');
  const [viewLedgerCustomer, setViewLedgerCustomer] = useState<Customer | null>(null);

  // Add Customer Modal
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustPhone, setNewCustPhone] = useState<string>('');
  const [newCustRegion, setNewCustRegion] = useState<string>('حي الياسمين');
  const [newCustLimit, setNewCustLimit] = useState<number>(1000);

  // Completed Orders for KPIs
  const completedOrders = useMemo(() => {
    return store.orders.filter((o) => o.status === 'COMPLETED');
  }, [store.orders]);

  // Operational KPIs
  const kpis = useMemo(() => {
    const grossSales = completedOrders.reduce((sum, o) => sum + o.total, 0);
    const aov = completedOrders.length > 0 ? grossSales / completedOrders.length : 0;

    // Average prep time in seconds across orders with prepDurationSeconds
    const prepTimes = store.orders
      .filter((o) => typeof o.prepDurationSeconds === 'number' && o.prepDurationSeconds > 0)
      .map((o) => o.prepDurationSeconds as number);

    const avgPrepSeconds =
      prepTimes.length > 0
        ? Math.round(prepTimes.reduce((acc, t) => acc + t, 0) / prepTimes.length)
        : 0;

    // Sales breakdown by payment method
    let cashSales = 0;
    let madaSales = 0;
    let debtSales = 0;

    for (const order of completedOrders) {
      if (order.paymentMethod === 'CASH') {
        cashSales += order.total;
      } else if (order.paymentMethod === 'MADA') {
        madaSales += order.total;
      } else if (order.paymentMethod === 'CUSTOMER_CREDIT') {
        debtSales += order.total;
      } else if (order.paymentMethod === 'SPLIT' && order.paymentSplits) {
        for (const sp of order.paymentSplits) {
          if (sp.method === 'CASH') cashSales += sp.amount;
          if (sp.method === 'MADA') madaSales += sp.amount;
        }
      }
    }

    const expectedCashInDrawer = store.currentShift.startingCash + cashSales;

    return {
      grossSales,
      orderCount: completedOrders.length,
      aov,
      avgPrepSeconds,
      cashSales,
      madaSales,
      debtSales,
      expectedCashInDrawer,
    };
  }, [completedOrders, store.orders, store.currentShift]);

  // Format Stopwatch MM:SS
  const formatSeconds = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  // Filtered Ingredients
  const ingredientsList = useMemo(() => {
    return Object.values(store.ingredients).filter((item) => {
      const matchesSearch =
        item.nameAr.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        item.nameEn.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        item.sku.toLowerCase().includes(inventorySearch.toLowerCase());

      const isLow = item.currentStock <= item.minAlertThreshold;
      if (filterLowStockOnly) return matchesSearch && isLow;
      return matchesSearch;
    });
  }, [store.ingredients, inventorySearch, filterLowStockOnly]);

  const lowStockCount = useMemo(() => {
    return Object.values(store.ingredients).filter((i) => i.currentStock <= i.minAlertThreshold).length;
  }, [store.ingredients]);

  // Filtered Customers by Region & Query
  const filteredCustomers = useMemo(() => {
    return store.customers.filter((c) => {
      const matchRegion = selectedRegionFilter === 'ALL' || c.region === selectedRegionFilter;
      const q = customerSearch.toLowerCase().trim();
      const matchQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.region.toLowerCase().includes(q);
      return matchRegion && matchQuery;
    });
  }, [store.customers, selectedRegionFilter, customerSearch]);

  // Total Regional Receivables
  const totalReceivables = useMemo(() => {
    return filteredCustomers.reduce((acc, c) => acc + c.currentBalance, 0);
  }, [filteredCustomers]);

  // Handlers
  const handleReplenishStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replenishItem) return;
    const amount = parseFloat(replenishAmount);
    if (!amount || amount <= 0) return;

    posStore.addStock(replenishItem.id, amount);
    setReplenishItem(null);
    setReplenishAmount('');
  };

  const handleExecuteSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementCustomer) return;
    const amount = parseFloat(settlementAmount);
    if (!amount || amount <= 0) return;

    posStore.recordCustomerLedgerEntry({
      customerId: settlementCustomer.id,
      type: 'PAYMENT_RECEIVED',
      amount,
      region: settlementCustomer.region,
      notes: settlementNotes || 'سداد دفعة نقدية لحساب الآجل',
    });

    setSettlementCustomer(null);
    setSettlementAmount('');
    setSettlementNotes('سداد دفعة نقدية');
  };

  const handleCloseShiftZReport = (e: React.FormEvent) => {
    e.preventDefault();
    const actual = parseFloat(actualCashInput) || 0;
    posStore.closeShift(actual);
    setIsZReportOpen(false);
    setActualCashInput('');
  };

  const handleOpenNewShift = () => {
    posStore.openShift(newShiftCashierName, newShiftStartingCash);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 p-2 sm:p-3 rounded-2xl">
        <div className="flex items-center gap-2 p-1 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSection('FINANCIAL')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSection === 'FINANCIAL'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>التقارير المالية والورديات (X/Z)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('INVENTORY')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSection === 'INVENTORY'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>مخزون الوصفات (BOM Recipe Inventory)</span>
            {lowStockCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                {lowStockCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('DEBT_CUSTOMERS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSection === 'DEBT_CUSTOMERS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>العملاء والذمم الإقليمية (آجل)</span>
          </button>
        </div>

        {/* Shift Badge Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <span className="text-slate-500">الوردية الحالية:</span>
          <span
            className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
              store.currentShift.status === 'OPEN'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
            }`}
          >
            {store.currentShift.status === 'OPEN' ? 'مفتوحة (نشطة)' : 'مغلقة'}
          </span>
          <span className="font-medium text-slate-700">({store.currentShift.cashierName})</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: FINANCIAL & SHIFT SUMMARY (X/Z REPORTS)                        */}
      {/* ========================================================================= */}
      {activeSection === 'FINANCIAL' && (
        <div className="space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* Total Sales */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
              <div className="text-xs text-slate-500 mb-1 flex items-center justify-between">
                <span>إجمالي مبيعات اليوم</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
                {kpis.grossSales.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-500">ر.س</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                عدد الطلبات: <span className="font-bold text-slate-700">{kpis.orderCount} طلب</span>
              </div>
            </div>

            {/* Average Prep Time */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
              <div className="text-xs text-slate-500 mb-1 flex items-center justify-between">
                <span>متوسط سرعة التحضير</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
                {formatSeconds(kpis.avgPrepSeconds)}
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                الهدف التشغيلي:{' '}
                <span className="text-emerald-400 font-bold">&lt; 03:00 دقيقة</span>
              </div>
            </div>

            {/* Expected Cash in Drawer */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
              <div className="text-xs text-slate-500 mb-1 flex items-center justify-between">
                <span>النقد المتوقع في الدرج</span>
                <Banknote className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                {kpis.expectedCashInDrawer.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-500">ر.س</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                الافتتاحية ({store.currentShift.startingCash.toFixed(2)}) + مبيعات الكاش
              </div>
            </div>

            {/* Average Order Value (AOV) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
              <div className="text-xs text-slate-500 mb-1 flex items-center justify-between">
                <span>متوسط قيمة السلة (AOV)</span>
                <BarChart3 className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-purple-400">
                {kpis.aov.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-500">ر.س</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-2">لكل سيارة / زائر</div>
            </div>
          </div>

          {/* Payment Channels Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>توزيع المبيعات حسب قناة التحصيل (Payment Method Breakdown)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Cash */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-amber-400" />
                    <span>نقد (كاش محصل)</span>
                  </span>
                  <span className="font-mono">
                    {kpis.grossSales > 0 ? ((kpis.cashSales / kpis.grossSales) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">
                  {kpis.cashSales.toFixed(2)} <span className="text-xs font-normal text-slate-500">ر.س</span>
                </div>
              </div>

              {/* Mada / Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <span>مدى / شبكة بطاقات</span>
                  </span>
                  <span className="font-mono">
                    {kpis.grossSales > 0 ? ((kpis.madaSales / kpis.grossSales) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">
                  {kpis.madaSales.toFixed(2)} <span className="text-xs font-normal text-slate-500">ر.س</span>
                </div>
              </div>

              {/* Customer Debt */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>ذمم عملاء (آجل مسجل)</span>
                  </span>
                  <span className="font-mono">
                    {kpis.grossSales > 0 ? ((kpis.debtSales / kpis.grossSales) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">
                  {kpis.debtSales.toFixed(2)} <span className="text-xs font-normal text-slate-500">ر.س</span>
                </div>
              </div>
            </div>
          </div>

          {/* Shift Actions: X-Report & Z-Report */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">إدارة الوردية والتقارير الرقابية (Shift Controls)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  معاينة تقرير منتصف الوردية (X-Report) أو إغلاق الصندوق مع مطابقة الفروقات (Z-Report)
                </p>
              </div>

              {store.currentShift.status === 'CLOSED' && (
                <button
                  type="button"
                  onClick={handleOpenNewShift}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Unlock className="w-4 h-4" />
                  <span>فتح وردية جديدة</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* X-Report Trigger */}
              <button
                type="button"
                onClick={() => setIsXReportOpen(true)}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-500/50 text-right transition-all flex items-start justify-between group"
              >
                <div>
                  <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>تقرير الوردية اللحظي (X-Report)</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    لقطة رقابية للحسابات دون إغلاق الصندوق أو تصفير العدادات
                  </p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-600 group-hover:text-amber-400 transition-colors" />
              </button>

              {/* Z-Report Trigger */}
              <button
                type="button"
                disabled={store.currentShift.status === 'CLOSED'}
                onClick={() => setIsZReportOpen(true)}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-rose-500/50 disabled:opacity-50 disabled:pointer-events-none text-right transition-all flex items-start justify-between group"
              >
                <div>
                  <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-rose-400" />
                    <span>إغلاق الوردية النهائي (Z-Report)</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    إدخال الجرد الفعلي للنقدية، حساب الفروقات المالية، وإقفال الوردية رسمياً
                  </p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-600 group-hover:text-rose-400 transition-colors" />
              </button>
            </div>

            {/* Last shift closure details if closed */}
            {store.currentShift.status === 'CLOSED' && store.currentShift.variance !== undefined && (
              <div
                className={`p-4 rounded-xl border ${
                  store.currentShift.variance === 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                } text-xs flex items-center justify-between`}
              >
                <div>
                  <span className="font-bold">تم إغلاق الوردية السابقة. </span>
                  النقد الفعلي: {store.currentShift.actualCash?.toFixed(2)} ر.س | المتوقع:{' '}
                  {store.currentShift.expectedCash.toFixed(2)} ر.س
                </div>
                <div className="font-mono font-bold">
                  الفارق (Variance): {store.currentShift.variance > 0 ? `+${store.currentShift.variance}` : store.currentShift.variance} ر.س
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: RECIPE-BASED INVENTORY (BOM)                                   */}
      {/* ========================================================================= */}
      {activeSection === 'INVENTORY' && (
        <div className="space-y-4">
          {/* Inventory Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200 p-3 sm:p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="relative min-w-[200px] sm:min-w-[260px]">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  placeholder="بحث في المواد الخام والمقادير..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-900 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  filterLowStockOnly
                    ? 'bg-rose-500 text-white border-rose-400'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>المواد المنخفضة فقط ({lowStockCount})</span>
              </button>
            </div>

            <div className="text-xs text-slate-500">
              إجمالي المواد المسجلة: <span className="font-bold text-slate-800">{Object.keys(store.ingredients).length} مادة</span>
            </div>
          </div>

          {/* Raw Ingredients Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {ingredientsList.map((item) => {
              const isLowStock = item.currentStock <= item.minAlertThreshold;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all relative overflow-hidden ${
                    isLowStock
                      ? 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-500/5'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{item.nameAr}</h4>
                      <p className="text-[11px] text-slate-500">{item.nameEn} • SKU: {item.sku}</p>
                    </div>

                    {isLowStock ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        نقص مخزون!
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        متوفر
                      </span>
                    )}
                  </div>

                  {/* Stock Level Bar */}
                  <div className="my-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">المخزون الحالي:</span>
                      <span className="font-mono font-black text-base text-slate-900">
                        {item.currentStock.toLocaleString()}{' '}
                        <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                      </span>
                    </div>

                    {/* Visual meter */}
                    <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isLowStock ? 'bg-rose-500' : 'bg-amber-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(5, (item.currentStock / (item.minAlertThreshold * 3)) * 100)
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                      <span>حد التنبيه: {item.minAlertThreshold} {item.unit}</span>
                      <span>تكلفة الوحدة: {item.costPerUnit} ر.س</span>
                    </div>
                  </div>

                  {/* Quick Replenish Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setReplenishItem(item);
                      setReplenishAmount('1000');
                    }}
                    className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-amber-400 border border-slate-200 hover:border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>توريد / زيادة رصيد المادة</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: CUSTOMER DEBT & REGIONAL RECEIVABLES                           */}
      {/* ========================================================================= */}
      {activeSection === 'DEBT_CUSTOMERS' && (
        <div className="space-y-4">
          {/* Header & Filter Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white border border-slate-200 p-3 sm:p-4 rounded-2xl">
            <div className="flex flex-wrap items-center gap-2">
              {/* Region Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-slate-500">تصفية بالحي:</span>
                <select
                  value={selectedRegionFilter}
                  onChange={(e) => setSelectedRegionFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">كافة الأحياء والمناطق</option>
                  {store.regions.map((reg) => (
                    <option key={reg.id} value={reg.nameAr}>
                      {reg.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Search */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="بحث باسم العميل أو الجوال..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Total Regional Debt Badge */}
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs">
                <span className="text-slate-500">إجمالي الذمم المستحقة: </span>
                <span className="font-mono font-black text-purple-400 text-sm">
                  {totalReceivables.toFixed(2)} ر.س
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-600/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة عميل آجل</span>
              </button>
            </div>
          </div>

          {/* Customers Table / Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredCustomers.map((customer) => {
              const availableCredit = customer.creditLimit - customer.currentBalance;
              const hasDebt = customer.currentBalance > 0;

              return (
                <div
                  key={customer.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{customer.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1 text-slate-500">
                          <MapPin className="w-3 h-3 text-amber-400" />
                          {customer.region}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Phone className="w-3 h-3" />
                          {customer.phone}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        hasDebt
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {hasDebt ? 'عليه ذمة مستحقة' : 'لا يوجد مديونية'}
                    </span>
                  </div>

                  {/* Financial Balance Meter */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-slate-500">الرصيد المستحق الحالي:</span>
                      <span className="font-mono font-black text-lg text-amber-400">
                        {customer.currentBalance.toFixed(2)}{' '}
                        <span className="text-xs font-normal text-slate-500">ر.س</span>
                      </span>
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-500 border-t border-slate-200 pt-1.5">
                      <span>الحد الائتماني: {customer.creditLimit} ر.س</span>
                      <span className="text-emerald-400">المتاح: {availableCredit.toFixed(2)} ر.س</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={customer.currentBalance <= 0}
                      onClick={() => {
                        setSettlementCustomer(customer);
                        setSettlementAmount(customer.currentBalance.toString());
                      }}
                      className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:pointer-events-none text-white text-xs font-bold transition-all shadow-md shadow-purple-600/10 flex items-center justify-center gap-1.5"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>تسجيل سداد دفعة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewLedgerCustomer(customer)}
                      className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium"
                      title="سجل العمليات السابقة"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}

      {/* MODAL: X-Report Viewer */}
      {isXReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-right">
            <button
              onClick={() => setIsXReportOpen(false)}
              className="absolute top-4 left-4 text-slate-500 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center border-b border-slate-200 pb-4 mb-4">
              <h3 className="text-base font-black text-amber-400">تقرير الوردية اللحظي (X-Report)</h3>
              <p className="text-xs text-slate-500 mt-1">
                الكاشير: {store.currentShift.cashierName} • {new Date().toLocaleTimeString('ar-SA')}
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-700">
                <span>الافتتاحية النقدية:</span>
                <span>{store.currentShift.startingCash.toFixed(2)} SAR</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>مبيعات النقد (كاش):</span>
                <span>+{kpis.cashSales.toFixed(2)} SAR</span>
              </div>
              <div className="flex justify-between text-blue-400">
                <span>مبيعات مدى / بطاقات:</span>
                <span>+{kpis.madaSales.toFixed(2)} SAR</span>
              </div>
              <div className="flex justify-between text-purple-400">
                <span>مبيعات الذمم (آجل):</span>
                <span>+{kpis.debtSales.toFixed(2)} SAR</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold pt-2 border-t border-slate-200 text-sm">
                <span>إجمالي المبيعات:</span>
                <span>{kpis.grossSales.toFixed(2)} SAR</span>
              </div>
              <div className="flex justify-between text-amber-400 font-bold pt-2 border-t border-slate-200 text-sm">
                <span>النقد المتوقع في الدرج:</span>
                <span>{kpis.expectedCashInDrawer.toFixed(2)} SAR</span>
              </div>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setIsXReportOpen(false)}
                className="w-full h-11 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-900 font-bold text-xs"
              >
                إغلاق التقرير
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Z-Report End-of-Shift Closure */}
      {isZReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-right">
            <button
              onClick={() => setIsZReportOpen(false)}
              className="absolute top-4 left-4 text-slate-500 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center border-b border-slate-200 pb-4 mb-4">
              <h3 className="text-base font-black text-rose-400 flex items-center justify-center gap-2">
                <Lock className="w-5 h-5" />
                <span>إغلاق الوردية النهائي (Z-Report Closure)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                قم بعد النقود الفعلية الموجودة في درج الكاشير لإقفال الصندوق
              </p>
            </div>

            <form onSubmit={handleCloseShiftZReport} className="space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>المبلغ النقدي المحسوب نظامياً:</span>
                  <span className="font-mono text-slate-800">{kpis.expectedCashInDrawer.toFixed(2)} ر.س</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  المبلغ النقدي الفعلي المجرود في الدرج (Actual Cash Count):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    value={actualCashInput}
                    onChange={(e) => setActualCashInput(e.target.value)}
                    placeholder={kpis.expectedCashInDrawer.toFixed(2)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xl font-black text-slate-900 focus:outline-none focus:border-rose-500"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">ر.س</span>
                </div>
              </div>

              {actualCashInput && (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    Math.abs(parseFloat(actualCashInput) - kpis.expectedCashInDrawer) < 0.01
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  الفارق المالي المحسوب (Variance):{' '}
                  <span className="font-bold font-mono">
                    {(parseFloat(actualCashInput) - kpis.expectedCashInDrawer).toFixed(2)} ر.س
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsZReportOpen(false)}
                  className="w-1/3 h-11 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  تراجع
                </button>
                <button
                  type="submit"
                  className="w-2/3 h-11 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/20"
                >
                  تأكيد إغلاق الوردية وطباعة Z-Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Replenish Stock */}
      {replenishItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative text-right">
            <button
              onClick={() => setReplenishItem(null)}
              className="absolute top-4 left-4 text-slate-500 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-amber-400 mb-1">
              توريد مخزون: {replenishItem.nameAr}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              المخزون الحالي: {replenishItem.currentStock} {replenishItem.unit}
            </p>

            <form onSubmit={handleReplenishStock} className="space-y-4">
              <div>
                <label className="text-xs text-slate-700 block mb-1">
                  الكمية المضافة ({replenishItem.unit}):
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={replenishAmount}
                  onChange={(e) => setReplenishAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-lg font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReplenishItem(null)}
                  className="w-1/3 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-2/3 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
                >
                  تأكيد الزيادة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Customer Debt Settlement Payment */}
      {settlementCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-right">
            <button
              onClick={() => setSettlementCustomer(null)}
              className="absolute top-4 left-4 text-slate-500 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-purple-400 mb-1">
              تسجيل سند قبض وسداد: {settlementCustomer.name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              الرصيد المستحق حالياً:{' '}
              <span className="text-amber-400 font-bold">{settlementCustomer.currentBalance} ر.س</span> • الحي:{' '}
              {settlementCustomer.region}
            </p>

            <form onSubmit={handleExecuteSettlement} className="space-y-4">
              <div>
                <label className="text-xs text-slate-700 block mb-1">مبلغ السداد المستلم (ر.س):</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-lg font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 block mb-1">ملاحظات أو رقم التحويل:</label>
                <input
                  type="text"
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettlementCustomer(null)}
                  className="w-1/3 h-11 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-2/3 h-11 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs shadow-lg shadow-purple-600/20"
                >
                  تسجيل السداد وخفض الذمة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Customer Ledger History */}
      {viewLedgerCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative text-right">
            <button
              onClick={() => setViewLedgerCustomer(null)}
              className="absolute top-4 left-4 text-slate-500 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-slate-900 mb-1">
              كشف حساب الذمم: {viewLedgerCustomer.name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              المنطقة: {viewLedgerCustomer.region} • الجوال: {viewLedgerCustomer.phone}
            </p>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {store.customerLedger
                .filter((entry) => entry.customerId === viewLedgerCustomer.id)
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-800">
                        {entry.type === 'SALE_CREDIT' ? 'فاتورة مبيعات آجل' : 'سند قبض وسداد'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(entry.date).toLocaleString('ar-SA')} • {entry.notes}
                      </div>
                    </div>
                    <div className="text-left font-mono">
                      <div
                        className={entry.type === 'SALE_CREDIT' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}
                      >
                        {entry.type === 'SALE_CREDIT' ? `+${entry.debit}` : `-${entry.credit}`} ر.س
                      </div>
                      <div className="text-[10px] text-slate-500">الرصيد: {entry.runningBalance} ر.س</div>
                    </div>
                  </div>
                ))}

              {store.customerLedger.filter((e) => e.customerId === viewLedgerCustomer.id).length === 0 && (
                <div className="text-center py-6 text-slate-500 text-xs">
                  لا توجد حركات سابقة مسجلة في كشف حساب هذا العميل
                </div>
              )}
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setViewLedgerCustomer(null)}
                className="w-full h-10 rounded-xl bg-slate-100 text-slate-800 font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Customer */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative text-right">
            <button
              onClick={() => setIsAddCustomerOpen(false)}
              className="absolute top-4 left-4 text-slate-500 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-purple-400 mb-3">
              إضافة عميل حساب آجل جديد
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-700 block mb-1">اسم العميل / المؤسسة:</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="مثال: تركي السبيعي"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 block mb-1">رقم الجوال:</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 block mb-1">الحي / المنطقة:</label>
                <select
                  value={newCustRegion}
                  onChange={(e) => setNewCustRegion(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                >
                  {store.regions.map((r) => (
                    <option key={r.id} value={r.nameAr}>
                      {r.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-700 block mb-1">الحد الائتماني (ر.س):</label>
                <input
                  type="number"
                  value={newCustLimit}
                  onChange={(e) => setNewCustLimit(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(false)}
                className="w-1/3 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={!newCustName.trim()}
                onClick={() => {
                  const newCust: Customer = {
                    id: `cust_${Date.now()}`,
                    name: newCustName.trim(),
                    phone: newCustPhone.trim() || '0500000000',
                    region: newCustRegion,
                    creditLimit: newCustLimit,
                    currentBalance: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  // We can update customers in store
                  store.customers.push(newCust);
                  setIsAddCustomerOpen(false);
                  setNewCustName('');
                  setNewCustPhone('');
                }}
                className="w-2/3 h-10 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-purple-600/20"
              >
                حفظ العميل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerStation;
