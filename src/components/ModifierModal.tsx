import React, { useState, useEffect } from 'react';
import { MenuItem, OrderItem, ItemModifier, ItemSize, ModifierCategory } from '../types';
import {
  X,
  Plus,
  Minus,
  Check,
  Sparkles,
  Flame,
  Snowflake,
  Coffee,
  Milk,
  Candy,
  FileText,
} from 'lucide-react';

interface ModifierModalProps {
  isOpen: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onAddToCart: (orderItem: OrderItem) => void;
}

// 1. Milk Options
const MILK_OPTIONS: { id: string; nameAr: string; nameEn: string; priceDelta: number }[] = [
  { id: 'mod_whole_milk', nameAr: 'حليب كامل الدسم', nameEn: 'Whole Milk', priceDelta: 0 },
  { id: 'mod_lowfat_milk', nameAr: 'قليل الدسم', nameEn: 'Low-Fat Milk', priceDelta: 0 },
  { id: 'mod_oat_milk', nameAr: 'حليب شوفان', nameEn: 'Oat Milk', priceDelta: 3 },
  { id: 'mod_almond_milk', nameAr: 'حليب لوز', nameEn: 'Almond Milk', priceDelta: 3 },
  { id: 'mod_coconut_milk', nameAr: 'حليب جوز هند', nameEn: 'Coconut Milk', priceDelta: 3 },
];

// 2. Sweetness Options
const SWEETNESS_OPTIONS: { id: string; nameAr: string; nameEn: string; priceDelta: number }[] = [
  { id: 'mod_sweet_0', nameAr: '0% (بدون سكر)', nameEn: '0% Sugar', priceDelta: 0 },
  { id: 'mod_sweet_25', nameAr: '25% (خفيف)', nameEn: '25% Light', priceDelta: 0 },
  { id: 'mod_sweet_50', nameAr: '50% (وسط)', nameEn: '50% Medium', priceDelta: 0 },
  { id: 'mod_sweet_100', nameAr: '100% (عادي)', nameEn: '100% Regular', priceDelta: 0 },
  { id: 'mod_sweet_150', nameAr: '150% (زيادة)', nameEn: '150% Extra', priceDelta: 0 },
];

// 3. Temperature / Ice Options
const TEMPERATURE_OPTIONS: { id: string; nameAr: string; nameEn: string; priceDelta: number }[] = [
  { id: 'mod_temp_hot', nameAr: 'ساخن (Hot)', nameEn: 'Hot', priceDelta: 0 },
  { id: 'mod_temp_extra_hot', nameAr: 'حار جداً (Extra Hot)', nameEn: 'Extra Hot', priceDelta: 0 },
  { id: 'mod_temp_iced', nameAr: 'مثلج (Iced)', nameEn: 'Iced', priceDelta: 0 },
  { id: 'mod_temp_light_ice', nameAr: 'ثلج قليل (Light Ice)', nameEn: 'Light Ice', priceDelta: 0 },
  { id: 'mod_temp_no_ice', nameAr: 'بدون ثلج (No Ice)', nameEn: 'No Ice', priceDelta: 0 },
];

// 4. Espresso Shots Options
const SHOT_OPTIONS: { id: string; nameAr: string; nameEn: string; priceDelta: number }[] = [
  { id: 'mod_shot_single', nameAr: 'شوت فردي (Single)', nameEn: 'Single Shot', priceDelta: 0 },
  { id: 'mod_extra_shot', nameAr: 'دبل شوت (+4 ر.س)', nameEn: 'Double Shot', priceDelta: 4 },
  { id: 'mod_shot_triple', nameAr: 'تريبل شوت (+7 ر.س)', nameEn: 'Triple Shot', priceDelta: 7 },
  { id: 'mod_shot_decaf', nameAr: 'منزوع الكافيين (+2 ر.س)', nameEn: 'Decaf', priceDelta: 2 },
];

// 5. Syrups Options
const SYRUP_OPTIONS: { id: string; nameAr: string; nameEn: string; priceDelta: number }[] = [
  { id: 'mod_syrup_none', nameAr: 'بدون نكهة', nameEn: 'None', priceDelta: 0 },
  { id: 'mod_syrup_vanilla', nameAr: 'فانيلا (+3 ر.س)', nameEn: 'Vanilla', priceDelta: 3 },
  { id: 'mod_syrup_caramel', nameAr: 'كراميل (+3 ر.س)', nameEn: 'Caramel', priceDelta: 3 },
  { id: 'mod_syrup_hazelnut', nameAr: 'بندق (+3 ر.س)', nameEn: 'Hazelnut', priceDelta: 3 },
  { id: 'mod_syrup_pistachio', nameAr: 'بستاشيو (+5 ر.س)', nameEn: 'Pistachio', priceDelta: 5 },
  { id: 'mod_syrup_saffron', nameAr: 'زعفران (+5 ر.س)', nameEn: 'Saffron', priceDelta: 5 },
  { id: 'mod_syrup_spanish', nameAr: 'صوص سبانش (+4 ر.س)', nameEn: 'Spanish Sauce', priceDelta: 4 },
];

// 6. Quick Barista Note Chips
const QUICK_NOTES = ['على جنب', 'خفف الفوم', 'حار جداً', 'بدون كريمة', 'دبل كب'];

export const ModifierModal: React.FC<ModifierModalProps> = ({
  isOpen,
  item,
  onClose,
  onAddToCart,
}) => {
  if (!isOpen || !item) return null;

  const isBeverage = item.category === 'HOT' || item.category === 'COLD' || item.category === 'DRIP' || item.category === 'TEA';

  // State
  const [selectedSize, setSelectedSize] = useState<ItemSize>('M');
  const [selectedMilk, setSelectedMilk] = useState<string>('mod_whole_milk');
  const [selectedSweetness, setSelectedSweetness] = useState<string>('mod_sweet_100');
  const [selectedTemp, setSelectedTemp] = useState<string>(
    item.category === 'COLD' ? 'mod_temp_iced' : 'mod_temp_hot'
  );
  const [selectedShot, setSelectedShot] = useState<string>('mod_shot_single');
  const [selectedSyrup, setSelectedSyrup] = useState<string>('mod_syrup_none');
  const [baristaNotes, setBaristaNotes] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

  // Reset or preset whenever item changes
  useEffect(() => {
    if (item) {
      setSelectedSize('M');
      setSelectedMilk('mod_whole_milk');
      setSelectedSweetness(item.id === 'item_spanish_latte' ? 'mod_sweet_50' : 'mod_sweet_100');
      setSelectedTemp(item.category === 'COLD' ? 'mod_temp_iced' : 'mod_temp_hot');
      setSelectedShot('mod_shot_single');
      setSelectedSyrup('mod_syrup_none');
      setBaristaNotes('');
      setQuantity(1);
    }
  }, [item]);

  // Pricing calculations
  const sizePrice = item.sizes ? item.sizes[selectedSize] ?? item.basePrice : item.basePrice;
  const sizeDelta = sizePrice - item.basePrice;

  // Selected Milk
  const milkObj = MILK_OPTIONS.find((m) => m.id === selectedMilk);
  const milkDelta = isBeverage && milkObj ? milkObj.priceDelta : 0;

  // Selected Sweetness
  const sweetObj = SWEETNESS_OPTIONS.find((s) => s.id === selectedSweetness);
  const sweetDelta = 0;

  // Selected Temp
  const tempObj = TEMPERATURE_OPTIONS.find((t) => t.id === selectedTemp);
  const tempDelta = 0;

  // Selected Shot
  const shotObj = SHOT_OPTIONS.find((sh) => sh.id === selectedShot);
  const shotDelta = isBeverage && shotObj ? shotObj.priceDelta : 0;

  // Selected Syrup
  const syrupObj = SYRUP_OPTIONS.find((sy) => sy.id === selectedSyrup);
  const syrupDelta = isBeverage && syrupObj ? syrupObj.priceDelta : 0;

  const unitPrice = item.basePrice + sizeDelta + milkDelta + sweetDelta + tempDelta + shotDelta + syrupDelta;
  const totalPrice = unitPrice * quantity;

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
      setBaristaNotes((prev) => (prev ? `${prev}, ${chip}` : chip));
    }
  };

  const handleConfirm = () => {
    const modifiers: ItemModifier[] = [];

    if (isBeverage) {
      // Milk
      if (milkObj && milkObj.id !== 'mod_whole_milk') {
        modifiers.push({
          id: milkObj.id,
          category: 'MILK',
          nameAr: milkObj.nameAr,
          nameEn: milkObj.nameEn,
          priceDelta: milkObj.priceDelta,
        });
      }

      // Sweetness
      if (sweetObj && sweetObj.id !== 'mod_sweet_100') {
        modifiers.push({
          id: sweetObj.id,
          category: 'SWEETNESS',
          nameAr: sweetObj.nameAr,
          nameEn: sweetObj.nameEn,
          priceDelta: sweetObj.priceDelta,
        });
      }

      // Temperature
      if (tempObj) {
        modifiers.push({
          id: tempObj.id,
          category: 'TEMPERATURE',
          nameAr: tempObj.nameAr,
          nameEn: tempObj.nameEn,
          priceDelta: tempObj.priceDelta,
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
          nameEn: syrupObj.nameEn,
          priceDelta: syrupObj.priceDelta,
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
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg text-slate-900">{item.nameAr}</h2>
              <span className="text-xs text-slate-500 font-mono">[{item.nameEn}]</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              السعر الأساسي: {item.basePrice.toFixed(2)} ر.س
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modifiers Body */}
        <div className="p-5 space-y-6 overflow-y-auto flex-1 overscroll-contain text-sm">
          {/* Size Selection */}
          <div>
            <label className="flex items-center gap-1.5 font-semibold text-slate-800 mb-2.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>الحجم (Size)</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(['S', 'M', 'L'] as ItemSize[]).map((size) => {
                const sPrice = item.sizes ? item.sizes[size] ?? item.basePrice : item.basePrice;
                const delta = sPrice - item.basePrice;
                const isSelected = selectedSize === size;
                const label = size === 'S' ? 'صغير (S)' : size === 'M' ? 'وسط (M)' : 'كبير (L)';
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/15 text-white font-bold shadow-sm shadow-indigo-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-200 hover:text-slate-800'
                    }`}
                  >
                    <span className="text-sm">{label}</span>
                    <span className="text-xs mt-1 font-mono">
                      {sPrice.toFixed(2)} ر.س
                      {delta > 0 && <span className="text-sky-400"> (+{delta})</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {isBeverage && (
            <>
              {/* Milk Alternatives */}
              <div>
                <label className="flex items-center gap-1.5 font-semibold text-slate-800 mb-2.5">
                  <Milk className="w-4 h-4 text-blue-400" />
                  <span>نوع الحليب (Milk)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MILK_OPTIONS.map((milk) => {
                    const isSelected = selectedMilk === milk.id;
                    return (
                      <button
                        key={milk.id}
                        type="button"
                        onClick={() => setSelectedMilk(milk.id)}
                        className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500/10 text-blue-300 font-medium'
                            : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-200'
                        }`}
                      >
                        <span className="text-xs">{milk.nameAr}</span>
                        {milk.priceDelta > 0 && (
                          <span className="text-[10px] text-amber-400 font-mono">
                            +{milk.priceDelta}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sweetness Control */}
              <div>
                <label className="flex items-center gap-1.5 font-semibold text-slate-800 mb-2.5">
                  <Candy className="w-4 h-4 text-pink-400" />
                  <span>درجة الحلاوة (Sweetness)</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {SWEETNESS_OPTIONS.map((sweet) => {
                    const isSelected = selectedSweetness === sweet.id;
                    return (
                      <button
                        key={sweet.id}
                        type="button"
                        onClick={() => setSelectedSweetness(sweet.id)}
                        className={`py-2 px-1 text-center rounded-xl border text-xs transition-all ${
                          isSelected
                            ? 'border-pink-500 bg-pink-500/10 text-pink-300 font-bold'
                            : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-200'
                        }`}
                      >
                        {sweet.nameAr}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Temperature Profile */}
              <div>
                <label className="flex items-center gap-1.5 font-semibold text-slate-800 mb-2.5">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span>درجة الحرارة والثلج (Temp & Ice)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TEMPERATURE_OPTIONS.map((temp) => {
                    const isSelected = selectedTemp === temp.id;
                    const isCold = temp.id.includes('iced') || temp.id.includes('ice');
                    return (
                      <button
                        key={temp.id}
                        type="button"
                        onClick={() => setSelectedTemp(temp.id)}
                        className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-orange-500 bg-orange-500/10 text-orange-300 font-medium'
                            : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-200'
                        }`}
                      >
                        <span className="text-xs">{temp.nameAr}</span>
                        {isCold ? (
                          <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                          <Flame className="w-3.5 h-3.5 text-orange-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Espresso Strength */}
              <div>
                <label className="flex items-center gap-1.5 font-semibold text-slate-800 mb-2.5">
                  <Coffee className="w-4 h-4 text-sky-400" />
                  <span>قوة الإسبريسو (Espresso Shots)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SHOT_OPTIONS.map((shot) => {
                    const isSelected = selectedShot === shot.id;
                    return (
                      <button
                        key={shot.id}
                        type="button"
                        onClick={() => setSelectedShot(shot.id)}
                        className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-sky-500 bg-sky-500/10 text-sky-300 font-medium'
                            : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-200'
                        }`}
                      >
                        <span className="text-xs">{shot.nameAr}</span>
                        {shot.priceDelta > 0 && (
                          <span className="text-[10px] text-sky-400 font-mono">
                            +{shot.priceDelta}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Syrups & Flavors */}
              <div>
                <label className="flex items-center gap-1.5 font-semibold text-slate-800 mb-2.5">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>النكهات والإضافات (Syrups)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SYRUP_OPTIONS.map((syrup) => {
                    const isSelected = selectedSyrup === syrup.id;
                    return (
                      <button
                        key={syrup.id}
                        type="button"
                        onClick={() => setSelectedSyrup(syrup.id)}
                        className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-purple-500 bg-purple-500/10 text-purple-300 font-medium'
                            : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-200'
                        }`}
                      >
                        <span className="text-xs">{syrup.nameAr}</span>
                        {syrup.priceDelta > 0 && (
                          <span className="text-[10px] text-purple-400 font-mono">
                            +{syrup.priceDelta}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Barista Notes */}
          <div>
            <label className="flex items-center gap-1.5 font-semibold text-slate-800 mb-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>ملاحظات البارستا (Barista Notes)</span>
            </label>
            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {QUICK_NOTES.map((chip) => {
                const active = baristaNotes.includes(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleToggleNoteChip(chip)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-medium'
                        : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
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
              onChange={(e) => setBaristaNotes(e.target.value.slice(0, 120))}
              placeholder="مثال: على جنب، حار جداً، بدون كريمة..."
              maxLength={120}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Footer Bar: Quantity & Add to Order Button */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3 sticky bottom-0 z-10">
          {/* Quantity selector */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 disabled:opacity-30 active:scale-95 transition-all"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-9 text-center font-bold font-mono text-slate-900 text-sm">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add to Order Button */}
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-98 shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Check className="w-5 h-5" />
            <span>إضافة للطلب</span>
            <span className="font-mono text-sky-200 font-black">
              ({totalPrice.toFixed(2)} ر.س)
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
