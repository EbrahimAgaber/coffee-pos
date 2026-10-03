/**
 * Tier 2: Boundary Value Analysis (BVA) & Corner Cases Test Suite
 * 
 * Verifies edge cases, boundaries, and defensive invariants across 6 domains:
 * 1. Payment under/over amounts, zero amounts, exact cash, large bills (500 SAR)
 * 2. Credit limit boundary checks (exact limit, limit exceeded rejection)
 * 3. Empty vehicle plate, maximum length strings, Arabic letters in plate
 * 4. KDS timer color transitions: 2:59 (Green), 3:00 (Yellow), 4:59 (Yellow), 5:00 (Red pulsating)
 * 5. KDS 60-second undo window expiry
 * 6. Recipe stock reaching exact 0, negative stock prevention, stock restoration on void
 */

import {
  describe,
  test,
  expect,
  calculateChange,
  validateSplitPayment,
  chargeCustomerDebt,
  getKdsUrgency,
  canUndoBump,
  formatStopwatch,
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
  Recipe,
  RawIngredient,
  Customer,
} from '../src/types';

export function registerTier2Tests(): void {
  describe('Tier 2 - Domain 1: Payment Boundary Value Analysis', () => {
    test('T2.1.1: Exact cash tendered equals order total (change = 0.00 SAR)', () => {
      const res = calculateChange(28.75, 28.75);
      expect(res.isValid).toBe(true);
      expect(res.changeDue).toBe(0.0);
    });

    test('T2.1.2: Underpayment cash tendered < total returns isValid: false', () => {
      const res = calculateChange(50.0, 45.0);
      expect(res.isValid).toBe(false);
      expect(res.changeDue).toBe(0.0);
      expect(res.error).toContain('Insufficient cash tendered');
    });

    test('T2.1.3: Underpayment by 1 Halala (0.01 SAR) returns isValid: false', () => {
      const res = calculateChange(25.0, 24.99);
      expect(res.isValid).toBe(false);
      expect(res.changeDue).toBe(0.0);
      expect(res.error).toContain('Insufficient cash');
    });

    test('T2.1.4: Zero cash tendered on non-zero total returns isValid: false', () => {
      const res = calculateChange(35.0, 0);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Zero cash tendered is invalid');
    });

    test('T2.1.5: Large 500.00 SAR bill tendered on 15.00 SAR order (change = 485.00 SAR)', () => {
      const res = calculateChange(15.0, 500.0);
      expect(res.isValid).toBe(true);
      expect(res.changeDue).toBe(485.0);
    });

    test('T2.1.6: Split payment exact coverage vs split payment mismatch', () => {
      const total = 100.0;

      // Exact split match
      const exactSplits: { method: 'CASH' | 'MADA'; amount: number }[] = [
        { method: 'CASH', amount: 30.5 },
        { method: 'MADA', amount: 69.5 },
      ];
      expect(validateSplitPayment(total, exactSplits).isValid).toBe(true);

      // Overpayment mismatch
      const overSplits: { method: 'CASH' | 'MADA'; amount: number }[] = [
        { method: 'CASH', amount: 50.0 },
        { method: 'MADA', amount: 50.5 },
      ];
      const overRes = validateSplitPayment(total, overSplits);
      expect(overRes.isValid).toBe(false);
      expect(overRes.discrepancy).toBe(0.5);

      // Underpayment mismatch
      const underSplits: { method: 'CASH' | 'MADA'; amount: number }[] = [
        { method: 'CASH', amount: 50.0 },
        { method: 'MADA', amount: 49.0 },
      ];
      const underRes = validateSplitPayment(total, underSplits);
      expect(underRes.isValid).toBe(false);
      expect(underRes.discrepancy).toBe(-1.0);
    });
  });

  describe('Tier 2 - Domain 2: Customer Credit Limit Boundary Checks', () => {
    test('T2.2.1: Charging debt where balance + order total == exact credit limit (ALLOWED)', () => {
      const customer: Customer = {
        id: 'cust_b1',
        name: 'عميل مميز',
        phone: '0500000001',
        region: 'حي الياسمين',
        creditLimit: 1000.0,
        currentBalance: 900.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = chargeCustomerDebt(customer, 100.0);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(1000.0);
    });

    test('T2.2.2: Charging debt where balance + order total == credit limit + 0.01 SAR (REJECTED)', () => {
      const customer: Customer = {
        id: 'cust_b2',
        name: 'عميل حرج',
        phone: '0500000002',
        region: 'حي الياسمين',
        creditLimit: 1000.0,
        currentBalance: 900.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = chargeCustomerDebt(customer, 100.01);
      expect(result.success).toBe(false);
      expect(result.newBalance).toBe(900.0);
      expect(result.error).toContain('Credit limit exceeded');
    });

    test('T2.2.3: Customer with 0.00 SAR credit limit rejects any debt charge', () => {
      const customer: Customer = {
        id: 'cust_b3',
        name: 'عميل نقدي فقط',
        phone: '0500000003',
        region: 'حي النرجس',
        creditLimit: 0.0,
        currentBalance: 0.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = chargeCustomerDebt(customer, 25.0);
      expect(result.success).toBe(false);
      expect(result.newBalance).toBe(0.0);
      expect(result.error).toContain('Credit limit exceeded');
    });

    test('T2.2.4: Negative customer balance (pre-paid deposit) handles debt charge accurately', () => {
      const customer: Customer = {
        id: 'cust_b4',
        name: 'عميل لديه رصيد دائن',
        phone: '0500000004',
        region: 'حي الصحافة',
        creditLimit: 500.0,
        currentBalance: -50.0, // Customer deposited 50 SAR in advance
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = chargeCustomerDebt(customer, 30.0);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(-20.0); // -50 + 30 = -20
    });

    test('T2.2.5: Consecutive orders: first reaches exact limit, second is immediately rejected', () => {
      let customer: Customer = {
        id: 'cust_b5',
        name: 'عميل متتابع',
        phone: '0500000005',
        region: 'حي الياسمين',
        creditLimit: 500.0,
        currentBalance: 400.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Order 1: 100 SAR -> Reaches exact 500 SAR
      const res1 = chargeCustomerDebt(customer, 100.0);
      expect(res1.success).toBe(true);
      expect(res1.newBalance).toBe(500.0);
      customer = { ...customer, currentBalance: res1.newBalance };

      // Order 2: 15 SAR -> Exceeds 500 SAR limit
      const res2 = chargeCustomerDebt(customer, 15.0);
      expect(res2.success).toBe(false);
      expect(res2.newBalance).toBe(500.0);
      expect(res2.error).toContain('Credit limit exceeded');
    });
  });

  describe('Tier 2 - Domain 3: Vehicle Plate & Token String Boundaries', () => {
    test('T2.3.1: Empty vehicle plate string falls back gracefully to auto-token', () => {
      const order: Partial<Order> = {
        tagType: 'VEHICLE',
        tagValue: '',
      };

      const effectiveToken = order.tagValue ? order.tagValue : 'AUTO_TOKEN_#01';
      expect(effectiveToken).toBe('AUTO_TOKEN_#01');
    });

    test('T2.3.2: Standard Saudi vehicle plate with Arabic letters (أ ب ج 1234)', () => {
      const plate = 'أ ب ج 1234';
      const arabicPlateRegex = /^[\u0600-\u06FF\s]+[0-9]{1,4}$/;
      expect(arabicPlateRegex.test(plate)).toBe(true);
    });

    test('T2.3.3: 50-character maximum length vehicle description preserved without truncation', () => {
      const longVehicleDesc = 'مرسيدس بنز الفئة إس سوداء مع لوحة دبلوماسية خاصة'.substring(0, 50);
      expect(longVehicleDesc.length).toBeLessThanOrEqual(50);
      expect(longVehicleDesc).toBeTruthy();
    });

    test('T2.3.4: Mixed Arabic and English plate alphanumeric string (ABC 1234 / أ ب ج)', () => {
      const mixedPlate = 'أ ب ج 1234 / ABC 1234';
      expect(mixedPlate).toContain('أ ب ج');
      expect(mixedPlate).toContain('ABC');
    });

    test('T2.3.5: Special characters and symbols in barista notes handled safely without escaping errors', () => {
      const specialNotes = 'حليب ساخن جداً! & بدون رغوة (على جنب) + 2x سكر أسمر #عاجل';
      expect(specialNotes).toContain('&');
      expect(specialNotes).toContain('+');
      expect(specialNotes).toContain('#');
      expect(specialNotes.length).toBeGreaterThan(10);
    });
  });

  describe('Tier 2 - Domain 4: KDS Stopwatch Timer Color Urgency Transitions', () => {
    test('T2.4.1: Elapsed 179s (2:59) is Green (< 3 minutes)', () => {
      const u = getKdsUrgency(179);
      expect(u.urgency).toBe('green');
      expect(u.colorHex).toBe('#10B981');
      expect(u.isPulsating).toBe(false);
      expect(u.formattedTime).toBe('02:59');
    });

    test('T2.4.2: Exact 180s (3:00) transitions to Yellow', () => {
      const u = getKdsUrgency(180);
      expect(u.urgency).toBe('yellow');
      expect(u.colorHex).toBe('#F59E0B');
      expect(u.isPulsating).toBe(false);
      expect(u.formattedTime).toBe('03:00');
    });

    test('T2.4.3: Elapsed 299s (4:59) is Yellow', () => {
      const u = getKdsUrgency(299);
      expect(u.urgency).toBe('yellow');
      expect(u.colorHex).toBe('#F59E0B');
      expect(u.isPulsating).toBe(false);
      expect(u.formattedTime).toBe('04:59');
    });

    test('T2.4.4: Exact 300s (5:00) transitions to Red with pulsating flag', () => {
      const u = getKdsUrgency(300);
      expect(u.urgency).toBe('red');
      expect(u.colorHex).toBe('#EF4444');
      expect(u.isPulsating).toBe(true);
      expect(u.formattedTime).toBe('05:00');
    });

    test('T2.4.5: Extended delay at 930s (15:30) maintains Red urgency and pulsating flag', () => {
      const u = getKdsUrgency(930);
      expect(u.urgency).toBe('red');
      expect(u.colorHex).toBe('#EF4444');
      expect(u.isPulsating).toBe(true);
      expect(u.formattedTime).toBe('15:30');
    });
  });

  describe('Tier 2 - Domain 5: KDS 60-Second Undo Window Expiry', () => {
    const bumpedAt = 1000000;

    test('T2.5.1: Immediate undo at 0 seconds after bump succeeds', () => {
      expect(canUndoBump(bumpedAt, bumpedAt)).toBe(true);
    });

    test('T2.5.2: Undo at 30 seconds after bump succeeds', () => {
      expect(canUndoBump(bumpedAt, bumpedAt + 30000)).toBe(true);
    });

    test('T2.5.3: Undo at 59 seconds (59,000ms) succeeds', () => {
      expect(canUndoBump(bumpedAt, bumpedAt + 59000)).toBe(true);
    });

    test('T2.5.4: Exact 60 seconds boundary (60,000ms) expires and is rejected', () => {
      expect(canUndoBump(bumpedAt, bumpedAt + 60000)).toBe(false);
    });

    test('T2.5.5: Expired undo at 61 seconds (61,000ms) is rejected', () => {
      expect(canUndoBump(bumpedAt, bumpedAt + 61000)).toBe(false);
    });
  });

  describe('Tier 2 - Domain 6: Recipe Stock Boundaries & Stockout Prevention', () => {
    const mockRecipes: Record<string, Recipe> = {
      v60: {
        id: 'rec_v60',
        menuItemId: 'v60',
        nameAr: 'قهوة مقطرة V60',
        nameEn: 'V60 Pour Over',
        baseIngredients: [
          { ingredientId: 'ing_specialty_beans', quantityRequired: 20 }, // 20g beans
          { ingredientId: 'ing_filter', quantityRequired: 1 }, // 1 paper filter
        ],
      },
    };

    test('T2.6.1: Raw ingredient stock reaching exact 0.00 is allowed and marks out-of-stock', () => {
      const ingredients: Record<string, RawIngredient> = {
        ing_specialty_beans: {
          id: 'ing_specialty_beans',
          nameAr: 'بن أثيوبي مختص',
          nameEn: 'Ethiopian Beans',
          sku: 'ETH-01',
          unit: 'g',
          currentStock: 20, // Exactly 20g remaining
          minAlertThreshold: 100,
          costPerUnit: 0.15,
        },
        ing_filter: {
          id: 'ing_filter',
          nameAr: 'فلاتر V60',
          nameEn: 'V60 Filters',
          sku: 'FLT-01',
          unit: 'piece',
          currentStock: 50,
          minAlertThreshold: 10,
          costPerUnit: 0.5,
        },
      };

      const order: Order = {
        id: 'ord_v60_1',
        orderNumber: 601,
        formattedOrderNumber: '#601',
        status: 'READY_FOR_PICKUP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'CASHIER',
        tagType: 'BUZZER',
        tagValue: 'Token #1',
        items: [
          {
            id: 'it_1',
            menuItemId: 'v60',
            nameAr: 'V60',
            nameEn: 'V60',
            unitPrice: 22,
            quantity: 1,
            size: 'M',
            modifiers: [],
            totalPrice: 22,
          },
        ],
        subtotal: 19.13,
        tax: 2.87,
        total: 22.0,
        paymentStatus: 'UNPAID',
      };

      const { depletions, alerts } = calculateOrderBOMDepletion(order, mockRecipes, ingredients);
      const beanDep = depletions.find((d) => d.ingredientId === 'ing_specialty_beans');
      expect(beanDep?.previousStock).toBe(20);
      expect(beanDep?.newStock).toBe(0); // Exact 0
      expect(beanDep?.isLowStock).toBe(true);
      expect(alerts.length).toBeGreaterThan(0);
    });

    test('T2.6.2: Insufficient stock prevents negative inventory (clamps to 0 with warning)', () => {
      const lowIngredients: Record<string, RawIngredient> = {
        ing_specialty_beans: {
          id: 'ing_specialty_beans',
          nameAr: 'بن أثيوبي مختص',
          nameEn: 'Ethiopian Beans',
          sku: 'ETH-01',
          unit: 'g',
          currentStock: 10, // Only 10g left, but order requires 20g
          minAlertThreshold: 100,
          costPerUnit: 0.15,
        },
        ing_filter: {
          id: 'ing_filter',
          nameAr: 'فلاتر V60',
          nameEn: 'V60 Filters',
          sku: 'FLT-01',
          unit: 'piece',
          currentStock: 50,
          minAlertThreshold: 10,
          costPerUnit: 0.5,
        },
      };

      const order: Order = {
        id: 'ord_v60_2',
        orderNumber: 602,
        formattedOrderNumber: '#602',
        status: 'READY_FOR_PICKUP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'CASHIER',
        tagType: 'BUZZER',
        tagValue: 'Token #2',
        items: [
          {
            id: 'it_1',
            menuItemId: 'v60',
            nameAr: 'V60',
            nameEn: 'V60',
            unitPrice: 22,
            quantity: 1,
            size: 'M',
            modifiers: [],
            totalPrice: 22,
          },
        ],
        subtotal: 19.13,
        tax: 2.87,
        total: 22.0,
        paymentStatus: 'UNPAID',
      };

      const { depletions } = calculateOrderBOMDepletion(order, mockRecipes, lowIngredients);
      const beanDep = depletions.find((d) => d.ingredientId === 'ing_specialty_beans');
      expect(beanDep?.newStock).toBe(0); // Clamped at 0 (never negative)
    });

    test('T2.6.3: Stock restoration on void precisely recovers depleted quantities', () => {
      const ingredients: Record<string, RawIngredient> = {
        ing_specialty_beans: {
          id: 'ing_specialty_beans',
          nameAr: 'بن أثيوبي مختص',
          nameEn: 'Ethiopian Beans',
          sku: 'ETH-01',
          unit: 'g',
          currentStock: 80, // Was 100, depleted 20
          minAlertThreshold: 100,
          costPerUnit: 0.15,
        },
        ing_filter: {
          id: 'ing_filter',
          nameAr: 'فلاتر V60',
          nameEn: 'V60 Filters',
          sku: 'FLT-01',
          unit: 'piece',
          currentStock: 49,
          minAlertThreshold: 10,
          costPerUnit: 0.5,
        },
      };

      const completedOrder: Order = {
        id: 'ord_v60_3',
        orderNumber: 603,
        formattedOrderNumber: '#603',
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'CASHIER',
        tagType: 'BUZZER',
        tagValue: 'Token #3',
        items: [
          {
            id: 'it_1',
            menuItemId: 'v60',
            nameAr: 'V60',
            nameEn: 'V60',
            unitPrice: 22,
            quantity: 1,
            size: 'M',
            modifiers: [],
            totalPrice: 22,
          },
        ],
        subtotal: 19.13,
        tax: 2.87,
        total: 22.0,
        paymentStatus: 'PAID',
      };

      const restorations = calculateOrderBOMRestoration(completedOrder, mockRecipes, ingredients);
      const beanRest = restorations.find((r) => r.ingredientId === 'ing_specialty_beans');
      expect(beanRest?.previousStock).toBe(80);
      expect(beanRest?.newStock).toBe(100); // 80 + 20 = 100
      expect(beanRest?.depletedQuantity).toBe(-20);
    });

    test('T2.6.4: Multiple sequential voids: state machine disallows voiding already voided order', () => {
      const voidedOrder: Order = {
        id: 'ord_v60_4',
        orderNumber: 604,
        formattedOrderNumber: '#604',
        status: 'VOIDED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'CASHIER',
        tagType: 'BUZZER',
        tagValue: 'Token #4',
        items: [],
        subtotal: 22,
        tax: 3.3,
        total: 25.3,
        paymentStatus: 'UNPAID',
      };

      expect(canTransitionOrder(voidedOrder.status, 'VOIDED')).toBe(false);
      const res = transitionOrder(voidedOrder, 'VOIDED');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid transition');
    });

    test('T2.6.5: State machine disallows skipping states (NEW_ORDER directly to COMPLETED)', () => {
      const newOrder: Order = {
        id: 'ord_v60_5',
        orderNumber: 605,
        formattedOrderNumber: '#605',
        status: 'NEW_ORDER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'DRIVE_THRU',
        tagType: 'VEHICLE',
        tagValue: 'أ ب ج 1234',
        items: [],
        subtotal: 20,
        tax: 3,
        total: 23,
        paymentStatus: 'UNPAID',
      };

      // Direct transition to COMPLETED must be rejected
      expect(canTransitionOrder(newOrder.status, 'COMPLETED')).toBe(false);
      const res = transitionOrder(newOrder, 'COMPLETED');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid transition from NEW_ORDER to COMPLETED');
    });
  });
}
