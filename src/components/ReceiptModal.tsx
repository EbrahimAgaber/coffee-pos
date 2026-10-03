import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Printer,
  Share2,
  Download,
  MessageSquare,
  Check,
  Smartphone,
  ExternalLink,
  Copy,
  Receipt,
  FileText,
} from 'lucide-react';
import { Order } from '../types';
import {
  PaperWidth,
  generateEscPosReceiptText,
  generateEscPosBytes,
  triggerWebPrint,
} from '../printing/escpos';
import {
  createZatcaDataFromOrder,
  generateZatcaQrDataUrl,
  StoreTaxProfile,
  DEFAULT_STORE_TAX_PROFILE,
} from '../printing/zatcaQr';
import {
  generateReceiptPdfBlob,
  shareReceiptPdf,
  buildWhatsAppReceiptUrl,
} from '../printing/pdfReceipt';
import { sanitizePhoneNumber } from '../utils/formatters';

export interface ReceiptModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  storeProfile?: StoreTaxProfile;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  order,
  onClose,
  storeProfile = DEFAULT_STORE_TAX_PROFILE,
}) => {
  const [paperWidth, setPaperWidth] = useState<PaperWidth>('80mm');
  const [zatcaQrUrl, setZatcaQrUrl] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [printSuccess, setPrintSuccess] = useState<boolean>(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Generate ZATCA QR code whenever order changes
  useEffect(() => {
    if (!order) return;

    // Reset feedback
    setPrintSuccess(false);
    setCopiedLink(false);

    const zatcaData = createZatcaDataFromOrder(order, storeProfile);
    generateZatcaQrDataUrl(zatcaData, 180)
      .then((url) => setZatcaQrUrl(url))
      .catch((e) => console.error('Failed generating QR Data URL:', e));

    // Guess phone number if attached
    if (order.notes && order.notes.match(/\d{9,}/)) {
      const matched = order.notes.match(/\d{9,}/);
      if (matched) setPhoneNumber(matched[0]);
    }
  }, [order, storeProfile]);

  if (!isOpen || !order) return null;

  const receiptText = generateEscPosReceiptText(order, paperWidth, storeProfile.name);

  const handleWebPrint = () => {
    setPrintSuccess(true);
    triggerWebPrint();
    setTimeout(() => setPrintSuccess(false), 3000);
  };

  const handleDownloadEscPos = async () => {
    try {
      const bytes = await generateEscPosBytes(order, {
        paperWidth,
        storeProfile,
        includeCut: true,
        embedZatcaQr: true,
      });

      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt_${order.formattedOrderNumber.replace('#', '')}_${paperWidth}.bin`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed generating ESC/POS file:', e);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const blob = await generateReceiptPdfBlob(order, {
        format: paperWidth,
        storeProfile,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt_${order.formattedOrderNumber.replace('#', '')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed downloading PDF receipt:', e);
    }
  };

  const handleNativeShare = async () => {
    setIsSharing(true);
    try {
      await shareReceiptPdf(order, {
        format: paperWidth,
        storeProfile,
      });
    } catch (e) {
      console.error('Web Share failed:', e);
    } finally {
      setIsSharing(false);
    }
  };

  const handleWhatsAppSend = () => {
    const cleanPhone = sanitizePhoneNumber(phoneNumber || '0500000000');
    const waUrl = buildWhatsAppReceiptUrl(cleanPhone, order, storeProfile.name);
    window.open(waUrl, '_blank');
  };

  const handleCopyWhatsAppLink = () => {
    const cleanPhone = sanitizePhoneNumber(phoneNumber || '0500000000');
    const waUrl = buildWhatsAppReceiptUrl(cleanPhone, order, storeProfile.name);
    navigator.clipboard.writeText(waUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>معاينة وطباعة الفاتورة</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                  {order.formattedOrderNumber}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                فواتير ZATCA الإلكترونية، الطباعة الحرارية والمشاركة الرقمية
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Width Selector & Action Bar */}
        <div className="px-5 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setPaperWidth('58mm')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                paperWidth === '58mm'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              58 ملم (32 عمود)
            </button>
            <button
              type="button"
              onClick={() => setPaperWidth('80mm')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                paperWidth === '80mm'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              80 ملم (48 عمود)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleWebPrint}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة فورية</span>
            </button>

            <button
              type="button"
              onClick={handleNativeShare}
              disabled={isSharing}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              <span>مشاركة PDF</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body: Thermal Preview Slip */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 flex flex-col items-center">
          <div
            ref={printAreaRef}
            className={`w-full bg-white text-slate-950 rounded-2xl shadow-xl p-5 sm:p-6 font-mono text-xs transition-all border border-slate-300 ${
              paperWidth === '58mm' ? 'max-w-[320px]' : 'max-w-[420px]'
            }`}
          >
            {/* Thermal Slip Header */}
            <div className="text-center pb-3 border-b border-dashed border-slate-300">
              <h3 className="text-base font-black text-slate-900">{storeProfile.name}</h3>
              {storeProfile.nameEn && (
                <div className="text-[10px] text-slate-500 font-sans">{storeProfile.nameEn}</div>
              )}
              <div className="text-[11px] text-slate-600 font-sans mt-0.5">
                فاتورة ضريبية مبسطة (Simplified Tax Invoice)
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                الرقم الضريبي: {storeProfile.vatNumber}
              </div>
              {storeProfile.crNumber && (
                <div className="text-[10px] text-slate-500 font-sans">
                  سجل تجاري: {storeProfile.crNumber}
                </div>
              )}
              {(storeProfile.address || storeProfile.phone) && (
                <div className="text-[10px] text-slate-500 font-sans">
                  {[storeProfile.address, storeProfile.phone ? `هاتف: ${storeProfile.phone}` : ''].filter(Boolean).join(' | ')}
                </div>
              )}
              <div className="text-[11px] font-bold text-slate-800 mt-1">
                رقم الطلب: {order.formattedOrderNumber}
              </div>
              <div className="text-[10px] text-slate-500">
                {new Date(order.createdAt).toLocaleString('ar-SA')}
              </div>
              {order.tagValue && (
                <div className="mt-1 inline-block px-2 py-0.5 bg-slate-100 rounded border border-slate-200 font-sans font-bold text-slate-800 text-[11px]">
                  {order.tagType === 'VEHICLE' ? 'مركبة' : 'نداء'}: {order.tagValue}
                  {order.vehicleModel ? ` (${order.vehicleModel})` : ''}
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="py-3 border-b border-dashed border-slate-300 space-y-2">
              <div className="flex justify-between font-bold text-slate-700 pb-1 border-b border-slate-200 text-[11px]">
                <span>الصنف / الكمية</span>
                <span>المجموع</span>
              </div>
              {order.items.map((item) => (
                <div key={item.id} className="space-y-0.5">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-900 font-sans">
                      {item.quantity}x {item.nameAr} ({item.size})
                    </span>
                    <span className="font-bold">{item.totalPrice.toFixed(2)} SAR</span>
                  </div>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="text-[10px] text-slate-600 font-sans pr-2">
                      └ {item.modifiers.map((m) => m.nameAr).join(' + ')}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Financial Totals */}
            <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الخاضع للضريبة:</span>
                <span>{order.subtotal.toFixed(2)} SAR</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>ضريبة القيمة المضافة (15%):</span>
                <span>{order.tax.toFixed(2)} SAR</span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-950 pt-1 border-t border-slate-200">
                <span>الإجمالي الكلي (TOTAL):</span>
                <span>{order.total.toFixed(2)} SAR</span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="py-2.5 border-b border-dashed border-slate-300 text-[10px] text-slate-700 space-y-0.5">
              <div className="flex justify-between font-sans">
                <span className="font-bold">طريقة الدفع:</span>
                <span>
                  {order.paymentMethod === 'CASH'
                    ? 'نقداً (Cash)'
                    : order.paymentMethod === 'MADA'
                    ? 'شبكة / مدى (Mada)'
                    : order.paymentMethod === 'CUSTOMER_CREDIT'
                    ? 'آجل (Credit)'
                    : 'دفع مجزأ (Split)'}
                </span>
              </div>
              {order.cashTendered && order.changeDue !== undefined && (
                <>
                  <div className="flex justify-between">
                    <span>المبلغ المستلم:</span>
                    <span>{order.cashTendered.toFixed(2)} SAR</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-800">
                    <span>المتبقي للعميل (Change):</span>
                    <span>{order.changeDue.toFixed(2)} SAR</span>
                  </div>
                </>
              )}
            </div>

            {/* ZATCA Phase 1 & 2 QR Code */}
            <div className="pt-4 pb-2 flex flex-col items-center justify-center text-center">
              {zatcaQrUrl ? (
                <img
                  src={zatcaQrUrl}
                  alt="ZATCA Tax QR Code"
                  className="w-32 h-32 border border-slate-200 p-1 rounded-lg bg-white"
                />
              ) : (
                <div className="w-32 h-32 bg-slate-100 flex items-center justify-center text-slate-500 text-[10px]">
                  جاري تشفير QR...
                </div>
              )}
              <span className="text-[9px] text-slate-500 mt-1 font-sans">
                رمز هيئة الزكاة والضريبة والجمارك (ZATCA Fatoora)
              </span>
              <span className="text-[10px] text-slate-600 font-sans mt-2">
                {storeProfile.footerAr || 'شكراً لزيارتكم! نتشرف بخدمتكم دائماً'}
              </span>
              {storeProfile.footerEn && (
                <span className="text-[9px] text-slate-400 font-sans">
                  {storeProfile.footerEn}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* WhatsApp Sharing Bar & Secondary Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <Smartphone className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                placeholder="رقم جوال العميل (مثال: 0501234567)"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleWhatsAppSend}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
              >
                <MessageSquare className="w-4 h-4" />
                <span>إرسال واتساب</span>
              </button>

              <button
                type="button"
                onClick={handleCopyWhatsAppLink}
                title="نسخ رابط الواتساب"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs transition-all active:scale-95"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                title="تحميل كملف PDF"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleDownloadEscPos}
                title="تحميل أوامر ESC/POS الثنائية للطابعة"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs transition-all active:scale-95"
              >
                <FileText className="w-4 h-4" />
              </button>
            </div>
          </div>

          {printSuccess && (
            <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-1 px-3 rounded-lg text-center font-medium">
              تم إرسال أمر الطباعة بنجاح إلى الطابعة الحرارية
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
