/**
 * Tier 3: Pairwise Combinatorial Cross-Feature Integration Test Suite
 * 
 * Verifies complex multi-station asynchronous interactions:
 * 1. Drive-Thru customizer -> KDS bump -> Cashier cash payment -> BOM stock depletion
 * 2. Drive-thru plate tag -> KDS bump -> Cashier debt settlement -> Customer regional attribution
 * 3. Order bump -> Barista recall -> Cashier ready queue removal
 * 4. Order completion -> Void order -> BOM stock restoration & customer debt rollback
 */

import {
  describe,
  test,
  expect,
  calculateChange,
  chargeCustomerDebt,
  filterReceivablesByRegion,
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
} from '../src/types';

export function registerTier3Tests(): void {
  describe('Tier 3 - Cross-Feature Pairwise Interactions', () => {
    // Shared Mock Master Data
    const mockRecipes: Record<string, Recipe> = {
      spanish_latte: {
        id: 'rec_sl',
        menuItemId: 'spanish_latte',
        nameAr: 'سبانش لاتيه',
        nameEn: 'Spanish Latte',
        baseIngredients: [
          { ingredientId: 'ing_beans', quantityRequired: 18 },
          { ingredientId: 'ing_milk', quantityRequired: 150 },
          { ingredientId: 'ing_condensed', quantityRequired: 30 },
          { ingredientId: 'ing_cup', quantityRequired: 1 },
        ],
        modifierAdjustments: {
          mod_oat_milk: [
            { ingredientId: 'ing_milk', quantityRequired: -150 },
            { ingredientId: 'ing_oat_milk', quantityRequired: 150 },
          ],
          mod_extra_shot: [
            { ingredientId: 'ing_beans', quantityRequired: 6 },
          ],
        },
      },
    };

    const getInitialIngredients = (): Record<string, RawIngredient> => ({
      ing_beans: {
        id: 'ing_beans',
        nameAr: 'حبوب القهوة',
        nameEn: 'Coffee Beans',
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
      ing_condensed: {
        id: 'ing_condensed',
        nameAr: 'حليب مكثف',
        nameEn: 'Condensed Milk',
        sku: 'CM-01',
        unit: 'ml',
        currentStock: 1000,
        minAlertThreshold: 200,
        costPerUnit: 0.02,
      },
      ing_cup: {
        id: 'ing_cup',
        nameAr: 'كوب 12oz',
        nameEn: 'Cup 12oz',
        sku: 'CP-01',
        unit: 'piece',
        currentStock: 500,
        minAlertThreshold: 50,
        costPerUnit: 0.35,
      },
    });

    test('Pair 1: Drive-Thru customizer -> KDS bump -> Cashier cash payment -> BOM stock depletion', async () => {
      const transport = new MockRealtimeTransport();
      const currentIngredients = getInitialIngredients();

      // Step 1: Drive-thru attendant customizes Spanish Latte with Oat Milk + Extra Shot
      const customOrder: Order = {
        id: 'ord_pair_1',
        orderNumber: 301,
        formattedOrderNumber: '#301',
        status: 'NEW_ORDER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'DRIVE_THRU_1',
        tagType: 'VEHICLE',
        tagValue: 'أ ب ج 7777',
        items: [
          {
            id: 'it_pair_1',
            menuItemId: 'spanish_latte',
            nameAr: 'سبانش لاتيه مع شوفان وشوت إضافي',
            nameEn: 'Oat Spanish Latte + Extra Shot',
            unitPrice: 20,
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

      // Attendant submits order -> broadcasts ORDER_CREATED
      await transport.publish({
        type: 'ORDER_CREATED',
        stationId: 'DRIVE_THRU_1',
        payload: { order: customOrder },
      });
      expect(transport.publishedEvents.length).toBe(1);

      // Step 2: KDS claims order to preparation
      const prepRes = transitionOrder(customOrder, 'IN_PREPARATION');
      expect(prepRes.success).toBe(true);
      const prepOrder = prepRes.order;

      // Step 3: Barista finishes drink and taps "Bump to Ready"
      const bumpRes = transitionOrder(prepOrder, 'READY_FOR_PICKUP');
      expect(bumpRes.success).toBe(true);
      const readyOrder = bumpRes.order;

      // Step 4: Cashier receives ticket in Ready Queue and settles with 50 SAR Cash
      const changeCalc = calculateChange(readyOrder.total, 50);
      expect(changeCalc.isValid).toBe(true);
      expect(changeCalc.changeDue).toBe(23.0); // 50 - 27 = 23

      const completeRes = transitionOrder(readyOrder, 'COMPLETED', {
        paymentMethod: 'CASH',
        cashTendered: 50,
        recipes: mockRecipes,
        currentIngredients,
      });

      expect(completeRes.success).toBe(true);
      expect(completeRes.order.status).toBe('COMPLETED');
      expect(completeRes.order.paymentStatus).toBe('PAID');

      // Step 5: Verify BOM raw stock depletion side effects
      const depletions = completeRes.sideEffects.inventoryDepletions;
      expect(depletions).toBeTruthy();

      // Coffee beans: 18g base + 6g extra shot = 24g
      const beansDep = depletions!.find((d) => d.ingredientId === 'ing_beans');
      expect(beansDep?.depletedQuantity).toBe(24);
      expect(beansDep?.newStock).toBe(976); // 1000 - 24 = 976

      // Whole milk should be 0 because replaced by oat milk
      const wholeMilkDep = depletions!.find((d) => d.ingredientId === 'ing_milk');
      expect(wholeMilkDep?.depletedQuantity).toBe(0);

      // Oat milk should be 150ml
      const oatMilkDep = depletions!.find((d) => d.ingredientId === 'ing_oat_milk');
      expect(oatMilkDep?.depletedQuantity).toBe(150);
      expect(oatMilkDep?.newStock).toBe(1850); // 2000 - 150 = 1850
    });

    test('Pair 2: Drive-thru plate tag -> KDS bump -> Cashier debt settlement -> Customer regional attribution', async () => {
      // Customer in حي الياسمين
      const customer: Customer = {
        id: 'cust_pair_2',
        name: 'مؤسسة الرياض التقنية',
        phone: '0511111111',
        region: 'حي الياسمين',
        creditLimit: 2000.0,
        currentBalance: 400.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Order created in drive-thru with vehicle plate tag
      const order: Order = {
        id: 'ord_pair_2',
        orderNumber: 302,
        formattedOrderNumber: '#302',
        status: 'NEW_ORDER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'DRIVE_THRU_1',
        tagType: 'VEHICLE',
        tagValue: 'ق م ر 9999',
        customerId: customer.id,
        customerName: customer.name,
        customerRegion: customer.region,
        items: [
          {
            id: 'it_1',
            menuItemId: 'spanish_latte',
            nameAr: 'سبانش لاتيه',
            nameEn: 'Spanish Latte',
            unitPrice: 20,
            quantity: 3,
            size: 'M',
            modifiers: [],
            totalPrice: 60,
          },
        ],
        subtotal: 52.17,
        tax: 7.83,
        total: 60.0,
        paymentStatus: 'UNPAID',
      };

      // KDS prep & bump
      const prep = transitionOrder(order, 'IN_PREPARATION');
      const bump = transitionOrder(prep.order, 'READY_FOR_PICKUP');
      expect(bump.success).toBe(true);

      // Cashier settles via Customer Credit (آجل)
      const debtCheck = chargeCustomerDebt(customer, bump.order.total);
      expect(debtCheck.success).toBe(true);
      expect(debtCheck.newBalance).toBe(460.0); // 400 + 60

      const complete = transitionOrder(bump.order, 'COMPLETED', {
        paymentMethod: 'CUSTOMER_CREDIT',
      });
      expect(complete.success).toBe(true);
      expect(complete.order.paymentMethod).toBe('CUSTOMER_CREDIT');
      expect(complete.order.paymentStatus).toBe('CHARGED_TO_DEBT');
      expect(complete.sideEffects.customerDebtDelta?.amount).toBe(60.0);

      // Verify regional attribution
      const updatedCustomer = { ...customer, currentBalance: debtCheck.newBalance };
      const regionReceivables = filterReceivablesByRegion([updatedCustomer], 'حي الياسمين');
      expect(regionReceivables.totalReceivables).toBe(460.0);
    });

    test('Pair 3: Order bump -> Barista recall -> Cashier ready queue removal', () => {
      // Order in preparation
      const initialOrder: Order = {
        id: 'ord_pair_3',
        orderNumber: 303,
        formattedOrderNumber: '#303',
        status: 'IN_PREPARATION',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        preparationStartedAt: new Date().toISOString(),
        stationId: 'KDS',
        tagType: 'BUZZER',
        tagValue: 'Token #21',
        items: [],
        subtotal: 18,
        tax: 2.7,
        total: 20.7,
        paymentStatus: 'UNPAID',
      };

      // Step 1: Barista bumps order by mistake
      const bumpRes = transitionOrder(initialOrder, 'READY_FOR_PICKUP');
      expect(bumpRes.success).toBe(true);
      const readyOrder = bumpRes.order;

      // Queue state: order appears in cashier ready queue
      let readyQueue = [readyOrder];
      expect(readyQueue.length).toBe(1);

      // Step 2: Barista recalls within 60s
      const recallRes = transitionOrder(readyOrder, 'IN_PREPARATION');
      expect(recallRes.success).toBe(true);
      const restoredOrder = recallRes.order;
      expect(restoredOrder.status).toBe('IN_PREPARATION');

      // Queue state: order is automatically dropped from cashier ready queue
      const activeOrders = [restoredOrder];
      readyQueue = activeOrders.filter((o) => o.status === 'READY_FOR_PICKUP');
      expect(readyQueue.length).toBe(0);
    });

    test('Pair 4: Order completion -> Void order -> BOM stock restoration & customer debt rollback', () => {
      const currentIngredients = getInitialIngredients();
      const customer: Customer = {
        id: 'cust_pair_4',
        name: 'محمد العتيبي',
        phone: '0522222222',
        region: 'حي النرجس',
        creditLimit: 1000.0,
        currentBalance: 200.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const order: Order = {
        id: 'ord_pair_4',
        orderNumber: 304,
        formattedOrderNumber: '#304',
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stationId: 'CASHIER',
        tagType: 'VEHICLE',
        tagValue: 'ن ر ج 3044',
        customerId: customer.id,
        customerName: customer.name,
        customerRegion: customer.region,
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
        paymentMethod: 'CUSTOMER_CREDIT',
        paymentStatus: 'CHARGED_TO_DEBT',
      };

      // Deplete stock and increase debt
      const depletions = calculateOrderBOMDepletion(order, mockRecipes, currentIngredients).depletions;
      for (const d of depletions) {
        currentIngredients[d.ingredientId].currentStock = d.newStock;
      }
      customer.currentBalance = 220.0; // 200 + 20

      expect(currentIngredients['ing_beans'].currentStock).toBe(982); // 1000 - 18
      expect(customer.currentBalance).toBe(220.0);

      // Manager voids completed order
      const voidResult = transitionOrder(order, 'VOIDED', {
        voidReason: 'Defective cup lid spilled drink',
        voidedBy: 'Shift Supervisor',
        recipes: mockRecipes,
        currentIngredients,
      });

      expect(voidResult.success).toBe(true);
      expect(voidResult.order.status).toBe('VOIDED');

      // Verify BOM restoration side-effect
      const restorations = voidResult.sideEffects.inventoryRestorations;
      expect(restorations).toBeTruthy();
      const beanRest = restorations?.find((r) => r.ingredientId === 'ing_beans');
      expect(beanRest?.newStock).toBe(1000); // 982 + 18 = 1000

      // Verify customer debt rollback side-effect
      const debtRollback = voidResult.sideEffects.customerDebtDelta;
      expect(debtRollback).toBeTruthy();
      expect(debtRollback?.amount).toBe(-20.0);
      expect(debtRollback?.action).toBe('REVERSE_DEBT');

      const rolledBackCustomerBalance = customer.currentBalance + debtRollback!.amount;
      expect(rolledBackCustomerBalance).toBe(200.0); // Exact initial balance
    });
  });
}
