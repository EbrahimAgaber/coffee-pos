/**
 * Milestone 2 Verification Suite: Drive-Thru Rapid Ordering & KDS Station
 */

import { chimeSynth } from '../src/audio/chimeSynth';
import { formatStopwatch, getKdsUrgency } from '../src/stations/KdsStation';
import { posStore } from '../src/state/store';
import { canUndoBump, calculateItemTotal } from './e2e_harness';
import { Order, OrderStatus } from '../src/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${msg}`);
    process.exit(1);
  }
}

async function runM2Verification() {
  console.log('=== Starting Milestone 2 Verification ===');

  // Test 1: Chime Synthesizer
  console.log('[Test 1] Testing Web Audio Chime Synthesizer...');
  assert(typeof chimeSynth.playNewOrderChime === 'function', 'playNewOrderChime must be defined');
  assert(typeof chimeSynth.playBumpChime === 'function', 'playBumpChime must be defined');
  assert(typeof chimeSynth.toggleMute === 'function', 'toggleMute must be defined');
  const initialMute = chimeSynth.getMuted();
  const toggledMute = chimeSynth.toggleMute();
  assert(toggledMute === !initialMute, 'toggleMute should toggle boolean');
  chimeSynth.setMuted(initialMute); // restore
  // In Node/CLI audio context might be dummy/undefined, method shouldn't throw:
  chimeSynth.playNewOrderChime();
  chimeSynth.playBumpChime();
  console.log('  -> Chime Synthesizer tests passed.');

  // Test 2: KDS Stopwatch & Urgency Classification
  console.log('[Test 2] Testing KDS Stopwatch and Color Urgency Classification...');
  assert(formatStopwatch(0) === '00:00', '0s should format to 00:00');
  assert(formatStopwatch(75) === '01:15', '75s should format to 01:15');
  assert(formatStopwatch(179) === '02:59', '179s should format to 02:59');
  assert(formatStopwatch(305) === '05:05', '305s should format to 05:05');

  const green = getKdsUrgency(179);
  assert(green.urgency === 'green' && !green.isPulsating && green.colorHex === '#10B981', '179s must be green');

  const yellow = getKdsUrgency(180);
  assert(yellow.urgency === 'yellow' && !yellow.isPulsating && yellow.colorHex === '#F59E0B', '180s must be yellow');

  const yellowEnd = getKdsUrgency(299);
  assert(yellowEnd.urgency === 'yellow' && !yellowEnd.isPulsating, '299s must be yellow');

  const red = getKdsUrgency(300);
  assert(red.urgency === 'red' && red.isPulsating && red.colorHex === '#EF4444', '300s must be red pulsating');

  const extremeRed = getKdsUrgency(999);
  assert(extremeRed.urgency === 'red' && extremeRed.isPulsating, '999s must be red pulsating');
  console.log('  -> KDS Stopwatch and Urgency tests passed.');

  // Test 3: KDS 60-second Undo Window
  console.log('[Test 3] Testing KDS 60-second Bump Undo Window...');
  const now = Date.now();
  assert(canUndoBump(now, now) === true, 'Immediate undo must be valid');
  assert(canUndoBump(now, now + 30000) === true, '30s undo must be valid');
  assert(canUndoBump(now, now + 59900) === true, '59.9s undo must be valid');
  assert(canUndoBump(now, now + 60000) === false, 'Exact 60.0s undo must expire');
  assert(canUndoBump(now, now + 65000) === false, '65s undo must be rejected');
  console.log('  -> 60-second Undo window tests passed.');

  // Test 4: Customizer Pricing Math
  console.log('[Test 4] Testing Customizer Item Pricing & Modifier Deltas...');
  // Spanish Latte (Base 20 SAR) + Large (+3 SAR) + Oat Milk (+3 SAR) + Extra Shot (+4 SAR) + Vanilla Syrup (+3 SAR) = 33 SAR
  const customizedItemTotal = calculateItemTotal(
    20, // basePrice
    3,  // sizeDelta
    [
      { priceDelta: 3 }, // Oat Milk
      { priceDelta: 4 }, // Extra Shot
      { priceDelta: 3 }, // Vanilla Syrup
    ],
    2   // quantity
  );
  assert(customizedItemTotal === 66, '2x Customized drinks total must be 66 SAR');
  console.log('  -> Customizer pricing math passed.');

  // Test 5: End-to-End Order Creation (Drive-Thru -> KDS Bump -> KDS Recall)
  console.log('[Test 5] Testing End-to-End Order Flow: Drive-Thru -> Store -> KDS Bump -> Recall...');
  const initialOrderCount = posStore.getSnapshot().orders.length;

  const newOrder = await posStore.createOrder({
    stationId: 'DRIVE_THRU',
    attendantName: 'مباشر السيارات 1',
    tagType: 'VEHICLE',
    tagValue: 'أ ب ج 1234',
    vehicleModel: 'تويوتا كامري بيضاء',
    items: [
      {
        id: 'test_item_1',
        menuItemId: 'item_spanish_latte',
        nameAr: 'سبانش لاتيه',
        nameEn: 'Spanish Latte',
        unitPrice: 23,
        quantity: 1,
        size: 'L',
        modifiers: [
          {
            id: 'mod_oat_milk',
            category: 'MILK',
            nameAr: 'حليب شوفان',
            nameEn: 'Oat Milk',
            priceDelta: 3,
          },
        ],
        totalPrice: 26,
      },
    ],
    subtotal: 26,
    tax: 3.9,
    total: 29.9,
    paymentStatus: 'UNPAID',
    status: 'NEW_ORDER' as OrderStatus,
  });

  assert(newOrder.status === 'NEW_ORDER', 'Order must be created in NEW_ORDER status');
  assert(posStore.getSnapshot().orders.length === initialOrderCount + 1, 'Store order count must increment');

  // Barista bumps order from NEW_ORDER -> transitions through IN_PREPARATION to READY_FOR_PICKUP
  const bumpResult = await posStore.bumpOrder(newOrder.id);
  assert(bumpResult.success === true, 'Bump order must succeed');
  assert(bumpResult.order.status === 'READY_FOR_PICKUP', 'Bumped order must be READY_FOR_PICKUP');

  // Barista recalls order within 60s
  const recallResult = await posStore.recallOrder(newOrder.id);
  assert(recallResult.success === true, 'Recall order must succeed');
  assert(recallResult.order.status === 'IN_PREPARATION', 'Recalled order must return to IN_PREPARATION');

  console.log('  -> End-to-End Order Flow tests passed.');

  console.log('=== All Milestone 2 Verification Tests Passed Successfully! ===');
}

runM2Verification().catch((err) => {
  console.error('M2 Verification failed:', err);
  process.exit(1);
});
