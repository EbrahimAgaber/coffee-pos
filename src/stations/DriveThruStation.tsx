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

  // Search & Modals
  const [activeModalItem, setActiveModalItem] = useState<MenuItem | null>(null);

  // Cart State
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [isCartOpenMobile, setIsCartOpenMobile] = useState<boolean>(false);

  // Tagging State
  const [tagType, setTagType] = useState<TagType>('VEHICLE');
  const [plateInput, setPlateInput] = useState<string>('أ ب ج 1234');
  const [vehicleModel, setVehicleModel] = useState<string>('كامري بيضاء');
  const [buzzerInput, setBuzzerInput] = useState<string>('#14');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // Submission Status Toast
  const [submittedOrderNumber, setSubmittedOrderNumber] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filtered Menu Items
  const filteredMenu = useMemo(() => {
    if (selectedCategory === 'ALL') return store.menu;
    return store.menu.filter((item) => item.category === selectedCategory);
  }, [store.menu, selectedCategory]);

  // Pricing calculations
  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((sum, it) => sum + it.totalPrice, 0);
  }, [cartItems]);

  const cartTax = useMemo(() => cartSubtotal * 0.15, [cartSubtotal]);
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
      setCartItems([]);
      setIsCartOpenMobile(false);

      // Auto-clear toast after 4s
      setTimeout(() => {
        setSubmittedOrderNumber(null);
      }, 4000);
    } catch (e) {
      console.error('[DriveThru] Failed to send order to kitchen:', e);
      alert('حدث خطأ أثناء إرسال الطلب إلى المطبخ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-5.5rem)] relative">
      {/* LEFT / MAIN COLUMN: Menu & Categories (Scrollable) */}
      <div className="flex-1 flex flex-col min-w-0 bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* Category Pills (Swipeable horizontally) */}
        <div className="p-3 border-b border-slate-200 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                      : 'bg-slate-100 border border-slate-200 text-slate-700 hover:text-white hover:bg-slate-100'
                  }`}
                >
                  <span>{cat.nameAr}</span>
                  <span className="text-[10px] opacity-70 hidden sm:inline">[{cat.nameEn}]</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Catalog Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredMenu.map((item) => {
              const isCold = item.category === 'COLD';
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveModalItem(item)}
                  className="group relative bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between hover:border-indigo-500/60 transition-all cursor-pointer shadow-sm hover:shadow-indigo-500/10 active:scale-98"
                >
                  {/* Top Bar: Icon & Price */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`p-1.5 rounded-lg text-xs ${
                          isCold
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}
                      >
                        {isCold ? <Snowflake className="w-3.5 h-3.5" /> : <Flame className="w-3.5 h-3.5" />}
                      </div>
                      <span className="font-mono font-bold text-sky-400 text-sm">
                        {item.basePrice.toFixed(2)} <span className="text-[10px] font-sans">ر.س</span>
                      </span>
                    </div>

                    {/* Item Titles */}
                    <h3 className="font-bold text-sm text-slate-900 line-clamp-1 group-hover:text-indigo-300 transition-colors">
                      {item.nameAr}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono line-clamp-1 mt-0.5">
                      {item.nameEn}
                    </p>
                    <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                      {item.descriptionAr}
                    </p>
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-200">
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      متوفر
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleQuickAddDefault(item, e)}
                      title="إضافة سريعة بالخيارات الافتراضية"
                      className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold active:scale-90 transition-all shadow-sm shadow-indigo-600/20"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Order Tagging & Cart Panel (Desktop sticky, Mobile drawer) */}
      <div className="w-full lg:w-96 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl shrink-0">
        {/* Panel Header */}
        <div className="p-3.5 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-sky-400" />
            <h2 className="font-bold text-sm text-slate-900">سلة الطلب السريع</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono font-bold">
              {cartItems.reduce((acc, it) => acc + it.quantity, 0)}
            </span>
          </div>
          {cartItems.length > 0 && (
            <button
              onClick={handleClearCart}
              className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>إفراغ</span>
            </button>
          )}
        </div>

        {/* Tagging Header: Plate / Buzzer / Name */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-3">
          {/* Tag Type Selector */}
          <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setTagType('VEHICLE')}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                tagType === 'VEHICLE'
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>سيارة</span>
            </button>
            <button
              type="button"
              onClick={() => setTagType('BUZZER')}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                tagType === 'BUZZER'
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>نداها</span>
            </button>
            <button
              type="button"
              onClick={() => setTagType('CUSTOMER_NAME')}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                tagType === 'CUSTOMER_NAME'
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>عميل</span>
            </button>
          </div>

          {/* Conditional Inputs */}
          {tagType === 'VEHICLE' && (
            <div className="space-y-2">
              {/* Saudi Plate Styled Input */}
              <div className="bg-white border-2 border-slate-200 rounded-xl p-2 flex items-center justify-between gap-2 shadow-inner">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-950/80 border border-emerald-500/40 rounded-lg text-emerald-400 text-xs font-bold font-mono">
                  <span>KSA</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <input
                  type="text"
                  value={plateInput}
                  onChange={(e) => setPlateInput(e.target.value)}
                  placeholder="أ ب ج 1234"
                  className="flex-1 bg-transparent text-center text-sm font-black tracking-widest text-slate-900 placeholder:text-slate-600 focus:outline-none"
                />
              </div>

              {/* Quick Plate Presets */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
                {PRESET_PLATES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPlateInput(preset)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-100 text-[10px] text-slate-700 font-mono whitespace-nowrap border border-slate-200"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Car Model & Color Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="نوع السيارة / اللون (مثال: كامري بيضاء)"
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Quick Model Chips */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
                {PRESET_MODELS.map((model) => (
                  <button
                    key={model}
                    type="button"
                    onClick={() => setVehicleModel(model)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-100 text-[10px] text-slate-500 whitespace-nowrap border border-slate-200"
                  >
                    {model}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tagType === 'BUZZER' && (
            <div className="space-y-2">
              <input
                type="text"
                value={buzzerInput}
                onChange={(e) => setBuzzerInput(e.target.value)}
                placeholder="رقم التوكن أو النداء (مثال: #14)"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-center text-sky-400 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
                {PRESET_BUZZERS.map((buzzer) => (
                  <button
                    key={buzzer}
                    type="button"
                    onClick={() => setBuzzerInput(buzzer)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-100 text-xs font-mono font-bold text-slate-700 border border-slate-200"
                  >
                    {buzzer}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tagType === 'CUSTOMER_NAME' && (
            <div className="space-y-2">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="اسم العميل (مثال: محمد بن سالم)"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* Customer Phone for WhatsApp Receipt */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-900">
            <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="جوال العميل لإيصال الواتساب (اختياري: 050...)"
              className="w-full bg-transparent text-xs text-slate-700 placeholder:text-slate-600 focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Cart Item List (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {cartItems.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center text-slate-500">
              <Coffee className="w-8 h-8 stroke-1 mb-2 opacity-40 text-indigo-400" />
              <p className="text-xs">السلة فارغة</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                اضغط على أي صنف من القائمة لإضافته مباشرة
              </p>
            </div>
          ) : (
            cartItems.map((it) => (
              <div
                key={it.id}
                className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-start justify-between gap-2 shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{it.nameAr}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-sky-400 font-mono font-bold">
                      {it.size}
                    </span>
                  </div>

                  {/* Modifiers string */}
                  {it.modifiers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {it.modifiers.map((m, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200"
                        >
                          {m.nameAr}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Barista Notes */}
                  {it.specialInstructions && (
                    <p className="text-[10px] text-emerald-400 mt-1 italic">
                      ملاحظة: {it.specialInstructions}
                    </p>
                  )}

                  {/* Price */}
                  <div className="text-xs font-mono font-bold text-sky-400 mt-1.5">
                    {it.totalPrice.toFixed(2)} ر.س
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleUpdateQuantity(it.id, -1)}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-900 active:scale-95"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-4 text-center font-bold text-xs font-mono text-slate-900">
                    {it.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdateQuantity(it.id, 1)}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-900 active:scale-95"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer: Order Summary & Send to Kitchen Button */}
        <div className="p-3.5 border-t border-slate-200 bg-white space-y-2.5">
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>المجموع قبل الضريبة</span>
              <span className="font-mono">{cartSubtotal.toFixed(2)} ر.س</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>ضريبة القيمة المضافة (15%)</span>
              <span className="font-mono">{cartTax.toFixed(2)} ر.س</span>
            </div>
            <div className="flex justify-between text-slate-900 font-bold text-sm pt-1 border-t border-slate-200">
              <span>الإجمالي الكلي</span>
              <span className="font-mono text-sky-400 font-black text-base">
                {cartTotal.toFixed(2)} ر.س
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSendToKitchen}
            disabled={cartItems.length === 0 || isSubmitting}
            className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-98 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-40 disabled:pointer-events-none"
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
