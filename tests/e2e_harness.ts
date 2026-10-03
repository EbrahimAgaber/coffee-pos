/**
 * Core E2E Test Harness, Assertion Framework & Domain Simulation Engine
 * for Coffee POS & Kitchen Display System (KDS)
 * 
 * Complies with PROJECT.md, ORIGINAL_REQUEST.md, and TEST_INFRA.md
 */

import {
  canTransitionOrder,
  transitionOrder,
  ALLOWED_TRANSITIONS,
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
  PaymentMethod,
  PaymentSplit,
  DepletionResult,
} from '../src/types';

import { shapeArabic, shapeBidi } from '../../src/utils/arabicShaper';
import { generateZatcaTlvQrString, ZatcaInvoiceData } from '../../src/utils/zatca';

// ============================================================================
// 1. Lightweight Assertion & Test Framework
// ============================================================================

export interface TestCaseResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: Error;
}

export interface TestSuiteResult {
  name: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  durationMs: number;
  results: TestCaseResult[];
}

class TestRegistry {
  public suites: { name: string; fn: () => void | Promise<void> }[] = [];
  public currentSuiteName: string = '';
  public currentTests: { name: string; fn: () => void | Promise<void> }[] = [];
  public suiteResults: TestSuiteResult[] = [];
}

const registry = new TestRegistry();

export function describe(name: string, fn: () => void | Promise<void>): void {
  registry.suites.push({ name, fn });
}

export function test(name: string, fn: () => void | Promise<void>): void {
  registry.currentTests.push({ name, fn });
}

export const it = test;

class Expectation<T> {
  constructor(private actual: T, private isNot: boolean = false) {}

  get not(): Expectation<T> {
    return new Expectation(this.actual, !this.isNot);
  }

  toBe(expected: T): void {
    const pass = this.actual === expected;
    if (this.isNot ? pass : !pass) {
      throw new Error(
        this.isNot
          ? `Expected ${JSON.stringify(this.actual)} NOT to be ${JSON.stringify(expected)}`
          : `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(this.actual)}`
      );
    }
  }

  toEqual(expected: unknown): void {
    const actualStr = JSON.stringify(this.actual);
    const expectedStr = JSON.stringify(expected);
    const pass = actualStr === expectedStr;
    if (this.isNot ? pass : !pass) {
      throw new Error(
        this.isNot
          ? `Expected values NOT to equal ${expectedStr}`
          : `Expected equality:\nExpected: ${expectedStr}\nReceived: ${actualStr}`
      );
    }
  }

  toBeCloseTo(expected: number, numDigits: number = 2): void {
    if (typeof this.actual !== 'number') {
      throw new Error(`Expected number, received ${typeof this.actual}`);
    }
    const diff = Math.abs(this.actual - expected);
    const tolerance = Math.pow(10, -numDigits) / 2;
    if (diff > tolerance) {
      throw new Error(`Expected ${this.actual} to be close to ${expected} (diff: ${diff} > ${tolerance})`);
    }
  }

  toContain(item: unknown): void {
    if (typeof this.actual === 'string') {
      if (!this.actual.includes(String(item))) {
        throw new Error(`Expected string "${this.actual}" to contain "${item}"`);
      }
      return;
    }
    if (Array.isArray(this.actual)) {
      if (!this.actual.includes(item)) {
        throw new Error(`Expected array to contain ${JSON.stringify(item)}`);
      }
      return;
    }
    throw new Error(`toContain only supports strings or arrays`);
  }

  toBeTruthy(): void {
    if (!this.actual) {
      throw new Error(`Expected truthy value, received ${JSON.stringify(this.actual)}`);
    }
  }

  toBeFalsy(): void {
    if (this.actual) {
      throw new Error(`Expected falsy value, received ${JSON.stringify(this.actual)}`);
    }
  }

  toBeGreaterThan(expected: number): void {
    if (typeof this.actual !== 'number' || this.actual <= expected) {
      throw new Error(`Expected ${this.actual} > ${expected}`);
    }
  }

  toBeGreaterThanOrEqual(expected: number): void {
    if (typeof this.actual !== 'number' || this.actual < expected) {
      throw new Error(`Expected ${this.actual} >= ${expected}`);
    }
  }

  toBeLessThan(expected: number): void {
    if (typeof this.actual !== 'number' || this.actual >= expected) {
      throw new Error(`Expected ${this.actual} < ${expected}`);
    }
  }

  toBeLessThanOrEqual(expected: number): void {
    if (typeof this.actual !== 'number' || this.actual > expected) {
      throw new Error(`Expected ${this.actual} <= ${expected}`);
    }
  }

  toMatch(regex: RegExp): void {
    if (typeof this.actual !== 'string' || !regex.test(this.actual)) {
      throw new Error(`Expected "${this.actual}" to match ${regex}`);
    }
  }

  toThrow(expectedMessage?: string | RegExp): void {
    if (typeof this.actual !== 'function') {
      throw new Error(`toThrow requires a function`);
    }
    let threw = false;
    let thrownError: unknown;
    try {
      (this.actual as () => unknown)();
    } catch (err) {
      threw = true;
      thrownError = err;
    }

    if (!threw) {
      throw new Error(`Expected function to throw, but it did not throw.`);
    }

    if (expectedMessage) {
      const msg = thrownError instanceof Error ? thrownError.message : String(thrownError);
      if (typeof expectedMessage === 'string' && !msg.includes(expectedMessage)) {
        throw new Error(`Expected error message to contain "${expectedMessage}", received "${msg}"`);
      } else if (expectedMessage instanceof RegExp && !expectedMessage.test(msg)) {
        throw new Error(`Expected error message to match ${expectedMessage}, received "${msg}"`);
      }
    }
  }
}

export function expect<T>(actual: T): Expectation<T> {
  return new Expectation(actual);
}

// ============================================================================
// 2. Universal Domain Helper Functions & Simulation Utilities
// ============================================================================

/**
 * Menu item pricing calculation helper
 */
export function calculateItemTotal(
  basePrice: number,
  sizeDelta: number,
  modifiers: { priceDelta: number }[],
  quantity: number = 1
): number {
  const modSum = modifiers.reduce((acc, m) => acc + m.priceDelta, 0);
  return (basePrice + sizeDelta + modSum) * quantity;
}

/**
 * KDS elapsed stopwatch formatting (MM:SS)
 */
export function formatStopwatch(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.floor(Math.max(0, seconds) % 60);
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * KDS Urgency Evaluation based on elapsed seconds
 * Green < 3m (0-179s), Yellow 3-5m (180-299s), Red >= 5m (300s+)
 */
export function getKdsUrgency(elapsedSeconds: number): {
  urgency: 'green' | 'yellow' | 'red';
  colorHex: string;
  isPulsating: boolean;
  formattedTime: string;
} {
  const s = Math.max(0, elapsedSeconds);
  const formattedTime = formatStopwatch(s);
  if (s < 180) {
    return { urgency: 'green', colorHex: '#10B981', isPulsating: false, formattedTime };
  }
  if (s < 300) {
    return { urgency: 'yellow', colorHex: '#F59E0B', isPulsating: false, formattedTime };
  }
  return { urgency: 'red', colorHex: '#EF4444', isPulsating: true, formattedTime };
}

/**
 * KDS Bump Undo Window Check (60-second window)
 */
export function canUndoBump(bumpedAtMs: number, currentMs: number): boolean {
  const diffSeconds = (currentMs - bumpedAtMs) / 1000;
  return diffSeconds >= 0 && diffSeconds < 60;
}

/**
 * Cashier Quick-Cash change calculation
 */
export function calculateChange(
  total: number,
  cashTendered: number
): { changeDue: number; isValid: boolean; error?: string } {
  if (cashTendered < 0) {
    return { changeDue: 0, isValid: false, error: 'Negative cash amount is invalid' };
  }
  if (cashTendered === 0 && total > 0) {
    return { changeDue: 0, isValid: false, error: 'Zero cash tendered is invalid' };
  }
  if (cashTendered < total) {
    return { changeDue: 0, isValid: false, error: 'Insufficient cash tendered' };
  }
  const change = Math.round((cashTendered - total) * 100) / 100;
  return { changeDue: change, isValid: true };
}

/**
 * Split Payment Validation
 */
export function validateSplitPayment(
  total: number,
  splits: { method: 'CASH' | 'MADA'; amount: number }[]
): { isValid: boolean; discrepancy: number; error?: string } {
  const sum = splits.reduce((acc, s) => acc + s.amount, 0);
  const diff = Math.round((sum - total) * 100) / 100;
  if (Math.abs(diff) < 0.001) {
    return { isValid: true, discrepancy: 0 };
  }
  return {
    isValid: false,
    discrepancy: diff,
    error: diff > 0 ? `Overpayment by ${diff} SAR` : `Underpayment by ${Math.abs(diff)} SAR`,
  };
}

/**
 * Customer Debt Ledger & Credit Limit Validation
 */
export function chargeCustomerDebt(
  customer: Customer,
  orderTotal: number
): { success: boolean; newBalance: number; error?: string } {
  if (orderTotal <= 0) {
    return { success: false, newBalance: customer.currentBalance, error: 'Order total must be greater than zero' };
  }
  const projectedBalance = Math.round((customer.currentBalance + orderTotal) * 100) / 100;
  if (projectedBalance > customer.creditLimit) {
    return {
      success: false,
      newBalance: customer.currentBalance,
      error: `Credit limit exceeded! Current balance: ${customer.currentBalance} SAR + Order: ${orderTotal} SAR exceeds limit of ${customer.creditLimit} SAR`,
    };
  }
  return { success: true, newBalance: projectedBalance };
}

/**
 * Customer Debt Repayment
 */
export function repayCustomerDebt(
  customer: Customer,
  paymentAmount: number
): { success: boolean; newBalance: number } {
  const newBalance = Math.round((customer.currentBalance - paymentAmount) * 100) / 100;
  return { success: true, newBalance };
}

/**
 * Regional Receivables Filter
 */
export function filterReceivablesByRegion(
  customers: Customer[],
  targetRegion: string
): { totalReceivables: number; matchingCustomers: Customer[] } {
  const matching = customers.filter((c) => c.region === targetRegion);
  const total = matching.reduce((acc, c) => acc + Math.max(0, c.currentBalance), 0);
  return { totalReceivables: Math.round(total * 100) / 100, matchingCustomers: matching };
}

/**
 * Shift X-Report computation (Non-resetting snapshot)
 */
export function generateXReport(
  shift: CashierShift,
  orders: Order[]
): {
  shiftId: string;
  cashierName: string;
  startingCash: number;
  cashSales: number;
  madaSales: number;
  debtSales: number;
  totalSales: number;
  orderCount: number;
  expectedDrawerCash: number;
} {
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
  let cashSales = 0;
  let madaSales = 0;
  let debtSales = 0;

  for (const o of completedOrders) {
    if (o.paymentMethod === 'CASH') {
      cashSales += o.total;
    } else if (o.paymentMethod === 'MADA') {
      madaSales += o.total;
    } else if (o.paymentMethod === 'CUSTOMER_CREDIT') {
      debtSales += o.total;
    } else if (o.paymentMethod === 'SPLIT' && o.paymentSplits) {
      for (const sp of o.paymentSplits) {
        if (sp.method === 'CASH') cashSales += sp.amount;
        if (sp.method === 'MADA') madaSales += sp.amount;
      }
    }
  }

  const expectedDrawerCash = shift.startingCash + cashSales;

  return {
    shiftId: shift.id,
    cashierName: shift.cashierName,
    startingCash: shift.startingCash,
    cashSales: Math.round(cashSales * 100) / 100,
    madaSales: Math.round(madaSales * 100) / 100,
    debtSales: Math.round(debtSales * 100) / 100,
    totalSales: Math.round((cashSales + madaSales + debtSales) * 100) / 100,
    orderCount: completedOrders.length,
    expectedDrawerCash: Math.round(expectedDrawerCash * 100) / 100,
  };
}

/**
 * Shift Z-Report closure computation
 */
export function generateZReport(
  shift: CashierShift,
  orders: Order[],
  actualCashCount: number
): {
  xReport: ReturnType<typeof generateXReport>;
  actualCashCount: number;
  variance: number; // positive = over, negative = short
  status: 'CLOSED';
} {
  const x = generateXReport(shift, orders);
  const variance = Math.round((actualCashCount - x.expectedDrawerCash) * 100) / 100;
  return {
    xReport: x,
    actualCashCount,
    variance,
    status: 'CLOSED',
  };
}

/**
 * 4-digit Master PIN verification
 */
export function verifyMasterPin(inputPin: string): boolean {
  return inputPin === '7788' || inputPin === '1234';
}

/**
 * ESC/POS Receipt Text Generator (58mm = 32 cols, 80mm = 48 cols)
 */
export function generateEscPosReceiptText(
  order: Order,
  paperWidth: '58mm' | '80mm',
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
  lines.push(padLine(`Subtotal:`, `${order.subtotal.toFixed(2)} SAR`, width));
  lines.push(padLine(`15% VAT:`, `${order.tax.toFixed(2)} SAR`, width));
  lines.push(padLine(`TOTAL:`, `${order.total.toFixed(2)} SAR`, width));
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
 * WhatsApp Receipt URL Builder
 */
export function buildWhatsAppReceiptUrl(phoneNumber: string, order: Order): string {
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  const message = `فاتورة كافيه الأفق\nرقم الطلب: ${order.formattedOrderNumber}\nالإجمالي: ${order.total.toFixed(2)} ر.س\nشكراً لزيارتكم!`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * In-Memory Realtime Transport Simulator
 */
export class MockRealtimeTransport {
  private listeners: Map<string, ((envelope: unknown) => void)[]> = new Map();
  public publishedEvents: unknown[] = [];

  async publish(event: { type: string; payload: unknown; stationId: string }): Promise<void> {
    const envelope = {
      id: 'evt_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      syncSource: 'local_memory',
      ...event,
    };
    this.publishedEvents.push(envelope);
    const handlers = this.listeners.get(event.type) || [];
    for (const h of handlers) {
      h(envelope);
    }
  }

  subscribe(eventType: string, handler: (envelope: unknown) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(handler);
    return () => {
      const list = this.listeners.get(eventType) || [];
      this.listeners.set(
        eventType,
        list.filter((h) => h !== handler)
      );
    };
  }

  getTransportName(): 'local_memory' {
    return 'local_memory';
  }
}

// ============================================================================
// 3. Test Runner Execution Engine
// ============================================================================

export async function runAllRegisteredSuites(): Promise<{
  success: boolean;
  totalSuites: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  durationMs: number;
}> {
  const startTime = Date.now();
  registry.suiteResults = [];

  console.log('\n================================================================');
  console.log('  COFFEE POS & KDS — 4-TIER E2E VERIFICATION TEST SUITE RUNNER  ');
  console.log('================================================================\n');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const suite of registry.suites) {
    registry.currentSuiteName = suite.name;
    registry.currentTests = [];

    const suiteStartTime = Date.now();
    await suite.fn();

    const suiteResult: TestSuiteResult = {
      name: suite.name,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      durationMs: 0,
      results: [],
    };

    console.log(`\n\x1b[1m\x1b[36m>>> [SUITE] ${suite.name}\x1b[0m`);

    for (const testCase of registry.currentTests) {
      totalTests++;
      suiteResult.totalTests++;
      const testStart = Date.now();
      try {
        await testCase.fn();
        const duration = Date.now() - testStart;
        passedTests++;
        suiteResult.passedTests++;
        suiteResult.results.push({ name: testCase.name, passed: true, durationMs: duration });
        console.log(`  \x1b[32m✔ PASS\x1b[0m ${testCase.name} (${duration}ms)`);
      } catch (err: unknown) {
        const duration = Date.now() - testStart;
        failedTests++;
        suiteResult.failedTests++;
        const error = err instanceof Error ? err : new Error(String(err));
        suiteResult.results.push({ name: testCase.name, passed: false, durationMs: duration, error });
        console.log(`  \x1b[31m✖ FAIL\x1b[0m ${testCase.name} (${duration}ms)`);
        console.log(`     \x1b[31mError: ${error.message}\x1b[0m`);
        if (error.stack) {
          const lines = error.stack.split('\n').slice(1, 3).join('\n     ');
          console.log(`     \x1b[90m${lines}\x1b[0m`);
        }
      }
    }

    suiteResult.durationMs = Date.now() - suiteStartTime;
    registry.suiteResults.push(suiteResult);
  }

  const totalDurationMs = Date.now() - startTime;

  console.log('\n================================================================');
  console.log('                     VERIFICATION SUMMARY                       ');
  console.log('================================================================');
  console.log(`Total Suites Run : ${registry.suites.length}`);
  console.log(`Total Test Cases : ${totalTests}`);
  console.log(`Passed Tests     : \x1b[32m${passedTests}\x1b[0m`);
  console.log(`Failed Tests     : ${failedTests > 0 ? `\x1b[31m${failedTests}\x1b[0m` : `\x1b[32m0\x1b[0m`}`);
  console.log(`Total Duration   : ${totalDurationMs}ms`);
  console.log('================================================================\n');

  const success = failedTests === 0;
  return {
    success,
    totalSuites: registry.suites.length,
    totalTests,
    passedTests,
    failedTests,
    durationMs: totalDurationMs,
  };
}
