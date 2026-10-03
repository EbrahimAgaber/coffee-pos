import React, { useState, useMemo } from 'react';
import { usePosStore, posStore } from '../state/store';
import {
  MenuItem,
  OrderItem,
  TagType,
  OrderStatus,
  MenuCategory,
} from '../types';
import { ModifierModal } from '../components/ModifierModal';
import {
  Car,
  Bell,
  User,
  Coffee,
  Plus,
  Minus,
  Trash2,
  Send,
  CheckCircle2,
  Sparkles,
  Phone,
  Flame,
  Snowflake,
  ShoppingBag,
  ChevronUp,
  ChevronDown,
  Search,
  X,
} from 'lucide-react';

type CategoryFilter = 'ALL' | MenuCategory;

const CATEGORIES: { id: CategoryFilter; nameAr: string; nameEn: string }[] = [
  { id: 'ALL', nameAr: 'الكل', nameEn: 'All' },
  { id: 'HOT', nameAr: 'قهوة ساخنة', nameEn: 'Hot Coffee' },
  { id: 'COLD', nameAr: 'قهوة باردة', nameEn: 'Iced Coffee' },
  { id: 'DRIP', nameAr: 'مختصة وتقطير', nameEn: 'Pour-Over' },
  { id: 'TEA', nameAr: 'شاي ومنعشات', nameEn: 'Tea & Refreshers' },
  { id: 'PASTRY', nameAr: 'مخبوزات وحلا', nameEn: 'Pastries' },
];

const PRESET_PLATES = ['أ ب ج 1234', 'س ص ع 5678', 'د هـ و 9012', 'ح ط ي 3456'];
const PRESET_MODELS = ['كامري بيضاء', 'لاندكروزر أسود', 'سوناتا فضية', 'يارس بيضاء'];
const PRESET_BUZZERS = ['#10', '#11', '#12', '#14', '#15', '#20'];

export const DriveThruStation: React.FC = () => {
  const store = usePosStore();

  // Active Category Filter
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Search & Modals
  const [activeModalItem, setActiveModalItem] = useState<MenuItem | null>(null);

  // Cart State
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [isCartOpenMobile, setIsCartOpenMobile] = useState<boolean>(false);

  // Tagging State
  const [tagType, setTagType] = useState<TagType>('VEHICLE');
  const [plateInput, setPlateInput] = useState<string>('');
  const [vehicleModel, setVehicleModel] = useState<string>('');
  const [buzzerInput, setBuzzerInput] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // Submission Status Toast & Error
  const [submittedOrderNumber, setSubmittedOrderNumber] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filtered Menu Items with Fast Search
  const filteredMenu = useMemo(() => {
    let list = selectedCategory === 'ALL'
      ? store.menu
      : store.menu.filter((item) => item.category === selectedCategory);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (it) =>
          it.nameAr.toLowerCase().includes(q) ||
          it.nameEn.toLowerCase().includes(q) ||
          it.descriptionAr.toLowerCase().includes(q)
      );
    }
    return list;
  }, [store.menu, selectedCategory, searchQuery]);

  // Pricing calculations
  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((sum, it) => sum + it.totalPrice, 0);
  }, [cartItems]);

  const taxRate = store.storeSettings?.taxRate ?? 0.15;
  const cartTax = useMemo(() => cartSubtotal * taxRate, [cartSubtotal, taxRate]);
  const cartTotal = useMemo(() => cartSubtotal + cartTax, [cartSubtotal, cartTax]);

  // Quick 1-Tap Add Default Item (Medium, standard modifiers)
  const handleQuickAddDefault = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const existingIndex = cartItems.findIndex(
      (it) => it.menuItemId === item.id && it.size === 'M' && it.modifiers.length === 0
    );

    if (existingIndex !== -1) {
      const updated = [...cartItems];
      const existing = updated[existingIndex];
      const newQty = existing.quantity + 1;
      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        totalPrice: existing.unitPrice * newQty,
      };
      setCartItems(updated);
    } else {
      const newItem: OrderItem = {
        id: `oi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        menuItemId: item.id,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        unitPrice: item.basePrice,
        quantity: 1,
        size: 'M',
        modifiers: [],
        totalPrice: item.basePrice,
      };
      setCartItems((prev) => [...prev, newItem]);
    }
  };

  // Add customized item from ModifierModal
  const handleAddToCart = (orderItem: OrderItem) => {
    setCartItems((prev) => [...prev, orderItem]);
  };

  // Cart Item Modifications
  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((it) => {
          if (it.id === itemId) {
            const newQty = it.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...it,
              quantity: newQty,
              totalPrice: it.unitPrice * newQty,
            };
          }
          return it;
        })
        .filter(Boolean) as OrderItem[]
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  // Resolve Tag Value with Fallbacks
  const resolveTagValue = (): { type: TagType; value: string; model?: string } => {
    if (tagType === 'VEHICLE') {
      const val = plateInput.trim() || `Token #${store.lastOrderNumber + 1}`;
      return {
        type: 'VEHICLE',
        value: val,
        model: vehicleModel.trim() || undefined,
      };
    }
    if (tagType === 'BUZZER') {
      const val = buzzerInput.trim() || `Token #${store.lastOrderNumber + 1}`;
      return {
        type: 'BUZZER',
        value: val,
      };
    }
    const val = customerName.trim() || `Token #${store.lastOrderNumber + 1}`;
    return {
      type: 'CUSTOMER_NAME',
      value: val,
    };
  };

  // Send Order to Kitchen (NEW_ORDER)
  const handleSendToKitchen = async () => {
    if (cartItems.length === 0 || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const tagInfo = resolveTagValue();

      const created = await posStore.createOrder({
        stationId: 'DRIVE_THRU',
        attendantName: 'مباشر السيارات',
        tagType: tagInfo.type,
        tagValue: tagInfo.value,
        vehicleModel: tagInfo.model,
        customerName: customerName.trim() || undefined,
        notes: customerPhone.trim() ? `هاتف: ${customerPhone.trim()}` : undefined,
        items: cartItems,
        subtotal: cartSubtotal,
        tax: cartTax,
        total: cartTotal,
        paymentStatus: 'UNPAID',
        status: 'NEW_ORDER' as OrderStatus,
      });

      // Show success toast
      setSubmittedOrderNumber(created.formattedOrderNumber);
      setOrderError(null);
      setCartItems([]);
      setIsCartOpenMobile(false);

      // Auto-clear toast after 4s
      setTimeout(() => {
        setSubmittedOrderNumber(null);
      }, 4000);
    } catch (e) {
      console.error('[DriveThru] Failed to send order to kitchen:', e);
      setOrderError('حدث خطأ أثناء إرسال الطلب إلى المطبخ.');
      setTimeout(() => setOrderError(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0 w-full overflow-hidden">
      {/* LEFT / MAIN COLUMN: Menu & Categories (Scrollable) */}
      <div className="flex-1 flex flex-col min-w-0 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        {/* Category Pills & Fast Search */}
        <div className="p-2.5 sm:p-3 border-b border-slate-200 bg-white sticky top-0 z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none no-scrollbar flex-1">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                      : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <span>{cat.nameAr}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-52 shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث سريع..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-8 pl-7 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 font-sans"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Catalog Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredMenu.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400">
              <Coffee className="w-10 h-10 opacity-30 mb-2" />
              <p className="text-sm font-bold text-slate-600">لا توجد أصناف تطابق البحث</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSearchQuery('');
                }}
                className="mt-2 text-xs text-indigo-600 font-bold hover:underline"
              >
                عرض كافة الأصناف
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {filteredMenu.map((item) => {
                const isCold = item.category === 'COLD';
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveModalItem(item)}
                    className="group relative bg-white border border-slate-200 hover:border-indigo-500 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.99]"
                  >
                    {/* Top Bar: Icon & Price */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div
                          className={`p-1 rounded-md text-xs ${
                            isCold
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isCold ? <Snowflake className="w-3.5 h-3.5" /> : <Flame className="w-3.5 h-3.5" />}
                        </div>
                        <span className="font-mono font-black text-slate-900 text-sm">
                          {item.basePrice.toFixed(2)} <span className="text-[10px] font-sans font-normal text-slate-500">ر.س</span>
                        </span>
                      </div>

                      {/* Item Titles */}
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                        {item.nameAr}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono line-clamp-1">
                        {item.nameEn}
                      </p>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                      <span className="text-[10px] text-indigo-600 font-bold group-hover:underline">
                        تخصيص ⚙
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleQuickAddDefault(item, e)}
                        title="إضافة فورية بالافتراضي (1-Tap)"
                        className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs flex items-center gap-0.5 transition-all active:scale-95 border border-indigo-200"
                      >
                        <Plus className="w-3 h-3" />
                        <span>سريع</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Order Tagging & Cart Panel */}
      <div className="w-full lg:w-96 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs shrink-0 h-full min-h-0">
        {/* Panel Header */}
        <div className="px-3.5 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-indigo-600" />
            <h2 className="font-black text-sm text-slate-900">سلة الطلب السريع</h2>
            <span className="text-xs px-2 py-0.2 rounded-full bg-indigo-50 text-indigo-700 font-mono font-black border border-indigo-100">
              {cartItems.reduce((acc, it) => acc + it.quantity, 0)}
            </span>
          </div>
          {cartItems.length > 0 && (
            <button
              onClick={handleClearCart}
              className="text-[11px] text-rose-500 hover:text-rose-700 flex items-center gap-1 transition-colors font-bold"
            >
              <Trash2 className="w-3 h-3" />
              <span>إفراغ</span>
            </button>
          )}
        </div>

        {/* Compact Speed Tagging Strip */}
        <div className="p-2.5 bg-slate-50 border-b border-slate-200 space-y-2 shrink-0">
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setTagType('VEHICLE')}
              className={`flex-1 py-1 px-2 rounded-md text-xs font-bold transition flex items-center justify-center gap-1 ${
                tagType === 'VEHICLE'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>سيارة</span>
            </button>
            <button
              type="button"
              onClick={() => setTagType('BUZZER')}
              className={`flex-1 py-1 px-2 rounded-md text-xs font-bold transition flex items-center justify-center gap-1 ${
                tagType === 'BUZZER'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>نداء</span>
            </button>
            <button
              type="button"
              onClick={() => setTagType('CUSTOMER_NAME')}
              className={`flex-1 py-1 px-2 rounded-md text-xs font-bold transition flex items-center justify-center gap-1 ${
                tagType === 'CUSTOMER_NAME'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>عميل</span>
            </button>
          </div>

          {tagType === 'VEHICLE' && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={plateInput}
                  onChange={(e) => setPlateInput(e.target.value)}
                  placeholder="اللوحة: أ ب ج 1234"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-center text-slate-900 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="الموديل: كامري..."
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Quick plate presets */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-[10px]">
                {PRESET_PLATES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPlateInput(preset)}
                    className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 font-mono border border-slate-200 shrink-0"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tagType === 'BUZZER' && (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={buzzerInput}
                onChange={(e) => setBuzzerInput(e.target.value)}
                placeholder="رقم التوكن..."
                className="w-28 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-indigo-700 text-center focus:outline-none focus:border-indigo-500"
              />
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {PRESET_BUZZERS.map((buzzer) => (
                  <button
                    key={buzzer}
                    type="button"
                    onClick={() => setBuzzerInput(buzzer)}
                    className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-xs font-mono font-bold text-slate-700 border border-slate-200"
                  >
                    {buzzer}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tagType === 'CUSTOMER_NAME' && (
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="اسم العميل (مثال: سلطان الخالدي)..."
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          )}

          {/* Quick Phone input */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="جوال لإيصال واتساب (اختياري: 050...)"
              className="w-full bg-transparent text-[11px] text-slate-700 placeholder:text-slate-400 focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Cart Item List (Flexible Scroll Area) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-8">
              <Coffee className="w-8 h-8 stroke-1 mb-2 opacity-30 text-indigo-400" />
              <p className="text-xs font-bold text-slate-600">السلة فارغة</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                اضغط على أي صنف لإضافته
              </p>
            </div>
          ) : (
            cartItems.map((it) => (
              <div
                key={it.id}
                className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-start justify-between gap-2 shadow-2xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-900">{it.nameAr}</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 font-mono font-bold">
                      {it.size}
                    </span>
                  </div>

                  {/* Modifiers string */}
                  {it.modifiers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {it.modifiers.map((m, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-1 py-0.2 rounded bg-white text-slate-600 border border-slate-200"
                        >
                          {m.nameAr}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Barista Notes */}
                  {it.specialInstructions && (
                    <p className="text-[10px] text-emerald-600 mt-0.5">
                      ملاحظة: {it.specialInstructions}
                    </p>
                  )}

                  <div className="text-xs font-mono font-black text-slate-900 mt-1">
                    {it.totalPrice.toFixed(2)} ر.س
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shrink-0 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleUpdateQuantity(it.id, -1)}
                    className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-slate-900 active:scale-90"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-4 text-center font-bold text-xs font-mono text-slate-900">
                    {it.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdateQuantity(it.id, 1)}
                    className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-slate-900 active:scale-90"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer: Order Summary & Send to Kitchen Button (Always Fully In View) */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/90 space-y-2 shrink-0">
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>المجموع قبل الضريبة</span>
              <span className="font-mono">{cartSubtotal.toFixed(2)} ر.س</span>
            </div>
            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>ضريبة القيمة المضافة (15%)</span>
              <span className="font-mono">{cartTax.toFixed(2)} ر.س</span>
            </div>
            <div className="flex justify-between text-slate-900 font-black text-sm pt-1 border-t border-slate-200">
              <span>الإجمالي الكلي</span>
              <span className="font-mono text-indigo-700 font-black text-base">
                {cartTotal.toFixed(2)} ر.س
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSendToKitchen}
            disabled={cartItems.length === 0 || isSubmitting}
            className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-98 shadow-sm transition disabled:opacity-40 disabled:pointer-events-none"
          >
            <Send className="w-4 h-4" />
            <span>إرسال إلى المطبخ (Send to Kitchen)</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {submittedOrderNumber && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <div className="text-sm">
            <span className="font-bold">تم إرسال الطلب بنجاح إلى شاشة المطبخ!</span>
            <span className="font-mono font-bold mr-2 text-emerald-100">
              ({submittedOrderNumber})
            </span>
          </div>
        </div>
      )}

      {/* Error Notification Banner */}
      {orderError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom duration-300">
          <div className="text-sm font-bold">
            {orderError}
          </div>
        </div>
      )}

      {/* Beverage Customizer Modal */}
      <ModifierModal
        isOpen={Boolean(activeModalItem)}
        item={activeModalItem}
        onClose={() => setActiveModalItem(null)}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
};
