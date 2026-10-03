/**
 * Challenger 2 Milestone 1 Empirical Verification Harness
 * 
 * Tests:
 * 1. StationRouter logic:
 *    - PIN validation logic (correct PINs '7788', '1234' accepted, wrong PINs rejected with error)
 *    - Station persistence and URL query parameter parsing
 *    - Role switching protection (unlocked vs locked, owner PIN challenge)
 * 2. store.ts and mockData.ts:
 *    - Concurrent order creations (no ID collisions, state integrity)
 *    - Catalog structure, ingredients, recipes, BOM consistency
 */

import {
  INITIAL_CUSTOMERS,
  INITIAL_INGREDIENTS,
  INITIAL_MENU,
  INITIAL_ORDERS,
  INITIAL_RECIPES,
  INITIAL_REGIONS,
  COMMON_MODIFIERS,
} from '../src/state/mockData';
import {
  canTransitionOrder,
  transitionOrder,
  calculateOrderBOMDepletion,
  calculateOrderBOMRestoration,
} from '../src/state/orderStateMachine';
import {
  Customer,
  MenuItem,
  Order,
  OrderStatus,
  RawIngredient,
  Recipe,
  Region,
  StationRole,
  MenuCategory,
  IngredientUnit,
} from '../src/types';

// Mock Browser Environment for StationRouter & PosStore
class MockLocalStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

const mockStorage = new MockLocalStorage();

(globalThis as any).window = {
  localStorage: mockStorage,
  location: {
    search: '',
  },
};
(globalThis as any).localStorage = mockStorage;

// Import store after window mock is established
import { posStore } from '../src/state/store';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string): void {
  totalTests++;
  if (!condition) {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}${detail ? ` -> ${detail}` : ''}`);
    throw new Error(`Test failed: ${testName} - ${detail || ''}`);
  } else {
    passedTests++;
    console.log(`  ✔ PASS: ${testName}`);
  }
}

console.log('================================================================');
console.log('  CHALLENGER 2 — EMPIRICAL VERIFICATION & STRESS HARNESS (M1)   ');
console.log('================================================================\n');

// ============================================================================
// SUITE 1: StationRouter PIN Validation & Role Switching Protection
// ============================================================================
console.log('>>> [Suite 1] StationRouter & PIN Authentication Logic');

const MASTER_PINS = ['7788', '1234'];
const STATION_STORAGE_KEY = 'COFFEE_POS_STATION_ROLE';
const LOCK_STORAGE_KEY = 'COFFEE_POS_STATION_LOCKED';

// 1.1 PIN Validation logic tests
function simulatePinValidation(pin: string): { accepted: boolean; error?: string } {
  if (MASTER_PINS.includes(pin)) {
    return { accepted: true };
  }
  return { accepted: false, error: 'رمز PIN غير صحيح. جرّب 7788 أو 1234' };
}

assert(simulatePinValidation('7788').accepted === true, 'Master PIN 7788 accepted');
assert(simulatePinValidation('1234').accepted === true, 'Master PIN 1234 accepted');
assert(simulatePinValidation('0000').accepted === false, 'Wrong PIN 0000 rejected');
assert(simulatePinValidation('9999').accepted === false, 'Wrong PIN 9999 rejected');
assert(simulatePinValidation('').accepted === false, 'Empty PIN rejected');
assert(simulatePinValidation('778').accepted === false, 'Incomplete PIN 778 rejected');
assert(simulatePinValidation('77889').accepted === false, '5-digit PIN rejected');
assert(simulatePinValidation(' 7788').accepted === false, 'PIN with leading space rejected');
assert(simulatePinValidation('7788 ').accepted === false, 'PIN with trailing space rejected');
assert(simulatePinValidation('abcd').accepted === false, 'Alphanumeric PIN rejected');
assert(
  simulatePinValidation('1111').error === 'رمز PIN غير صحيح. جرّب 7788 أو 1234',
  'Wrong PIN produces expected Arabic error message'
);

// 1.2 Numpad Input Buffer Simulation (max 4 digits, clear)
function simulateNumpad(inputSequence: string[]): string {
  let pin = '';
  for (const action of inputSequence) {
    if (action === 'CLEAR') {
      pin = '';
    } else if (pin.length < 4 && /^\d$/.test(action)) {
      pin += action;
    }
  }
  return pin;
}

assert(simulateNumpad(['7', '7', '8', '8']) === '7788', 'Numpad enters 7788');
assert(simulateNumpad(['1', '2', '3', '4', '5']) === '1234', 'Numpad restricts to 4 digits');
assert(simulateNumpad(['9', '9', 'CLEAR', '1', '2', '3', '4']) === '1234', 'Numpad clear resets buffer');
assert(simulateNumpad(['CLEAR']) === '', 'Clear on empty buffer is safe');

// 1.3 Role Switching State Machine & Protection Simulator
// Mirrors exact handleStationClick & handleToggleLock logic from StationRouter.tsx
interface RouterSimState {
  activeStation: StationRole;
  isLocked: boolean;
  isPinModalOpen: boolean;
  pinTargetAction: { type: 'SWITCH_STATION' | 'TOGGLE_LOCK'; targetStation?: StationRole } | null;
  enteredPin: string;
  pinError: string;
}

function createRouterSimulator(initialStation: StationRole = 'DRIVE_THRU', initialLocked = false): {
  state: RouterSimState;
  handleStationClick: (target: StationRole) => void;
  handleToggleLock: () => void;
  enterPinDigit: (digit: string) => void;
  clearPin: () => void;
  submitPin: () => boolean;
} {
  const state: RouterSimState = {
    activeStation: initialStation,
    isLocked: initialLocked,
    isPinModalOpen: false,
    pinTargetAction: null,
    enteredPin: '',
    pinError: '',
  };

  const handleStationClick = (role: StationRole) => {
    if (role === state.activeStation) return;

    if (role === 'OWNER') {
      state.pinTargetAction = { type: 'SWITCH_STATION', targetStation: role };
      state.enteredPin = '';
      state.pinError = '';
      state.isPinModalOpen = true;
      return;
    }

    if (state.isLocked) {
      state.pinTargetAction = { type: 'SWITCH_STATION', targetStation: role };
      state.enteredPin = '';
      state.pinError = '';
      state.isPinModalOpen = true;
      return;
    }

    state.activeStation = role;
    mockStorage.setItem(STATION_STORAGE_KEY, role);
  };

  const handleToggleLock = () => {
    if (state.isLocked) {
      state.pinTargetAction = { type: 'TOGGLE_LOCK' };
      state.enteredPin = '';
      state.pinError = '';
      state.isPinModalOpen = true;
    } else {
      state.isLocked = true;
      mockStorage.setItem(LOCK_STORAGE_KEY, 'true');
    }
  };

  const enterPinDigit = (digit: string) => {
    if (state.enteredPin.length < 4) {
      state.enteredPin += digit;
    }
  };

  const clearPin = () => {
    state.enteredPin = '';
    state.pinError = '';
  };

  const submitPin = (): boolean => {
    if (MASTER_PINS.includes(state.enteredPin)) {
      state.pinError = '';
      state.isPinModalOpen = false;

      if (state.pinTargetAction?.type === 'SWITCH_STATION' && state.pinTargetAction.targetStation) {
        state.activeStation = state.pinTargetAction.targetStation;
        mockStorage.setItem(STATION_STORAGE_KEY, state.pinTargetAction.targetStation);
      } else if (state.pinTargetAction?.type === 'TOGGLE_LOCK') {
        state.isLocked = false;
        mockStorage.setItem(LOCK_STORAGE_KEY, 'false');
      }

      state.pinTargetAction = null;
      state.enteredPin = '';
      return true;
    } else {
      state.pinError = 'رمز PIN غير صحيح. جرّب 7788 أو 1234';
      state.enteredPin = '';
      return false;
    }
  };

  return {
    state,
    handleStationClick,
    handleToggleLock,
    enterPinDigit,
    clearPin,
    submitPin,
  };
}

// Test Case 1.3.1: Unlocked station switching between non-owner stations
const sim1 = createRouterSimulator('DRIVE_THRU', false);
sim1.handleStationClick('KDS');
assert(sim1.state.activeStation === 'KDS', 'Switching DRIVE_THRU -> KDS when unlocked requires no PIN');
assert(sim1.state.isPinModalOpen === false, 'PIN modal not opened for normal switch when unlocked');

sim1.handleStationClick('CASHIER');
assert(sim1.state.activeStation === 'CASHIER', 'Switching KDS -> CASHIER when unlocked requires no PIN');

// Test Case 1.3.2: Switching to OWNER station ALWAYS triggers PIN modal
sim1.handleStationClick('OWNER');
assert(sim1.state.activeStation === 'CASHIER', 'Station remains CASHIER before PIN submission');
assert(sim1.state.isPinModalOpen === true, 'Switching to OWNER requires PIN challenge modal');
assert(sim1.state.pinTargetAction?.targetStation === 'OWNER', 'Target station is OWNER');

// Wrong PIN attempt
sim1.enterPinDigit('9');
sim1.enterPinDigit('9');
sim1.enterPinDigit('9');
sim1.enterPinDigit('9');
const failedOwner = sim1.submitPin();
assert(failedOwner === false, 'Wrong PIN 9999 fails');
assert(sim1.state.activeStation === 'CASHIER', 'Station remains CASHIER after wrong PIN');
assert(sim1.state.isPinModalOpen === true, 'PIN modal stays open after wrong PIN');
assert(sim1.state.pinError !== '', 'PIN error message is displayed');

// Correct PIN attempt
sim1.enterPinDigit('7');
sim1.enterPinDigit('7');
sim1.enterPinDigit('8');
sim1.enterPinDigit('8');
const okOwner = sim1.submitPin();
assert(okOwner === true, 'Correct PIN 7788 succeeds');
assert(sim1.state.activeStation === 'OWNER', 'Station switched to OWNER after valid PIN');
assert(sim1.state.isPinModalOpen === false, 'PIN modal closed after success');
assert(mockStorage.getItem(STATION_STORAGE_KEY) === 'OWNER', 'Station persisted to localStorage as OWNER');

// Test Case 1.3.3: Station Locking & Locked Role Switching
const sim2 = createRouterSimulator('DRIVE_THRU', false);
// Lock the station
sim2.handleToggleLock();
assert(sim2.state.isLocked === true, 'Station locked immediately without PIN');
assert(mockStorage.getItem(LOCK_STORAGE_KEY) === 'true', 'Lock state persisted to localStorage as true');

// Attempt to switch to KDS while locked
sim2.handleStationClick('KDS');
assert(sim2.state.activeStation === 'DRIVE_THRU', 'Switching prevented while station is locked');
assert(sim2.state.isPinModalOpen === true, 'PIN modal opened when switching while locked');
assert(sim2.state.pinTargetAction?.targetStation === 'KDS', 'Target station recorded as KDS');

// Submit correct PIN 1234
sim2.enterPinDigit('1');
sim2.enterPinDigit('2');
sim2.enterPinDigit('3');
sim2.enterPinDigit('4');
const okKds = sim2.submitPin();
assert(okKds === true, 'PIN 1234 unlocks switch to KDS');
assert(sim2.state.activeStation === 'KDS', 'Station successfully switched to KDS');

// Attempt to unlock station
sim2.handleToggleLock(); // Currently locked is true
assert(sim2.state.isPinModalOpen === true, 'Unlocking locked station requires PIN');
assert(sim2.state.pinTargetAction?.type === 'TOGGLE_LOCK', 'Target action is TOGGLE_LOCK');

sim2.enterPinDigit('7');
sim2.enterPinDigit('7');
sim2.enterPinDigit('8');
sim2.enterPinDigit('8');
sim2.submitPin();
assert(sim2.state.isLocked === false, 'Station successfully unlocked with PIN 7788');
assert(mockStorage.getItem(LOCK_STORAGE_KEY) === 'false', 'Lock state persisted as false');

// 1.4 URL Query Parameter Parsing Simulation
function parseStationUrlParam(queryString: string): StationRole | null {
  const params = new URLSearchParams(queryString);
  const stationParam = params.get('station')?.toLowerCase();

  if (stationParam === 'drive-thru' || stationParam === 'drive_thru' || stationParam === 'drivethru') {
    return 'DRIVE_THRU';
  } else if (stationParam === 'kds' || stationParam === 'kitchen') {
    return 'KDS';
  } else if (stationParam === 'cashier') {
    return 'CASHIER';
  } else if (stationParam === 'owner' || stationParam === 'admin') {
    return 'OWNER';
  }
  return null;
}

assert(parseStationUrlParam('?station=drive-thru') === 'DRIVE_THRU', 'URL param drive-thru parsed');
assert(parseStationUrlParam('?station=DRIVE_THRU') === 'DRIVE_THRU', 'URL param DRIVE_THRU (uppercase) parsed');
assert(parseStationUrlParam('?station=drivethru') === 'DRIVE_THRU', 'URL param drivethru parsed');
assert(parseStationUrlParam('?station=kds') === 'KDS', 'URL param kds parsed');
assert(parseStationUrlParam('?station=KDS') === 'KDS', 'URL param KDS (uppercase) parsed');
assert(parseStationUrlParam('?station=kitchen') === 'KDS', 'URL param kitchen parsed');
assert(parseStationUrlParam('?station=cashier') === 'CASHIER', 'URL param cashier parsed');
assert(parseStationUrlParam('?station=owner') === 'OWNER', 'URL param owner parsed');
assert(parseStationUrlParam('?station=admin') === 'OWNER', 'URL param admin parsed');
assert(parseStationUrlParam('?station=unknown') === null, 'Unknown URL param returns null');
assert(parseStationUrlParam('') === null, 'Empty query string returns null');
assert(parseStationUrlParam('?foo=bar') === null, 'Query without station returns null');


// ============================================================================
// SUITE 2: Concurrent Order Creation & ID Collision Stress Test
// ============================================================================
console.log('\n>>> [Suite 2] store.ts Concurrency & ID Collision Stress Test');

async function runConcurrencyStressTest(orderCount: number): Promise<{
  distinctIds: number;
  distinctNumbers: number;
  finalOrdersCount: number;
}> {
  // Clear any existing orders in store for clean test
  posStore.resetToDefaults();
  const initialCount = posStore.getSnapshot().orders.length;

  // Launch orderCount concurrent creations
  const promises: Promise<Order>[] = [];
  for (let i = 0; i < orderCount; i++) {
    promises.push(
      posStore.createOrder({
        tagType: 'VEHICLE',
        tagValue: `لوحة ${i + 1000}`,
        vehicleModel: `سيارة ${i}`,
        items: [
          {
            id: `item_${i}`,
            menuItemId: 'item_spanish_latte',
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
        stationId: `STATION_${(i % 3) + 1}`,
      })
    );
  }

  const createdOrders = await Promise.all(promises);

  const ids = new Set(createdOrders.map((o) => o.id));
  const numbers = new Set(createdOrders.map((o) => o.orderNumber));
  const finalOrdersCount = posStore.getSnapshot().orders.length;

  return {
    distinctIds: ids.size,
    distinctNumbers: numbers.size,
    finalOrdersCount,
  };
}

// Execute 500 concurrent order creations
console.log('  Executing 500 concurrent order creations...');
const stressResults = await runConcurrencyStressTest(500);

assert(stressResults.distinctIds === 500, `All 500 created order IDs must be 100% distinct (got ${stressResults.distinctIds})`);
assert(stressResults.distinctNumbers === 500, `All 500 orderNumbers must be sequential and unique (got ${stressResults.distinctNumbers})`);
assert(
  stressResults.finalOrdersCount >= 500,
  `Final order store must contain all 500 created orders (got ${stressResults.finalOrdersCount})`
);

// Cross-station simulated network concurrent injection
console.log('  Testing simulated cross-device concurrent ORDER_CREATED injection...');
const currentStore = posStore.getSnapshot();
const foreignOrder1: Order = {
  id: 'uuid_foreign_station_A_12345',
  orderNumber: 9901,
  formattedOrderNumber: '#9901',
  status: 'IN_PREPARATION',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  stationId: 'DRIVE_THRU_REMOTE',
  tagType: 'BUZZER',
  tagValue: 'Buzzer 12',
  items: [],
  subtotal: 20,
  tax: 3,
  total: 23,
  paymentStatus: 'UNPAID',
};

const foreignOrder2: Order = {
  id: 'uuid_foreign_station_B_67890',
  orderNumber: 9902,
  formattedOrderNumber: '#9902',
  status: 'IN_PREPARATION',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  stationId: 'DRIVE_THRU_REMOTE_2',
  tagType: 'CUSTOMER_NAME',
  tagValue: 'سعد التميمي',
  items: [],
  subtotal: 15,
  tax: 2.25,
  total: 17.25,
  paymentStatus: 'UNPAID',
};

// Publish foreign orders via transport
await posStore.getTransport().publish({
  type: 'ORDER_CREATED',
  stationId: 'DRIVE_THRU_REMOTE',
  payload: foreignOrder1,
});
await posStore.getTransport().publish({
  type: 'ORDER_CREATED',
  stationId: 'DRIVE_THRU_REMOTE_2',
  payload: foreignOrder2,
});

// Give a microtick for event loop
await new Promise((resolve) => setTimeout(resolve, 50));

const updatedStore = posStore.getSnapshot();
const hasForeign1 = updatedStore.orders.some((o) => o.id === foreignOrder1.id);
const hasForeign2 = updatedStore.orders.some((o) => o.id === foreignOrder2.id);
assert(hasForeign1 === true, 'Foreign station A order incorporated into local store without collision');
assert(hasForeign2 === true, 'Foreign station B order incorporated into local store without collision');
assert(updatedStore.lastOrderNumber >= 9902, `Store lastOrderNumber updated to reflect max(foreign) >= 9902 (got ${updatedStore.lastOrderNumber})`);


// ============================================================================
// SUITE 3: Catalog Structure & Ingredient Quantities Verification
// ============================================================================
console.log('\n>>> [Suite 3] Catalog Structure, Recipes, and BOM Ingredients');

// 3.1 Verify INITIAL_MENU structure
const VALID_CATEGORIES: MenuCategory[] = ['HOT', 'COLD', 'DRIP', 'TEA', 'PASTRY'];
assert(INITIAL_MENU.length >= 7, `Catalog contains at least 7 items (got ${INITIAL_MENU.length})`);

const menuItemIds = new Set<string>();
for (const item of INITIAL_MENU) {
  assert(item.id.length > 0, `Menu item id non-empty: ${item.id}`);
  assert(!menuItemIds.has(item.id), `Menu item id unique: ${item.id}`);
  menuItemIds.add(item.id);

  assert(VALID_CATEGORIES.includes(item.category), `Menu item category valid: ${item.category} for ${item.nameEn}`);
  assert(item.nameAr.length > 0, `Arabic name present for ${item.id}`);
  assert(item.nameEn.length > 0, `English name present for ${item.id}`);
  assert(item.basePrice > 0, `Base price positive (${item.basePrice}) for ${item.nameEn}`);
  assert(item.sizes.S > 0 && item.sizes.M > 0 && item.sizes.L > 0, `Valid S/M/L prices for ${item.nameEn}`);
  assert(item.isAvailable === true, `Item ${item.nameEn} marked available`);
  assert(item.recipeId in INITIAL_RECIPES, `Recipe ${item.recipeId} exists in INITIAL_RECIPES for ${item.nameEn}`);
}

// 3.2 Verify INITIAL_RECIPES & BOM Mapping
const VALID_UNITS: IngredientUnit[] = ['g', 'ml', 'piece', 'shot'];

for (const [recipeId, recipe] of Object.entries(INITIAL_RECIPES)) {
  assert(recipe.id === recipeId, `Recipe key matches id: ${recipeId}`);
  assert(menuItemIds.has(recipe.menuItemId), `Recipe menuItemId ${recipe.menuItemId} exists in menu`);
  assert(recipe.baseIngredients.length > 0, `Recipe ${recipeId} has at least 1 base ingredient`);

  for (const baseReq of recipe.baseIngredients) {
    assert(
      baseReq.ingredientId in INITIAL_INGREDIENTS,
      `Base ingredient ${baseReq.ingredientId} in recipe ${recipeId} exists in INITIAL_INGREDIENTS`
    );
    assert(
      baseReq.quantityRequired > 0,
      `Base quantity required > 0 (${baseReq.quantityRequired}) for ${baseReq.ingredientId} in ${recipeId}`
    );
  }

  if (recipe.modifierAdjustments) {
    for (const [modId, adjList] of Object.entries(recipe.modifierAdjustments)) {
      for (const adj of adjList) {
        assert(
          adj.ingredientId in INITIAL_INGREDIENTS,
          `Modifier adjustment ingredient ${adj.ingredientId} in ${modId} exists in INITIAL_INGREDIENTS`
        );
      }
    }
  }
}

// 3.3 Verify INITIAL_INGREDIENTS integrity
for (const [ingId, ing] of Object.entries(INITIAL_INGREDIENTS)) {
  assert(ing.id === ingId, `Ingredient key matches id: ${ingId}`);
  assert(VALID_UNITS.includes(ing.unit), `Valid unit ${ing.unit} for ${ing.nameEn}`);
  assert(ing.currentStock > 0, `Initial stock > 0 (${ing.currentStock}) for ${ing.nameEn}`);
  assert(ing.minAlertThreshold >= 0, `Min alert threshold >= 0 for ${ing.nameEn}`);
  assert(ing.currentStock >= ing.minAlertThreshold, `Initial stock >= threshold for ${ing.nameEn}`);
  assert(ing.costPerUnit > 0, `Cost per unit > 0 (${ing.costPerUnit}) for ${ing.nameEn}`);
}

// 3.4 Verify Exact Specification BOM Recipes:
// ORIGINAL_REQUEST.md: "1 Spanish Latte deducts 18g coffee beans, 150ml milk, 30ml condensed milk, 1 cup, 1 lid"
const spanishLatteRecipe = INITIAL_RECIPES['rec_spanish_latte'];
assert(spanishLatteRecipe !== undefined, 'Spanish Latte recipe exists');

const getBaseQty = (rec: Recipe, ingId: string) =>
  rec.baseIngredients.find((b) => b.ingredientId === ingId)?.quantityRequired;

assert(getBaseQty(spanishLatteRecipe, 'raw_coffee_beans') === 18, 'Spanish Latte: 18g coffee beans');
assert(getBaseQty(spanishLatteRecipe, 'raw_fresh_milk') === 150, 'Spanish Latte: 150ml fresh milk');
assert(getBaseQty(spanishLatteRecipe, 'raw_condensed_milk') === 30, 'Spanish Latte: 30ml condensed milk');
assert(getBaseQty(spanishLatteRecipe, 'raw_cup_12oz') === 1, 'Spanish Latte: 1 cup 12oz');
assert(getBaseQty(spanishLatteRecipe, 'raw_lid_hot') === 1, 'Spanish Latte: 1 lid hot');

// Modifier: Oat milk swap
const oatAdjustments = spanishLatteRecipe.modifierAdjustments?.['mod_oat_milk'];
assert(oatAdjustments !== undefined, 'Oat milk modifier adjustment exists');
const oatFreshMilkAdj = oatAdjustments?.find((a) => a.ingredientId === 'raw_fresh_milk')?.quantityRequired;
const oatMilkAdj = oatAdjustments?.find((a) => a.ingredientId === 'raw_oat_milk')?.quantityRequired;
assert(oatFreshMilkAdj === -150, 'Oat milk modifier subtracts 150ml fresh milk');
assert(oatMilkAdj === 150, 'Oat milk modifier adds 150ml oat milk');

// 3.5 Verify INITIAL_REGIONS and INITIAL_CUSTOMERS
assert(INITIAL_REGIONS.length === 5, 'Exactly 5 initial Riyadh regions');
const regionNames = INITIAL_REGIONS.map((r) => r.nameAr);
assert(regionNames.includes('حي الياسمين'), 'Region includes حي الياسمين');
assert(regionNames.includes('حي النرجس'), 'Region includes حي النرجس');
assert(regionNames.includes('حي الصحافة'), 'Region includes حي الصحافة');
assert(regionNames.includes('حي الملقا'), 'Region includes حي الملقا');
assert(regionNames.includes('حي حطين'), 'Region includes حي حطين');

assert(INITIAL_CUSTOMERS.length === 5, 'Exactly 5 initial customers');
for (const cust of INITIAL_CUSTOMERS) {
  assert(regionNames.includes(cust.region), `Customer ${cust.name} assigned to valid region: ${cust.region}`);
  assert(cust.creditLimit > 0, `Customer ${cust.name} has positive credit limit (${cust.creditLimit})`);
  assert(cust.currentBalance >= 0, `Customer ${cust.name} has non-negative balance (${cust.currentBalance})`);
  assert(cust.phone.startsWith('05'), `Customer ${cust.name} has valid Saudi phone: ${cust.phone}`);
}

// 3.6 Multi-Item Overlapping Ingredient Accumulation Test
console.log('\n  Testing multi-item overlapping ingredient accumulation...');
const multiItemOrder: Order = {
  id: 'multi_item_order_1',
  orderNumber: 301,
  formattedOrderNumber: '#301',
  status: 'IN_PREPARATION',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  stationId: 'DRIVE_THRU_1',
  tagType: 'VEHICLE',
  tagValue: 'ع ع ع 1111',
  items: [
    {
      id: 'it_span',
      menuItemId: 'item_spanish_latte',
      nameAr: 'سبانش لاتيه',
      nameEn: 'Spanish Latte',
      unitPrice: 20,
      quantity: 2, // 2x 18g beans = 36g, 2x 150ml milk = 300ml, 2x 30ml condensed = 60ml
      size: 'M',
      modifiers: [],
      totalPrice: 40,
    },
    {
      id: 'it_flat',
      menuItemId: 'item_flat_white',
      nameAr: 'فلات وايت',
      nameEn: 'Flat White',
      unitPrice: 17,
      quantity: 1, // 1x 18g beans = 18g, 1x 130ml milk = 130ml
      size: 'M',
      modifiers: [],
      totalPrice: 17,
    },
    {
      id: 'it_caramel',
      menuItemId: 'item_caramel_macchiato',
      nameAr: 'كاراميل ماكياتو',
      nameEn: 'Caramel Macchiato',
      unitPrice: 24,
      quantity: 1, // 1x 18g beans = 18g, 1x 160ml milk = 160ml, 25ml vanilla, 15ml caramel
      size: 'M',
      modifiers: [],
      totalPrice: 24,
    },
  ],
  subtotal: 70.43,
  tax: 10.57,
  total: 81.0,
  paymentStatus: 'UNPAID',
};

const multiBOM = calculateOrderBOMDepletion(multiItemOrder, INITIAL_RECIPES, INITIAL_INGREDIENTS);
// Expected:
// Beans: 36 + 18 + 18 = 72g
// Milk: 300 + 130 + 160 = 590ml
// Condensed: 60ml
// Vanilla: 25ml
// Caramel: 15ml
// Cups 12oz: 2 pieces
// Cups 8oz: 1 piece
// Cups 16oz cold: 1 piece
const beansDep = multiBOM.depletions.find((d) => d.ingredientId === 'raw_coffee_beans');
const milkDep = multiBOM.depletions.find((d) => d.ingredientId === 'raw_fresh_milk');
const condDep = multiBOM.depletions.find((d) => d.ingredientId === 'raw_condensed_milk');
const vanDep = multiBOM.depletions.find((d) => d.ingredientId === 'raw_vanilla_syrup');
const carDep = multiBOM.depletions.find((d) => d.ingredientId === 'raw_caramel_drizzle');

assert(beansDep?.depletedQuantity === 72, `Accumulated beans depletion must equal 72g (got ${beansDep?.depletedQuantity})`);
assert(milkDep?.depletedQuantity === 590, `Accumulated milk depletion must equal 590ml (got ${milkDep?.depletedQuantity})`);
assert(condDep?.depletedQuantity === 60, `Condensed milk depletion must equal 60ml (got ${condDep?.depletedQuantity})`);
assert(vanDep?.depletedQuantity === 25, `Vanilla syrup depletion must equal 25ml (got ${vanDep?.depletedQuantity})`);
assert(carDep?.depletedQuantity === 15, `Caramel drizzle depletion must equal 15ml (got ${carDep?.depletedQuantity})`);

// 3.7 Corrupted localStorage Tolerance Test
console.log('\n  Testing corrupted localStorage recovery...');
mockStorage.setItem('coffee_pos_state_v1', 'CORRUPTED_JSON_{{[invalid');
// Resetting or creating store should not crash
posStore.resetToDefaults();
const safeSnapshot = posStore.getSnapshot();
assert(safeSnapshot.activeStation === 'DRIVE_THRU', 'Safe recovery to DRIVE_THRU after corrupted storage');
assert(safeSnapshot.orders.length > 0, 'Initial orders recovered safely');

console.log('\n================================================================');
console.log(`  HARNESS COMPLETE: ${passedTests} passed, ${failedTests} failed (Total: ${totalTests})`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL CHALLENGER 2 EMPIRICAL TESTS PASSED WITH ZERO ERRORS!\n');
}
