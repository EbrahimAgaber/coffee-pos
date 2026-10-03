import { Order } from '../types';

export function formatCurrency(
  amount: number,
  currency = 'SAR',
  lang: 'ar' | 'en' = 'ar'
): string {
  const formattedNum = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  const currencySymbols: Record<string, { ar: string; en: string }> = {
    SAR: { ar: 'ر.س', en: 'SAR' },
    USD: { ar: '$', en: 'USD' },
    EUR: { ar: '€', en: 'EUR' },
    AED: { ar: 'د.إ', en: 'AED' },
  };

  const symbol = currencySymbols[currency]
    ? currencySymbols[currency][lang]
    : currency;

  if (lang === 'ar') {
    return `${formattedNum} ${symbol}`;
  }
  return `${symbol} ${formattedNum}`;
}

export function formatDate(dateString: string, lang: 'ar' | 'en' = 'ar'): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatShortDate(dateString: string, lang: 'ar' | 'en' = 'ar'): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function sanitizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('05')) {
    // Saudi local format 05XXXXXXXX -> 9665XXXXXXXX
    cleaned = '966' + cleaned.substring(1);
  } else if (cleaned.startsWith('5') && cleaned.length === 9) {
    // Saudi format 5XXXXXXXX -> 9665XXXXXXXX
    cleaned = '966' + cleaned;
  } else if (cleaned.startsWith('01') && cleaned.length === 11) {
    // Egypt format 01XXXXXXXXX -> 201XXXXXXXXX
    cleaned = '20' + cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Builds formatted WhatsApp receipt URL for immediate customer sharing.
 */
export function buildWhatsAppReceiptUrl(
  phoneNumber: string,
  order: Order,
  storeName: string = 'كافيه الأفق'
): string {
  const cleanPhone = sanitizePhoneNumber(phoneNumber);
  const itemsSummary = order.items && order.items.length > 0
    ? '\nالأصناف:\n' + order.items.map((it) => `- ${it.quantity}x ${it.nameAr} (${it.totalPrice.toFixed(2)} ر.س)`).join('\n')
    : '';

  const message = `فاتورة ${storeName}\nرقم الطلب: ${order.formattedOrderNumber}${itemsSummary}\nالإجمالي: ${order.total.toFixed(2)} ر.س\nشكراً لزيارتكم!`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Builds comprehensive text message summary for WhatsApp sharing or printing.
 */
export function buildOrderSummaryText(order: Order, storeName: string = 'كافيه الأفق'): string {
  let summary = `*${storeName}*\n`;
  summary += `فاتورة ضريبية مبسطة\n`;
  summary += `رقم الطلب: ${order.formattedOrderNumber}\n`;
  summary += `التاريخ: ${formatDate(order.createdAt, 'ar')}\n`;
  if (order.tagValue) {
    summary += `المركبة/النداء: ${order.tagValue}\n`;
  }
  summary += `------------------------------\n`;
  for (const it of order.items) {
    summary += `${it.quantity}x ${it.nameAr} (${it.size}) - ${it.totalPrice.toFixed(2)} ر.س\n`;
    if (it.modifiers && it.modifiers.length > 0) {
      summary += `  └ ${it.modifiers.map((m) => m.nameAr).join(', ')}\n`;
    }
  }
  summary += `------------------------------\n`;
  summary += `المجموع الفرعي: ${order.subtotal.toFixed(2)} ر.س\n`;
  summary += `ضريبة القيمة المضافة (15%): ${order.tax.toFixed(2)} ر.س\n`;
  summary += `الإجمالي الكلي: ${order.total.toFixed(2)} ر.س\n`;
  summary += `طريقة الدفع: ${order.paymentMethod === 'CASH' ? 'نقداً' : order.paymentMethod === 'MADA' ? 'شبكة / مدى' : order.paymentMethod === 'CUSTOMER_CREDIT' ? 'آجل' : 'دفع مجزأ'}\n`;
  if (order.cashTendered && order.changeDue !== undefined) {
    summary += `المدفوع نقداً: ${order.cashTendered.toFixed(2)} ر.س\n`;
    summary += `المتبقي للعميل: ${order.changeDue.toFixed(2)} ر.س\n`;
  }
  summary += `شكراً لزيارتكم ونتطلع لخدمتكم دائماً!`;
  return summary;
}
