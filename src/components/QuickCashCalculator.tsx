import React from 'react';
import { Banknote, Check, ArrowRight, Plus } from 'lucide-react';

export interface QuickCashCalculatorProps {
  total: number;
  tendered: number;
  onTenderedChange: (tendered: number) => void;
  onQuickCheckout?: () => void;
  className?: string;
}

export const SAUDI_DENOMINATIONS = [5, 10, 20, 50, 100, 200, 500];

export function calculateChangeDue(total: number, tendered: number): {
  changeDue: number;
  isValid: boolean;
  underpayment: number;
} {
  const roundedTotal = Math.round(total * 100) / 100;
  const roundedTendered = Math.round(tendered * 100) / 100;
  const diff = Math.round((roundedTendered - roundedTotal) * 100) / 100;

  if (diff >= 0) {
    return {
      changeDue: diff,
      isValid: true,
      underpayment: 0,
    };
  }

  return {
    changeDue: 0,
    isValid: false,
    underpayment: Math.abs(diff),
  };
}

export const QuickCashCalculator: React.FC<QuickCashCalculatorProps> = ({
  total,
  tendered,
  onTenderedChange,
  onQuickCheckout,
  className = '',
}) => {
  const { changeDue, isValid, underpayment } = calculateChangeDue(total, tendered);

  const handleDenominationClick = (amount: number) => {
    onTenderedChange(amount);
  };

  const handleIncrement = (increment: number) => {
    onTenderedChange(Math.round((tendered + increment) * 100) / 100);
  };

  const handleExactClick = () => {
    onTenderedChange(total);
  };

  return (
    <div className={`space-y-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 ${className}`}>
      {/* Header & Total Banner */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">حاسبة النقد السريع (Quick Cash)</h3>
            <p className="text-xs text-slate-500">حساب الفكة والمبالغ المستلمة في أقل من 3 نقرات</p>
          </div>
        </div>
        <div className="text-left">
          <div className="text-xs text-slate-500">إجمالي الفاتورة</div>
          <div className="text-lg font-black text-indigo-700 font-mono">
            {total.toFixed(2)} <span className="text-xs font-normal text-slate-500">ر.س</span>
          </div>
        </div>
      </div>

      {/* Prominent Live Change Due / Underpayment Display */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-xs text-slate-500 block mb-1">المبلغ المستلم (Tendered)</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="any"
              min="0"
              value={tendered > 0 ? tendered : ''}
              placeholder="0.00"
              onChange={(e) => onTenderedChange(parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent font-mono text-xl sm:text-2xl font-black text-slate-900 focus:outline-none placeholder:text-slate-400"
            />
            <span className="text-xs text-slate-500">ر.س</span>
          </div>
        </div>

        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isValid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span className="text-xs block mb-1 font-medium">
            {isValid ? 'الفكة للعميل (Change Due)' : 'المبلغ المتبقي للتحصيل'}
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono">
            {isValid ? (
              <span className="text-emerald-700">+{changeDue.toFixed(2)} <span className="text-xs font-normal">ر.س</span></span>
            ) : (
              <span className="text-rose-700">-{underpayment.toFixed(2)} <span className="text-xs font-normal">ر.س</span></span>
            )}
          </div>
        </div>
      </div>

      {/* Denominations Button Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
          <span>الفئات النقدية الشائعة (Saudi Riyal):</span>
          {/* Quick Increments */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">إضافة:</span>
            {[5, 10, 20].map((inc) => (
              <button
                key={inc}
                type="button"
                onClick={() => handleIncrement(inc)}
                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-mono font-bold text-slate-700 border border-slate-200 flex items-center"
              >
                <Plus className="w-2.5 h-2.5" />
                {inc}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {/* Exact Amount Button */}
          <button
            type="button"
            onClick={handleExactClick}
            className={`h-11 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 col-span-2 sm:col-span-1 ${
              Math.abs(tendered - total) < 0.01
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 active:scale-95'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>المبلغ بالضبط</span>
          </button>

          {/* SAR Denominations */}
          {SAUDI_DENOMINATIONS.map((denom) => {
            const isSelected = Math.abs(tendered - denom) < 0.01;
            const isInsufficient = denom < total;

            return (
              <button
                key={denom}
                type="button"
                onClick={() => handleDenominationClick(denom)}
                className={`h-11 rounded-xl font-mono text-sm font-black border transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                    : isInsufficient
                    ? 'bg-slate-50 hover:bg-slate-100 text-slate-400 border-slate-200'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-2xs'
                }`}
              >
                {denom} <span className="text-[10px] font-sans font-normal text-slate-500">ر.س</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Direct Quick Confirmation Action if provided */}
      {onQuickCheckout && (
        <button
          type="button"
          disabled={!isValid || tendered <= 0}
          onClick={onQuickCheckout}
          className="w-full h-12 mt-2 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none active:scale-98 shadow-md shadow-emerald-600/20"
        >
          <span>تأكيد استلام النقد وإتمام البيع</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default QuickCashCalculator;
