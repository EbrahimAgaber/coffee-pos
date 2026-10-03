import { jsPDF } from 'jspdf';
import { Order } from '../types';
import { registerArabicFont, FONT_NAME } from '../utils/arabicFont';
import { shapeBidi, shapeArabic } from '../utils/arabicShaper';
import {
  createZatcaDataFromOrder,
  generateZatcaQrDataUrl,
  StoreTaxProfile,
  DEFAULT_STORE_TAX_PROFILE,
} from './zatcaQr';
import { sanitizePhoneNumber, buildWhatsAppReceiptUrl } from '../utils/formatters';

export { buildWhatsAppReceiptUrl };

export interface PdfReceiptOptions {
  format?: '80mm' | '58mm' | 'a4';
  storeProfile?: StoreTaxProfile;
}

/**
 * Generates an authentic, high-quality vector PDF receipt with embedded Amiri Arabic font
 * and scannable Saudi ZATCA TLV QR code.
 */
export async function generateReceiptPdf(
  order: Order,
  options: PdfReceiptOptions = {}
): Promise<jsPDF> {
  const format = options.format || '80mm';
  const profile = options.storeProfile || DEFAULT_STORE_TAX_PROFILE;

  let doc: jsPDF;
  let pageWidth = 80;
  let margin = 5;

  if (format === '58mm') {
    pageWidth = 58;
    margin = 4;
    doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [58, 220],
    });
  } else if (format === 'a4') {
    pageWidth = 210;
    margin = 15;
    doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
  } else {
    // 80mm roll format (default)
    pageWidth = 80;
    margin = 6;
    doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 240],
    });
  }

  // 1. Register Arabic TrueType Font
  const fontLoaded = await registerArabicFont(doc);
  const activeFont = fontLoaded ? FONT_NAME : 'helvetica';
  doc.setFont(activeFont, 'normal');

  let y = margin + 4;
  const centerX = pageWidth / 2;
  const contentWidth = pageWidth - margin * 2;

  // 2. Header
  doc.setFontSize(14);
  doc.text(shapeBidi(profile.name), centerX, y, { align: 'center' });
  y += 6;

  doc.setFontSize(9);
  doc.text(shapeBidi('فاتورة ضريبية مبسطة (Simplified Tax Invoice)'), centerX, y, { align: 'center' });
  y += 5;

  doc.setFontSize(8);
  doc.text(`الرقم الضريبي: ${profile.vatNumber}`, centerX, y, { align: 'center' });
  y += 5;

  // Separator
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // Order Details
  doc.setFontSize(9);
  doc.text(`رقم الطلب: ${order.formattedOrderNumber}`, pageWidth - margin, y, { align: 'right' });
  y += 4.5;

  const dateStr = new Date(order.createdAt).toISOString().replace('T', ' ').substring(0, 16);
  doc.setFontSize(7.5);
  doc.text(`التاريخ: ${dateStr}`, pageWidth - margin, y, { align: 'right' });
  y += 4.5;

  if (order.tagValue) {
    const tagLabel = order.tagType === 'VEHICLE' ? 'المركبة' : 'النداء';
    const tagText = `${tagLabel}: ${order.tagValue}${order.vehicleModel ? ' (' + order.vehicleModel + ')' : ''}`;
    doc.text(shapeBidi(tagText), pageWidth - margin, y, { align: 'right' });
    y += 4.5;
  }

  // Separator
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // 3. Items Table Header
  doc.setFontSize(8);
  doc.text(shapeBidi('الصنف'), pageWidth - margin, y, { align: 'right' });
  doc.text(shapeBidi('السعر'), margin, y, { align: 'left' });
  y += 4;

  doc.line(margin, y, pageWidth - margin, y);
  y += 3.5;

  // Items
  for (const item of order.items) {
    doc.setFontSize(8);
    const itemTitle = `${item.quantity}x ${item.nameAr} (${item.size})`;
    const priceText = `${item.totalPrice.toFixed(2)} SAR`;

    doc.text(shapeBidi(itemTitle), pageWidth - margin, y, { align: 'right' });
    doc.text(priceText, margin, y, { align: 'left' });
    y += 3.5;

    // Modifiers / special instructions
    if (item.modifiers && item.modifiers.length > 0) {
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 90);
      const modText = item.modifiers.map((m) => m.nameAr).join(' + ');
      doc.text(shapeBidi(`- ${modText}`), pageWidth - margin - 2, y, { align: 'right' });
      y += 3;
      doc.setTextColor(0, 0, 0);
    }
  }

  // Separator
  y += 1;
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // 4. Financial Totals
  doc.setFontSize(8);
  doc.text(shapeBidi('المجموع الخاضع للضريبة:'), pageWidth - margin, y, { align: 'right' });
  doc.text(`${order.subtotal.toFixed(2)} SAR`, margin, y, { align: 'left' });
  y += 4;

  doc.text(shapeBidi('ضريبة القيمة المضافة (15%):'), pageWidth - margin, y, { align: 'right' });
  doc.text(`${order.tax.toFixed(2)} SAR`, margin, y, { align: 'left' });
  y += 4;

  doc.setFontSize(10);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4.5;

  doc.text(shapeBidi('الإجمالي الكلي (TOTAL):'), pageWidth - margin, y, { align: 'right' });
  doc.text(`${order.total.toFixed(2)} SAR`, margin, y, { align: 'left' });
  y += 5;

  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // Payment Breakdown
  doc.setFontSize(7.5);
  const payMethodAr = order.paymentMethod === 'CASH'
    ? 'نقداً (Cash)'
    : order.paymentMethod === 'MADA'
    ? 'شبكة / مدى (Mada)'
    : order.paymentMethod === 'CUSTOMER_CREDIT'
    ? 'آجل (Customer Credit)'
    : 'دفع مجزأ (Split)';

  doc.text(shapeBidi(`طريقة السداد: ${payMethodAr}`), pageWidth - margin, y, { align: 'right' });
  y += 3.5;

  if (order.cashTendered && order.changeDue !== undefined) {
    const cashDetail = `المدفوع: ${order.cashTendered.toFixed(2)} SAR | المتبقي: ${order.changeDue.toFixed(2)} SAR`;
    doc.text(shapeBidi(cashDetail), pageWidth - margin, y, { align: 'right' });
    y += 3.5;
  }

  // 5. Embedded ZATCA Phase 1 & 2 QR Code
  try {
    const zatcaData = createZatcaDataFromOrder(order, profile);
    const qrSize = format === '58mm' ? 32 : 38;
    const qrDataUrl = await generateZatcaQrDataUrl(zatcaData, 180);
    const qrX = (pageWidth - qrSize) / 2;

    y += 2;
    doc.addImage(qrDataUrl, 'PNG', qrX, y, qrSize, qrSize);
    y += qrSize + 3;
  } catch (err) {
    console.warn('Could not render ZATCA QR code into PDF:', err);
  }

  // Footer Note
  doc.setFontSize(7.5);
  doc.text(shapeBidi('شكراً لزيارتكم ونسعد بخدمتكم دائماً'), centerX, y, { align: 'center' });
  y += 3.5;
  doc.text('Thank you for your visit!', centerX, y, { align: 'center' });

  return doc;
}

/**
 * Returns the PDF receipt as a downloadable/shareable Blob.
 */
export async function generateReceiptPdfBlob(
  order: Order,
  options: PdfReceiptOptions = {}
): Promise<Blob> {
  const doc = await generateReceiptPdf(order, options);
  return doc.output('blob');
}

/**
 * Shares the generated PDF receipt using native mobile Web Share API (Android/iOS)
 * with automatic fallback to direct download.
 */
export async function shareReceiptPdf(
  order: Order,
  options: PdfReceiptOptions = {}
): Promise<{ shared: boolean; method: 'web-share' | 'download' }> {
  const blob = await generateReceiptPdfBlob(order, options);
  const fileName = `Receipt_${order.formattedOrderNumber.replace('#', '')}.pdf`;
  const file = new File([blob], fileName, { type: 'application/pdf' });

  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      const sharePromise = navigator.share({
        title: `فاتورة ${order.formattedOrderNumber}`,
        text: `فاتورة كافيه الأفق - طلب رقم ${order.formattedOrderNumber} بقيمة ${order.total.toFixed(2)} ر.س`,
        files: [file],
      }).catch((err) => {
        if ((err as Error)?.name !== 'AbortError') {
          console.warn('Native share dismissed or deferred error:', err);
        }
      });

      await Promise.race([
        sharePromise,
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
      return { shared: true, method: 'web-share' };
    } catch (e) {
      // User cancelled, dismissed, or resumed from external app - handled cleanly
      return { shared: (e as Error)?.name !== 'AbortError', method: 'web-share' };
    }
  }

  // Fallback: Browser direct file download ONLY if Web Share is not supported
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { shared: true, method: 'download' };
}
