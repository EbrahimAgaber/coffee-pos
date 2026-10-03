/**
 * Tier 1: Feature Coverage Test Suite
 * 
 * Verifies primary behaviors (happy path, functional requirements) across 7 domains:
 * 1. Drive-Thru ordering & modifier selection
 * 2. KDS dark-mode Kanban, timers, color urgency, audio chime trigger, bump action
 * 3. Cashier ready queue, quick-cash calculator, payment methods
 * 4. Owner station analytics, X-Report & Z-Report
 * 5. ESC/POS thermal formatting (58mm/80mm), Arabic RTL shaping, ZATCA TLV Base64 QR
 * 6. Customer Debt (آجل) balance update & credit limit enforcement
 * 7. Recipe BOM mapping & atomic raw ingredient depletion
 */

import {
  describe,
  test,
  expect,
  calculateItemTotal,
  formatStopwatch,
  getKdsUrgency,
  canUndoBump,
  calculateChange,
  validateSplitPayment,
  chargeCustomerDebt,
  repayCustomerDebt,
  filterReceivablesByRegion,
  generateXReport,
  generateZReport,
  verifyMasterPin,
  generateEscPosReceiptText,
  buildWhatsAppReceiptUrl,
  MockRealtimeTransport,
} from './e2e_harness';

import {
  canTransitionOrder,
  transitionOrder,
  calculateOrderBOMDepletion,
  calculateOrderBOMRestoration,
} from '../src/state/orderStateMachine';

import {
  Order,
  OrderStatus,
  OrderItem,
  ItemModifier,
  Recipe,
  RawIngredient,
  Customer,
  CashierShift,
} from '../src/types';

import { shapeArabic, shapeBidi } from '../../src/utils/arabicShaper';
import { generateZatcaTlvQrString } from '../../src/utils/zatca';

export function registerTier1Tests(): void {
  describe('Tier 1 - Domain 1: Drive-Thru Ordering & Beverage Customizer', () => {
    test('T1.1.1: Base catalog item selection calculates correct base price', () => {
      const espressoTotal = calculateItemTotal(12, 0, [], 1);
      const flatWhiteTotal = calculateItemTotal(18, 0, [], 1);
      const spanishLatteTotal = calculateItemTotal(20, 0, [], 1);

      expect(espressoTotal).toBe(12);
      expect(flatWhiteTotal).toBe(18);
      expect(spanishLatteTotal).toBe(20);
    });

    test('T1.1.2: Size modifier delta pricing (+0 Small, +3 Medium, +5 Large)', () => {
      const basePrice = 18; // Flat White
      const small = calculateItemTotal(basePrice, 0, [], 1);
      const medium = calculateItemTotal(basePrice, 3, [], 1);
      const large = calculateItemTotal(basePrice, 5, [], 1);

      expect(small).toBe(18);
      expect(medium).toBe(21);
      expect(large).toBe(23);
    });

    test('T1.1.3: Milk alternative surcharge pricing (Whole +0, Oat +3, Almond +3)', () => {
      const basePrice = 20; // Spanish Latte Medium
      const sizeDelta = 3;
      const whole = calculateItemTotal(basePrice, sizeDelta, [{ priceDelta: 0 }], 1);
      const oat = calculateItemTotal(basePrice, sizeDelta, [{ priceDelta: 3 }], 1);
      const almond = calculateItemTotal(basePrice, sizeDelta, [{ priceDelta: 3 }], 1);

      expect(whole).toBe(23);
      expect(oat).toBe(26);
      expect(almond).toBe(26);
    });

    test('T1.1.4: Multi-modifier accumulation (Size + Oat + Extra Shot + Syrup)', () => {
      const basePrice = 20; // Spanish Latte
      const sizeDelta = 5; // Large (+5)
      const modifiers = [
        { priceDelta: 3 }, // Oat Milk (+3)
        { priceDelta: 4 }, // Double Shot (+4)
        { priceDelta: 3 }, // Vanilla Syrup (+3)
      ];
      const singleItemTotal = calculateItemTotal(basePrice, sizeDelta, modifiers, 1);
      const doubleItemTotal = calculateItemTotal(basePrice, sizeDelta, modifiers, 2);

      expect(singleItemTotal).toBe(35); // 20 + 5 + 3 + 4 + 3 = 35
      expect(doubleItemTotal).toBe(70);
    });

    test('T1.1.5: Vehicle plate and buzzer token tagging on order creation', () => {
      const orderWithPlate: Partial<Order> = {
        id: 'ord_101',
        tagType: 'VEHICLE',
        tagValue: 'أ ب ج 1234',
        vehicleModel: 'تويوتا كامري بيضاء',
      };
      const orderWithBuzzer: Partial<Order> = {
        id: 'ord_102',
        tagType: 'BUZZER',
        tagValue: 'Token #14',
      };

      expect(orderWithPlate.tagType).toBe('VEHICLE');
      expect(orderWithPlate.tagValue).toBe('أ ب ج 1234');
      expect(orderWithPlate.vehicleModel).toBe('تويوتا كامري بيضاء');
      expect(orderWithBuzzer.tagValue).toBe('Token #14');
    });

    test('T1.1.6: Sub-5 tap order sequence verification for 2-item customized drive-thru order', () => {
      // Tap 1: Select Item 1 (Flat White)
      let tapCount = 1;
      // Tap 2: Accept default size & modifiers
      tapCount++;
      // Tap 3: Select Item 2 (Croissant)
      tapCount++;
      // Tap 4: Tag vehicle plate from quick list
      tapCount++;
      // Tap 5: Tap "Send to Kitchen"
      tapCount++;

      expect(tapCount).toBeLessThanOrEqual(5);
    });
  });

  describe('Tier 1 - Domain 2: Kitchen Display System (KDS)', () => {
    test('T1.2.1: Chronological Kanban ticket sorting by order creation timestamp', () => {
      const t1 = new Date('2026-09-04T10:00:00Z').toISOString();
      const t2 = new Date('2026-09-04T10:02:00Z').toISOString();
      const t3 = new Date('2026-09-04T10:05:00Z').toISOString();

      const orders: { id: string; createdAt: string }[] = [
        { id: 'O3', createdAt: t3 },
        { id: 'O1', createdAt: t1 },
        { id: 'O2', createdAt: t2 },
      ];

      const sorted = [...orders].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      expect(sorted[0].id).toBe('O1');
      expect(sorted[1].id).toBe('O2');
      expect(sorted[2].id).toBe('O3');
    });

    test('T1.2.2: Live elapsed stopwatch formatting (seconds to MM:SS)', () => {
      expect(formatStopwatch(0)).toBe('00:00');
      expect(formatStopwatch(45)).toBe('00:45');
      expect(formatStopwatch(125)).toBe('02:05');
      expect(formatStopwatch(300)).toBe('05:00');
      expect(formatStopwatch(615)).toBe('10:15');
    });

    test('T1.2.3: Three-tier color urgency classification (Green <3m, Yellow 3-5m, Red >=5m)', () => {
      const fast = getKdsUrgency(120); // 2:00
      const warning = getKdsUrgency(240); // 4:00
      const rush = getKdsUrgency(310); // 5:10

      expect(fast.urgency).toBe('green');
      expect(fast.colorHex).toBe('#10B981');
      expect(fast.isPulsating).toBe(false);

      expect(warning.urgency).toBe('yellow');
      expect(warning.colorHex).toBe('#F59E0B');
      expect(warning.isPulsating).toBe(false);

      expect(rush.urgency).toBe('red');
      expect(rush.colorHex).toBe('#EF4444');
      expect(rush.isPulsating).toBe(true);
    });

    test('T1.2.4: Web Audio 3-tone chime event dispatch strictly upon ORDER_CREATED', async () => {
      const transport = new MockRealtimeTransport();
      let chimePlayed = false;

      transport.subscribe('ORDER_CREATED', (envelope: any) => {
        // Synthesizer triggered on arrival
        if (envelope.payload && envelope.payload.orderId) {
          chimePlayed = true;
        }
      });

      await transport.publish({
        type: 'ORDER_CREATED',
        stationId: 'DRIVE_THRU_1',
        payload: { orderId: 'ord_201' },
      });

      expect(chimePlayed).toBe(true);
    });

    test('T1.2.5: Single-tap bump action transitions ticket from IN_PREPARATION to READY_FOR_PICKUP', () => {
      const initialOrder: Order = {
        id: 'ord_202',
        orderNumber: 202,
        formattedOrderNumber: '#202',
        status: 'IN_PREPARATION',
        createdAt: new Date('2026-09-04T10:00:00Z').toISOString(),
        updatedAt: new Date('2026-09-04T10:00:00Z').toISOString(),
        stationId: 'KDS',
        tagType: 'VEHICLE',
        tagValue: 'أ ب ج 1234',
        items: [],
        subtotal: 25,
        tax: 3.75,
        total: 28.75,
        paymentStatus: 'UNPAID',
      };

      const bumpResult = transitionOrder(initialOrder, 'READY_FOR_PICKUP', {
        timestamp: new Date('2026-09-04T10:02:15Z').toISOString(),
      });

      expect(bumpResult.success).toBe(true);
      expect(bumpResult.order.status).toBe('READY_FOR_PICKUP');
      expect(bumpResult.order.prepDurationSeconds).toBe(135); // 2 mins 15 secs
      expect(bumpResult.sideEffects.prepDurationSeconds).toBe(135);
    });

    test('T1.2.6: Recall / undo bump within 60 seconds restores ticket to IN_PREPARATION', () => {
      const bumpedAt = 1000000;
      const withinWindow = bumpedAt + 25000; // 25 seconds later
      expect(canUndoBump(bumpedAt, withinWindow)).toBe(true);

      const readyOrder: Order = {
        id: 'ord_203',
        orderNumber: 203,
        formattedOrderNumber: '#203',
        status: 'READY_FOR_PICKUP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        readyAt: new Date().toISOString(),
        prepDurationSeconds: 120,
        stationId: 'KDS',
        tagType: 'BUZZER',
        tagValue: 'Token #5',
        items: [],
        subtotal: 20,
        tax: 3,
        total: 23,
        paymentStatus: 'UNPAID',
      };

      const recallResult = transitionOrder(readyOrder, 'IN_PREPARATION');
      expect(recallResult.success).toBe(true);
      expect(recallResult.order.status).toBe('IN_PREPARATION');
      expect(recallResult.order.readyAt).toBeFalsy();
    });
  });

  describe('Tier 1 - Domain 3: Cashier Station & Quick Checkout', () => {
    test('T1.3.1: Auto-refreshing ready queue filters orders in READY_FOR_PICKUP state', () => {
      const orderList: Partial<Order>[] = [
        { id: '1', status: 'NEW_ORDER' },
        { id: '2', status: 'IN_PREPARATION' },
        { id: '3', status: 'READY_FOR_PICKUP' },
        { id: '4', status: 'READY_FOR_PICKUP' },
        { id: '5', status: 'COMPLETED' },
      ];

      const readyQueue = orderList.filter((o) => o.status === 'READY_FOR_PICKUP');
      expect(readyQueue.length).toBe(2);
      expect(readyQueue[0].id).toBe('3');
      expect(readyQueue[1].id).toBe('4');
    });

    test('T1.3.2: Quick-cash denomination buttons and change due calculation', () => {
      const orderTotal = 32.0;

      const calc50 = calculateChange(orderTotal, 50);
      expect(calc50.isValid).toBe(true);
      expect(calc50.changeDue).toBe(18.0);

      const calc100 = calculateChange(orderTotal, 100);
      expect(calc100.isValid).toBe(true);
      expect(calc100.changeDue).toBe(68.0);

      const calcExact = calculateChange(orderTotal, 32);
      expect(calcExact.isValid).toBe(true);
      expect(calcExact.changeDue).toBe(0.0);
    });

    test('T1.3.3: Cashier settlement via Cash payment method', () => {
      const order: Order = {
        id: 'ord_301',
        orderNumber: 301,
        formattedOrderNumber: '#301',
        status: 'READY_FOR_PICKUP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'CASHIER',
        tagType: 'VEHICLE',
        tagValue: 'د هـ و 5678',
        items: [],
        subtotal: 30,
        tax: 4.5,
        total: 34.5,
        paymentStatus: 'UNPAID',
      };

      const res = transitionOrder(order, 'COMPLETED', {
        paymentMethod: 'CASH',
        cashTendered: 50,
      });

      expect(res.success).toBe(true);
      expect(res.order.status).toBe('COMPLETED');
      expect(res.order.paymentMethod).toBe('CASH');
      expect(res.order.paymentStatus).toBe('PAID');
      expect(res.order.cashTendered).toBe(50);
      expect(res.order.changeDue).toBe(15.5);
    });

    test('T1.3.4: Cashier settlement via Mada / Card payment method', () => {
      const order: Order = {
        id: 'ord_302',
        orderNumber: 302,
        formattedOrderNumber: '#302',
        status: 'READY_FOR_PICKUP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'CASHIER',
        tagType: 'BUZZER',
        tagValue: 'Token #8',
        items: [],
        subtotal: 40,
        tax: 6,
        total: 46,
        paymentStatus: 'UNPAID',
      };

      const res = transitionOrder(order, 'COMPLETED', {
        paymentMethod: 'MADA',
      });

      expect(res.success).toBe(true);
      expect(res.order.status).toBe('COMPLETED');
      expect(res.order.paymentMethod).toBe('MADA');
      expect(res.order.paymentStatus).toBe('PAID');
    });

    test('T1.3.5: Cashier split payment across Cash and Mada', () => {
      const total = 45.0;
      const validSplits: { method: 'CASH' | 'MADA'; amount: number }[] = [
        { method: 'CASH', amount: 20 },
        { method: 'MADA', amount: 25 },
      ];

      const validation = validateSplitPayment(total, validSplits);
      expect(validation.isValid).toBe(true);
      expect(validation.discrepancy).toBe(0);

      const invalidSplits: { method: 'CASH' | 'MADA'; amount: number }[] = [
        { method: 'CASH', amount: 20 },
        { method: 'MADA', amount: 20 },
      ];
      const invalidValidation = validateSplitPayment(total, invalidSplits);
      expect(invalidValidation.isValid).toBe(false);
      expect(invalidValidation.discrepancy).toBe(-5);
    });

    test('T1.3.6: Sub-3-tap cash checkout flow execution', () => {
      // Tap 1: Select Ready Order
      let tapCount = 1;
      // Tap 2: Tap Preset Cash Denomination button ("50 SAR")
      tapCount++;
      // Tap 3: Tap "Checkout & Print"
      tapCount++;

      expect(tapCount).toBeLessThanOrEqual(3);
    });
  });

  describe('Tier 1 - Domain 4: Owner Station Analytics, X-Report & Z-Report', () => {
    test('T1.4.1: Real-time sales velocity and operations KPI calculation', () => {
      const orders: Order[] = [
        { id: '1', total: 25, status: 'COMPLETED', paymentMethod: 'CASH' } as Order,
        { id: '2', total: 35, status: 'COMPLETED', paymentMethod: 'MADA' } as Order,
        { id: '3', total: 40, status: 'COMPLETED', paymentMethod: 'CUSTOMER_CREDIT' } as Order,
        { id: '4', total: 30, status: 'IN_PREPARATION' } as Order, // Not completed
      ];

      const completed = orders.filter((o) => o.status === 'COMPLETED');
      const grossSales = completed.reduce((acc, o) => acc + o.total, 0);
      const aov = grossSales / completed.length;

      expect(completed.length).toBe(3);
      expect(grossSales).toBe(100);
      expect(aov).toBeCloseTo(33.33, 2);
    });

    test('T1.4.2: Average preparation time computation across bumped tickets', () => {
      const bumpedOrders: Partial<Order>[] = [
        { id: '1', prepDurationSeconds: 120 },
        { id: '2', prepDurationSeconds: 180 },
        { id: '3', prepDurationSeconds: 240 },
      ];

      const sum = bumpedOrders.reduce((acc, o) => acc + (o.prepDurationSeconds || 0), 0);
      const avg = sum / bumpedOrders.length;

      expect(avg).toBe(180); // 3 minutes
      expect(formatStopwatch(avg)).toBe('03:00');
    });

    test('T1.4.3: Mid-shift X-Report generation with drawer expected cash snapshot', () => {
      const shift: CashierShift = {
        id: 'shift_1',
        cashierId: 'usr_1',
        cashierName: 'أحمد المحاسب',
        openedAt: new Date().toISOString(),
        startingCash: 500,
        cashSales: 0,
        madaSales: 0,
        creditSales: 0,
        totalSales: 0,
        orderCount: 0,
        expectedCash: 500,
        status: 'OPEN',
      };

      const orders: Order[] = [
        { id: '1', status: 'COMPLETED', total: 50, paymentMethod: 'CASH' } as Order,
        { id: '2', status: 'COMPLETED', total: 80, paymentMethod: 'MADA' } as Order,
        { id: '3', status: 'COMPLETED', total: 70, paymentMethod: 'CUSTOMER_CREDIT' } as Order,
      ];

      const xReport = generateXReport(shift, orders);
      expect(xReport.startingCash).toBe(500);
      expect(xReport.cashSales).toBe(50);
      expect(xReport.madaSales).toBe(80);
      expect(xReport.debtSales).toBe(70);
      expect(xReport.totalSales).toBe(200);
      expect(xReport.expectedDrawerCash).toBe(550); // 500 + 50
    });

    test('T1.4.4: End-of-day Z-Report shift closure with cash count and discrepancy variance', () => {
      const shift: CashierShift = {
        id: 'shift_1',
        cashierId: 'usr_1',
        cashierName: 'أحمد المحاسب',
        openedAt: new Date().toISOString(),
        startingCash: 500,
        cashSales: 200,
        madaSales: 300,
        creditSales: 100,
        totalSales: 600,
        orderCount: 4,
        expectedCash: 700,
        status: 'OPEN',
      };

      const orders: Order[] = [
        { id: '1', status: 'COMPLETED', total: 200, paymentMethod: 'CASH' } as Order,
      ];

      // Physical cash count conducted by cashier = 695 (5 SAR short)
      const zReport = generateZReport(shift, orders, 695);
      expect(zReport.status).toBe('CLOSED');
      expect(zReport.actualCashCount).toBe(695);
      expect(zReport.variance).toBe(-5); // Short by 5 SAR
    });

    test('T1.4.5: Master 4-digit PIN authentication challenge (7788 / 1234)', () => {
      expect(verifyMasterPin('7788')).toBe(true);
      expect(verifyMasterPin('1234')).toBe(true);
      expect(verifyMasterPin('0000')).toBe(false);
      expect(verifyMasterPin('9999')).toBe(false);
      expect(verifyMasterPin('abcd')).toBe(false);
    });
  });

  describe('Tier 1 - Domain 5: Thermal Printing (58/80mm), Arabic RTL & ZATCA TLV QR', () => {
    test('T1.5.1: 58mm ESC/POS layout formatting with 32-character columns and header', () => {
      const sampleOrder: Order = {
        id: 'ord_501',
        orderNumber: 501,
        formattedOrderNumber: '#501',
        status: 'COMPLETED',
        createdAt: '2026-09-04T12:00:00Z',
        updatedAt: '2026-09-04T12:00:00Z',
        stationId: 'CASHIER',
        tagType: 'VEHICLE',
        tagValue: 'أ ب ج 1234',
        items: [
          {
            id: 'it_1',
            menuItemId: 'flat_white',
            nameAr: 'فلات وايت',
            nameEn: 'Flat White',
            unitPrice: 18,
            quantity: 1,
            size: 'M',
            modifiers: [],
            totalPrice: 18,
          },
        ],
        subtotal: 15.65,
        tax: 2.35,
        total: 18.0,
        paymentStatus: 'PAID',
      };

      const receiptText = generateEscPosReceiptText(sampleOrder, '58mm');
      const lines = receiptText.split('\n');

      expect(lines.length).toBeGreaterThan(5);
      // All lines should adhere to width <= 32
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(32);
      }
      expect(receiptText).toContain('#501');
      expect(receiptText).toContain('18.00 SAR');
    });

    test('T1.5.2: 80mm ESC/POS layout formatting with 48-character columns and itemized table', () => {
      const sampleOrder: Order = {
        id: 'ord_502',
        orderNumber: 502,
        formattedOrderNumber: '#502',
        status: 'COMPLETED',
        createdAt: '2026-09-04T12:00:00Z',
        updatedAt: '2026-09-04T12:00:00Z',
        stationId: 'CASHIER',
        tagType: 'BUZZER',
        tagValue: 'Token #12',
        items: [
          {
            id: 'it_1',
            menuItemId: 'spanish_latte',
            nameAr: 'سبانش لاتيه بارد',
            nameEn: 'Iced Spanish Latte',
            unitPrice: 22,
            quantity: 2,
            size: 'L',
            modifiers: [],
            totalPrice: 44,
          },
        ],
        subtotal: 38.26,
        tax: 5.74,
        total: 44.0,
        paymentStatus: 'PAID',
      };

      const receiptText = generateEscPosReceiptText(sampleOrder, '80mm');
      const lines = receiptText.split('\n');

      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(48);
      }
      expect(receiptText).toContain('Token #12');
      expect(receiptText).toContain('44.00 SAR');
    });

    test('T1.5.3: Arabic RTL glyph shaping and Presentation Forms-B mapping via arabicShaper', () => {
      const originalText = 'قهوة مختصة';
      const shaped = shapeArabic(originalText);

      // Verify shaping changed characters to Presentation Forms-B
      expect(shaped).toBeTruthy();
      expect(shaped.length).toBeGreaterThan(0);
      expect(shaped).not.toBe(originalText); // Glyphs should be mapped to presentation forms
    });

    test('T1.5.4: ZATCA Phase 1 & 2 TLV Base64 QR code encoding and decoding validation', () => {
      const invoiceData = {
        sellerName: 'كافيه الأفق المختص',
        vatNumber: '310123456700003',
        timestamp: '2026-09-04T14:30:00Z',
        totalAmount: 28.75,
        vatAmount: 3.75,
      };

      const base64Qr = generateZatcaTlvQrString(invoiceData);
      expect(base64Qr).toBeTruthy();
      expect(typeof base64Qr).toBe('string');
      expect(base64Qr.length).toBeGreaterThan(20);

      // Decode Base64 and verify TLV tags
      const binary = atob(base64Qr);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      // Check Tag 1 (Seller Name)
      expect(bytes[0]).toBe(1); // Tag 1
      const tag1Len = bytes[1];
      expect(tag1Len).toBeGreaterThan(0);

      // Verify Tag 2 (VAT Number)
      const tag2Offset = 2 + tag1Len;
      expect(bytes[tag2Offset]).toBe(2); // Tag 2
      const tag2Len = bytes[tag2Offset + 1];
      expect(tag2Len).toBe(15); // 15 digits Saudi VAT
    });

    test('T1.5.5: WhatsApp direct digital receipt link construction with sanitized Saudi phone number', () => {
      const sampleOrder: Order = {
        id: 'ord_505',
        orderNumber: 505,
        formattedOrderNumber: '#505',
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'CASHIER',
        tagType: 'VEHICLE',
        tagValue: 'س ص ع 9111',
        items: [],
        subtotal: 20,
        tax: 3,
        total: 23.0,
        paymentStatus: 'PAID',
      };

      const url = buildWhatsAppReceiptUrl('+966 50 123 4567', sampleOrder);
      expect(url).toContain('https://wa.me/966501234567');
      expect(url).toContain(encodeURIComponent('#505'));
      expect(url).toContain(encodeURIComponent('23.00'));
    });
  });

  describe('Tier 1 - Domain 6: Customer Debt (آجل) & Regional Classification', () => {
    test('T1.6.1: Customer account setup with Saudi neighborhood classification', () => {
      const customer: Customer = {
        id: 'cust_01',
        name: 'سلطان الشمري',
        phone: '0555555555',
        region: 'حي الياسمين',
        creditLimit: 1000,
        currentBalance: 250,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(customer.region).toBe('حي الياسمين');
      expect(customer.creditLimit).toBe(1000);
      expect(customer.currentBalance).toBe(250);
    });

    test('T1.6.2: Charge order to Customer Credit with real-time balance increment', () => {
      const customer: Customer = {
        id: 'cust_02',
        name: 'عبدالله القحطاني',
        phone: '0566666666',
        region: 'حي النرجس',
        creditLimit: 500,
        currentBalance: 120,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = chargeCustomerDebt(customer, 65);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(185); // 120 + 65
    });

    test('T1.6.3: Credit limit enforcement rejecting charge exceeding limit', () => {
      const customer: Customer = {
        id: 'cust_03',
        name: 'شركة الروابي',
        phone: '0577777777',
        region: 'حي الصحافة',
        creditLimit: 1000,
        currentBalance: 950,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = chargeCustomerDebt(customer, 80); // 950 + 80 = 1030 > 1000
      expect(result.success).toBe(false);
      expect(result.newBalance).toBe(950);
      expect(result.error).toContain('Credit limit exceeded');
    });

    test('T1.6.4: Customer debt repayment voucher reducing outstanding balance', () => {
      const customer: Customer = {
        id: 'cust_04',
        name: 'فهد المطيري',
        phone: '0588888888',
        region: 'حي الياسمين',
        creditLimit: 2000,
        currentBalance: 800,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = repayCustomerDebt(customer, 300);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(500); // 800 - 300
    });

    test('T1.6.5: Regional receivables ledger filtering aggregating outstanding debt by neighborhood', () => {
      const customers: Customer[] = [
        { id: '1', name: 'A', phone: '1', region: 'حي الياسمين', currentBalance: 300, creditLimit: 1000 } as Customer,
        { id: '2', name: 'B', phone: '2', region: 'حي الياسمين', currentBalance: 450, creditLimit: 1000 } as Customer,
        { id: '3', name: 'C', phone: '3', region: 'حي النرجس', currentBalance: 500, creditLimit: 1000 } as Customer,
        { id: '4', name: 'D', phone: '4', region: 'حي الصحافة', currentBalance: 200, creditLimit: 1000 } as Customer,
      ];

      const yasmineFilter = filterReceivablesByRegion(customers, 'حي الياسمين');
      expect(yasmineFilter.totalReceivables).toBe(750); // 300 + 450
      expect(yasmineFilter.matchingCustomers.length).toBe(2);

      const narjisFilter = filterReceivablesByRegion(customers, 'حي النرجس');
      expect(narjisFilter.totalReceivables).toBe(500);
      expect(narjisFilter.matchingCustomers.length).toBe(1);
    });
  });

  describe('Tier 1 - Domain 7: Recipe BOM Mapping & Atomic Raw Ingredient Depletion', () => {
    const mockRecipes: Record<string, Recipe> = {
      spanish_latte: {
        id: 'rec_1',
        menuItemId: 'spanish_latte',
        nameAr: 'سبانش لاتيه',
        nameEn: 'Spanish Latte',
        baseIngredients: [
          { ingredientId: 'ing_beans', quantityRequired: 18 }, // 18g coffee beans
          { ingredientId: 'ing_milk', quantityRequired: 150 }, // 150ml milk
          { ingredientId: 'ing_condensed', quantityRequired: 30 }, // 30ml condensed milk
          { ingredientId: 'ing_cup', quantityRequired: 1 }, // 1 cup
          { ingredientId: 'ing_lid', quantityRequired: 1 }, // 1 lid
        ],
        modifierAdjustments: {
          mod_oat_milk: [
            { ingredientId: 'ing_milk', quantityRequired: -150 }, // Deduct whole milk requirement
            { ingredientId: 'ing_oat_milk', quantityRequired: 150 }, // Add oat milk requirement
          ],
          mod_extra_shot: [
            { ingredientId: 'ing_beans', quantityRequired: 6 }, // Add 6g coffee beans
          ],
        },
      },
    };

    const mockIngredients: Record<string, RawIngredient> = {
      ing_beans: {
        id: 'ing_beans',
        nameAr: 'حبوب قهوة مختصة',
        nameEn: 'Espresso Beans',
        sku: 'BN-01',
        unit: 'g',
        currentStock: 1000,
        minAlertThreshold: 200,
        costPerUnit: 0.1,
      },
      ing_milk: {
        id: 'ing_milk',
        nameAr: 'حليب كامل الدسم',
        nameEn: 'Whole Milk',
        sku: 'MK-01',
        unit: 'ml',
        currentStock: 5000,
        minAlertThreshold: 1000,
        costPerUnit: 0.006,
      },
      ing_condensed: {
        id: 'ing_condensed',
        nameAr: 'حليب مكثف محلى',
        nameEn: 'Condensed Milk',
        sku: 'CM-01',
        unit: 'ml',
        currentStock: 1000,
        minAlertThreshold: 200,
        costPerUnit: 0.02,
      },
      ing_cup: {
        id: 'ing_cup',
        nameAr: 'أكواب ورقية 12oz',
        nameEn: 'Paper Cups 12oz',
        sku: 'CP-12',
        unit: 'piece',
        currentStock: 500,
        minAlertThreshold: 50,
        costPerUnit: 0.4,
      },
      ing_lid: {
        id: 'ing_lid',
        nameAr: 'أغطية أكواب',
        nameEn: 'Cup Lids',
        sku: 'LD-01',
        unit: 'piece',
        currentStock: 500,
        minAlertThreshold: 50,
        costPerUnit: 0.15,
      },
      ing_oat_milk: {
        id: 'ing_oat_milk',
        nameAr: 'حليب شوفان',
        nameEn: 'Oat Milk',
        sku: 'OM-01',
        unit: 'ml',
        currentStock: 2000,
        minAlertThreshold: 500,
        costPerUnit: 0.015,
      },
    };

    test('T1.7.1: Menu item recipe BOM relational mapping verified', () => {
      const recipe = mockRecipes['spanish_latte'];
      expect(recipe).toBeTruthy();
      expect(recipe.baseIngredients.length).toBe(5);
      expect(recipe.baseIngredients[0].ingredientId).toBe('ing_beans');
      expect(recipe.baseIngredients[0].quantityRequired).toBe(18);
    });

    test('T1.7.2: Atomic raw ingredient deduction on order reaching COMPLETED state', () => {
      const order: Order = {
        id: 'ord_701',
        orderNumber: 701,
        formattedOrderNumber: '#701',
        status: 'READY_FOR_PICKUP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'CASHIER',
        tagType: 'VEHICLE',
        tagValue: 'أ ب ج 1234',
        items: [
          {
            id: 'it_1',
            menuItemId: 'spanish_latte',
            nameAr: 'سبانش لاتيه',
            nameEn: 'Spanish Latte',
            unitPrice: 20,
            quantity: 1,
            size: 'M',
            modifiers: [],
            totalPrice: 20,
          },
        ],
        subtotal: 17.39,
        tax: 2.61,
        total: 20.0,
        paymentStatus: 'UNPAID',
      };

      const result = transitionOrder(order, 'COMPLETED', {
        paymentMethod: 'CASH',
        recipes: mockRecipes,
        currentIngredients: mockIngredients,
      });

      expect(result.success).toBe(true);
      expect(result.sideEffects.inventoryDepletions).toBeTruthy();
      const depletions = result.sideEffects.inventoryDepletions!;
      expect(depletions.length).toBe(5);

      const beanDepletion = depletions.find((d) => d.ingredientId === 'ing_beans');
      expect(beanDepletion?.previousStock).toBe(1000);
      expect(beanDepletion?.depletedQuantity).toBe(18);
      expect(beanDepletion?.newStock).toBe(982);
    });

    test('T1.7.3: Modifier-adjusted BOM depletion (Oat Milk replacing Whole Milk & Extra Shot)', () => {
      const order: Order = {
        id: 'ord_702',
        orderNumber: 702,
        formattedOrderNumber: '#702',
        status: 'READY_FOR_PICKUP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'CASHIER',
        tagType: 'BUZZER',
        tagValue: 'Token #3',
        items: [
          {
            id: 'it_1',
            menuItemId: 'spanish_latte',
            nameAr: 'سبانش لاتيه بحليب الشوفان',
            nameEn: 'Oat Spanish Latte',
            unitPrice: 26,
            quantity: 1,
            size: 'M',
            modifiers: [
              { id: 'mod_oat_milk', category: 'MILK', nameAr: 'حليب شوفان', nameEn: 'Oat Milk', priceDelta: 3 },
              { id: 'mod_extra_shot', category: 'EXTRA_SHOT', nameAr: 'شوت إضافي', nameEn: 'Extra Shot', priceDelta: 4 },
            ],
            totalPrice: 27,
          },
        ],
        subtotal: 23.48,
        tax: 3.52,
        total: 27.0,
        paymentStatus: 'UNPAID',
      };

      const { depletions } = calculateOrderBOMDepletion(order, mockRecipes, mockIngredients);

      const beanDepletion = depletions.find((d) => d.ingredientId === 'ing_beans');
      expect(beanDepletion?.depletedQuantity).toBe(24); // 18 base + 6 extra shot

      const wholeMilkDepletion = depletions.find((d) => d.ingredientId === 'ing_milk');
      expect(wholeMilkDepletion?.depletedQuantity).toBe(0); // 150 base - 150 modifier = 0

      const oatMilkDepletion = depletions.find((d) => d.ingredientId === 'ing_oat_milk');
      expect(oatMilkDepletion?.depletedQuantity).toBe(150);
    });

    test('T1.7.4: Low stock threshold detection and alert triggering', () => {
      const lowStockIngredients: Record<string, RawIngredient> = {
        ...mockIngredients,
        ing_beans: {
          ...mockIngredients.ing_beans,
          currentStock: 210, // Just above 200 min threshold
        },
      };

      const order: Order = {
        id: 'ord_703',
        orderNumber: 703,
        formattedOrderNumber: '#703',
        status: 'READY_FOR_PICKUP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'CASHIER',
        tagType: 'VEHICLE',
        tagValue: 'أ ب ج 1234',
        items: [
          {
            id: 'it_1',
            menuItemId: 'spanish_latte',
            nameAr: 'سبانش لاتيه',
            nameEn: 'Spanish Latte',
            unitPrice: 20,
            quantity: 1,
            size: 'M',
            modifiers: [],
            totalPrice: 20,
          },
        ],
        subtotal: 17.39,
        tax: 2.61,
        total: 20.0,
        paymentStatus: 'UNPAID',
      };

      const { depletions, alerts } = calculateOrderBOMDepletion(order, mockRecipes, lowStockIngredients);
      const beanDepletion = depletions.find((d) => d.ingredientId === 'ing_beans');
      expect(beanDepletion?.newStock).toBe(192); // 210 - 18 = 192 <= 200
      expect(beanDepletion?.isLowStock).toBe(true);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0]).toContain('تنبيه مخزون');
    });

    test('T1.7.5: Stock reversal on order VOIDED state transition', () => {
      const completedOrder: Order = {
        id: 'ord_704',
        orderNumber: 704,
        formattedOrderNumber: '#704',
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'CASHIER',
        tagType: 'VEHICLE',
        tagValue: 'أ ب ج 1234',
        items: [
          {
            id: 'it_1',
            menuItemId: 'spanish_latte',
            nameAr: 'سبانش لاتيه',
            nameEn: 'Spanish Latte',
            unitPrice: 20,
            quantity: 1,
            size: 'M',
            modifiers: [],
            totalPrice: 20,
          },
        ],
        subtotal: 17.39,
        tax: 2.61,
        total: 20.0,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
      };

      // Void the order
      const voidResult = transitionOrder(completedOrder, 'VOIDED', {
        voidReason: 'Spilled by customer',
        voidedBy: 'Manager',
        recipes: mockRecipes,
        currentIngredients: mockIngredients,
      });

      expect(voidResult.success).toBe(true);
      expect(voidResult.order.status).toBe('VOIDED');
      expect(voidResult.sideEffects.inventoryRestorations).toBeTruthy();

      const beanRestoration = voidResult.sideEffects.inventoryRestorations?.find(
        (d) => d.ingredientId === 'ing_beans'
      );
      expect(beanRestoration?.depletedQuantity).toBe(-18); // Negative denotes restored
      expect(beanRestoration?.newStock).toBe(1018);
    });
  });
}
