import {
  canTransitionOrder,
  transitionOrder,
  calculateOrderBOMDepletion,
  calculateOrderBOMRestoration,
} from '../src/state/orderStateMachine';
import {
  INITIAL_INGREDIENTS,
  INITIAL_RECIPES,
  INITIAL_CUSTOMERS,
} from '../src/state/mockData';
import { Order, OrderStatus } from '../src/types';
import { RealtimeDeduplicator, createRealtimeEnvelope } from '../src/realtime/transport';
import { BroadcastChannelTransport } from '../src/realtime/broadcastTransport';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('=== Starting Milestone 1 Deterministic Verification ===');

// 1. Test canTransitionOrder rules
console.log('[Test 1] Testing legal and illegal state transitions...');
assert(canTransitionOrder('NEW_ORDER', 'IN_PREPARATION') === true, 'NEW_ORDER -> IN_PREPARATION must be legal');
assert(canTransitionOrder('NEW_ORDER', 'VOIDED') === true, 'NEW_ORDER -> VOIDED must be legal');
assert(canTransitionOrder('NEW_ORDER', 'COMPLETED') === false, 'NEW_ORDER -> COMPLETED must be illegal');
assert(canTransitionOrder('NEW_ORDER', 'READY_FOR_PICKUP') === false, 'NEW_ORDER -> READY_FOR_PICKUP must be illegal');

assert(canTransitionOrder('IN_PREPARATION', 'READY_FOR_PICKUP') === true, 'IN_PREPARATION -> READY_FOR_PICKUP must be legal');
assert(canTransitionOrder('IN_PREPARATION', 'VOIDED') === true, 'IN_PREPARATION -> VOIDED must be legal');
assert(canTransitionOrder('IN_PREPARATION', 'COMPLETED') === false, 'IN_PREPARATION -> COMPLETED must be illegal');

assert(canTransitionOrder('READY_FOR_PICKUP', 'COMPLETED') === true, 'READY_FOR_PICKUP -> COMPLETED must be legal');
assert(canTransitionOrder('READY_FOR_PICKUP', 'IN_PREPARATION') === true, 'READY_FOR_PICKUP -> IN_PREPARATION (recall) must be legal');
assert(canTransitionOrder('READY_FOR_PICKUP', 'VOIDED') === true, 'READY_FOR_PICKUP -> VOIDED must be legal');

assert(canTransitionOrder('COMPLETED', 'VOIDED') === true, 'COMPLETED -> VOIDED must be legal');
assert(canTransitionOrder('COMPLETED', 'IN_PREPARATION') === false, 'COMPLETED -> IN_PREPARATION must be illegal');

assert(canTransitionOrder('VOIDED', 'NEW_ORDER') === false, 'VOIDED is terminal');
assert(canTransitionOrder('VOIDED', 'COMPLETED') === false, 'VOIDED is terminal');
console.log('  -> Passed transition rules.');

// 2. Test transitionOrder execution and timestamps
console.log('[Test 2] Testing transitionOrder execution & prep duration calculation...');
const sampleOrder: Order = {
  id: 'test_ord_1',
  orderNumber: 201,
  formattedOrderNumber: '#201',
  status: 'NEW_ORDER',
  createdAt: '2026-09-04T12:00:00Z',
  updatedAt: '2026-09-04T12:00:00Z',
  stationId: 'DRIVE_THRU_1',
  tagType: 'VEHICLE',
  tagValue: 'أ ب ج 9999',
  items: [
    {
      id: 'it_1',
      menuItemId: 'item_spanish_latte',
      nameAr: 'سبانش لاتيه',
      nameEn: 'Spanish Latte',
      unitPrice: 20,
      quantity: 2,
      size: 'M',
      modifiers: [
        { id: 'mod_oat_milk', category: 'MILK', nameAr: 'حليب شوفان', nameEn: 'Oat Milk', priceDelta: 4 },
        { id: 'mod_extra_shot', category: 'EXTRA_SHOT', nameAr: 'شوت إضافي', nameEn: 'Extra Shot', priceDelta: 4 },
      ],
      totalPrice: 56,
    },
  ],
  subtotal: 48.7,
  tax: 7.3,
  total: 56.0,
  paymentStatus: 'UNPAID',
};

// Transition NEW_ORDER -> IN_PREPARATION
const res1 = transitionOrder(sampleOrder, 'IN_PREPARATION', { timestamp: '2026-09-04T12:01:00Z' });
assert(res1.success === true, 'Transition to IN_PREPARATION should succeed');
assert(res1.order.status === 'IN_PREPARATION', 'Order status should be IN_PREPARATION');
assert(res1.order.preparationStartedAt === '2026-09-04T12:01:00Z', 'preparationStartedAt should be set');

// Transition IN_PREPARATION -> READY_FOR_PICKUP
const res2 = transitionOrder(res1.order, 'READY_FOR_PICKUP', { timestamp: '2026-09-04T12:03:30Z' });
assert(res2.success === true, 'Transition to READY_FOR_PICKUP should succeed');
assert(res2.order.status === 'READY_FOR_PICKUP', 'Order status should be READY_FOR_PICKUP');
assert(res2.order.readyAt === '2026-09-04T12:03:30Z', 'readyAt should be set');
// 2m30s elapsed = 150 seconds
assert(res2.order.prepDurationSeconds === 150, `prepDurationSeconds should be 150, got ${res2.order.prepDurationSeconds}`);
console.log(`  -> Passed prep duration: ${res2.order.prepDurationSeconds}s.`);

// 3. Test transitionOrder READY_FOR_PICKUP -> COMPLETED with BOM Depletion & Customer Credit
console.log('[Test 3] Testing BOM Depletion on COMPLETED...');
const initialStock = { ...INITIAL_INGREDIENTS };
const cust = INITIAL_CUSTOMERS[0]; // خالد العتيبي (balance 120, limit 500)

const res3 = transitionOrder(res2.order, 'COMPLETED', {
  timestamp: '2026-09-04T12:04:00Z',
  paymentMethod: 'CUSTOMER_CREDIT',
  customerId: cust.id,
  customerName: cust.name,
  customerRegion: cust.region,
  recipes: INITIAL_RECIPES,
  currentIngredients: initialStock,
});

assert(res3.success === true, 'Transition to COMPLETED should succeed');
assert(res3.order.status === 'COMPLETED', 'Order status should be COMPLETED');
assert(res3.order.paymentStatus === 'CHARGED_TO_DEBT', 'Payment status should be CHARGED_TO_DEBT');
assert(res3.sideEffects.customerDebtDelta?.amount === 56.0, 'Customer debt delta should equal total 56.0');

// Verify BOM Depletion for 2x Spanish Latte with oat milk and extra shot:
// Base per item: 18g beans, 150ml milk, 30ml condensed milk, 1 cup 12oz, 1 lid hot
// Modifiers: oat milk (-150ml fresh milk, +150ml oat milk), extra shot (+9g beans)
// Total per item: 27g beans, 0ml fresh milk, 150ml oat milk, 30ml condensed milk, 1 cup, 1 lid
// For 2 items: 54g beans, 0ml fresh milk, 300ml oat milk, 60ml condensed milk, 2 cups, 2 lids
const depletions = res3.sideEffects.inventoryDepletions || [];
const beansDep = depletions.find((d) => d.ingredientId === 'raw_coffee_beans');
assert(beansDep !== undefined && beansDep.depletedQuantity === 54, `Beans depletion must be 54g, got ${beansDep?.depletedQuantity}`);

const oatDep = depletions.find((d) => d.ingredientId === 'raw_oat_milk');
assert(oatDep !== undefined && oatDep.depletedQuantity === 300, `Oat milk depletion must be 300ml, got ${oatDep?.depletedQuantity}`);

const freshMilkDep = depletions.find((d) => d.ingredientId === 'raw_fresh_milk');
assert(freshMilkDep === undefined || freshMilkDep.depletedQuantity === 0, 'Fresh milk depletion must be 0 due to oat milk modifier');

console.log('  -> Passed BOM Depletion calculations.');

// 4. Test Void Reversal of COMPLETED Order
console.log('[Test 4] Testing Stock & Debt Reversal on VOIDED...');
const res4 = transitionOrder(res3.order, 'VOIDED', {
  timestamp: '2026-09-04T12:05:00Z',
  voidReason: 'Customer requested cancellation',
  voidedBy: 'المشرف',
  recipes: INITIAL_RECIPES,
  currentIngredients: initialStock,
});

assert(res4.success === true, 'Voiding COMPLETED order should succeed');
assert(res4.order.status === 'VOIDED', 'Order status should be VOIDED');
assert(res4.sideEffects.customerDebtDelta?.action === 'REVERSE_DEBT', 'Should trigger debt reversal');
assert(res4.sideEffects.customerDebtDelta?.amount === -56.0, 'Debt reversal should be -56.0');

const restorations = res4.sideEffects.inventoryRestorations || [];
const beansRestored = restorations.find((r) => r.ingredientId === 'raw_coffee_beans');
assert(beansRestored !== undefined && beansRestored.depletedQuantity === -54, 'Beans restoration should be -54g');
console.log('  -> Passed Stock & Debt reversal on VOIDED.');

// 5. Test Realtime Deduplicator
console.log('[Test 5] Testing Realtime Deduplicator...');
const deduplicator = new RealtimeDeduplicator(10);
assert(deduplicator.trackAndCheckIsNew('evt_1') === true, 'evt_1 is new');
assert(deduplicator.trackAndCheckIsNew('evt_1') === false, 'evt_1 duplicate must be rejected');
assert(deduplicator.trackAndCheckIsNew('evt_2') === true, 'evt_2 is new');
assert(deduplicator.trackAndCheckIsNew('evt_1') === false, 'evt_1 duplicate must still be rejected');
console.log('  -> Passed Deduplication test.');

console.log('=== All Milestone 1 Unit Tests Passed Successfully! ===');
