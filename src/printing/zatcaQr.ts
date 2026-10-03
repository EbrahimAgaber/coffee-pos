import QRCode from 'qrcode';
import { generateZatcaTlvQrString, ZatcaInvoiceData } from '../utils/zatca';
import { Order } from '../types';

export { generateZatcaTlvQrString, type ZatcaInvoiceData };

export interface StoreTaxProfile {
  name: string;
  vatNumber: string;
}

export const DEFAULT_STORE_TAX_PROFILE: StoreTaxProfile = {
  name: 'كافيه الأفق المختص',
  vatNumber: '310123456700003',
};

/**
 * Extracts compliant ZATCA Phase 1 & 2 invoice data from a POS order.
 */
export function createZatcaDataFromOrder(
  order: Order,
  profile: StoreTaxProfile = DEFAULT_STORE_TAX_PROFILE
): ZatcaInvoiceData {
  return {
    sellerName: profile.name,
    vatNumber: profile.vatNumber,
    timestamp: order.createdAt || new Date().toISOString(),
    totalAmount: order.total,
    vatAmount: order.tax,
  };
}

/**
 * Generates Base64 Data URL (image/png) for the ZATCA QR code.
 */
export async function generateZatcaQrDataUrl(
  invoiceData: ZatcaInvoiceData,
  size: number = 180
): Promise<string> {
  const tlvBase64 = generateZatcaTlvQrString(invoiceData);
  return QRCode.toDataURL(tlvBase64, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

/**
 * Renders ZATCA QR code directly onto an existing HTML Canvas element.
 */
export async function renderZatcaQrToCanvas(
  canvas: HTMLCanvasElement,
  invoiceData: ZatcaInvoiceData,
  size: number = 180
): Promise<void> {
  const tlvBase64 = generateZatcaTlvQrString(invoiceData);
  await QRCode.toCanvas(canvas, tlvBase64, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

/**
 * Generates raw 1-bit monochrome bitmap data of the QR code for ESC/POS raster printing.
 */
export async function generateZatcaQrRasterBytes(
  invoiceData: ZatcaInvoiceData,
  moduleSize: number = 4
): Promise<{ width: number; height: number; bytes: Uint8Array }> {
  const tlvBase64 = generateZatcaTlvQrString(invoiceData);
  const qrData = QRCode.create(tlvBase64, { errorCorrectionLevel: 'M' });
  const moduleCount = qrData.modules.size;
  const width = moduleCount * moduleSize;
  const height = width;
  const rowBytes = Math.ceil(width / 8);
  const bytes = new Uint8Array(rowBytes * height);

  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      const isDark = qrData.modules.get(r, c);
      if (isDark) {
        for (let py = 0; py < moduleSize; py++) {
          const y = r * moduleSize + py;
          for (let px = 0; px < moduleSize; px++) {
            const x = c * moduleSize + px;
            const byteIndex = y * rowBytes + Math.floor(x / 8);
            const bitPosition = 7 - (x % 8);
            bytes[byteIndex] |= 1 << bitPosition;
          }
        }
      }
    }
  }

  return { width, height, bytes };
}

export default {
  createZatcaDataFromOrder,
  generateZatcaQrDataUrl,
  renderZatcaQrToCanvas,
  generateZatcaQrRasterBytes,
  generateZatcaTlvQrString,
  DEFAULT_STORE_TAX_PROFILE,
};
