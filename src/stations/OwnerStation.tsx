import React, { useState, useMemo, useEffect } from 'react';
import { usePosStore, posStore } from '../state/store';
import {
  Customer,
  RawIngredient,
  CashierShift,
  Order,
  MenuItem,
  MenuCategory,
  IngredientUnit,
  Region,
  StoreSettings,
} from '../types';
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
  Activity,
  KeyRound,
  ShieldCheck,
  Zap,
  Coffee,
  Settings,
  Edit2,
  Trash2,
  Save,
  Building,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { WorkMovementVisualizer } from '../components/WorkMovementVisualizer';
import { LicenseModal } from '../components/LicenseModal';

type OwnerSection =
  | 'WORK_MOVEMENT'
  | 'FINANCIAL'
  | 'MENU_MANAGEMENT'
  | 'INVENTORY'
  | 'DEBT_CUSTOMERS'
  | 'STORE_SETTINGS'
  | 'LICENSING';

export const OwnerStation: React.FC = () => {
  const store = usePosStore();

  // Active Navigation Section
  const [activeSection, setActiveSection] = useState<OwnerSection>('WORK_MOVEMENT');
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState<boolean>(false);

  // --- Financial & Shift State ---
  const [isXReportOpen, setIsXReportOpen] = useState<boolean>(false);
  const [isZReportOpen, setIsZReportOpen] = useState<boolean>(false);
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [newShiftCashierName, setNewShiftCashierName] = useState<string>(
    () => store.currentShift?.cashierName || 'كاشير الفرع الرئيسي'
  );
  const [newShiftStartingCash, setNewShiftStartingCash] = useState<number>(
    () => store.currentShift?.startingCash || 500
  );

  // --- Inventory State ---
  const [replenishItem, setReplenishItem] = useState<RawIngredient | null>(null);
  const [replenishAmount, setReplenishAmount] = useState<string>('');
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState<boolean>(false);
  const [isAddIngredientModalOpen, setIsAddIngredientModalOpen] = useState<boolean>(false);
  const [newIngNameAr, setNewIngNameAr] = useState<string>('');
  const [newIngNameEn, setNewIngNameEn] = useState<string>('');
  const [newIngSku, setNewIngSku] = useState<string>('');
  const [newIngUnit, setNewIngUnit] = useState<IngredientUnit>('g');
  const [newIngStock, setNewIngStock] = useState<number>(1000);
  const [newIngThreshold, setNewIngThreshold] = useState<number>(200);
  const [newIngCost, setNewIngCost] = useState<number>(0.1);

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
  const [newCustRegion, setNewCustRegion] = useState<string>(() => store.regions[0]?.nameAr || 'الفرع الرئيسي');
  const [newCustLimit, setNewCustLimit] = useState<number>(1000);

  // Add Region Modal
  const [isAddRegionOpen, setIsAddRegionOpen] = useState<boolean>(false);
  const [newRegionNameAr, setNewRegionNameAr] = useState<string>('');
  const [newRegionCity, setNewRegionCity] = useState<string>('الرياض');

  // --- Menu Management State ---
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<'ALL' | MenuCategory>('ALL');
  const [menuSearchQuery, setMenuSearchQuery] = useState<string>('');
  const [isAddMenuModalOpen, setIsAddMenuModalOpen] = useState<boolean>(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);

  const [menuFormNameAr, setMenuFormNameAr] = useState<string>('');
  const [menuFormNameEn, setMenuFormNameEn] = useState<string>('');
  const [menuFormCategory, setMenuFormCategory] = useState<MenuCategory>('HOT');
  const [menuFormBasePrice, setMenuFormBasePrice] = useState<number>(18);
  const [menuFormPriceS, setMenuFormPriceS] = useState<number>(16);
  const [menuFormPriceM, setMenuFormPriceM] = useState<number>(18);
  const [menuFormPriceL, setMenuFormPriceL] = useState<number>(20);
  const [menuFormDescAr, setMenuFormDescAr] = useState<string>('');
  const [menuFormDescEn, setMenuFormDescEn] = useState<string>('');

  // --- Store Settings State ---
  const [settingsStoreName, setSettingsStoreName] = useState<string>(store.storeSettings?.storeName || '');
  const [settingsStoreNameEn, setSettingsStoreNameEn] = useState<string>(store.storeSettings?.storeNameEn || '');
  const [settingsVatNumber, setSettingsVatNumber] = useState<string>(store.storeSettings?.vatNumber || '');
  const [settingsCrNumber, setSettingsCrNumber] = useState<string>(store.storeSettings?.commercialRegNumber || '');
  const [settingsPhone, setSettingsPhone] = useState<string>(store.storeSettings?.phone || '');
  const [settingsAddress, setSettingsAddress] = useState<string>(store.storeSettings?.address || '');
  const [settingsCurrency, setSettingsCurrency] = useState<string>(store.storeSettings?.currency || 'ر.س');
  const [settingsTaxRate, setSettingsTaxRate] = useState<number>(store.storeSettings?.taxRate ?? 0.15);
  const [settingsMasterPin, setSettingsMasterPin] = useState<string>(store.storeSettings?.masterPin || '1234');
  const [settingsFooterAr, setSettingsFooterAr] = useState<string>(
    store.storeSettings?.receiptFooterAr || 'شكراً لزيارتكم ونسعد بخدمتكم دائماً'
  );
  const [settingsFooterEn, setSettingsFooterEn] = useState<string>(
    store.storeSettings?.receiptFooterEn || 'Thank you for your visit!'
  );
  const [settingsSavedToast, setSettingsSavedToast] = useState<boolean>(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Sync settings inputs when store settings update
  useEffect(() => {
    if (store.storeSettings) {
      setSettingsStoreName(store.storeSettings.storeName);
      setSettingsStoreNameEn(store.storeSettings.storeNameEn);
      setSettingsVatNumber(store.storeSettings.vatNumber);
      setSettingsCrNumber(store.storeSettings.commercialRegNumber || '');
      setSettingsPhone(store.storeSettings.phone);
      setSettingsAddress(store.storeSettings.address);
      setSettingsCurrency(store.storeSettings.currency);
      setSettingsTaxRate(store.storeSettings.taxRate);
      setSettingsMasterPin(store.storeSettings.masterPin);
      if (store.storeSettings.receiptFooterAr) setSettingsFooterAr(store.storeSettings.receiptFooterAr);
      if (store.storeSettings.receiptFooterEn) setSettingsFooterEn(store.storeSettings.receiptFooterEn);
    }
  }, [store.storeSettings]);

  // --- Production Reset / Live Mode State ---
  const [isProductionModalOpen, setIsProductionModalOpen] = useState<boolean>(false);
  const [prodPinInput, setProdPinInput] = useState<string>('');
  const [prodStartOrderNum, setProdStartOrderNum] = useState<number>(1);
  const [prodCashierName, setProdCashierName] = useState<string>(
    () => store.currentShift?.cashierName || 'كاشير الفرع الرئيسي'
  );
  const [prodStartingCash, setProdStartingCash] = useState<number>(
    () => store.currentShift?.startingCash || 500
  );
  const [prodPinError, setProdPinError] = useState<string>('');
  const [prodSuccessToast, setProdSuccessToast] = useState<boolean>(false);

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

  // --- Filtered Menu Items ---
  const filteredMenuItems = useMemo(() => {
    return store.menu.filter((it) => {
      const matchCat = menuCategoryFilter === 'ALL' || it.category === menuCategoryFilter;
      const q = menuSearchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        it.nameAr.toLowerCase().includes(q) ||
        it.nameEn.toLowerCase().includes(q) ||
        it.descriptionAr?.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [store.menu, menuCategoryFilter, menuSearchQuery]);

  // --- Menu Handlers ---
  const handleOpenAddMenuItem = () => {
    setEditingMenuItem(null);
    setMenuFormNameAr('');
    setMenuFormNameEn('');
    setMenuFormCategory('HOT');
    setMenuFormBasePrice(18);
    setMenuFormPriceS(16);
    setMenuFormPriceM(18);
    setMenuFormPriceL(20);
    setMenuFormDescAr('');
    setMenuFormDescEn('');
    setIsAddMenuModalOpen(true);
  };

  const handleOpenEditMenuItem = (item: MenuItem) => {
    setEditingMenuItem(item);
    setMenuFormNameAr(item.nameAr);
    setMenuFormNameEn(item.nameEn);
    setMenuFormCategory(item.category);
    setMenuFormBasePrice(item.basePrice);
    setMenuFormPriceS(item.sizes?.S || item.basePrice);
    setMenuFormPriceM(item.sizes?.M || item.basePrice);
    setMenuFormPriceL(item.sizes?.L || item.basePrice);
    setMenuFormDescAr(item.descriptionAr || '');
    setMenuFormDescEn(item.descriptionEn || '');
    setIsAddMenuModalOpen(true);
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuFormNameAr.trim()) return;

    if (editingMenuItem) {
      await posStore.updateMenuItem({
        ...editingMenuItem,
        nameAr: menuFormNameAr.trim(),
        nameEn: menuFormNameEn.trim() || menuFormNameAr.trim(),
        category: menuFormCategory,
        basePrice: Number(menuFormBasePrice) || 0,
        sizes: {
          S: Number(menuFormPriceS) || Number(menuFormBasePrice),
          M: Number(menuFormPriceM) || Number(menuFormBasePrice),
          L: Number(menuFormPriceL) || Number(menuFormBasePrice),
        },
        descriptionAr: menuFormDescAr.trim(),
        descriptionEn: menuFormDescEn.trim(),
      });
    } else {
      await posStore.addMenuItem({
        nameAr: menuFormNameAr.trim(),
        nameEn: menuFormNameEn.trim() || menuFormNameAr.trim(),
        category: menuFormCategory,
        basePrice: Number(menuFormBasePrice) || 0,
        sizes: {
          S: Number(menuFormPriceS) || Number(menuFormBasePrice),
          M: Number(menuFormPriceM) || Number(menuFormBasePrice),
          L: Number(menuFormPriceL) || Number(menuFormBasePrice),
        },
        descriptionAr: menuFormDescAr.trim(),
        descriptionEn: menuFormDescEn.trim(),
        recipeId: 'rec_custom',
        isAvailable: true,
      });
    }
    setIsAddMenuModalOpen(false);
    setEditingMenuItem(null);
  };

  const handleDeleteMenuItem = (itemId: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'حذف صنف من القائمة',
      message: `هل أنت متأكد من حذف الصنف "${name}" من القائمة نهائياً؟`,
      onConfirm: async () => {
        await posStore.deleteMenuItem(itemId);
        setConfirmModal(null);
      },
    });
  };

  const handleToggleAvailability = async (itemId: string) => {
    await posStore.toggleMenuItemAvailability(itemId);
  };

  // --- Store Settings Handlers ---
  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsVatNumber.trim()) {
      setSettingsError('الرجاء إدخال الرقم الضريبي للتحقق من امتثال هيئة الزكاة والضريبة والجمارك ZATCA');
      setTimeout(() => setSettingsError(null), 5000);
      return;
    }
    setSettingsError(null);
    await posStore.updateStoreSettings({
      storeName: settingsStoreName.trim(),
      storeNameEn: settingsStoreNameEn.trim(),
      vatNumber: settingsVatNumber.trim(),
      commercialRegNumber: settingsCrNumber.trim(),
      phone: settingsPhone.trim(),
      address: settingsAddress.trim(),
      currency: settingsCurrency.trim() || 'ر.س',
      taxRate: Number(settingsTaxRate) || 0.15,
      masterPin: settingsMasterPin.trim() || '1234',
      receiptFooterAr: settingsFooterAr.trim(),
      receiptFooterEn: settingsFooterEn.trim(),
    });
    setSettingsSavedToast(true);
    setTimeout(() => setSettingsSavedToast(false), 3000);
  };

  // --- Production Mode Reset Handlers ---
  const handleConfirmProductionMode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prodPinInput.trim() !== (store.storeSettings?.masterPin || '1234')) {
      setProdPinError('رمز المشرف (PIN) غير صحيح');
      return;
    }
    await posStore.activateProductionCleanMode({
      startingOrderNumber: Number(prodStartOrderNum) || 1,
      cashierName: prodCashierName.trim() || 'كاشير الفرع الرئيسي',
      startingCash: Number(prodStartingCash) || 500,
    });
    setIsProductionModalOpen(false);
    setProdPinInput('');
    setProdPinError('');
    setProdSuccessToast(true);
    setTimeout(() => setProdSuccessToast(false), 4000);
  };

  // --- Inventory & Ingredients Handlers ---
  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngNameAr.trim()) return;
    await posStore.addRawIngredient({
      nameAr: newIngNameAr.trim(),
      nameEn: newIngNameEn.trim() || newIngNameAr.trim(),
      sku: newIngSku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      unit: newIngUnit,
      currentStock: Number(newIngStock) || 0,
      minAlertThreshold: Number(newIngThreshold) || 10,
      costPerUnit: Number(newIngCost) || 0,
    });
    setIsAddIngredientModalOpen(false);
    setNewIngNameAr('');
    setNewIngNameEn('');
    setNewIngSku('');
  };

  const handleDeleteIngredient = (ingId: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'حذف مادة خام من المستودع',
      message: `هل أنت متأكد من حذف المادة الخام "${name}" من المستودع؟`,
      onConfirm: async () => {
        await posStore.deleteRawIngredient(ingId);
        setConfirmModal(null);
      },
    });
  };

  // --- Region Handlers ---
  const handleSaveRegion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegionNameAr.trim()) return;
    posStore.addRegion({
      nameAr: newRegionNameAr.trim(),
      nameEn: newRegionNameAr.trim(),
      city: newRegionCity.trim() || 'الرياض',
    });
    setIsAddRegionOpen(false);
    setNewRegionNameAr('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 p-2 sm:p-3 rounded-2xl">
        <div className="flex items-center gap-2 p-1 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSection('WORK_MOVEMENT')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSection === 'WORK_MOVEMENT'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white'
            }`}
          >
            <Activity className="w-4 h-4 text-amber-400" />
            <span>حركة العمل المباشرة (Work Movement)</span>
          </button>

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
            <span>التقارير والورديات (X/Z)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('MENU_MANAGEMENT')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSection === 'MENU_MANAGEMENT'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white'
            }`}
          >
            <Coffee className="w-4 h-4" />
            <span>قائمة الأصناف والأسعار</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
              {store.menu.length}
            </span>
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
            <span>المستودع والمخزون</span>
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
            <span>العملاء والآجل</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('STORE_SETTINGS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSection === 'STORE_SETTINGS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>إعدادات المتجر وبيانات الفاتورة</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('LICENSING')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSection === 'LICENSING'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white'
            }`}
          >
            <KeyRound className="w-4 h-4 text-indigo-400" />
            <span>التراخيص والأجهزة</span>
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
                  posStore.addCustomer({
                    name: newCustName.trim(),
                    phone: newCustPhone.trim() || '0500000000',
                    region: newCustRegion,
                    creditLimit: newCustLimit,
                  });
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

      {/* ========================================================================= */}
      {/* SECTION: MENU & PRODUCT CATALOG MANAGEMENT                                */}
      {/* ========================================================================= */}
      {activeSection === 'MENU_MANAGEMENT' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200 p-3 sm:p-4 rounded-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] sm:min-w-[240px]">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                  placeholder="بحث في قائمة الأصناف..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
                {(
                  [
                    { id: 'ALL', label: 'الكل' },
                    { id: 'HOT', label: 'ساخن' },
                    { id: 'COLD', label: 'بارد' },
                    { id: 'DRIP', label: 'تقطير' },
                    { id: 'TEA', label: 'شاي' },
                    { id: 'PASTRY', label: 'حلا ومخبوزات' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setMenuCategoryFilter(cat.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                      menuCategoryFilter === cat.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenAddMenuItem}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة صنف جديد</span>
            </button>
          </div>

          {/* Menu Items Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredMenuItems.map((item) => {
              const categoryBadge =
                item.category === 'HOT'
                  ? { label: 'قهوة ساخنة 🔥', color: 'bg-amber-50 text-amber-700 border-amber-200' }
                  : item.category === 'COLD'
                  ? { label: 'قهوة باردة ❄️', color: 'bg-sky-50 text-sky-700 border-sky-200' }
                  : item.category === 'DRIP'
                  ? { label: 'مختصة وتقطير ☕', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
                  : item.category === 'TEA'
                  ? { label: 'شاي ومنعشات 🍃', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                  : { label: 'حلا ومخبوزات 🥐', color: 'bg-orange-50 text-orange-700 border-orange-200' };

              return (
                <div
                  key={item.id}
                  className={`bg-white border rounded-2xl p-4 transition-all relative flex flex-col justify-between ${
                    item.isAvailable ? 'border-slate-200 shadow-xs' : 'border-slate-200 bg-slate-50/70 opacity-70'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{item.nameAr}</h4>
                        <p className="text-[11px] text-slate-500 font-mono">{item.nameEn}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${categoryBadge.color}`}>
                        {categoryBadge.label}
                      </span>
                    </div>

                    {item.descriptionAr && (
                      <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                        {item.descriptionAr}
                      </p>
                    )}

                    {/* Pricing */}
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80 mb-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">السعر الأساسي:</span>
                        <span className="font-mono font-black text-slate-900">
                          {item.basePrice.toFixed(2)} ر.س
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 font-mono">
                        <span>صغير: {item.sizes?.S ?? item.basePrice} ر.س</span>
                        <span>وسط: {item.sizes?.M ?? item.basePrice} ر.س</span>
                        <span>كبير: {item.sizes?.L ?? item.basePrice} ر.س</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Availability Toggle */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleToggleAvailability(item.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        item.isAvailable
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${item.isAvailable ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span>{item.isAvailable ? 'متاح للطلب' : 'غير متوفر (نافذ)'}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditMenuItem(item)}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition"
                        title="تعديل الصنف والأسعار"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMenuItem(item.id, item.nameAr)}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="حذف الصنف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredMenuItems.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 space-y-3">
              <Coffee className="w-10 h-10 mx-auto text-slate-300" />
              <div className="text-sm font-bold text-slate-800">لا توجد أصناف مطابقة للبحث أو الفلتر</div>
              <button
                type="button"
                onClick={handleOpenAddMenuItem}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة صنف جديد</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION: STORE SETTINGS & TAX & PRODUCTION MODE                           */}
      {/* ========================================================================= */}
      {activeSection === 'STORE_SETTINGS' && (
        <div className="space-y-6">
          {settingsSavedToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>تم حفظ وتحديث إعدادات المتجر وبيانات الفاتورة بنجاح ومزامنتها لحظياً مع جميع الأجهزة.</span>
            </div>
          )}

          {settingsError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{settingsError}</span>
            </div>
          )}

          {prodSuccessToast && (
            <div className="p-4 bg-emerald-600 text-white rounded-2xl text-sm font-bold flex items-center gap-3 shadow-lg shadow-emerald-600/20">
              <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
              <span>تم تفعيل وضع الإنتاج بنجاح! تم تصفير بيانات التجربة، والنظام جاهز الآن لاستقبال زبائنك الحقيقيين.</span>
            </div>
          )}

          {/* Production Mode Switcher Card */}
          <div
            className={`border rounded-2xl p-5 sm:p-6 transition relative overflow-hidden ${
              store.storeSettings?.isProductionMode
                ? 'bg-gradient-to-br from-emerald-500/10 via-white to-white border-emerald-300 shadow-sm'
                : 'bg-gradient-to-br from-amber-500/10 via-white to-white border-amber-300 shadow-sm'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-xl ${
                      store.storeSettings?.isProductionMode
                        ? 'bg-emerald-500 text-white'
                        : 'bg-amber-500 text-white'
                    }`}
                  >
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      وضع التشغيل: {store.storeSettings?.isProductionMode ? 'وضع الإنتاج الفعلي (Live Production)' : 'وضع التجربة (Demo Mode)'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {store.storeSettings?.isProductionMode
                        ? 'النظام يعمل حالياً بكامل طاقته ومسجل للطلبات والمبيعات الحقيقية.'
                        : 'يحتوي النظام حالياً على طلبات وديون تجريبية لاختبار الكاشير وشاشة المطبخ والسيارات.'}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setProdPinInput('');
                  setProdPinError('');
                  setIsProductionModalOpen(true);
                }}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition active:scale-95 shadow-sm whitespace-nowrap ${
                  store.storeSettings?.isProductionMode
                    ? 'bg-slate-900 hover:bg-slate-800 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>{store.storeSettings?.isProductionMode ? 'إعادة تصفير العداد وبدء وردية جديدة' : 'تصفير بيانات التجربة والانتقال للإنتاج الفعلي'}</span>
              </button>
            </div>
          </div>

          {/* Store & Tax Identity Form */}
          <form onSubmit={handleSaveStoreSettings} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">هوية المتجر وبيانات الفاتورة الضريبية ZATCA</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  هذه البيانات تظهر في الفواتير المطبوعة والمشاريع الرقمية ورمز الاستجابة السريع QR
                </p>
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">اسم المقهى بالعربي:</label>
                <input
                  type="text"
                  required
                  value={settingsStoreName}
                  onChange={(e) => setSettingsStoreName(e.target.value)}
                  placeholder="مثال: مقهى رشفة البارستا المختصة"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">اسم المقهى بالإنجليزي:</label>
                <input
                  type="text"
                  value={settingsStoreNameEn}
                  onChange={(e) => setSettingsStoreNameEn(e.target.value)}
                  placeholder="e.g. Barista Sip Cafe"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  الرقم الضريبي ZATCA VAT (15 رقم):
                </label>
                <input
                  type="text"
                  required
                  maxLength={15}
                  value={settingsVatNumber}
                  onChange={(e) => setSettingsVatNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="3XXXXXXXXXXXXX3"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
                />
                <div className="text-[10px] mt-1">
                  {settingsVatNumber.length === 15 && settingsVatNumber.startsWith('3') && settingsVatNumber.endsWith('3') ? (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> مطابق لمعايير هيئة الزكاة والضريبة والجمارك (15 خانة)
                    </span>
                  ) : (
                    <span className="text-amber-600">
                      يجب أن يتكون من 15 رقماً ويبدأ بالرقم 3 وينتهي بالرقم 3
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">رقم السجل التجاري (CR No.):</label>
                <input
                  type="text"
                  value={settingsCrNumber}
                  onChange={(e) => setSettingsCrNumber(e.target.value)}
                  placeholder="مثال: 1010XXXXXX"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">رقم هاتف المتجر / خدمة العملاء:</label>
                <input
                  type="text"
                  value={settingsPhone}
                  onChange={(e) => setSettingsPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">عنوان الفرع / المدينة:</label>
                <input
                  type="text"
                  value={settingsAddress}
                  onChange={(e) => setSettingsAddress(e.target.value)}
                  placeholder="الرياض - طريق الملك فهد"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">الرمز السري الرئيسي للمشرف (Master PIN):</label>
                <input
                  type="password"
                  maxLength={6}
                  value={settingsMasterPin}
                  onChange={(e) => setSettingsMasterPin(e.target.value)}
                  placeholder="1234"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  يُستخدم للدخول إلى محطة الإدارة، إلغاء الطلبات، وإقفال الورديات
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">نسبة ضريبة القيمة المضافة:</label>
                <select
                  value={settingsTaxRate}
                  onChange={(e) => setSettingsTaxRate(parseFloat(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  <option value={0.15}>15% (المملكة العربية السعودية القياسية)</option>
                  <option value={0.05}>5%</option>
                  <option value={0}>0% (معفى من الضريبة)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">رسالة تذييل الفاتورة (بالعربي):</label>
                <input
                  type="text"
                  value={settingsFooterAr}
                  onChange={(e) => setSettingsFooterAr(e.target.value)}
                  placeholder="شكراً لزيارتكم ونسعد بخدمتكم دائماً"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">رسالة تذييل الفاتورة (بالإنجليزي):</label>
                <input
                  type="text"
                  value={settingsFooterEn}
                  onChange={(e) => setSettingsFooterEn(e.target.value)}
                  placeholder="Thank you for your visit!"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>حفظ كافة إعدادات المتجر</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT MENU ITEM                                               */}
      {/* ========================================================================= */}
      {isAddMenuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Coffee className="w-5 h-5 text-indigo-600" />
                <span>{editingMenuItem ? 'تعديل الصنف' : 'إضافة صنف جديد للقائمة'}</span>
              </h3>
              <button
                onClick={() => setIsAddMenuModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMenuItem} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">الاسم بالعربي:</label>
                  <input
                    type="text"
                    required
                    value={menuFormNameAr}
                    onChange={(e) => setMenuFormNameAr(e.target.value)}
                    placeholder="مثال: فلات وايت"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">الاسم بالإنجليزي:</label>
                  <input
                    type="text"
                    value={menuFormNameEn}
                    onChange={(e) => setMenuFormNameEn(e.target.value)}
                    placeholder="e.g. Flat White"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">التصنيف:</label>
                <select
                  value={menuFormCategory}
                  onChange={(e) => setMenuFormCategory(e.target.value as MenuCategory)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  <option value="HOT">قهوة ساخنة (HOT)</option>
                  <option value="COLD">قهوة باردة (COLD)</option>
                  <option value="DRIP">مختصة وتقطير (DRIP)</option>
                  <option value="TEA">شاي ومنعشات (TEA)</option>
                  <option value="PASTRY">حلا ومخبوزات (PASTRY)</option>
                </select>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">الأساسي:</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={menuFormBasePrice}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      setMenuFormBasePrice(v);
                      if (!editingMenuItem) {
                        setMenuFormPriceS(v);
                        setMenuFormPriceM(v);
                        setMenuFormPriceL(v + 2);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">صغير S:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={menuFormPriceS}
                    onChange={(e) => setMenuFormPriceS(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">وسط M:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={menuFormPriceM}
                    onChange={(e) => setMenuFormPriceM(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">كبير L:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={menuFormPriceL}
                    onChange={(e) => setMenuFormPriceL(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الوصف (اختياري):</label>
                <textarea
                  rows={2}
                  value={menuFormDescAr}
                  onChange={(e) => setMenuFormDescAr(e.target.value)}
                  placeholder="وصف مكونات المشروب أو الحلا..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMenuModalOpen(false)}
                  className="w-1/3 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-2/3 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20"
                >
                  {editingMenuItem ? 'حفظ التعديلات' : 'إضافة الصنف للمنيو'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD RAW INGREDIENT                                                 */}
      {/* ========================================================================= */}
      {isAddIngredientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                <span>إضافة مادة خام جديدة للمستودع</span>
              </h3>
              <button
                onClick={() => setIsAddIngredientModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIngredient} className="space-y-3.5 pt-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">اسم المادة بالعربي:</label>
                <input
                  type="text"
                  required
                  value={newIngNameAr}
                  onChange={(e) => setNewIngNameAr(e.target.value)}
                  placeholder="مثال: حبوب بن كولومبي مختص"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الاسم بالإنجليزي:</label>
                <input
                  type="text"
                  value={newIngNameEn}
                  onChange={(e) => setNewIngNameEn(e.target.value)}
                  placeholder="e.g. Colombian Beans"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">رمز المادة (SKU):</label>
                  <input
                    type="text"
                    value={newIngSku}
                    onChange={(e) => setNewIngSku(e.target.value)}
                    placeholder="SKU-BEAN-01"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">وحدة القياس:</label>
                  <select
                    value={newIngUnit}
                    onChange={(e) => setNewIngUnit(e.target.value as IngredientUnit)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-900"
                  >
                    <option value="g">جرام (g)</option>
                    <option value="ml">مليلتر (ml)</option>
                    <option value="piece">حبة / قطعة (piece)</option>
                    <option value="shot">جرعة / شوت (shot)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">الكمية البدائية:</label>
                  <input
                    type="number"
                    required
                    value={newIngStock}
                    onChange={(e) => setNewIngStock(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">حد التنبيه:</label>
                  <input
                    type="number"
                    value={newIngThreshold}
                    onChange={(e) => setNewIngThreshold(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">تكلفة الوحدة:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newIngCost}
                    onChange={(e) => setNewIngCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddIngredientModalOpen(false)}
                  className="w-1/3 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-2/3 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20"
                >
                  حفظ المادة الخام
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD REGION / DISTRICT                                              */}
      {/* ========================================================================= */}
      {isAddRegionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-600" />
                <span>إضافة حي أو منطقة تغطية</span>
              </h3>
              <button
                onClick={() => setIsAddRegionOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRegion} className="space-y-3.5 pt-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">اسم الحي / المنطقة:</label>
                <input
                  type="text"
                  required
                  value={newRegionNameAr}
                  onChange={(e) => setNewRegionNameAr(e.target.value)}
                  placeholder="مثال: حي الملقا"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">المدينة:</label>
                <input
                  type="text"
                  value={newRegionCity}
                  onChange={(e) => setNewRegionCity(e.target.value)}
                  placeholder="الرياض"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddRegionOpen(false)}
                  className="w-1/3 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-2/3 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                >
                  حفظ المنطقة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ACTIVATE PRODUCTION MODE & WIPE DEMO DATA                          */}
      {/* ========================================================================= */}
      {isProductionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">الانتقال للإنتاج الفعلي</h3>
                  <p className="text-xs text-slate-500">تصفير بيانات التجربة وبدء الوردية الحقيقية</p>
                </div>
              </div>
              <button
                onClick={() => setIsProductionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmProductionMode} className="space-y-4 pt-4">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1">
                <div className="font-bold">تنبيه هام للتشغيل:</div>
                <p>
                  سيتم مسح كافة الطلبات التجريبية وتصفير عداد حركة العمل، مع الإبقاء على قائمة الأصناف والمستودع والعملاء. سيبدأ النظام فوراً بتسجيل طلبات الزبائن الحقيقيين.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  الرمز السري الرئيسي للمشرف (PIN):
                </label>
                <input
                  type="password"
                  required
                  value={prodPinInput}
                  onChange={(e) => {
                    setProdPinInput(e.target.value);
                    setProdPinError('');
                  }}
                  placeholder="أدخل الرمز السري (الافتراضي 1234)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-900"
                />
                {prodPinError && <span className="text-xs text-rose-500 font-bold block mt-1">{prodPinError}</span>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">رقم أول طلب حقيقي:</label>
                  <input
                    type="number"
                    min={1}
                    value={prodStartOrderNum}
                    onChange={(e) => setProdStartOrderNum(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">عهدة بداية اليوم (ر.س):</label>
                  <input
                    type="number"
                    value={prodStartingCash}
                    onChange={(e) => setProdStartingCash(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">اسم كاشير الوردية الأولى:</label>
                <input
                  type="text"
                  value={prodCashierName}
                  onChange={(e) => setProdCashierName(e.target.value)}
                  placeholder="كاشير الفرع"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProductionModalOpen(false)}
                  className="w-1/3 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-2/3 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>تأكيد البدء الفعلي للإنتاج</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECTION: WORK MOVEMENT VISUALIZER */}
      {activeSection === 'WORK_MOVEMENT' && (
        <WorkMovementVisualizer />
      )}

      {/* SECTION: LICENSING & DEVICE QUOTAS */}
      {activeSection === 'LICENSING' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">نظام إدارة التراخيص وتنسيق الأجهزة المتصلة</h3>
              <p className="text-xs text-slate-500 mt-1">تحديد مدة الترخيص، إضافة أجهزة الكاشير والمطبخ والسيارات، وتوليد مفاتيح مشفرة</p>
            </div>
            <button
              onClick={() => setIsLicenseModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition active:scale-95"
            >
              <KeyRound className="w-4 h-4" />
              <span>إدارة وتوليد التراخيص</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 block">المقهى المرخص</span>
              <span className="text-base font-bold text-slate-900 mt-1 block">
                {store.licenseValidation.payload?.shopName || store.storeSettings?.storeName || 'البارستا الذكي'}
              </span>
              <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                Tenant: {store.licenseValidation.payload?.tenantId || store.deviceId}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 block">حصة الأجهزة المرخصة</span>
              <div className="text-base font-bold text-indigo-600 font-mono mt-1 flex items-center gap-2">
                <span>{Object.keys(store.connectedDevices).length} / {store.licenseValidation.payload?.maxDevices || 1} أجهزة</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 font-sans font-medium">
                  {Object.keys(store.connectedDevices).length <= (store.licenseValidation.payload?.maxDevices || 1) ? 'ضمن الحصة' : 'تجاوز الحصة'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                تشمل هواتف السيارات، لوحي المطبخ، وشاشة الكاشير
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 block">صلاحية الاشتراك</span>
              <span className="text-base font-bold text-emerald-600 font-mono mt-1 block">
                {store.licenseValidation.daysRemaining} يوم متبقي
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                ينتهي في: {store.licenseValidation.payload?.expiresAt ? new Date(store.licenseValidation.payload.expiresAt).toLocaleDateString('ar-SA') : 'نشط'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* License Modal */}
      <LicenseModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
      />

      {/* Confirmation Modal (Replaces window.confirm) */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">{confirmModal.title}</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-sm"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerStation;
