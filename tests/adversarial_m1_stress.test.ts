/**
 * Challenger M1 Adversarial Stress Test Harness
 * 
 * Conducts rigorous empirical verification of Milestone 1 components:
 * 1. Order State Machine:
 *    - All 17 illegal state transitions (out of 25 pairs) + invalid status types
 *    - Immutability of order state and side-effects on rejected transitions
 *    - Preparation duration edge cases (clock skew, fallback to createdAt, recall reset)
 * 2. Inventory Depletion & BOM Engine:
 *    - Zero quantity requirements & empty ingredient recipes
 *    - Unmapped/missing recipes
 *    - Multi-item overlapping ingredient depletion
 *    - Negative modifier adjustments (milk swaps)
 *    - Stock underflow protection (non-negative stock clamping)
 *    - Alert generation at/below minAlertThreshold
 *    - Full stock restoration on VOIDED from COMPLETED
 *    - Zero restoration on premature VOIDED (NEW_ORDER, IN_PREPARATION, READY_FOR_PICKUP)
 * 3. Customer Debt Ledger:
 *    - Debt increase on COMPLETED with CUSTOMER_CREDIT
 *    - Non-debt methods (CASH, MADA, SPLIT)
 *    - Debt reversal on VOIDED from COMPLETED
 *    - Non-reversal on VOIDED from cash or premature orders
 *    - Zero-amount orders and customerId inheritance
 * 4. Realtime Transport & Deduplication:
 *    - 100 identical UUID stress test
 *    - Deduplicator FIFO capacity eviction & clear
 *    - Strict subscriber dispatch ordering (FIFO)
 *    - Subscriber cleanup & set deletion
 *    - Resilience to throwing subscribers
 *    - Idempotent unsubscription
 *    - Incoming duplicate filtering & malformed envelope tolerance
 */

import {
  canTransitionOrder,
  transitionOrder,
  calculateOrderBOMDepletion,
  calculateOrderBOMRestoration,
  ALLOWED_TRANSITIONS,
} from '../src/state/orderStateMachine';
import {
  Order,
  OrderStatus,
  OrderItem,
  Recipe,
  RawIngredient,
  Customer,
  RealtimeEnvelope,
  RealtimeEventType,
} from '../src/types';
import { RealtimeDeduplicator, createRealtimeEnvelope } from '../src/realtime/transport';
import { BroadcastChannelTransport } from '../src/realtime/broadcastTransport';
import {
  INITIAL_INGREDIENTS,
  INITIAL_RECIPES,
  INITIAL_CUSTOMERS,
} from '../src/state/mockData';

let testCount = 0;
let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string): void {
  testCount++;
  if (!condition) {
    failCount++;
    console.error(`  ❌ FAIL: ${testName}${detail ? ` -> ${detail}` : ''}`);
    throw new Error(`Test failed: ${testName}`);
  } else {
    passCount++;
    console.log(`  ✔ PASS: ${testName}`);
  }
}

console.log('================================================================');
console.log('       ADVERSARIAL STRESS TEST HARNESS — MILESTONE 1           ');
console.log('================================================================\n');

// ============================================================================
// SECTION 1: Exhaustive State Transition Stress Matrix
// ============================================================================
console.log('>>> Domain 1: Order State Machine Transitions & Matrix Invariance');

const ALL_STATUSES: OrderStatus[] = [
  'NEW_ORDER',
  'IN_PREPARATION',
  'READY_FOR_PICKUP',
  'COMPLETED',
  'VOIDED',
];

const LEGAL_PAIRS = new Set<string>([
  'NEW_ORDER->IN_PREPARATION',
  'NEW_ORDER->VOIDED',
  'IN_PREPARATION->READY_FOR_PICKUP',
  'IN_PREPARATION->VOIDED',
  'READY_FOR_PICKUP->COMPLETED',
  'READY_FOR_PICKUP->IN_PREPARATION',
  'READY_FOR_PICKUP->VOIDED',
  'COMPLETED->VOIDED',
]);

const baseOrder: Order = {
  id: 'adv_ord_01',
  orderNumber: 501,
  formattedOrderNumber: '#501',
  status: 'NEW_ORDER',
  createdAt: '2026-09-04T12:00:00.000Z',
  updatedAt: '2026-09-04T12:00:00.000Z',
  stationId: 'DRIVE_THRU_1',
  tagType: 'VEHICLE',
  tagValue: 'د ص ق 7777',
  items: [],
  subtotal: 30.0,
  tax: 4.5,
  total: 34.5,
  paymentStatus: 'UNPAID',
};

// 1.1 Verify all 25 pairs in canTransitionOrder
for (const from of ALL_STATUSES) {
  for (const to of ALL_STATUSES) {
    const pair = `${from}->${to}`;
    const shouldBeLegal = LEGAL_PAIRS.has(pair);
    const result = canTransitionOrder(from, to);
    assert(
      result === shouldBeLegal,
      `canTransitionOrder: ${pair}`,
      `Expected ${shouldBeLegal} but received ${result}`
    );
  }
}

// 1.2 Verify transitionOrder behavior on all 17 illegal transitions
let illegalCount = 0;
for (const from of ALL_STATUSES) {
  for (const to of ALL_STATUSES) {
    const pair = `${from}->${to}`;
    if (!LEGAL_PAIRS.has(pair)) {
      illegalCount++;
      const currentOrder: Order = {
        ...baseOrder,
        id: `ord_${from}_${to}`,
        status: from,
      };
      const orderSnapshot = JSON.stringify(currentOrder);

      const transResult = transitionOrder(currentOrder, to);
      assert(
        transResult.success === false,
        `transitionOrder rejects ${pair}`,
        `Expected success=false`
      );
      assert(
        typeof transResult.error === 'string' && transResult.error.length > 0,
        `transitionOrder error message on ${pair}`,
        `Error string was: ${transResult.error}`
      );
      assert(
        JSON.stringify(transResult.order) === orderSnapshot,
        `Order immutability preserved on illegal ${pair}`,
        `Original order modified!`
      );
      assert(
        Object.keys(transResult.sideEffects).length === 0,
        `Side-effects empty on illegal ${pair}`
      );
    }
  }
}
assert(illegalCount === 17, `Verified exactly 17 illegal transition pairs tested (got ${illegalCount})`);

// 1.3 Unknown/corrupted status strings
const invalidStatusCases = ['UNKNOWN', '', 'COMPLETED_REFUNDED', null, undefined];
for (const invalid of invalidStatusCases) {
  const canResult = canTransitionOrder(invalid as any, 'COMPLETED');
  assert(canResult === false, `canTransitionOrder handles invalid status '${invalid}' safely`);

  const mockOrder: Order = { ...baseOrder, status: invalid as any };
  const transResult = transitionOrder(mockOrder, 'COMPLETED');
  assert(transResult.success === false, `transitionOrder handles invalid status '${invalid}' safely`);
}

// 1.4 Timing edge cases: Clock skew / past timestamp
const timedOrder: Order = {
  ...baseOrder,
  status: 'IN_PREPARATION',
  createdAt: '2026-09-04T12:00:00.000Z',
  preparationStartedAt: '2026-09-04T12:05:00.000Z',
};

// Ready timestamp is earlier than preparationStartedAt (clock skew)
const skewedResult = transitionOrder(timedOrder, 'READY_FOR_PICKUP', {
  timestamp: '2026-09-04T12:04:00.000Z', // 1 minute in the past!
});
assert(skewedResult.success === true, 'Ready transition succeeds despite clock skew');
assert(
  skewedResult.order.prepDurationSeconds === 0,
  'prepDurationSeconds clamped to 0 under clock skew (non-negative)',
  `Got ${skewedResult.order.prepDurationSeconds}`
);

// Fallback to createdAt when preparationStartedAt is missing
const missingPrepTimeOrder: Order = {
  ...baseOrder,
  status: 'IN_PREPARATION',
  createdAt: '2026-09-04T12:00:00.000Z',
  preparationStartedAt: undefined,
};
const fallbackResult = transitionOrder(missingPrepTimeOrder, 'READY_FOR_PICKUP', {
  timestamp: '2026-09-04T12:02:30.000Z',
});
assert(fallbackResult.success === true, 'Transition with missing prepStartedAt succeeds');
assert(
  fallbackResult.order.prepDurationSeconds === 150,
  'prepDurationSeconds accurately falls back to createdAt (150s)'
);

// Recall from READY_FOR_PICKUP back to IN_PREPARATION wipes readyAt and duration
const recallResult = transitionOrder(fallbackResult.order, 'IN_PREPARATION', {
  timestamp: '2026-09-04T12:02:45.000Z',
});
assert(recallResult.success === true, 'Recall from READY_FOR_PICKUP to IN_PREPARATION succeeds');
assert(recallResult.order.readyAt === undefined, 'readyAt is deleted on recall');
assert(recallResult.order.prepDurationSeconds === undefined, 'prepDurationSeconds is deleted on recall');
assert(
  recallResult.order.preparationStartedAt !== undefined,
  'preparationStartedAt is preserved on recall'
);


// ============================================================================
// SECTION 2: Inventory Depletion & BOM Engine Adversarial Cases
// ============================================================================
console.log('\n>>> Domain 2: Inventory Depletion & BOM Calculations Edge Cases');

const testIngredients: Record<string, RawIngredient> = {
  ing_beans: {
    id: 'ing_beans',
    nameAr: 'بن إسبريسو',
    nameEn: 'Espresso Beans',
    sku: 'B-01',
    unit: 'g',
    currentStock: 100,
    minAlertThreshold: 20,
    costPerUnit: 0.1,
  },
  ing_milk: {
    id: 'ing_milk',
    nameAr: 'حليب كامل',
    nameEn: 'Milk',
    sku: 'M-01',
    unit: 'ml',
    currentStock: 500,
    minAlertThreshold: 100,
    costPerUnit: 0.01,
  },
  ing_oat_milk: {
    id: 'ing_oat_milk',
    nameAr: 'حليب شوفان',
    nameEn: 'Oat Milk',
    sku: 'OM-01',
    unit: 'ml',
    currentStock: 300,
    minAlertThreshold: 50,
    costPerUnit: 0.02,
  },
  ing_cup: {
    id: 'ing_cup',
    nameAr: 'كوب ورقي',
    nameEn: 'Paper Cup',
    sku: 'C-01',
    unit: 'piece',
    currentStock: 10,
    minAlertThreshold: 15, // Already low stock initially!
    costPerUnit: 0.5,
  },
};

const testRecipes: Record<string, Recipe> = {
  rec_latte: {
    id: 'rec_latte',
    menuItemId: 'item_latte',
    nameAr: 'لاتيه',
    nameEn: 'Latte',
    baseIngredients: [
      { ingredientId: 'ing_beans', quantityRequired: 18 },
      { ingredientId: 'ing_milk', quantityRequired: 150 },
      { ingredientId: 'ing_cup', quantityRequired: 1 },
    ],
    modifierAdjustments: {
      mod_oat: [
        { ingredientId: 'ing_milk', quantityRequired: -150 },
        { ingredientId: 'ing_oat_milk', quantityRequired: 150 },
      ],
      mod_double_shot: [
        { ingredientId: 'ing_beans', quantityRequired: 18 },
      ],
    },
  },
  rec_cortado: {
    id: 'rec_cortado',
    menuItemId: 'item_cortado',
    nameAr: 'كورتادو',
    nameEn: 'Cortado',
    baseIngredients: [
      { ingredientId: 'ing_beans', quantityRequired: 18 },
      { ingredientId: 'ing_milk', quantityRequired: 60 },
      { ingredientId: 'ing_cup', quantityRequired: 1 },
    ],
  },
  rec_zero_req: {
    id: 'rec_zero_req',
    menuItemId: 'item_water',
    nameAr: 'ماء نقي',
    nameEn: 'Pure Water',
    baseIngredients: [
      { ingredientId: 'ing_beans', quantityRequired: 0 },
    ],
  },
  rec_empty: {
    id: 'rec_empty',
    menuItemId: 'item_package',
    nameAr: 'خدمة تغليف',
    nameEn: 'Packaging Service',
    baseIngredients: [],
  },
};

// 2.1 Zero Recipe Requirements and Empty Base Ingredients
const zeroReqOrder: Order = {
  ...baseOrder,
  status: 'READY_FOR_PICKUP',
  items: [
    {
      id: 'i_zero',
      menuItemId: 'item_water',
      nameAr: 'ماء نقي',
      nameEn: 'Pure Water',
      unitPrice: 5,
      quantity: 3,
      totalPrice: 15,
    },
    {
      id: 'i_empty',
      menuItemId: 'item_package',
      nameAr: 'خدمة تغليف',
      nameEn: 'Packaging Service',
      unitPrice: 2,
      quantity: 1,
      totalPrice: 2,
    },
  ],
};

const zeroDepResult = calculateOrderBOMDepletion(zeroReqOrder, testRecipes, testIngredients);
assert(Array.isArray(zeroDepResult.depletions), 'Zero req depletion returns array');
const beansZeroDep = zeroDepResult.depletions.find((d) => d.ingredientId === 'ing_beans');
assert(beansZeroDep !== undefined, 'Ingredient with 0 requirement is mapped');
assert(beansZeroDep!.depletedQuantity === 0, 'Depleted quantity is 0 for 0-requirement item');
assert(beansZeroDep!.newStock === 100, 'New stock equals previous stock');

// 2.2 Unmapped item without recipe
const unmappedOrder: Order = {
  ...baseOrder,
  status: 'READY_FOR_PICKUP',
  items: [
    {
      id: 'i_unmapped',
      menuItemId: 'item_unregistered_mystery_drink',
      nameAr: 'مشروب غير مسجل',
      nameEn: 'Mystery Drink',
      unitPrice: 25,
      quantity: 2,
      totalPrice: 50,
    },
  ],
};
const unmappedDepResult = calculateOrderBOMDepletion(unmappedOrder, testRecipes, testIngredients);
assert(unmappedDepResult.depletions.length === 0, 'Unmapped recipe generates 0 depletions without crashing');

// 2.3 Multiple items with shared ingredients and modifier adjustments
const multiItemOrder: Order = {
  ...baseOrder,
  status: 'READY_FOR_PICKUP',
  items: [
    // 2x Latte with Oat Milk and Double Shot
    // Beans: 2 * (18 + 18) = 72g
    // Milk: 2 * (150 - 150) = 0ml
    // Oat Milk: 2 * 150 = 300ml
    // Cup: 2 * 1 = 2
    {
      id: 'i_latte_2',
      menuItemId: 'item_latte',
      nameAr: 'لاتيه',
      nameEn: 'Latte',
      unitPrice: 22,
      quantity: 2,
      modifiers: [
        { id: 'mod_oat', category: 'MILK', nameAr: 'حليب شوفان', nameEn: 'Oat Milk', priceDelta: 4 },
        { id: 'mod_double_shot', category: 'EXTRA_SHOT', nameAr: 'دبل شوت', nameEn: 'Double Shot', priceDelta: 4 },
      ],
      totalPrice: 60,
    },
    // 1x Cortado
    // Beans: 1 * 18 = 18g
    // Milk: 1 * 60 = 60ml
    // Cup: 1 * 1 = 1
    {
      id: 'i_cortado_1',
      menuItemId: 'item_cortado',
      nameAr: 'كورتادو',
      nameEn: 'Cortado',
      unitPrice: 16,
      quantity: 1,
      totalPrice: 16,
    },
  ],
};

const multiDepResult = calculateOrderBOMDepletion(multiItemOrder, testRecipes, testIngredients);
// Total expected:
// Beans: 72 + 18 = 90g (prev 100 -> new 10)
// Milk: 0 + 60 = 60ml (prev 500 -> new 440)
// Oat Milk: 300ml (prev 300 -> new 0)
// Cup: 2 + 1 = 3 (prev 10 -> new 7)
const depBeans = multiDepResult.depletions.find((d) => d.ingredientId === 'ing_beans');
assert(depBeans?.depletedQuantity === 90, 'Accumulated beans across items equals 90g');
assert(depBeans?.newStock === 10, 'Beans newStock is 10g');
assert(depBeans?.isLowStock === true, 'Beans flagged as low stock (10 <= 20 threshold)');

const depMilk = multiDepResult.depletions.find((d) => d.ingredientId === 'ing_milk');
assert(depMilk?.depletedQuantity === 60, 'Net milk across items is 60ml (oat substitution worked)');
assert(depMilk?.newStock === 440, 'Milk newStock is 440ml');

const depOat = multiDepResult.depletions.find((d) => d.ingredientId === 'ing_oat_milk');
assert(depOat?.depletedQuantity === 300, 'Oat milk depletion is 300ml');
assert(depOat?.newStock === 0, 'Oat milk stock depleted to exact 0');
assert(depOat?.isLowStock === true, 'Oat milk marked low stock at 0');

const depCup = multiDepResult.depletions.find((d) => d.ingredientId === 'ing_cup');
assert(depCup?.depletedQuantity === 3, 'Cup depletion across items is 3 pieces');
assert(depCup?.newStock === 7, 'Cup newStock is 7 pieces');

// 2.4 Stock underflow protection (stock clamping to 0)
const underflowOrder: Order = {
  ...baseOrder,
  status: 'READY_FOR_PICKUP',
  items: [
    {
      id: 'i_huge',
      menuItemId: 'item_latte',
      nameAr: 'لاتيه كبير',
      nameEn: 'Latte',
      unitPrice: 20,
      quantity: 50, // Demands 50 * 18 = 900g beans (stock is only 100g)
      totalPrice: 1000,
    },
  ],
};
const underflowDep = calculateOrderBOMDepletion(underflowOrder, testRecipes, testIngredients);
const underflowBeans = underflowDep.depletions.find((d) => d.ingredientId === 'ing_beans');
assert(underflowBeans?.newStock === 0, 'Stock cannot drop below zero (clamped to 0)');
assert(underflowBeans?.depletedQuantity === 900, 'depletedQuantity reflects required amount 900g');
assert(underflowBeans?.isLowStock === true, 'Marked as low stock');

// 2.5 Inventory Restoration on VOID of COMPLETED order
const completedOrderResult = transitionOrder(multiItemOrder, 'COMPLETED', {
  timestamp: '2026-09-04T12:10:00.000Z',
  paymentMethod: 'CASH',
  recipes: testRecipes,
  currentIngredients: testIngredients,
});
assert(completedOrderResult.success === true, 'Transition to COMPLETED succeeds');
assert(
  completedOrderResult.sideEffects.inventoryDepletions?.length === 4,
  '4 ingredients depleted on COMPLETED'
);

// Simulate stock being updated after completion
const updatedIngredientsAfterComp: Record<string, RawIngredient> = {
  ing_beans: { ...testIngredients.ing_beans, currentStock: 10 },
  ing_milk: { ...testIngredients.ing_milk, currentStock: 440 },
  ing_oat_milk: { ...testIngredients.ing_oat_milk, currentStock: 0 },
  ing_cup: { ...testIngredients.ing_cup, currentStock: 7 },
};

// Now VOID the completed order
const voidCompletedResult = transitionOrder(completedOrderResult.order, 'VOIDED', {
  timestamp: '2026-09-04T12:12:00.000Z',
  voidReason: 'Mistake order',
  voidedBy: 'Supervisor',
  recipes: testRecipes,
  currentIngredients: updatedIngredientsAfterComp,
});
assert(voidCompletedResult.success === true, 'VOID of COMPLETED order succeeds');
const restorations = voidCompletedResult.sideEffects.inventoryRestorations || [];
assert(restorations.length === 4, '4 ingredients restored on VOID');

const restoredBeans = restorations.find((r) => r.ingredientId === 'ing_beans');
assert(restoredBeans?.previousStock === 10, 'Restoration previousStock is 10g');
assert(restoredBeans?.depletedQuantity === -90, 'Restoration depletedQuantity is negative (-90g)');
assert(restoredBeans?.newStock === 100, 'Restored stock recovers back to 100g');

const restoredOat = restorations.find((r) => r.ingredientId === 'ing_oat_milk');
assert(restoredOat?.newStock === 300, 'Oat milk stock restored back to 300ml');

// 2.6 Premature VOID must NEVER reverse inventory
const prematureOrder1 = { ...baseOrder, status: 'NEW_ORDER' as OrderStatus };
const voidPremature1 = transitionOrder(prematureOrder1, 'VOIDED', {
  recipes: testRecipes,
  currentIngredients: testIngredients,
});
assert(
  voidPremature1.sideEffects.inventoryRestorations === undefined,
  'VOID of NEW_ORDER does NOT trigger inventory restoration'
);

const prematureOrder2 = { ...baseOrder, status: 'IN_PREPARATION' as OrderStatus };
const voidPremature2 = transitionOrder(prematureOrder2, 'VOIDED', {
  recipes: testRecipes,
  currentIngredients: testIngredients,
});
assert(
  voidPremature2.sideEffects.inventoryRestorations === undefined,
  'VOID of IN_PREPARATION does NOT trigger inventory restoration'
);

const prematureOrder3 = { ...baseOrder, status: 'READY_FOR_PICKUP' as OrderStatus };
const voidPremature3 = transitionOrder(prematureOrder3, 'VOIDED', {
  recipes: testRecipes,
  currentIngredients: testIngredients,
});
assert(
  voidPremature3.sideEffects.inventoryRestorations === undefined,
  'VOID of READY_FOR_PICKUP does NOT trigger inventory restoration'
);


// ============================================================================
// SECTION 3: Customer Debt Balance Adjustments
// ============================================================================
console.log('\n>>> Domain 3: Customer Debt Balance Adjustments & Reversals');

const debtCustomer: Customer = {
  id: 'cust_adv_01',
  name: 'عبدالله السبيعي',
  phone: '0555555555',
  region: 'حي النرجس',
  creditLimit: 1000,
  currentBalance: 250,
};

const debtOrder: Order = {
  ...baseOrder,
  id: 'ord_debt_test',
  status: 'READY_FOR_PICKUP',
  customerId: debtCustomer.id,
  customerName: debtCustomer.name,
  customerRegion: debtCustomer.region,
  total: 85.5,
};

// 3.1 Settle with CUSTOMER_CREDIT
const debtCompleted = transitionOrder(debtOrder, 'COMPLETED', {
  paymentMethod: 'CUSTOMER_CREDIT',
});
assert(debtCompleted.success === true, 'COMPLETED with CUSTOMER_CREDIT succeeds');
assert(debtCompleted.order.paymentStatus === 'CHARGED_TO_DEBT', 'Status is CHARGED_TO_DEBT');
assert(debtCompleted.sideEffects.customerDebtDelta !== undefined, 'customerDebtDelta is created');
assert(
  debtCompleted.sideEffects.customerDebtDelta?.action === 'ADD_DEBT',
  'Debt action is ADD_DEBT'
);
assert(
  debtCompleted.sideEffects.customerDebtDelta?.amount === 85.5,
  'Debt delta amount matches order total 85.5'
);
assert(
  debtCompleted.sideEffects.customerDebtDelta?.customerId === debtCustomer.id,
  'Debt delta customerId matches'
);

// 3.2 Settle with CASH (No debt delta)
const cashCompleted = transitionOrder(debtOrder, 'COMPLETED', {
  paymentMethod: 'CASH',
  cashTendered: 100,
  changeDue: 14.5,
});
assert(cashCompleted.order.paymentStatus === 'PAID', 'Status is PAID for CASH');
assert(
  cashCompleted.sideEffects.customerDebtDelta === undefined,
  'No customerDebtDelta when paying with CASH'
);

// 3.3 Voiding order with debt charged -> triggers REVERSE_DEBT
const voidDebtResult = transitionOrder(debtCompleted.order, 'VOIDED', {
  voidReason: 'Customer returned items',
  voidedBy: 'Cashier 1',
});
assert(voidDebtResult.success === true, 'VOID of debt-charged order succeeds');
assert(
  voidDebtResult.sideEffects.customerDebtDelta !== undefined,
  'VOID of debt-charged order triggers customerDebtDelta'
);
assert(
  voidDebtResult.sideEffects.customerDebtDelta?.action === 'REVERSE_DEBT',
  'Debt action is REVERSE_DEBT'
);
assert(
  voidDebtResult.sideEffects.customerDebtDelta?.amount === -85.5,
  'Debt delta amount is negative total -85.5'
);

// 3.4 Voiding order paid by CASH -> NO debt reversal
const voidCashResult = transitionOrder(cashCompleted.order, 'VOIDED', {
  voidReason: 'Wrong order',
});
assert(
  voidCashResult.sideEffects.customerDebtDelta === undefined,
  'VOID of CASH-paid order does NOT trigger debt reversal'
);

// 3.5 Voiding an unpaid order in READY_FOR_PICKUP -> NO debt reversal
const voidUnpaidResult = transitionOrder(debtOrder, 'VOIDED', {
  voidReason: 'Abandoned',
});
assert(
  voidUnpaidResult.sideEffects.customerDebtDelta === undefined,
  'VOID of UNPAID order does NOT trigger debt reversal'
);

// 3.6 Edge cases: 0.00 total and customerId inheritance
const zeroTotalOrder: Order = {
  ...debtOrder,
  id: 'ord_zero_total',
  total: 0.0,
  customerId: debtCustomer.id,
};
const zeroDebtComp = transitionOrder(zeroTotalOrder, 'COMPLETED', {
  paymentMethod: 'CUSTOMER_CREDIT',
});
assert(
  zeroDebtComp.sideEffects.customerDebtDelta?.amount === 0.0,
  'Zero total order produces 0.0 debt delta without error'
);

// Customer ID provided in options overrides/populates order
const noCustIdOrder: Order = {
  ...baseOrder,
  status: 'READY_FOR_PICKUP',
  customerId: undefined,
  total: 40.0,
};
const optionCustResult = transitionOrder(noCustIdOrder, 'COMPLETED', {
  paymentMethod: 'CUSTOMER_CREDIT',
  customerId: 'cust_override_99',
  customerName: 'سارة',
});
assert(
  optionCustResult.order.customerId === 'cust_override_99',
  'customerId from options populated on order'
);
assert(
  optionCustResult.sideEffects.customerDebtDelta?.customerId === 'cust_override_99',
  'customerDebtDelta has overridden customerId'
);


// ============================================================================
// SECTION 4: Realtime Transport & Deduplication Stress
// ============================================================================
console.log('\n>>> Domain 4: Realtime Transport & Deduplication Stress');

// 4.1 RealtimeDeduplicator: 100 Identical UUIDs Stress Test
const deduplicator = new RealtimeDeduplicator(500);
const fixedUuid = 'uuid-stress-test-fixed-001';

let acceptedCount = 0;
let rejectedCount = 0;

for (let i = 0; i < 100; i++) {
  if (deduplicator.trackAndCheckIsNew(fixedUuid)) {
    acceptedCount++;
  } else {
    rejectedCount++;
  }
}
assert(acceptedCount === 1, 'Exactly 1 of 100 identical UUIDs accepted');
assert(rejectedCount === 99, 'Exactly 99 of 100 identical UUIDs rejected as duplicates');

// 4.2 Capacity eviction FIFO stress test
const tinyDedup = new RealtimeDeduplicator(3);
assert(tinyDedup.trackAndCheckIsNew('id_A') === true, 'id_A is new');
assert(tinyDedup.trackAndCheckIsNew('id_B') === true, 'id_B is new');
assert(tinyDedup.trackAndCheckIsNew('id_C') === true, 'id_C is new');
assert(tinyDedup.trackAndCheckIsNew('id_A') === false, 'id_A duplicate rejected before eviction');

// Adding 4th element evicts id_A (capacity = 3)
assert(tinyDedup.trackAndCheckIsNew('id_D') === true, 'id_D is new (triggers eviction of oldest id_A)');
// Now id_A is evicted from memory, so tracking it again treats it as new
assert(tinyDedup.trackAndCheckIsNew('id_A') === true, 'id_A accepted after FIFO eviction');
// But id_C and id_D should still be tracked
assert(tinyDedup.trackAndCheckIsNew('id_D') === false, 'id_D duplicate still rejected');

// Clear resets state
tinyDedup.clear();
assert(tinyDedup.trackAndCheckIsNew('id_D') === true, 'id_D is accepted after clear()');

// 4.3 BroadcastChannelTransport Subscriber Management & Ordering
const transport = new BroadcastChannelTransport('stress_test_channel');

const dispatchOrderLog: string[] = [];

const unsubA = transport.subscribe('ORDER_CREATED', (env) => {
  dispatchOrderLog.push(`Handler_A:${env.id}`);
});

const unsubB = transport.subscribe('ORDER_CREATED', (env) => {
  dispatchOrderLog.push(`Handler_B:${env.id}`);
});

const unsubC = transport.subscribe('ORDER_CREATED', (env) => {
  dispatchOrderLog.push(`Handler_C:${env.id}`);
});

// Publish test event
await transport.publish({
  type: 'ORDER_CREATED',
  stationId: 'TEST_STATION',
  payload: { test: true },
});

assert(dispatchOrderLog.length === 3, 'All 3 subscribers invoked');
assert(
  dispatchOrderLog[0].startsWith('Handler_A') &&
  dispatchOrderLog[1].startsWith('Handler_B') &&
  dispatchOrderLog[2].startsWith('Handler_C'),
  'Subscribers invoked strictly in FIFO registration order [A, B, C]'
);

// 4.4 Subscriber Cleanup / Unsubscribe
dispatchOrderLog.length = 0; // Clear log
unsubB(); // Unsubscribe middle handler

await transport.publish({
  type: 'ORDER_CREATED',
  stationId: 'TEST_STATION',
  payload: { test: 2 },
});

assert(dispatchOrderLog.length === 2, 'Only 2 subscribers invoked after unsubscribing B');
assert(
  dispatchOrderLog[0].startsWith('Handler_A') &&
  dispatchOrderLog[1].startsWith('Handler_C'),
  'Remaining subscribers invoked in order [A, C]'
);

// Unsubscribe remaining handlers
unsubA();
unsubC();
dispatchOrderLog.length = 0;

await transport.publish({
  type: 'ORDER_CREATED',
  stationId: 'TEST_STATION',
  payload: { test: 3 },
});
assert(dispatchOrderLog.length === 0, 'No subscribers invoked after all unsubscribe');

// Idempotent unsubscribe (calling again does not throw)
let threwUnsub = false;
try {
  unsubA();
  unsubB();
  unsubC();
} catch (e) {
  threwUnsub = true;
}
assert(threwUnsub === false, 'Repeated unsubscription calls are idempotent and safe');

// 4.5 Subscriber Error Resilience
let resilientHandlerCalled = false;
const badUnsub = transport.subscribe('STOCK_UPDATED', () => {
  throw new Error('Explosion in faulty subscriber');
});
const goodUnsub = transport.subscribe('STOCK_UPDATED', () => {
  resilientHandlerCalled = true;
});

await transport.publish({
  type: 'STOCK_UPDATED',
  stationId: 'TEST_STATION',
  payload: { stock: 0 },
});

assert(resilientHandlerCalled === true, 'Faulty subscriber error does not halt subsequent subscribers');
badUnsub();
goodUnsub();

// 4.6 Incoming Duplicate Envelope Handling via handleIncomingEnvelope
let incomingCallCount = 0;
const testIncomingUnsub = transport.subscribe('ORDER_BUMPED', () => {
  incomingCallCount++;
});

const mockIncomingEnvelope: RealtimeEnvelope = {
  id: 'dup_incoming_uuid_999',
  type: 'ORDER_BUMPED',
  timestamp: new Date().toISOString(),
  stationId: 'KDS_STATION',
  payload: { orderId: 'ord_123' },
  syncSource: 'broadcast_channel',
};

// Simulate incoming envelopes through internal handler
(transport as any).handleIncomingEnvelope(mockIncomingEnvelope);
(transport as any).handleIncomingEnvelope(mockIncomingEnvelope); // Duplicate
(transport as any).handleIncomingEnvelope(mockIncomingEnvelope); // Duplicate

assert(incomingCallCount === 1, 'Duplicate incoming envelope strictly executed only once');
testIncomingUnsub();

// 4.7 Malformed Envelope Immunity
let malformedThrew = false;
try {
  (transport as any).handleIncomingEnvelope(null);
  (transport as any).handleIncomingEnvelope(undefined);
  (transport as any).handleIncomingEnvelope({});
  (transport as any).handleIncomingEnvelope({ id: 'no_type' });
  (transport as any).handleIncomingEnvelope({ type: 'ORDER_BUMPED' }); // no id
} catch (e) {
  malformedThrew = true;
}
assert(malformedThrew === false, 'Malformed/null incoming envelopes gracefully ignored');

// 4.8 Transport Close
transport.close();
assert(transport.getTransportName() === 'broadcast_channel', 'Transport name is broadcast_channel');

console.log('\n================================================================');
console.log(`STRESS TEST SUMMARY: ${passCount} passed, ${failCount} failed (Total: ${testCount})`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL EMPIRICAL ADVERSARIAL CHALLENGES PASSED!');
}
