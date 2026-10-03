import { Order } from '../types';
import { shapeArabic } from '../utils/arabicShaper';
import {
  createZatcaDataFromOrder,
  generateZatcaQrRasterBytes,
  StoreTaxProfile,
  DEFAULT_STORE_TAX_PROFILE,
} from './zatcaQr';

export type PaperWidth = '58mm' | '80mm';

export interface EscPosReceiptOptions {
  paperWidth?: PaperWidth;
  storeProfile?: StoreTaxProfile;
  includeCut?: boolean;
  embedZatcaQr?: boolean;
}

export const ESC_POS_CONSTANTS = {
  // Control codes
  LF: 0x0a, // Line feed
  ESC: 0x1b,
  GS: 0x1d,

  // Commands
  INIT: [0x1b, 0x40], // ESC @ - Initialize printer
  ALIGN_LEFT: [0x1b, 0x61, 0x00], // ESC a 0
  ALIGN_CENTER: [0x1b, 0x61, 0x01], // ESC a 1
  ALIGN_RIGHT: [0x1b, 0x61, 0x02], // ESC a 2
  BOLD_ON: [0x1b, 0x45, 0x01], // ESC E 1
  BOLD_OFF: [0x1b, 0x45, 0x00], // ESC E 0
  DOUBLE_HEIGHT_ON: [0x1b, 0x21, 0x10],
  DOUBLE_WIDTH_ON: [0x1b, 0x21, 0x20],
  NORMAL_TEXT: [0x1b, 0x21, 0x00],
  CUT_FULL: [0x1d, 0x56, 0x00], // GS V 0
  CUT_PARTIAL: [0x1d, 0x56, 0x01], // GS V 1
  CUT_FEED: [0x1d, 0x56, 0x42, 0x00], // GS V 66 0
};

/**
 * Low-level ESC/POS binary command builder
 */
export class EscPosBuilder {
  private buffer: number[] = [];

  constructor() {
    this.initialize();
  }

  public initialize(): this {
    this.buffer.push(...ESC_POS_CONSTANTS.INIT);
    return this;
  }

  public align(alignment: 'left' | 'center' | 'right'): this {
    if (alignment === 'center') {
      this.buffer.push(...ESC_POS_CONSTANTS.ALIGN_CENTER);
    } else if (alignment === 'right') {
      this.buffer.push(...ESC_POS_CONSTANTS.ALIGN_RIGHT);
    } else {
      this.buffer.push(...ESC_POS_CONSTANTS.ALIGN_LEFT);
    }
    return this;
  }

  public bold(enable: boolean = true): this {
    this.buffer.push(...(enable ? ESC_POS_CONSTANTS.BOLD_ON : ESC_POS_CONSTANTS.BOLD_OFF));
    return this;
  }

  public feed(lines: number = 1): this {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(ESC_POS_CONSTANTS.LF);
    }
    return this;
  }

  public rawBytes(bytes: number[] | Uint8Array): this {
    if (bytes instanceof Uint8Array) {
      for (let i = 0; i < bytes.length; i++) {
        this.buffer.push(bytes[i]);
      }
    } else {
      this.buffer.push(...bytes);
    }
    return this;
  }

  public text(str: string): this {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);
    this.rawBytes(encoded);
    return this;
  }

  public line(str: string = ''): this {
    if (str) {
      this.text(str);
    }
    this.buffer.push(ESC_POS_CONSTANTS.LF);
    return this;
  }

  public cut(feedLines: number = 3): this {
    this.feed(feedLines);
    this.buffer.push(...ESC_POS_CONSTANTS.CUT_FEED);
    return this;
  }

  /**
   * GS v 0 (Raster bit image command)
   * Format: GS v 0 m xL xH yL yH d1...dk
   * m = 0 (Normal mode)
   * xL, xH = width in bytes (width / 8)
   * yL, yH = height in dots
   */
  public rasterBitImage(width: number, height: number, bytes: Uint8Array): this {
    const xL = (Math.ceil(width / 8)) & 0xff;
    const xH = ((Math.ceil(width / 8)) >> 8) & 0xff;
    const yL = height & 0xff;
    const yH = (height >> 8) & 0xff;

    // GS v 0 0 xL xH yL yH
    this.buffer.push(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH);
    this.rawBytes(bytes);
    return this;
  }

  public getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Pure Text ESC/POS Receipt Formatter
 * 58mm = 32 character columns
 * 80mm = 48 character columns
 */
export function generateEscPosReceiptText(
  order: Order,
  paperWidth: PaperWidth,
  storeNameAr: string = 'كافيه الأفق'
): string {
  const width = paperWidth === '58mm' ? 32 : 48;
  const separator = '-'.repeat(width);
  const doubleSep = '='.repeat(width);

  const shapedStoreName = shapeArabic(storeNameAr);
  const orderNum = order.formattedOrderNumber;
  const dateStr = new Date(order.createdAt).toISOString().substring(0, 10);

  const lines: string[] = [];
  lines.push(doubleSep);
  lines.push(centerText(shapedStoreName, width));
  lines.push(centerText(`Order: ${orderNum} | ${dateStr}`, width));
  if (order.tagValue) {
    lines.push(centerText(`Tag: ${order.tagValue}`, width));
  }
  lines.push(separator);

  for (const it of order.items) {
    const itemShaped = shapeArabic(it.nameAr);
    const line = `${it.quantity}x ${itemShaped} ... ${it.totalPrice.toFixed(2)} SAR`;
    lines.push(line.length > width ? line.substring(0, width) : line);
  }

  lines.push(separator);
  lines.push(padLine('Subtotal:', `${order.subtotal.toFixed(2)} SAR`, width));
  lines.push(padLine('15% VAT:', `${order.tax.toFixed(2)} SAR`, width));
  lines.push(padLine('TOTAL:', `${order.total.toFixed(2)} SAR`, width));
  lines.push(doubleSep);

  return lines.join('\n');
}

function centerText(text: string, width: number): string {
  if (text.length >= width) return text.substring(0, width);
  const pad = Math.floor((width - text.length) / 2);
  return ' '.repeat(pad) + text;
}

function padLine(left: string, right: string, width: number): string {
  const spaces = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(spaces) + right;
}

/**
 * Generates full authentic ESC/POS binary command buffer with headers,
 * itemized order lines, shaped Arabic text, embedded ZATCA QR raster image, and paper cut.
 */
export async function generateEscPosBytes(
  order: Order,
  options: EscPosReceiptOptions = {}
): Promise<Uint8Array> {
  const paperWidth = options.paperWidth || '80mm';
  const profile = options.storeProfile || DEFAULT_STORE_TAX_PROFILE;
  const embedQr = options.embedZatcaQr !== false;
  const includeCut = options.includeCut !== false;

  const builder = new EscPosBuilder();

  // 1. Initialize & Header
  builder.initialize();
  builder.align('center');
  builder.bold(true);
  builder.line(shapeArabic(profile.name));
  builder.bold(false);
  builder.line(`VAT #: ${profile.vatNumber}`);
  builder.line(`فاتورة ضريبية مبسطة - ${order.formattedOrderNumber}`);
  builder.line(new Date(order.createdAt).toISOString().replace('T', ' ').substring(0, 19));
  if (order.tagValue) {
    builder.line(`Tag: ${order.tagValue} ${order.vehicleModel ? '(' + order.vehicleModel + ')' : ''}`);
  }
  builder.feed(1);

  // 2. Receipt Text Table
  builder.align('left');
  const textTable = generateEscPosReceiptText(order, paperWidth, profile.name);
  builder.line(textTable);
  builder.feed(1);

  // 3. Payment Method
  builder.align('left');
  builder.bold(true);
  const payLabel = order.paymentMethod === 'CASH'
    ? 'Payment: CASH (نقداً)'
    : order.paymentMethod === 'MADA'
    ? 'Payment: MADA (مدى / شبكة)'
    : order.paymentMethod === 'CUSTOMER_CREDIT'
    ? 'Payment: CREDIT (آجل)'
    : 'Payment: SPLIT (مجزأ)';
  builder.line(payLabel);
  if (order.cashTendered && order.changeDue !== undefined) {
    builder.line(`Tendered: ${order.cashTendered.toFixed(2)} SAR | Change: ${order.changeDue.toFixed(2)} SAR`);
  }
  builder.bold(false);
  builder.feed(1);

  // 4. ZATCA QR Code Raster Bit Image
  if (embedQr) {
    try {
      const zatcaData = createZatcaDataFromOrder(order, profile);
      // Module size: 3 for 58mm, 4 for 80mm
      const moduleSize = paperWidth === '58mm' ? 3 : 4;
      const { width, height, bytes } = await generateZatcaQrRasterBytes(zatcaData, moduleSize);

      builder.align('center');
      builder.line('--- Saudi ZATCA QR Code ---');
      builder.rasterBitImage(width, height, bytes);
      builder.feed(1);
    } catch (e) {
      console.warn('Failed embedding ZATCA QR raster in ESC/POS:', e);
    }
  }

  // 5. Footer & Cut
  builder.align('center');
  builder.line('شكراً لزيارتكم! Thank you!');
  if (includeCut) {
    builder.cut(4);
  }

  return builder.getBytes();
}

/**
 * Triggers native browser printing for thermal printers with CSS @media print styling.
 */
export function triggerWebPrint(): void {
  if (typeof window !== 'undefined' && window.print) {
    window.print();
  }
}

/**
 * CSS Print Styles helper for 58mm and 80mm paper widths.
 */
export function getThermalPrintCss(paperWidth: PaperWidth): string {
  const widthMm = paperWidth === '58mm' ? '58mm' : '80mm';
  return `
    @media print {
      @page {
        size: ${widthMm} auto;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 4mm;
        width: ${widthMm};
        background: #fff;
        color: #000;
        font-family: 'Courier New', Courier, monospace, system-ui;
        font-size: 11px;
        line-height: 1.3;
      }
      .no-print {
        display: none !important;
      }
      .thermal-print-area {
        width: 100% !important;
        max-width: ${widthMm} !important;
        margin: 0 auto !important;
      }
    }
  `;
}
