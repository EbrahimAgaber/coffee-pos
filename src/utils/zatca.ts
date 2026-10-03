/**
 * ZATCA (Saudi Arabia Zakat, Tax and Customs Authority / Fatoora)
 * Phase 1 & Phase 2 TLV (Tag-Length-Value) Base64 QR Code Generator.
 *
 * Tags:
 * 1: Seller's Name (اسم المورد)
 * 2: VAT Registration Number (الرقم الضريبي للمورد)
 * 3: Time Stamp (تاريخ ووقت الفاتورة ISO 8601)
 * 4: Invoice Total with VAT (إجمالي الفاتورة مع الضريبة)
 * 5: VAT Total (مبلغ ضريبة القيمة المضافة)
 */

export interface ZatcaInvoiceData {
  sellerName: string;
  vatNumber: string;
  timestamp: string; // ISO 8601
  totalAmount: number | string;
  vatAmount: number | string;
}

export function getTlvTag(tagNumber: number, tagValue: string): Uint8Array {
  const encoder = new TextEncoder();
  const valueBytes = encoder.encode(tagValue || '');
  const length = valueBytes.length;

  const tlv = new Uint8Array(2 + length);
  tlv[0] = tagNumber;
  tlv[1] = length;
  tlv.set(valueBytes, 2);

  return tlv;
}

export function generateZatcaTlvQrString(data: ZatcaInvoiceData): string {
  const tag1 = getTlvTag(1, data.sellerName);
  const tag2 = getTlvTag(2, data.vatNumber);
  const tag3 = getTlvTag(3, new Date(data.timestamp).toISOString());
  const tag4 = getTlvTag(4, Number(data.totalAmount || 0).toFixed(2));
  const tag5 = getTlvTag(5, Number(data.vatAmount || 0).toFixed(2));

  const totalLength = tag1.length + tag2.length + tag3.length + tag4.length + tag5.length;
  const combined = new Uint8Array(totalLength);

  let offset = 0;
  for (const tag of [tag1, tag2, tag3, tag4, tag5]) {
    combined.set(tag, offset);
    offset += tag.length;
  }

  // Convert Uint8Array to binary string then Base64
  let binary = '';
  const len = combined.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(combined[i]);
  }

  return btoa(binary);
}

export default {
  generateZatcaTlvQrString,
  getTlvTag,
};
