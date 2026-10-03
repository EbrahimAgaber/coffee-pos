import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MenuItem, OrderItem, ItemModifier, ItemSize } from '../types';
import {
  X,
  Plus,
  Minus,
  Check,
  Flame,
  Snowflake,
  Coffee,
  Milk,
  Candy,
  Sparkles,
  Zap,
} from 'lucide-react';

interface ModifierModalProps {
  isOpen: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onAddToCart: (orderItem: OrderItem) => void;
}

// 1. Milk Options
const MILK_OPTIONS = [
  { id: 'mod_whole_milk', nameAr: 'كامل الدسم', nameEn: 'Whole Milk', priceDelta: 0 },
  { id: 'mod_lowfat_milk', nameAr: 'قليل الدسم', nameEn: 'Low-Fat', priceDelta: 0 },
  { id: 'mod_oat_milk', nameAr: 'شوفان', nameEn: 'Oat Milk', priceDelta: 3 },
  { id: 'mod_almond_milk', nameAr: 'لوز', nameEn: 'Almond', priceDelta: 3 },
  { id: 'mod_coconut_milk', nameAr: 'جوز هند', nameEn: 'Coconut', priceDelta: 3 },
];

// Special Milk Options for Drip & Tea (Black by default)
const DRIP_MILK_OPTIONS = [
  { id: 'mod_no_milk', nameAr: 'بدون حليب (افتراضي)', nameEn: 'Black (No Milk)', priceDelta: 0 },
  { id: 'mod_whole_milk', nameAr: 'حليب كامل الدسم', nameEn: 'Whole Milk', priceDelta: 0 },
  { id: 'mod_oat_milk', nameAr: 'حليب شوفان', nameEn: 'Oat Milk', priceDelta: 3 },
  { id: 'mod_almond_milk', nameAr: 'حليب لوز', nameEn: 'Almond Milk', priceDelta: 3 },
];

// 2. Sweetness Options
const SWEETNESS_OPTIONS = [
  { id: 'mod_sweet_0', nameAr: '0%', label: 'بدون سكر', priceDelta: 0 },
  { id: 'mod_sweet_25', nameAr: '25%', label: 'خفيف', priceDelta: 0 },
  { id: 'mod_sweet_50', nameAr: '50%', label: 'وسط', priceDelta: 0 },
  { id: 'mod_sweet_100', nameAr: '100%', label: 'عادي', priceDelta: 0 },
  { id: 'mod_sweet_150', nameAr: '150%', label: 'زيادة', priceDelta: 0 },
];

// 3. Hot Temperature Options
const HOT_TEMP_OPTIONS = [
  { id: 'mod_temp_hot', nameAr: 'ساخن (Hot)', icon: Flame },
  { id: 'mod_temp_extra_hot', nameAr: 'حار جداً (Extra)', icon: Flame },
  { id: 'mod_temp_warm', nameAr: 'دافئ (Warm)', icon: Coffee },
];

// 4. Cold / Ice Level Options
const COLD_ICE_OPTIONS = [
  { id: 'mod_temp_iced', nameAr: 'ثلج عادي', icon: Snowflake },
  { id: 'mod_temp_light_ice', nameAr: 'ثلج قليل', icon: Snowflake },
  { id: 'mod_temp_no_ice', nameAr: 'بدون ثلج', icon: X },
];

// 5. Espresso Shots
const SHOT_OPTIONS = [
  { id: 'mod_shot_single', nameAr: 'سنجل (1)', nameEn: 'Single', priceDelta: 0 },
  { id: 'mod_extra_shot', nameAr: 'دبل (+4)', nameEn: 'Double', priceDelta: 4 },
  { id: 'mod_shot_triple', nameAr: 'تريبل (+7)', nameEn: 'Triple', priceDelta: 7 },
  { id: 'mod_shot_decaf', nameAr: 'ديكاف (+2)', nameEn: 'Decaf', priceDelta: 2 },
];

// 6. Syrups
const SYRUP_OPTIONS = [
  { id: 'mod_syrup_none', nameAr: 'بدون', priceDelta: 0 },
  { id: 'mod_syrup_vanilla', nameAr: 'فانيلا (+3)', priceDelta: 3 },
  { id: 'mod_syrup_caramel', nameAr: 'كراميل (+3)', priceDelta: 3 },
  { id: 'mod_syrup_hazelnut', nameAr: 'بندق (+3)', priceDelta: 3 },
  { id: 'mod_syrup_pistachio', nameAr: 'بستاشيو (+5)', priceDelta: 5 },
  { id: 'mod_syrup_spanish', nameAr: 'سبانش (+4)', priceDelta: 4 },
  { id: 'mod_syrup_saffron', nameAr: 'زعفران (+5)', priceDelta: 5 },
];

// 7. Pastry Warming Options
const WARMING_OPTIONS = [
  { id: 'mod_warm_normal', nameAr: 'تسخين خفيف (Warm)' },
  { id: 'mod_warm_hot', nameAr: 'حار (Hot)' },
  { id: 'mod_warm_none', nameAr: 'بدون تسخين (Room Temp)' },
];

// 8. Quick Barista Notes
const QUICK_NOTES = ['على جنب', 'خفف الفوم', 'دبل كب', 'بدون كريمة', 'صب بطيء'];

export const ModifierModal: React.FC<ModifierModalProps> = ({
  isOpen,
  item,
  onClose,
  onAddToCart,
}) => {
  const isBeverage = item ? item.category !== 'PASTRY' : false;
  const isDrip = item?.category === 'DRIP';
  const isTea = item?.category === 'TEA';
  const isPastry = item?.category === 'PASTRY';
  const isColdDefault = item?.category === 'COLD';

  // State
  const [selectedSize, setSelectedSize] = useState<ItemSize>('M');
  const [selectedMilk, setSelectedMilk] = useState<string>('mod_whole_milk');
  const [selectedSweetness, setSelectedSweetness] = useState<string>('mod_sweet_100');
  const [selectedTemp, setSelectedTemp] = useState<string>('mod_temp_hot');
  const [selectedShot, setSelectedShot] = useState<string>('mod_shot_single');
  const [selectedSyrup, setSelectedSyrup] = useState<string>('mod_syrup_none');
  const [selectedWarming, setSelectedWarming] = useState<string>('mod_warm_normal');
  const [baristaNotes, setBaristaNotes] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

  // Initialize or reset based on category whenever item opens
  useEffect(() => {
    if (item) {
      setSelectedSize('M');
      // For Drip and Tea, default to black (no milk)
      setSelectedMilk(isDrip || isTea ? 'mod_no_milk' : 'mod_whole_milk');
      setSelectedSweetness(item.id.includes('spanish') ? 'mod_sweet_50' : 'mod_sweet_100');
      setSelectedTemp(isColdDefault ? 'mod_temp_iced' : 'mod_temp_hot');
      setSelectedShot('mod_shot_single');
      setSelectedSyrup('mod_syrup_none');
      setSelectedWarming('mod_warm_normal');
      setBaristaNotes('');
      setQuantity(1);
    }
  }, [item, isDrip, isTea, isColdDefault]);

  // Pricing calculations
  const sizePrice = item?.sizes ? item.sizes[selectedSize] ?? item.basePrice : item?.basePrice ?? 0;
  const sizeDelta = item ? sizePrice - item.basePrice : 0;

  const currentMilkList = isDrip || isTea ? DRIP_MILK_OPTIONS : MILK_OPTIONS;
  const milkObj = currentMilkList.find((m) => m.id === selectedMilk);
  const milkDelta = isBeverage && milkObj ? milkObj.priceDelta : 0;

  const shotObj = SHOT_OPTIONS.find((sh) => sh.id === selectedShot);
  const shotDelta = isBeverage && shotObj ? shotObj.priceDelta : 0;

  const syrupObj = SYRUP_OPTIONS.find((sy) => sy.id === selectedSyrup);
  const syrupDelta = isBeverage && syrupObj ? syrupObj.priceDelta : 0;

  const basePrice = item?.basePrice ?? 0;
  const unitPrice = isPastry ? basePrice : basePrice + sizeDelta + milkDelta + shotDelta + syrupDelta;
  const totalPrice = unitPrice * quantity;

  // Confirm and build final OrderItem
  const handleConfirm = useCallback(() => {
    if (!item) return;
    const modifiers: ItemModifier[] = [];

    if (isBeverage) {
      // Milk
      if (milkObj && milkObj.id !== 'mod_whole_milk' && milkObj.id !== 'mod_no_milk') {
        modifiers.push({
          id: milkObj.id,
          category: 'MILK',
          nameAr: milkObj.nameAr,
          nameEn: milkObj.nameEn,
          priceDelta: milkObj.priceDelta,
        });
      }

      // Sweetness
      const sweetObj = SWEETNESS_OPTIONS.find((s) => s.id === selectedSweetness);
      if (sweetObj && sweetObj.id !== 'mod_sweet_100') {
        modifiers.push({
          id: sweetObj.id,
          category: 'SWEETNESS',
          nameAr: `سكر ${sweetObj.nameAr}`,
          nameEn: `${sweetObj.nameAr} Sugar`,
          priceDelta: 0,
        });
      }

      // Temperature / Ice
      const tempOptions = isColdDefault ? COLD_ICE_OPTIONS : HOT_TEMP_OPTIONS;
      const tempObj = tempOptions.find((t) => t.id === selectedTemp);
      if (tempObj) {
        modifiers.push({
          id: tempObj.id,
          category: 'TEMPERATURE',
          nameAr: tempObj.nameAr,
          nameEn: tempObj.nameAr,
          priceDelta: 0,
        });
      }

      // Extra Shot
      if (shotObj && shotObj.id !== 'mod_shot_single') {
        modifiers.push({
          id: shotObj.id,
          category: 'EXTRA_SHOT',
          nameAr: shotObj.nameAr,
          nameEn: shotObj.nameEn,
          priceDelta: shotObj.priceDelta,
        });
      }

      // Syrup
      if (syrupObj && syrupObj.id !== 'mod_syrup_none') {
        modifiers.push({
          id: syrupObj.id,
          category: 'SYRUP',
          nameAr: syrupObj.nameAr,
          nameEn: syrupObj.id.replace('mod_syrup_', ''),
          priceDelta: syrupObj.priceDelta,
        });
      }
    } else if (isPastry) {
      const warmObj = WARMING_OPTIONS.find((w) => w.id === selectedWarming);
      if (warmObj) {
        modifiers.push({
          id: warmObj.id,
          category: 'TOPPING',
          nameAr: warmObj.nameAr,
          nameEn: warmObj.nameAr,
          priceDelta: 0,
        });
      }
    }

    const orderItem: OrderItem = {
      id: `oi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      menuItemId: item.id,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      unitPrice,
      quantity,
      size: selectedSize,
      modifiers,
      specialInstructions: baristaNotes.trim() || undefined,
      totalPrice,
    };

    onAddToCart(orderItem);
    onClose();
  }, [
    item,
    isBeverage,
    isPastry,
    isColdDefault,
    milkObj,
    selectedSweetness,
    selectedTemp,
    shotObj,
    syrupObj,
    selectedWarming,
    selectedSize,
    unitPrice,
    quantity,
    totalPrice,
    baristaNotes,
    onAddToCart,
    onClose,
  ]);

  // Quick 1-Tap Add with Standard Defaults
  const handleQuickAddDefault = useCallback(() => {
    if (!item) return;
    const defaultItem: OrderItem = {
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
    onAddToCart(defaultItem);
    onClose();
  }, [item, onAddToCart, onClose]);

  // Keyboard navigation for order takers (Enter to add, Esc to close, 1/2/3 for S/M/L)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing in text note input, don't hijack numeric keys
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !isInput) {
        e.preventDefault();
        handleConfirm();
      } else if (!isInput && !isPastry) {
        if (e.key === '1') {
          e.preventDefault();
          setSelectedSize('S');
        } else if (e.key === '2') {
          e.preventDefault();
          setSelectedSize('M');
        } else if (e.key === '3') {
          e.preventDefault();
          setSelectedSize('L');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleConfirm, isPastry]);

  const handleToggleNoteChip = (chip: string) => {
    if (baristaNotes.includes(chip)) {
      setBaristaNotes((prev) =>
        prev
          .replace(chip, '')
          .replace(/,\s*,/g, ',')
          .trim()
          .replace(/^,\s*|,\s*$/g, '')
      );
    } else {
      setBaristaNotes((prev) => (prev ? `${prev}، ${chip}` : chip));
    }
  };

  if (!isOpen || !item) return null;

  // Real-time crafted recipe summary string
  const summaryPills = [
    `الحجم: ${selectedSize === 'S' ? 'صغير' : selectedSize === 'M' ? 'وسط' : 'كبير'}`,
    isColdDefault ? 'مثلج' : 'ساخن',
    milkObj ? milkObj.nameAr : null,
    selectedSweetness !== 'mod_sweet_100' ? `سكر ${SWEETNESS_OPTIONS.find((s) => s.id === selectedSweetness)?.nameAr}` : null,
    shotObj && shotObj.id !== 'mod_shot_single' ? shotObj.nameAr : null,
    syrupObj && syrupObj.id !== 'mod_syrup_none' ? syrupObj.nameAr : null,
  ].filter(Boolean);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-2 sm:p-4 overflow-hidden"
      dir="rtl"
    >
      {/* Zero-Scroll Landscape Modal */}
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
        
        {/* COMPACT HEADER */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold">
              {isColdDefault ? <Snowflake className="w-5 h-5 text-sky-500" /> : <Coffee className="w-5 h-5 text-amber-600" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-base text-slate-900 leading-tight">{item.nameAr}</h2>
                <span className="text-xs text-slate-500 font-mono hidden sm:inline">[{item.nameEn}]</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600">
                <span>السعر الأساسي: <strong className="font-mono text-slate-900">{item.basePrice.toFixed(2)}</strong> ر.س</span>
                <span className="text-slate-300">·</span>
                <span className="text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-mono">
                  {summaryPills.join(' · ')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleQuickAddDefault}
              title="إضافة سريعة بالافتراضي مباشرة"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>إضافة بالافتراضي</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              title="إغلاق (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ZERO-SCROLL BODY: 2-COLUMN BALANCED GRID */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[calc(94vh-130px)] flex-1">
          {isPastry ? (
            /* SPECIAL BAKERY / FOOD VIEW */
            <div className="max-w-md mx-auto py-4 space-y-5 text-center">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">درجة التسخين والتقديم:</label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
                  {WARMING_OPTIONS.map((w) => {
                    const isSelected = selectedWarming === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setSelectedWarming(w.id)}
                        className={`py-2.5 px-2 rounded-lg text-xs font-bold transition ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {w.nameAr}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ملاحظات التحضير:</label>
                <input
                  type="text"
                  value={baristaNotes}
                  onChange={(e) => setBaristaNotes(e.target.value.slice(0, 100))}
                  placeholder="مثال: شوكة وسكين، تسخين خفيف سفري..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          ) : (
            /* BEVERAGE VIEW: 2 HIGH-EFFICIENCY COLUMNS */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              
              {/* === LEFT COLUMN: CORE CRAFT (Size, Temp/Ice, Sweetness) === */}
              <div className="space-y-3.5">
                
                {/* 1. SIZE SELECTOR (Segmented Row) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>الحجم (Size)</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">مفاتيح سريعة: [1] [2] [3]</span>
                  </div>

                  <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-xl gap-1 border border-slate-200">
                    {(['S', 'M', 'L'] as ItemSize[]).map((size, idx) => {
                      const sPrice = item.sizes ? item.sizes[size] ?? item.basePrice : item.basePrice;
                      const delta = sPrice - item.basePrice;
                      const isSelected = selectedSize === size;
                      const label = size === 'S' ? 'صغير (S)' : size === 'M' ? 'وسط (M)' : 'كبير (L)';
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className={`py-2 px-1 rounded-lg text-xs font-bold transition flex flex-col items-center justify-center ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-700 hover:bg-slate-200/70'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <span>{label}</span>
                            <span className="text-[10px] opacity-70 font-mono">[{idx + 1}]</span>
                          </div>
                          <span className={`text-[11px] font-mono mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                            {sPrice.toFixed(2)} ر.س
                            {delta > 0 && <span> (+{delta})</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. TEMPERATURE & ICE (Tailored to drink type) */}
                <div>
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                    {isColdDefault ? (
                      <Snowflake className="w-3.5 h-3.5 text-sky-500" />
                    ) : (
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span>{isColdDefault ? 'مستوى الثلج (Ice Level)' : 'درجة الحرارة (Temperature)'}</span>
                  </label>

                  <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-xl gap-1 border border-slate-200">
                    {(isColdDefault ? COLD_ICE_OPTIONS : HOT_TEMP_OPTIONS).map((t) => {
                      const isSelected = selectedTemp === t.id;
                      const IconComponent = t.icon;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTemp(t.id)}
                          className={`py-2 px-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-700 hover:bg-slate-200/70'
                          }`}
                        >
                          <IconComponent className="w-3.5 h-3.5 shrink-0" />
                          <span>{t.nameAr}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. SWEETNESS (Compact 5-Segment Strip) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Candy className="w-3.5 h-3.5 text-pink-500" />
                      <span>درجة الحلاوة والسكر (Sweetness)</span>
                    </label>
                    <span className="text-[10px] text-pink-600 font-bold font-mono">
                      {SWEETNESS_OPTIONS.find((s) => s.id === selectedSweetness)?.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 p-1 bg-slate-100 rounded-xl gap-1 border border-slate-200">
                    {SWEETNESS_OPTIONS.map((sweet) => {
                      const isSelected = selectedSweetness === sweet.id;
                      return (
                        <button
                          key={sweet.id}
                          type="button"
                          onClick={() => setSelectedSweetness(sweet.id)}
                          className={`py-1.5 px-0.5 rounded-lg text-center transition flex flex-col items-center justify-center ${
                            isSelected
                              ? 'bg-pink-600 text-white font-black shadow-sm'
                              : 'text-slate-700 hover:bg-slate-200/70'
                          }`}
                        >
                          <span className="text-xs font-mono font-bold">{sweet.nameAr}</span>
                          <span className={`text-[9px] ${isSelected ? 'text-pink-100' : 'text-slate-500'}`}>
                            {sweet.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. ESPRESSO SHOTS (Compact Segmented Strip) */}
                <div>
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                    <Coffee className="w-3.5 h-3.5 text-amber-700" />
                    <span>جرعات الإسبريسو (Espresso Shots)</span>
                  </label>

                  <div className="grid grid-cols-4 p-1 bg-slate-100 rounded-xl gap-1 border border-slate-200">
                    {SHOT_OPTIONS.map((shot) => {
                      const isSelected = selectedShot === shot.id;
                      return (
                        <button
                          key={shot.id}
                          type="button"
                          onClick={() => setSelectedShot(shot.id)}
                          className={`py-1.5 px-1 rounded-lg text-center transition flex flex-col items-center justify-center ${
                            isSelected
                              ? 'bg-amber-700 text-white font-bold shadow-sm'
                              : 'text-slate-700 hover:bg-slate-200/70'
                          }`}
                        >
                          <span className="text-xs font-medium">{shot.nameAr}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* === RIGHT COLUMN: MILK, SYRUPS & NOTES === */}
              <div className="space-y-3.5">
                
                {/* 5. MILK SELECTION (Intelligently Compact) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Milk className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isDrip || isTea ? 'إضافة الحليب (اختياري للمقطرة)' : 'نوع الحليب (Milk Type)'}</span>
                    </label>
                    {isDrip && (
                      <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        المقطرة سوداء بدون حليب افتراضياً
                      </span>
                    )}
                  </div>

                  <div className={`grid ${isDrip || isTea ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-5'} p-1 bg-slate-100 rounded-xl gap-1 border border-slate-200`}>
                    {currentMilkList.map((m) => {
                      const isSelected = selectedMilk === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedMilk(m.id)}
                          className={`py-2 px-1 rounded-lg text-center transition flex flex-col items-center justify-center ${
                            isSelected
                              ? 'bg-blue-600 text-white font-bold shadow-sm'
                              : 'text-slate-700 hover:bg-slate-200/70'
                          }`}
                        >
                          <span className="text-xs">{m.nameAr}</span>
                          {m.priceDelta > 0 && (
                            <span className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-blue-100' : 'text-blue-600 font-bold'}`}>
                              +{m.priceDelta} ر.س
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 6. SYRUPS & FLAVORS */}
                <div>
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <span>النكهات والإضافات (Syrups & Sauces)</span>
                  </label>

                  <div className="grid grid-cols-4 sm:grid-cols-7 p-1 bg-slate-100 rounded-xl gap-1 border border-slate-200 text-center">
                    {SYRUP_OPTIONS.map((syrup) => {
                      const isSelected = selectedSyrup === syrup.id;
                      return (
                        <button
                          key={syrup.id}
                          type="button"
                          onClick={() => setSelectedSyrup(syrup.id)}
                          className={`py-1.5 px-0.5 rounded-lg transition flex flex-col items-center justify-center ${
                            isSelected
                              ? 'bg-purple-600 text-white font-bold shadow-sm'
                              : 'text-slate-700 hover:bg-slate-200/70'
                          }`}
                        >
                          <span className="text-xs leading-tight">{syrup.nameAr}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 7. BARISTA NOTES & QUICK CHIPS */}
                <div>
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                    <span>ملاحظات البارستا والتجهيز (Special Instructions)</span>
                  </label>

                  {/* 1-Tap Quick Note Pills */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {QUICK_NOTES.map((chip) => {
                      const active = baristaNotes.includes(chip);
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => handleToggleNoteChip(chip)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                            active
                              ? 'bg-emerald-600 border-emerald-600 text-white font-bold shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    value={baristaNotes}
                    onChange={(e) => setBaristaNotes(e.target.value.slice(0, 100))}
                    placeholder="اكتب تعليمات خاصة (مثال: بدون فوم، حار جداً، في كوب العميل)..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PERSISTENT HIGH-SPEED BOTTOM ACTION BAR */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          
          {/* Stepper Quantity */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 active:scale-95 transition"
              title="تقليل الكمية"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-10 text-center font-black font-mono text-slate-900 text-base">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 active:scale-95 transition"
              title="زيادة الكمية"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Cancel button */}
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-11 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition active:scale-98"
          >
            إلغاء (Esc)
          </button>

          {/* Primary Add Button */}
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 h-11 sm:h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-98 shadow-md shadow-indigo-600/20 transition"
          >
            <Check className="w-5 h-5" />
            <span>إضافة للطلب</span>
            <span className="font-mono text-indigo-100 font-black text-base mr-1">
              {totalPrice.toFixed(2)} ر.س
            </span>
            <span className="text-[11px] bg-indigo-500/50 px-2 py-0.5 rounded font-mono hidden sm:inline">
              ↵ Enter
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModifierModal;
