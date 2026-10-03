/**
 * Tier 4: Real-World High-Stress Workload Scenarios Test Suite
 * 
 * Verifies end-to-end, multi-step real-world workloads and operational profiles:
 * 1. Morning rush hour: 5 concurrent drive-thru orders processed through KDS to Cashier
 * 2. Catering bulk order with mixed custom modifiers and split payment (Cash + Mada)
 * 3. Regional delivery batch charged to customer credit in حي الياسمين with receivables ledger update
 * 4. Shift handover: Mid-shift X-Report inspection followed by end-of-day Z-Report drawer reconciliation
 * 5. High-stress out-of-stock guard & void recovery rush
 */

import {
  describe,
  test,
  expect,
  calculateChange,
  validateSplitPayment,
  chargeCustomerDebt,
  filterReceivablesByRegion,
  generateXReport,
  generateZReport,
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
  Recipe,
  RawIngredient,
  Customer,
  CashierShift,
} from '../src/types';

import { generateZatcaTlvQrString } from '../../src/utils/zatca';

export function registerTier4Tests(): void {
  describe('Tier 4 - Real-World High-Stress Workload Scenarios', () => {
    const mockRecipes: Record<string, Recipe> = {
      flat_white: {
        id: 'rec_fw',
        menuItemId: 'flat_white',
        nameAr: 'فلات وايت',
        nameEn: 'Flat White',
        baseIngredients: [
          { ingredientId: 'ing_beans', quantityRequired: 18 },
          { ingredientId: 'ing_milk', quantityRequired: 150 },
          { ingredientId: 'ing_cup_8oz', quantityRequired: 1 },
        ],
      },
      spanish_latte: {
        id: 'rec_sl',
        menuItemId: 'spanish_latte',
        nameAr: 'سبانش لاتيه',
        nameEn: 'Spanish Latte',
        baseIngredients: [
          { ingredientId: 'ing_beans', quantityRequired: 18 },
          { ingredientId: 'ing_milk', quantityRequired: 150 },
          { ingredientId: 'ing_condensed', quantityRequired: 30 },
          { ingredientId: 'ing_cup_12oz', quantityRequired: 1 },
        ],
        modifierAdjustments: {
          mod_oat_milk: [
            { ingredientId: 'ing_milk', quantityRequired: -150 },
            { ingredientId: 'ing_oat_milk', quantityRequired: 150 },
          ],
        },
      },
      v60: {
        id: 'rec_v60',
        menuItemId: 'v60',
        nameAr: 'قهوة V60 مختصة',
        nameEn: 'V60 Drip',
        baseIngredients: [
          { ingredientId: 'ing_ethiopian_beans', quantityRequired: 20 },
          { ingredientId: 'ing_filter', quantityRequired: 1 },
          { ingredientId: 'ing_cup_12oz', quantityRequired: 1 },
        ],
      },
      croissant: {
        id: 'rec_cr',
        menuItemId: 'croissant',
        nameAr: 'كرواسون زبدة فرنسي',
        nameEn: 'Butter Croissant',
        baseIngredients: [
          { ingredientId: 'ing_croissant_dough', quantityRequired: 1 },
          { ingredientId: 'ing_pastry_box', quantityRequired: 1 },
        ],
      },
    };

    const getFreshIngredients = (): Record<string, RawIngredient> => ({
      ing_beans: {
        id: 'ing_beans',
        nameAr: 'حبوب إسبريسو',
        nameEn: 'Espresso Beans',
        sku: 'BN-01',
        unit: 'g',
        currentStock: 2000,
        minAlertThreshold: 300,
        costPerUnit: 0.1,
      },
      ing_ethiopian_beans: {
        id: 'ing_ethiopian_beans',
        nameAr: 'بن أثيوبي مختص',
        nameEn: 'Ethiopian Beans',
        sku: 'ETH-01',
        unit: 'g',
        currentStock: 1000,
        minAlertThreshold: 200,
        costPerUnit: 0.15,
      },
      ing_milk: {
        id: 'ing_milk',
        nameAr: 'حليب كامل الدسم',
        nameEn: 'Whole Milk',
        sku: 'MK-01',
        unit: 'ml',
        currentStock: 10000,
        minAlertThreshold: 2000,
        costPerUnit: 0.006,
      },
      ing_oat_milk: {
        id: 'ing_oat_milk',
        nameAr: 'حليب شوفان',
        nameEn: 'Oat Milk',
        sku: 'OM-01',
        unit: 'ml',
        currentStock: 5000,
        minAlertThreshold: 1000,
        costPerUnit: 0.015,
      },
      ing_condensed: {
        id: 'ing_condensed',
        nameAr: 'حليب مكثف',
        nameEn: 'Condensed Milk',
        sku: 'CM-01',
        unit: 'ml',
        currentStock: 3000,
        minAlertThreshold: 500,
        costPerUnit: 0.02,
      },
      ing_cup_8oz: {
        id: 'ing_cup_8oz',
        nameAr: 'كوب 8oz',
        nameEn: 'Cup 8oz',
        sku: 'CP-08',
        unit: 'piece',
        currentStock: 1000,
        minAlertThreshold: 100,
        costPerUnit: 0.3,
      },
      ing_cup_12oz: {
        id: 'ing_cup_12oz',
        nameAr: 'كوب 12oz',
        nameEn: 'Cup 12oz',
        sku: 'CP-12',
        unit: 'piece',
        currentStock: 1000,
        minAlertThreshold: 100,
        costPerUnit: 0.35,
      },
      ing_filter: {
        id: 'ing_filter',
        nameAr: 'فلتر V60',
        nameEn: 'Filter V60',
        sku: 'FLT-01',
        unit: 'piece',
        currentStock: 200,
        minAlertThreshold: 30,
        costPerUnit: 0.5,
      },
      ing_croissant_dough: {
        id: 'ing_croissant_dough',
        nameAr: 'كرواسون مجمد',
        nameEn: 'Croissant Dough',
        sku: 'CR-01',
        unit: 'piece',
        currentStock: 100,
        minAlertThreshold: 20,
        costPerUnit: 3.5,
      },
      ing_pastry_box: {
        id: 'ing_pastry_box',
        nameAr: 'علبة حلا',
        nameEn: 'Pastry Box',
        sku: 'BX-01',
        unit: 'piece',
        currentStock: 200,
        minAlertThreshold: 30,
        costPerUnit: 0.75,
      },
    });

    test('Scenario 4.1: Morning rush hour (5 concurrent drive-thru orders through KDS to Cashier)', async () => {
      const transport = new MockRealtimeTransport();
      const currentIngredients = getFreshIngredients();

      // Create 5 concurrent orders from two drive-thru stations
      const rushOrders: Order[] = [
        {
          id: 'ord_rush_1',
          orderNumber: 401,
          formattedOrderNumber: '#401',
          status: 'NEW_ORDER',
          createdAt: new Date('2026-09-04T08:00:01Z').toISOString(),
          updatedAt: new Date('2026-09-04T08:00:01Z').toISOString(),
          stationId: 'DRIVE_THRU_1',
          tagType: 'VEHICLE',
          tagValue: 'أ ب ج 1111',
          items: [{ id: '1', menuItemId: 'flat_white', nameAr: 'فلات وايت', nameEn: 'Flat White', unitPrice: 18, quantity: 2, size: 'S', modifiers: [], totalPrice: 36 }],
          subtotal: 31.30,
          tax: 4.70,
          total: 36.0,
          paymentStatus: 'UNPAID',
        },
        {
          id: 'ord_rush_2',
          orderNumber: 402,
          formattedOrderNumber: '#402',
          status: 'NEW_ORDER',
          createdAt: new Date('2026-09-04T08:00:05Z').toISOString(),
          updatedAt: new Date('2026-09-04T08:00:05Z').toISOString(),
          stationId: 'DRIVE_THRU_2',
          tagType: 'VEHICLE',
          tagValue: 'د هـ و 2222',
          items: [
            { id: '2a', menuItemId: 'spanish_latte', nameAr: 'سبانش لاتيه شوفان', nameEn: 'Oat Spanish Latte', unitPrice: 23, quantity: 1, size: 'M', modifiers: [{ id: 'mod_oat_milk', category: 'MILK', nameAr: 'حليب شوفان', nameEn: 'Oat Milk', priceDelta: 3 }], totalPrice: 26 },
            { id: '2b', menuItemId: 'croissant', nameAr: 'كرواسون', nameEn: 'Croissant', unitPrice: 12, quantity: 1, size: 'M', modifiers: [], totalPrice: 12 },
          ],
          subtotal: 33.04,
          tax: 4.96,
          total: 38.0,
          paymentStatus: 'UNPAID',
        },
        {
          id: 'ord_rush_3',
          orderNumber: 403,
          formattedOrderNumber: '#403',
          status: 'NEW_ORDER',
          createdAt: new Date('2026-09-04T08:00:10Z').toISOString(),
          updatedAt: new Date('2026-09-04T08:00:10Z').toISOString(),
          stationId: 'DRIVE_THRU_1',
          tagType: 'BUZZER',
          tagValue: 'Token #03',
          items: [{ id: '3', menuItemId: 'v60', nameAr: 'V60', nameEn: 'V60', unitPrice: 22, quantity: 1, size: 'M', modifiers: [], totalPrice: 22 }],
          subtotal: 19.13,
          tax: 2.87,
          total: 22.0,
          paymentStatus: 'UNPAID',
        },
        {
          id: 'ord_rush_4',
          orderNumber: 404,
          formattedOrderNumber: '#404',
          status: 'NEW_ORDER',
          createdAt: new Date('2026-09-04T08:00:15Z').toISOString(),
          updatedAt: new Date('2026-09-04T08:00:15Z').toISOString(),
          stationId: 'DRIVE_THRU_2',
          tagType: 'VEHICLE',
          tagValue: 'س ص ع 4444',
          items: [{ id: '4', menuItemId: 'flat_white', nameAr: 'فلات وايت', nameEn: 'Flat White', unitPrice: 18, quantity: 1, size: 'S', modifiers: [], totalPrice: 18 }],
          subtotal: 15.65,
          tax: 2.35,
          total: 18.0,
          paymentStatus: 'UNPAID',
        },
        {
          id: 'ord_rush_5',
          orderNumber: 405,
          formattedOrderNumber: '#405',
          status: 'NEW_ORDER',
          createdAt: new Date('2026-09-04T08:00:20Z').toISOString(),
          updatedAt: new Date('2026-09-04T08:00:20Z').toISOString(),
          stationId: 'DRIVE_THRU_1',
          tagType: 'BUZZER',
          tagValue: 'Token #05',
          items: [{ id: '5', menuItemId: 'croissant', nameAr: 'كرواسون', nameEn: 'Croissant', unitPrice: 12, quantity: 2, size: 'M', modifiers: [], totalPrice: 24 }],
          subtotal: 20.87,
          tax: 3.13,
          total: 24.0,
          paymentStatus: 'UNPAID',
        },
      ];

      // Broadcast all 5 orders
      for (const ord of rushOrders) {
        await transport.publish({
          type: 'ORDER_CREATED',
          stationId: ord.stationId,
          payload: { order: ord },
        });
      }
      expect(transport.publishedEvents.length).toBe(5);

      // KDS processes all orders through preparation and bumping to ready
      const readyOrders: Order[] = [];
      for (const ord of rushOrders) {
        const prep = transitionOrder(ord, 'IN_PREPARATION');
        expect(prep.success).toBe(true);
        const bump = transitionOrder(prep.order, 'READY_FOR_PICKUP');
        expect(bump.success).toBe(true);
        readyOrders.push(bump.order);
      }
      expect(readyOrders.length).toBe(5);

      // Cashier completes all 5 orders with different payment methods
      const completedOrders: Order[] = [];
      const paymentMethods: ('CASH' | 'MADA')[] = ['CASH', 'MADA', 'CASH', 'MADA', 'CASH'];

      for (let i = 0; i < readyOrders.length; i++) {
        const ord = readyOrders[i];
        const method = paymentMethods[i];
        const comp = transitionOrder(ord, 'COMPLETED', {
          paymentMethod: method,
          cashTendered: method === 'CASH' ? ord.total + 10 : undefined,
          recipes: mockRecipes,
          currentIngredients,
        });
        expect(comp.success).toBe(true);
        completedOrders.push(comp.order);

        // Apply depletion to ingredient state
        for (const dep of comp.sideEffects.inventoryDepletions || []) {
          currentIngredients[dep.ingredientId].currentStock = dep.newStock;
        }
      }

      // Assertions on the rush outcome
      const totalRushSales = completedOrders.reduce((acc, o) => acc + o.total, 0);
      expect(totalRushSales).toBe(138.0); // 36 + 38 + 22 + 18 + 24 = 138

      // Croissants depleted: 1 from order 2 + 2 from order 5 = 3
      expect(currentIngredients['ing_croissant_dough'].currentStock).toBe(97); // 100 - 3 = 97

      // V60 filters depleted: 1
      expect(currentIngredients['ing_filter'].currentStock).toBe(199); // 200 - 1 = 199
    });

    test('Scenario 4.2: Catering bulk order with mixed custom modifiers and split payment (Cash + Mada)', () => {
      const currentIngredients = getFreshIngredients();

      // Bulk catering: 10x Spanish Latte (M), 5x V60, 10x Croissants
      // Spanish Latte: 10 * 20 = 200 SAR
      // V60: 5 * 22 = 110 SAR
      // Croissants: 10 * 12 = 120 SAR
      // Total = 430 SAR
      const cateringOrder: Order = {
        id: 'ord_catering_1',
        orderNumber: 501,
        formattedOrderNumber: '#501',
        status: 'READY_FOR_PICKUP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'CASHIER',
        tagType: 'CUSTOMER_NAME',
        tagValue: 'شركة أرامكو - ضيافة',
        items: [
          { id: 'c1', menuItemId: 'spanish_latte', nameAr: 'سبانش لاتيه', nameEn: 'Spanish Latte', unitPrice: 20, quantity: 10, size: 'M', modifiers: [], totalPrice: 200 },
          { id: 'c2', menuItemId: 'v60', nameAr: 'V60', nameEn: 'V60', unitPrice: 22, quantity: 5, size: 'M', modifiers: [], totalPrice: 110 },
          { id: 'c3', menuItemId: 'croissant', nameAr: 'كرواسون', nameEn: 'Croissant', unitPrice: 12, quantity: 10, size: 'M', modifiers: [], totalPrice: 120 },
        ],
        subtotal: 373.91,
        tax: 56.09,
        total: 430.0,
        paymentStatus: 'UNPAID',
      };

      // Split settlement: 200 Cash + 230 Mada
      const splits: { method: 'CASH' | 'MADA'; amount: number }[] = [
        { method: 'CASH', amount: 200.0 },
        { method: 'MADA', amount: 230.0 },
      ];
      const splitCheck = validateSplitPayment(cateringOrder.total, splits);
      expect(splitCheck.isValid).toBe(true);

      const completeRes = transitionOrder(cateringOrder, 'COMPLETED', {
        paymentMethod: 'SPLIT',
        paymentSplits: splits,
        recipes: mockRecipes,
        currentIngredients,
      });

      expect(completeRes.success).toBe(true);
      expect(completeRes.order.paymentMethod).toBe('SPLIT');

      // Check ZATCA QR generation for 430 SAR with 56.09 SAR VAT
      const zatcaQr = generateZatcaTlvQrString({
        sellerName: 'كافيه الأفق',
        vatNumber: '310123456700003',
        timestamp: '2026-09-04T12:00:00Z',
        totalAmount: 430.0,
        vatAmount: 56.09,
      });
      expect(zatcaQr.length).toBeGreaterThan(20);

      // Verify bulk inventory depletions:
      // 10 Spanish Lattes = 180g beans + 1500ml milk + 300ml condensed
      // 5 V60 = 100g Ethiopian beans + 5 filters
      // 10 Croissants = 10 dough
      const depletions = completeRes.sideEffects.inventoryDepletions!;
      const condensed = depletions.find((d) => d.ingredientId === 'ing_condensed');
      expect(condensed?.depletedQuantity).toBe(300); // 10 * 30ml
      expect(condensed?.newStock).toBe(2700); // 3000 - 300
    });

    test('Scenario 4.3: Regional delivery batch charged to customer credit in حي الياسمين with receivables ledger update', () => {
      const customers: Customer[] = [
        { id: 'c_yas_1', name: 'مكتب الياسمين للاستشارات', phone: '0501111111', region: 'حي الياسمين', currentBalance: 200.0, creditLimit: 2000.0 } as Customer,
        { id: 'c_yas_2', name: 'عيادات الياسمين الطبية', phone: '0502222222', region: 'حي الياسمين', currentBalance: 350.0, creditLimit: 1500.0 } as Customer,
        { id: 'c_nar_1', name: 'مؤسسة النرجس للمقاولات', phone: '0503333333', region: 'حي النرجس', currentBalance: 500.0, creditLimit: 3000.0 } as Customer,
      ];

      // Dispatch 2 orders charged to customers in حي الياسمين
      // Order 1: 150 SAR to c_yas_1
      const res1 = chargeCustomerDebt(customers[0], 150.0);
      expect(res1.success).toBe(true);
      customers[0].currentBalance = res1.newBalance; // 350 SAR

      // Order 2: 220 SAR to c_yas_2
      const res2 = chargeCustomerDebt(customers[1], 220.0);
      expect(res2.success).toBe(true);
      customers[1].currentBalance = res2.newBalance; // 570 SAR

      // Regional receivables filter for حي الياسمين
      const yasmineReceivables = filterReceivablesByRegion(customers, 'حي الياسمين');
      expect(yasmineReceivables.totalReceivables).toBe(920.0); // 350 + 570 = 920.0 SAR
      expect(yasmineReceivables.matchingCustomers.length).toBe(2);

      // Verify حي النرجس remains isolated at 500.0 SAR
      const narjisReceivables = filterReceivablesByRegion(customers, 'حي النرجس');
      expect(narjisReceivables.totalReceivables).toBe(500.0);
    });

    test('Scenario 4.4: Shift handover (Mid-shift X-Report inspection followed by end-of-day Z-Report drawer reconciliation)', () => {
      const shift: CashierShift = {
        id: 'shift_morning_01',
        cashierId: 'cashier_fahad',
        cashierName: 'فهد المطيري',
        openedAt: '2026-09-04T07:00:00Z',
        startingCash: 500.0, // Opening float
        cashSales: 0,
        madaSales: 0,
        creditSales: 0,
        totalSales: 0,
        orderCount: 0,
        expectedCash: 500.0,
        status: 'OPEN',
      };

      const orders: Order[] = [
        { id: 'o1', total: 60.0, status: 'COMPLETED', paymentMethod: 'CASH' } as Order,
        { id: 'o2', total: 140.0, status: 'COMPLETED', paymentMethod: 'MADA' } as Order,
        { id: 'o3', total: 100.0, status: 'COMPLETED', paymentMethod: 'CASH' } as Order,
        { id: 'o4', total: 80.0, status: 'COMPLETED', paymentMethod: 'CUSTOMER_CREDIT' } as Order,
      ];

      // 1. Mid-shift X-Report inspection by shift manager
      const xReport = generateXReport(shift, orders);
      expect(xReport.startingCash).toBe(500.0);
      expect(xReport.cashSales).toBe(160.0); // 60 + 100
      expect(xReport.madaSales).toBe(140.0);
      expect(xReport.debtSales).toBe(80.0);
      expect(xReport.totalSales).toBe(380.0);
      expect(xReport.expectedDrawerCash).toBe(660.0); // 500 + 160

      // Verify shift remains OPEN during/after X-Report
      expect(shift.status).toBe('OPEN');

      // 2. Additional late transactions occur
      orders.push({ id: 'o5', total: 40.0, status: 'COMPLETED', paymentMethod: 'CASH' } as Order);

      // 3. End-of-Day Z-Report closure
      // Total expected cash = 500 + 160 + 40 = 700.0 SAR
      // Cashier physically counts 700.0 SAR (Exact match)
      const zReport = generateZReport(shift, orders, 700.0);
      expect(zReport.status).toBe('CLOSED');
      expect(zReport.variance).toBe(0.0); // Exactly balanced
      expect(zReport.actualCashCount).toBe(700.0);
    });

    test('Scenario 4.5: High-stress out-of-stock guard & void recovery rush', () => {
      const tightIngredients: Record<string, RawIngredient> = {
        ing_ethiopian_beans: {
          id: 'ing_ethiopian_beans',
          nameAr: 'بن أثيوبي مختص',
          nameEn: 'Ethiopian Beans',
          sku: 'ETH-01',
          unit: 'g',
          currentStock: 20, // Only 20g left (exactly 1 cup)
          minAlertThreshold: 50,
          costPerUnit: 0.15,
        },
        ing_filter: {
          id: 'ing_filter',
          nameAr: 'فلتر V60',
          nameEn: 'Filter V60',
          sku: 'FLT-01',
          unit: 'piece',
          currentStock: 10,
          minAlertThreshold: 2,
          costPerUnit: 0.5,
        },
        ing_cup_12oz: {
          id: 'ing_cup_12oz',
          nameAr: 'كوب 12oz',
          nameEn: 'Cup 12oz',
          sku: 'CP-12',
          unit: 'piece',
          currentStock: 10,
          minAlertThreshold: 2,
          costPerUnit: 0.35,
        },
      };

      const orderA: Order = {
        id: 'ord_rush_a',
        orderNumber: 601,
        formattedOrderNumber: '#601',
        status: 'READY_FOR_PICKUP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'CASHIER',
        tagType: 'BUZZER',
        tagValue: 'Token #1',
        items: [{ id: '1', menuItemId: 'v60', nameAr: 'V60', nameEn: 'V60', unitPrice: 22, quantity: 1, size: 'M', modifiers: [], totalPrice: 22 }],
        subtotal: 19.13,
        tax: 2.87,
        total: 22.0,
        paymentStatus: 'UNPAID',
      };

      // Order A completes -> depletes stock to 0g
      const compA = transitionOrder(orderA, 'COMPLETED', {
        paymentMethod: 'CASH',
        recipes: mockRecipes,
        currentIngredients: tightIngredients,
      });
      expect(compA.success).toBe(true);
      tightIngredients['ing_ethiopian_beans'].currentStock = 0; // Depleted to 0

      // Order B attempts to order V60 -> stock is 0
      const orderB: Order = {
        id: 'ord_rush_b',
        orderNumber: 602,
        formattedOrderNumber: '#602',
        status: 'READY_FOR_PICKUP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'CASHIER',
        tagType: 'BUZZER',
        tagValue: 'Token #2',
        items: [{ id: '1', menuItemId: 'v60', nameAr: 'V60', nameEn: 'V60', unitPrice: 22, quantity: 1, size: 'M', modifiers: [], totalPrice: 22 }],
        subtotal: 19.13,
        tax: 2.87,
        total: 22.0,
        paymentStatus: 'UNPAID',
      };

      const { depletions: depB } = calculateOrderBOMDepletion(orderB, mockRecipes, tightIngredients);
      const beanDepB = depB.find((d) => d.ingredientId === 'ing_ethiopian_beans');
      expect(beanDepB?.previousStock).toBe(0);
      expect(beanDepB?.newStock).toBe(0); // Cannot go below 0

      // Order A is voided due to spilled drink -> triggers stock restoration
      const voidA = transitionOrder(compA.order, 'VOIDED', {
        voidReason: 'Spilled before handoff',
        recipes: mockRecipes,
        currentIngredients: tightIngredients,
      });
      expect(voidA.success).toBe(true);
      const restorations = voidA.sideEffects.inventoryRestorations!;
      const restoredBeans = restorations.find((r) => r.ingredientId === 'ing_ethiopian_beans');
      expect(restoredBeans?.newStock).toBe(20); // Restored back to 20g

      // Now Order B can be prepared!
      tightIngredients['ing_ethiopian_beans'].currentStock = 20;
      const compB = transitionOrder(orderB, 'COMPLETED', {
        paymentMethod: 'MADA',
        recipes: mockRecipes,
        currentIngredients: tightIngredients,
      });
      expect(compB.success).toBe(true);
      const beanDepFinal = compB.sideEffects.inventoryDepletions?.find((d) => d.ingredientId === 'ing_ethiopian_beans');
      expect(beanDepFinal?.newStock).toBe(0);
    });
  });
}
