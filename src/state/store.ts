import {
  CashierShift,
  Customer,
  CustomerLedgerEntry,
  MenuItem,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentSplit,
  RawIngredient,
  Recipe,
  Region,
  StationRole,
  WorkMovementLogItem,
  ConnectedDeviceItem,
  StoreSettings,
} from '../types';
import {
  INITIAL_CUSTOMERS,
  INITIAL_INGREDIENTS,
  INITIAL_MENU,
  INITIAL_ORDERS,
  INITIAL_RECIPES,
  INITIAL_REGIONS,
  INITIAL_MOVEMENT_LOGS,
} from './mockData';
import {
  canTransitionOrder,
  transitionOrder,
  TransitionResult,
} from './orderStateMachine';
import { IRealtimeTransport } from '../types';
import { SupabaseRealtimeTransport } from '../realtime/supabaseTransport';
import { useSyncExternalStore } from 'react';
import {
  getActiveLicenseKey,
  validateLicenseKey,
  getOrCreateDeviceId,
  getDeviceCustomName,
  saveActiveLicenseKey,
  LicenseValidationResult,
  setDeviceCustomName,
} from '../licensing/licenseManager';

export interface PosState {
  activeStation: StationRole;
  orders: Order[];
  ingredients: Record<string, RawIngredient>;
  recipes: Record<string, Recipe>;
  customers: Customer[];
  customerLedger: CustomerLedgerEntry[];
  regions: Region[];
  menu: MenuItem[];
  currentShift: CashierShift;
  stockAlerts: string[];
  lastOrderNumber: number;
  movementLogs: WorkMovementLogItem[];
  connectedDevices: Record<string, ConnectedDeviceItem>;
  activeLicenseKey: string;
  licenseValidation: LicenseValidationResult;
  deviceId: string;
  deviceName: string;
  storeSettings: StoreSettings;
}

const STORAGE_KEY = 'coffee_pos_state_v1';

function getInitialState(): PosState {
  const currentDevId = getOrCreateDeviceId();
  const currentDevName = getDeviceCustomName();
  const licenseKey = getActiveLicenseKey();
  const licenseVal = validateLicenseKey(licenseKey);

  const initialDevices: Record<string, ConnectedDeviceItem> = {
    [currentDevId]: {
      deviceId: currentDevId,
      deviceName: currentDevName,
      role: 'DRIVE_THRU',
      lastPingMs: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      isCurrentDevice: true,
    },
  };

  const defaultStoreSettings: StoreSettings = {
    storeName: licenseVal.payload?.shopName || 'مقهى البارستا الذكي',
    storeNameEn: 'Smart Barista Cafe',
    vatNumber: '310123456700003',
    phone: '0501234567',
    address: 'الرياض، المملكة العربية السعودية',
    currency: 'ر.س',
    taxRate: 0.15,
    masterPin: '1234',
  };

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          // Guarantee fresh references
          activeStation: parsed.activeStation || 'DRIVE_THRU',
          orders: Array.isArray(parsed.orders)
            ? (parsed.storeSettings?.isProductionMode ? parsed.orders : (parsed.orders.length > 0 ? parsed.orders : INITIAL_ORDERS))
            : INITIAL_ORDERS,
          ingredients: parsed.ingredients || INITIAL_INGREDIENTS,
          recipes: parsed.recipes || INITIAL_RECIPES,
          customers: parsed.customers || INITIAL_CUSTOMERS,
          customerLedger: parsed.customerLedger || [],
          regions: parsed.regions || INITIAL_REGIONS,
          menu: parsed.menu || INITIAL_MENU,
          stockAlerts: parsed.stockAlerts || [],
          lastOrderNumber: typeof parsed.lastOrderNumber === 'number' ? parsed.lastOrderNumber : 102,
          movementLogs: Array.isArray(parsed.movementLogs)
            ? (parsed.storeSettings?.isProductionMode ? parsed.movementLogs : (parsed.movementLogs.length > 0 ? parsed.movementLogs : INITIAL_MOVEMENT_LOGS))
            : INITIAL_MOVEMENT_LOGS,
          connectedDevices: initialDevices,
          activeLicenseKey: licenseKey,
          licenseValidation: licenseVal,
          deviceId: currentDevId,
          deviceName: currentDevName,
          storeSettings: parsed.storeSettings || defaultStoreSettings,
          currentShift: parsed.currentShift || {
            id: 'shift_today_1',
            cashierId: 'cashier_1',
            cashierName: 'الكاشير المناوب',
            openedAt: new Date().toISOString(),
            startingCash: 500,
            cashSales: 0,
            madaSales: 0,
            creditSales: 0,
            totalSales: 0,
            orderCount: 0,
            expectedCash: 500,
            status: 'OPEN',
          },
        };
      }
    } catch (e) {
      console.warn('[PosStore] Failed to load cached state, loading initial defaults:', e);
    }
  }

  return {
    activeStation: 'DRIVE_THRU',
    orders: INITIAL_ORDERS,
    ingredients: INITIAL_INGREDIENTS,
    recipes: INITIAL_RECIPES,
    customers: INITIAL_CUSTOMERS,
    customerLedger: [],
    regions: INITIAL_REGIONS,
    menu: INITIAL_MENU,
    stockAlerts: [],
    lastOrderNumber: 102,
    movementLogs: INITIAL_MOVEMENT_LOGS,
    connectedDevices: initialDevices,
    activeLicenseKey: licenseKey,
    licenseValidation: licenseVal,
    deviceId: currentDevId,
    deviceName: currentDevName,
    storeSettings: defaultStoreSettings,
    currentShift: {
      id: 'shift_today_1',
      cashierId: 'cashier_1',
      cashierName: 'الكاشير المناوب',
      openedAt: new Date().toISOString(),
      startingCash: 500,
      cashSales: 0,
      madaSales: 0,
      creditSales: 0,
      totalSales: 0,
      orderCount: 0,
      expectedCash: 500,
      status: 'OPEN',
    },
  };
}

class PosStoreManager {
  private state: PosState;
  private listeners = new Set<() => void>();
  private transport: IRealtimeTransport;

  constructor() {
    this.state = getInitialState();
    this.transport = new SupabaseRealtimeTransport();
    this.setupRealtimeListeners();
  }

  private saveState(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        console.warn('[PosStore] Failed to save state to localStorage:', e);
      }
    }
  }

  private emitChange(): void {
    this.saveState();
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('[PosStore] Listener error:', e);
      }
    });
  }

  private setupRealtimeListeners(): void {
    // 1. ORDER_CREATED
    this.transport.subscribe<Order>('ORDER_CREATED', (envelope) => {
      const incomingOrder = envelope.payload;
      if (!incomingOrder || !incomingOrder.id) return;

      const exists = this.state.orders.some((o) => o.id === incomingOrder.id);
      if (!exists) {
        this.state = {
          ...this.state,
          orders: [incomingOrder, ...this.state.orders],
          lastOrderNumber: Math.max(this.state.lastOrderNumber, incomingOrder.orderNumber),
        };
        this.emitChange();
      }
    });

    // 2. ORDER_STATUS_CHANGED / ORDER_BUMPED / ORDER_COMPLETED / ORDER_CANCELLED
    const handleOrderUpdate = (envelope: { payload: Order }) => {
      const updated = envelope.payload;
      if (!updated || !updated.id) return;

      const currentIdx = this.state.orders.findIndex((o) => o.id === updated.id);
      if (currentIdx !== -1) {
        const currentOrder = this.state.orders[currentIdx];
        if (new Date(updated.updatedAt).getTime() >= new Date(currentOrder.updatedAt).getTime()) {
          const newOrders = [...this.state.orders];
          newOrders[currentIdx] = updated;
          this.state = { ...this.state, orders: newOrders };
          this.emitChange();
        }
      } else {
        this.state = {
          ...this.state,
          orders: [updated, ...this.state.orders],
        };
        this.emitChange();
      }
    };

    this.transport.subscribe<Order>('ORDER_STATUS_CHANGED', handleOrderUpdate);
    this.transport.subscribe<Order>('ORDER_BUMPED', handleOrderUpdate);
    this.transport.subscribe<Order>('ORDER_COMPLETED', handleOrderUpdate);
    this.transport.subscribe<Order>('ORDER_CANCELLED', handleOrderUpdate);

    // 3. STOCK_UPDATED
    this.transport.subscribe<{ ingredients: Record<string, RawIngredient> }>('STOCK_UPDATED', (envelope) => {
      if (envelope.payload?.ingredients) {
        this.state = {
          ...this.state,
          ingredients: { ...this.state.ingredients, ...envelope.payload.ingredients },
        };
        this.emitChange();
      }
    });

    // 4. CUSTOMER_CREDIT_UPDATED
    this.transport.subscribe<CustomerLedgerEntry>('CUSTOMER_CREDIT_UPDATED', (envelope) => {
      const entry = envelope.payload;
      if (!entry || !entry.customerId) return;

      const custIndex = this.state.customers.findIndex((c) => c.id === entry.customerId);
      if (custIndex !== -1) {
        const updatedCust = {
          ...this.state.customers[custIndex],
          currentBalance: entry.runningBalance,
          updatedAt: entry.date,
        };
        const updatedList = [...this.state.customers];
        updatedList[custIndex] = updatedCust;

        const ledgerExists = this.state.customerLedger.some((l) => l.id === entry.id);
        const newLedger = ledgerExists ? this.state.customerLedger : [entry, ...this.state.customerLedger];

        this.state = {
          ...this.state,
          customers: updatedList,
          customerLedger: newLedger,
        };
        this.emitChange();
      }
    });

    // 5. WORK_MOVEMENT_LOG
    this.transport.subscribe<WorkMovementLogItem>('WORK_MOVEMENT_LOG', (envelope) => {
      const log = envelope.payload;
      if (!log || !log.id) return;
      if (!this.state.movementLogs.some((m) => m.id === log.id)) {
        this.state = {
          ...this.state,
          movementLogs: [log, ...this.state.movementLogs].slice(0, 100),
        };
        this.emitChange();
      }
    });

    // 6. DEVICE_HEARTBEAT
    this.transport.subscribe<ConnectedDeviceItem>('DEVICE_HEARTBEAT', (envelope) => {
      const dev = envelope.payload;
      if (!dev || !dev.deviceId) return;
      const isCurrent = dev.deviceId === this.state.deviceId;
      this.state = {
        ...this.state,
        connectedDevices: {
          ...this.state.connectedDevices,
          [dev.deviceId]: {
            ...dev,
            lastPingMs: Date.now(),
            isCurrentDevice: isCurrent,
          },
        },
      };
      this.emitChange();
    });

    // 7. LICENSE_UPDATED
    this.transport.subscribe<{ licenseKey: string }>('LICENSE_UPDATED', (envelope) => {
      if (envelope.payload?.licenseKey) {
        const val = validateLicenseKey(envelope.payload.licenseKey);
        this.state = {
          ...this.state,
          activeLicenseKey: envelope.payload.licenseKey,
          licenseValidation: val,
        };
        this.emitChange();
      }
    });

    // 8. STORE_SETTINGS_UPDATED
    this.transport.subscribe<StoreSettings>('STORE_SETTINGS_UPDATED', (envelope) => {
      if (envelope.payload) {
        this.state = {
          ...this.state,
          storeSettings: { ...this.state.storeSettings, ...envelope.payload },
        };
        this.emitChange();
      }
    });

    // 9. MENU_UPDATED
    this.transport.subscribe<MenuItem[]>('MENU_UPDATED', (envelope) => {
      if (Array.isArray(envelope.payload)) {
        this.state = {
          ...this.state,
          menu: envelope.payload,
        };
        this.emitChange();
      }
    });

    // Start heartbeat interval
    if (typeof window !== 'undefined') {
      setTimeout(() => this.broadcastHeartbeat(), 500);
      setInterval(() => {
        this.broadcastHeartbeat();
        this.pruneStaleDevices();
      }, 8000);
    }
  }

  public getSnapshot = (): PosState => {
    return this.state;
  };

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getTransport(): IRealtimeTransport {
    return this.transport;
  }

  // --- ACTIONS ---

  public broadcastHeartbeat(): void {
    const currentDevice: ConnectedDeviceItem = {
      deviceId: this.state.deviceId,
      deviceName: this.state.deviceName,
      role: this.state.activeStation,
      lastPingMs: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      isCurrentDevice: true,
    };

    this.state = {
      ...this.state,
      connectedDevices: {
        ...this.state.connectedDevices,
        [this.state.deviceId]: currentDevice,
      },
    };
    this.emitChange();

    this.transport.publish<ConnectedDeviceItem>({
      type: 'DEVICE_HEARTBEAT',
      stationId: this.state.activeStation,
      payload: currentDevice,
    }).catch(() => {});
  }

  public pruneStaleDevices(): void {
    const now = Date.now();
    const threshold = 35000; // 35 seconds
    let changed = false;
    const updated: Record<string, ConnectedDeviceItem> = {};

    for (const [id, dev] of Object.entries(this.state.connectedDevices)) {
      if (dev.isCurrentDevice || now - dev.lastPingMs < threshold) {
        updated[id] = dev;
      } else {
        changed = true;
      }
    }

    if (changed) {
      this.state = { ...this.state, connectedDevices: updated };
      this.emitChange();
    }
  }

  public removeConnectedDevice(targetDeviceId: string): void {
    if (!this.state.connectedDevices[targetDeviceId]) return;
    const updated = { ...this.state.connectedDevices };
    delete updated[targetDeviceId];
    this.state = { ...this.state, connectedDevices: updated };
    this.emitChange();
  }

  public async recordMovementLog(item: Omit<WorkMovementLogItem, 'id' | 'timestamp' | 'deviceName'>): Promise<void> {
    const fullItem: WorkMovementLogItem = {
      ...item,
      id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      deviceName: this.state.deviceName,
    };

    this.state = {
      ...this.state,
      movementLogs: [fullItem, ...this.state.movementLogs].slice(0, 100),
    };
    this.emitChange();

    await this.transport.publish<WorkMovementLogItem>({
      type: 'WORK_MOVEMENT_LOG',
      stationId: this.state.activeStation,
      payload: fullItem,
    });
  }

  public setCustomDeviceName(name: string): void {
    setDeviceCustomName(name);
    this.state = { ...this.state, deviceName: name };
    this.emitChange();
    this.broadcastHeartbeat();
  }

  public async updateLicenseKey(keyStr: string): Promise<LicenseValidationResult> {
    const result = saveActiveLicenseKey(keyStr);
    const updatedStoreSettings = { ...this.state.storeSettings };
    if (result.payload?.shopName) {
      updatedStoreSettings.storeName = result.payload.shopName;
    }
    this.state = {
      ...this.state,
      activeLicenseKey: keyStr,
      licenseValidation: result,
      storeSettings: updatedStoreSettings,
    };
    this.emitChange();

    if (result.isValid && !result.isExpired) {
      await this.transport.publish<{ licenseKey: string }>({
        type: 'LICENSE_UPDATED',
        stationId: this.state.activeStation,
        payload: { licenseKey: keyStr },
      });
    }
    return result;
  }

  public async saveLicenseKey(keyStr: string): Promise<LicenseValidationResult> {
    return this.updateLicenseKey(keyStr);
  }

  public async updateStoreSettings(settings: Partial<StoreSettings>): Promise<void> {
    const updated = {
      ...this.state.storeSettings,
      ...settings,
    };
    this.state = {
      ...this.state,
      storeSettings: updated,
    };
    this.emitChange();

    await this.transport.publish<StoreSettings>({
      type: 'STORE_SETTINGS_UPDATED',
      stationId: this.state.activeStation,
      payload: updated,
    });
  }

  public async addMenuItem(itemData: Omit<MenuItem, 'id'>): Promise<MenuItem> {
    const newItem: MenuItem = {
      ...itemData,
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    const updatedMenu = [...this.state.menu, newItem];
    this.state = {
      ...this.state,
      menu: updatedMenu,
    };
    this.emitChange();

    await this.transport.publish<MenuItem[]>({
      type: 'MENU_UPDATED',
      stationId: this.state.activeStation,
      payload: updatedMenu,
    });
    return newItem;
  }

  public async updateMenuItem(item: MenuItem): Promise<void> {
    const updatedMenu = this.state.menu.map((it) => (it.id === item.id ? item : it));
    this.state = {
      ...this.state,
      menu: updatedMenu,
    };
    this.emitChange();

    await this.transport.publish<MenuItem[]>({
      type: 'MENU_UPDATED',
      stationId: this.state.activeStation,
      payload: updatedMenu,
    });
  }

  public async deleteMenuItem(itemId: string): Promise<void> {
    const updatedMenu = this.state.menu.filter((it) => it.id !== itemId);
    this.state = {
      ...this.state,
      menu: updatedMenu,
    };
    this.emitChange();

    await this.transport.publish<MenuItem[]>({
      type: 'MENU_UPDATED',
      stationId: this.state.activeStation,
      payload: updatedMenu,
    });
  }

  public async toggleMenuItemAvailability(itemId: string): Promise<void> {
    const updatedMenu = this.state.menu.map((it) =>
      it.id === itemId ? { ...it, isAvailable: !it.isAvailable } : it
    );
    this.state = {
      ...this.state,
      menu: updatedMenu,
    };
    this.emitChange();

    await this.transport.publish<MenuItem[]>({
      type: 'MENU_UPDATED',
      stationId: this.state.activeStation,
      payload: updatedMenu,
    });
  }

  public async addRawIngredient(data: Omit<RawIngredient, 'id'>): Promise<RawIngredient> {
    const newId = `ing_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newIngredient: RawIngredient = {
      ...data,
      id: newId,
    };
    const updatedIngredients = {
      ...this.state.ingredients,
      [newId]: newIngredient,
    };
    this.state = {
      ...this.state,
      ingredients: updatedIngredients,
    };
    this.emitChange();

    await this.transport.publish<{ ingredients: Record<string, RawIngredient> }>({
      type: 'STOCK_UPDATED',
      stationId: this.state.activeStation,
      payload: { ingredients: updatedIngredients },
    });
    return newIngredient;
  }

  public async updateRawIngredient(ingredient: RawIngredient): Promise<void> {
    const updatedIngredients = {
      ...this.state.ingredients,
      [ingredient.id]: ingredient,
    };
    this.state = {
      ...this.state,
      ingredients: updatedIngredients,
    };
    this.emitChange();

    await this.transport.publish<{ ingredients: Record<string, RawIngredient> }>({
      type: 'STOCK_UPDATED',
      stationId: this.state.activeStation,
      payload: { ingredients: updatedIngredients },
    });
  }

  public async deleteRawIngredient(ingredientId: string): Promise<void> {
    const updatedIngredients = { ...this.state.ingredients };
    delete updatedIngredients[ingredientId];
    this.state = {
      ...this.state,
      ingredients: updatedIngredients,
    };
    this.emitChange();

    await this.transport.publish<{ ingredients: Record<string, RawIngredient> }>({
      type: 'STOCK_UPDATED',
      stationId: this.state.activeStation,
      payload: { ingredients: updatedIngredients },
    });
  }

  public async setIngredientStock(ingredientId: string, currentStock: number): Promise<void> {
    const ing = this.state.ingredients[ingredientId];
    if (!ing) return;
    const updatedIngredients = {
      ...this.state.ingredients,
      [ingredientId]: {
        ...ing,
        currentStock,
      },
    };
    this.state = {
      ...this.state,
      ingredients: updatedIngredients,
    };
    this.emitChange();

    await this.transport.publish<{ ingredients: Record<string, RawIngredient> }>({
      type: 'STOCK_UPDATED',
      stationId: this.state.activeStation,
      payload: { ingredients: updatedIngredients },
    });
  }

  public addCustomer(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'currentBalance'>): Customer {
    const now = new Date().toISOString();
    const newCustomer: Customer = {
      ...data,
      id: `cust_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      currentBalance: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.state = {
      ...this.state,
      customers: [newCustomer, ...this.state.customers],
    };
    this.emitChange();
    return newCustomer;
  }

  public updateCustomer(customer: Customer): void {
    const updated = this.state.customers.map((c) => (c.id === customer.id ? customer : c));
    this.state = {
      ...this.state,
      customers: updated,
    };
    this.emitChange();
  }

  public addRegion(data: Omit<Region, 'id'>): Region {
    const newRegion: Region = {
      ...data,
      id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    this.state = {
      ...this.state,
      regions: [...this.state.regions, newRegion],
    };
    this.emitChange();
    return newRegion;
  }

  public async activateProductionCleanMode(options?: {
    startingOrderNumber?: number;
    cashierName?: string;
    startingCash?: number;
  }): Promise<void> {
    const startNum = options?.startingOrderNumber ?? 1;
    const cashierName = options?.cashierName || 'كاشير الفرع الرئيسي';
    const startingCash = options?.startingCash ?? 500;
    const now = new Date().toISOString();

    const cleanShift: CashierShift = {
      id: `shift_prod_${Date.now().toString().slice(-6)}`,
      cashierId: 'cashier_prod_1',
      cashierName,
      openedAt: now,
      startingCash,
      cashSales: 0,
      madaSales: 0,
      creditSales: 0,
      totalSales: 0,
      orderCount: 0,
      expectedCash: startingCash,
      status: 'OPEN',
    };

    const resetCustomers = this.state.customers.map((c) => ({
      ...c,
      currentBalance: 0,
      updatedAt: now,
    }));

    const cleanLog: WorkMovementLogItem = {
      id: `mov_init_prod_${Date.now()}`,
      timestamp: now,
      stage: 'ORDER_CAPTURE',
      stationRole: this.state.activeStation,
      orderNumber: 0,
      formattedOrderNumber: 'PROD-INIT',
      tagValue: 'LIVE',
      summary: 'تم تفعيل وضع الإنتاج والتشغيل الحي للنظام بنجاح وتصفير بيانات التجربة',
    };

    this.state = {
      ...this.state,
      orders: [],
      lastOrderNumber: startNum - 1,
      movementLogs: [cleanLog],
      customers: resetCustomers,
      customerLedger: [],
      currentShift: cleanShift,
      storeSettings: {
        ...this.state.storeSettings,
        isProductionMode: true,
      },
    };
    this.emitChange();

    await this.transport.publish<WorkMovementLogItem>({
      type: 'WORK_MOVEMENT_LOG',
      stationId: this.state.activeStation,
      payload: cleanLog,
    });
  }

  public setActiveStation(station: StationRole): void {
    this.state = { ...this.state, activeStation: station };
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('COFFEE_POS_STATION_ROLE', station);
    }
    this.emitChange();
    this.broadcastHeartbeat();
  }

  public async createOrder(
    params: Omit<Order, 'id' | 'orderNumber' | 'formattedOrderNumber' | 'createdAt' | 'updatedAt' | 'status'> & {
      status?: OrderStatus;
    }
  ): Promise<Order> {
    const nextNum = this.state.lastOrderNumber + 1;
    const now = new Date().toISOString();
    const orderId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `ord_${nextNum}_${Math.random().toString(36).slice(2, 7)}`;

    const newOrder: Order = {
      ...params,
      id: orderId,
      orderNumber: nextNum,
      formattedOrderNumber: `#${nextNum}`,
      status: params.status || 'IN_PREPARATION',
      createdAt: now,
      updatedAt: now,
      preparationStartedAt: now,
    };

    this.state = {
      ...this.state,
      orders: [newOrder, ...this.state.orders],
      lastOrderNumber: nextNum,
    };
    this.emitChange();

    await this.transport.publish<Order>({
      type: 'ORDER_CREATED',
      stationId: newOrder.stationId || this.state.activeStation,
      payload: newOrder,
    });

    await this.recordMovementLog({
      stage: 'ORDER_CAPTURE',
      stationRole: this.state.activeStation,
      orderNumber: newOrder.orderNumber,
      formattedOrderNumber: newOrder.formattedOrderNumber,
      tagValue: newOrder.tagValue,
      vehicleModel: newOrder.vehicleModel,
      summary: `تسجيل طلب جديد (${newOrder.items.map((i) => `${i.quantity}x ${i.nameAr}`).join('، ')})`,
      total: newOrder.total,
    });

    return newOrder;
  }

  public async startPreparationOrder(orderId: string): Promise<TransitionResult> {
    const order = this.state.orders.find((o) => o.id === orderId);
    if (!order) {
      return { success: false, order: null as any, error: 'Order not found', sideEffects: {} };
    }

    const result = transitionOrder(order, 'IN_PREPARATION');
    if (result.success) {
      this.applyTransitionResult(result);
      await this.transport.publish<Order>({
        type: 'ORDER_STATUS_CHANGED',
        stationId: this.state.activeStation,
        payload: result.order,
      });

      await this.recordMovementLog({
        stage: 'KITCHEN_PREP',
        stationRole: this.state.activeStation,
        orderNumber: order.orderNumber,
        formattedOrderNumber: order.formattedOrderNumber,
        tagValue: order.tagValue,
        vehicleModel: order.vehicleModel,
        summary: `بدء تحضير الطلب في شاشة المطبخ`,
      });
    }

    return result;
  }

  public async bumpOrder(orderId: string): Promise<TransitionResult> {
    let order = this.state.orders.find((o) => o.id === orderId);
    if (!order) {
      return { success: false, order: null as any, error: 'Order not found', sideEffects: {} };
    }

    // If order is still in NEW_ORDER, transition through IN_PREPARATION first
    if (order.status === 'NEW_ORDER') {
      const prepRes = transitionOrder(order, 'IN_PREPARATION');
      if (!prepRes.success) {
        return prepRes;
      }
      this.applyTransitionResult(prepRes);
      order = prepRes.order;
    }

    const result = transitionOrder(order, 'READY_FOR_PICKUP');
    if (result.success) {
      this.applyTransitionResult(result);
      await this.transport.publish<Order>({
        type: 'ORDER_BUMPED',
        stationId: this.state.activeStation,
        payload: result.order,
      });

      await this.recordMovementLog({
        stage: 'BUMP_READY',
        stationRole: this.state.activeStation,
        orderNumber: result.order.orderNumber,
        formattedOrderNumber: result.order.formattedOrderNumber,
        tagValue: result.order.tagValue,
        vehicleModel: result.order.vehicleModel,
        summary: `تم إنجاز التحضير في المطبخ وأصبح جاهزاً للتسليم عند الكاشير`,
        durationSeconds: result.order.prepDurationSeconds,
      });
    }

    return result;
  }

  public async recallOrder(orderId: string): Promise<TransitionResult> {
    const order = this.state.orders.find((o) => o.id === orderId);
    if (!order) {
      return { success: false, order: null as any, error: 'Order not found', sideEffects: {} };
    }

    const result = transitionOrder(order, 'IN_PREPARATION');
    if (result.success) {
      this.applyTransitionResult(result);
      await this.transport.publish<Order>({
        type: 'ORDER_STATUS_CHANGED',
        stationId: this.state.activeStation,
        payload: result.order,
      });
    }

    return result;
  }

  public async completeOrder(
    orderId: string,
    options: {
      paymentMethod: PaymentMethod;
      cashTendered?: number;
      changeDue?: number;
      paymentSplits?: PaymentSplit[];
      customerId?: string;
    }
  ): Promise<TransitionResult> {
    const order = this.state.orders.find((o) => o.id === orderId);
    if (!order) {
      return { success: false, order: null as any, error: 'Order not found', sideEffects: {} };
    }

    // Attach customer info if paying with credit
    if (options.customerId) {
      const customer = this.state.customers.find((c) => c.id === options.customerId);
      if (customer) {
        order.customerId = customer.id;
        order.customerName = customer.name;
        order.customerRegion = customer.region;
      }
    }

    const result = transitionOrder(order, 'COMPLETED', {
      paymentMethod: options.paymentMethod,
      cashTendered: options.cashTendered,
      changeDue: options.changeDue,
      paymentSplits: options.paymentSplits,
      recipes: this.state.recipes,
      currentIngredients: this.state.ingredients,
      customerId: options.customerId,
      customerName: order.customerName,
      customerRegion: order.customerRegion,
    });

    if (result.success) {
      // 1. Update order
      this.applyTransitionResult(result);

      // 2. Deplete inventory
      if (result.sideEffects.inventoryDepletions && result.sideEffects.inventoryDepletions.length > 0) {
        const updatedIngredients = { ...this.state.ingredients };
        for (const dep of result.sideEffects.inventoryDepletions) {
          if (updatedIngredients[dep.ingredientId]) {
            updatedIngredients[dep.ingredientId] = {
              ...updatedIngredients[dep.ingredientId],
              currentStock: dep.newStock,
            };
          }
        }

        const newAlerts = [...this.state.stockAlerts];
        if (result.sideEffects.stockAlerts) {
          newAlerts.push(...result.sideEffects.stockAlerts);
        }

        this.state = {
          ...this.state,
          ingredients: updatedIngredients,
          stockAlerts: newAlerts,
        };
        this.emitChange();

        await this.transport.publish<{ ingredients: Record<string, RawIngredient> }>({
          type: 'STOCK_UPDATED',
          stationId: this.state.activeStation,
          payload: { ingredients: updatedIngredients },
        });
      }

      // 3. Update customer debt if charged to credit
      if (result.sideEffects.customerDebtDelta) {
        const delta = result.sideEffects.customerDebtDelta;
        this.recordCustomerLedgerEntry({
          customerId: delta.customerId,
          orderId: result.order.id,
          type: 'SALE_CREDIT',
          amount: delta.amount,
          region: result.order.customerRegion || 'غير محدد',
          notes: `فاتورة مبيعات آجل ${result.order.formattedOrderNumber}`,
        });
      }

      // 4. Update cashier shift sales
      const shift = { ...this.state.currentShift };
      shift.totalSales += result.order.total;
      shift.orderCount += 1;
      if (result.order.paymentMethod === 'CASH') {
        shift.cashSales += result.order.total;
        shift.expectedCash += result.order.total;
      } else if (result.order.paymentMethod === 'MADA') {
        shift.madaSales += result.order.total;
      } else if (result.order.paymentMethod === 'CUSTOMER_CREDIT') {
        shift.creditSales += result.order.total;
      } else if (result.order.paymentMethod === 'SPLIT' && result.order.paymentSplits) {
        for (const split of result.order.paymentSplits) {
          if (split.method === 'CASH') {
            shift.cashSales += split.amount;
            shift.expectedCash += split.amount;
          } else if (split.method === 'MADA') {
            shift.madaSales += split.amount;
          }
        }
      }
      this.state = { ...this.state, currentShift: shift };
      this.emitChange();

      await this.transport.publish<Order>({
        type: 'ORDER_COMPLETED',
        stationId: this.state.activeStation,
        payload: result.order,
      });

      await this.recordMovementLog({
        stage: 'CASHIER_PAID',
        stationRole: this.state.activeStation,
        orderNumber: result.order.orderNumber,
        formattedOrderNumber: result.order.formattedOrderNumber,
        tagValue: result.order.tagValue,
        vehicleModel: result.order.vehicleModel,
        summary: `تسديد الفاتورة (${options.paymentMethod}) وإصدار الإيصال الضريبي`,
        total: result.order.total,
      });
    }

    return result;
  }

  public async chargeOrderToCustomer(orderId: string, customerId: string): Promise<TransitionResult> {
    const customer = this.state.customers.find((c) => c.id === customerId);
    if (!customer) {
      return { success: false, order: null as any, error: 'العميل غير مسجل في النظام', sideEffects: {} };
    }
    const order = this.state.orders.find((o) => o.id === orderId);
    if (!order) {
      return { success: false, order: null as any, error: 'الطلب غير موجود', sideEffects: {} };
    }
    if (customer.currentBalance + order.total > customer.creditLimit) {
      return {
        success: false,
        order,
        error: `الحد الائتماني للعميل (${customer.creditLimit} ر.س) لا يسمح بهذه الفاتورة (${order.total} ر.س). الرصيد الحالي: ${customer.currentBalance} ر.س`,
        sideEffects: {},
      };
    }
    return this.completeOrder(orderId, {
      paymentMethod: 'CUSTOMER_CREDIT',
      customerId,
    });
  }

  public closeShift(actualCash: number): CashierShift {
    const shift = { ...this.state.currentShift };
    const variance = Math.round((actualCash - shift.expectedCash) * 100) / 100;
    const closedShift: CashierShift = {
      ...shift,
      actualCash,
      variance,
      closedAt: new Date().toISOString(),
      status: 'CLOSED',
    };
    this.state = {
      ...this.state,
      currentShift: closedShift,
    };
    this.emitChange();
    return closedShift;
  }

  public openShift(cashierName: string = 'الكاشير المناوب', startingCash: number = 500): CashierShift {
    const newShift: CashierShift = {
      id: `shift_${Date.now()}`,
      cashierId: `cashier_${Date.now().toString().slice(-4)}`,
      cashierName,
      openedAt: new Date().toISOString(),
      startingCash,
      cashSales: 0,
      madaSales: 0,
      creditSales: 0,
      totalSales: 0,
      orderCount: 0,
      expectedCash: startingCash,
      status: 'OPEN',
    };
    this.state = {
      ...this.state,
      currentShift: newShift,
    };
    this.emitChange();
    return newShift;
  }

  public async voidOrder(orderId: string, reason: string, voidedBy?: string): Promise<TransitionResult> {
    const order = this.state.orders.find((o) => o.id === orderId);
    if (!order) {
      return { success: false, order: null as any, error: 'Order not found', sideEffects: {} };
    }

    const result = transitionOrder(order, 'VOIDED', {
      voidReason: reason,
      voidedBy: voidedBy || 'المشرف',
      recipes: this.state.recipes,
      currentIngredients: this.state.ingredients,
    });

    if (result.success) {
      this.applyTransitionResult(result);

      // Reverse stock if previously completed
      if (result.sideEffects.inventoryRestorations && result.sideEffects.inventoryRestorations.length > 0) {
        const updatedIngredients = { ...this.state.ingredients };
        for (const res of result.sideEffects.inventoryRestorations) {
          if (updatedIngredients[res.ingredientId]) {
            updatedIngredients[res.ingredientId] = {
              ...updatedIngredients[res.ingredientId],
              currentStock: res.newStock,
            };
          }
        }
        this.state = { ...this.state, ingredients: updatedIngredients };
        this.emitChange();

        await this.transport.publish<{ ingredients: Record<string, RawIngredient> }>({
          type: 'STOCK_UPDATED',
          stationId: this.state.activeStation,
          payload: { ingredients: updatedIngredients },
        });
      }

      // Reverse customer debt if previously charged
      if (result.sideEffects.customerDebtDelta) {
        const delta = result.sideEffects.customerDebtDelta;
        this.recordCustomerLedgerEntry({
          customerId: delta.customerId,
          orderId: result.order.id,
          type: 'PAYMENT_RECEIVED',
          amount: Math.abs(delta.amount),
          region: result.order.customerRegion || 'غير محدد',
          notes: `إلغاء واسترجاع فاتورة ${result.order.formattedOrderNumber}`,
        });
      }

      await this.transport.publish<Order>({
        type: 'ORDER_CANCELLED',
        stationId: this.state.activeStation,
        payload: result.order,
      });

      await this.recordMovementLog({
        stage: 'VOID',
        stationRole: this.state.activeStation,
        orderNumber: order.orderNumber,
        formattedOrderNumber: order.formattedOrderNumber,
        tagValue: order.tagValue,
        vehicleModel: order.vehicleModel,
        summary: `إلغاء الطلب: ${reason} (بواسطة ${voidedBy || 'المشرف'})`,
      });
    }

    return result;
  }

  public recordCustomerLedgerEntry(params: {
    customerId: string;
    orderId?: string;
    type: 'SALE_CREDIT' | 'PAYMENT_RECEIVED';
    amount: number;
    region: string;
    notes: string;
  }): void {
    const custIndex = this.state.customers.findIndex((c) => c.id === params.customerId);
    if (custIndex === -1) return;

    const cust = this.state.customers[custIndex];
    const delta = params.type === 'SALE_CREDIT' ? params.amount : -params.amount;
    const newBalance = Math.max(0, cust.currentBalance + delta);
    const now = new Date().toISOString();

    const entry: CustomerLedgerEntry = {
      id: `led_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      customerId: cust.id,
      orderId: params.orderId,
      date: now,
      region: params.region || cust.region,
      type: params.type,
      debit: params.type === 'SALE_CREDIT' ? params.amount : 0,
      credit: params.type === 'PAYMENT_RECEIVED' ? params.amount : 0,
      runningBalance: newBalance,
      receiptNumber: params.orderId || `REC-${Date.now().toString().slice(-4)}`,
      notes: params.notes,
    };

    const updatedCustomer: Customer = {
      ...cust,
      currentBalance: newBalance,
      updatedAt: now,
    };

    const updatedCustomers = [...this.state.customers];
    updatedCustomers[custIndex] = updatedCustomer;

    this.state = {
      ...this.state,
      customers: updatedCustomers,
      customerLedger: [entry, ...this.state.customerLedger],
    };
    this.emitChange();

    this.transport.publish<CustomerLedgerEntry>({
      type: 'CUSTOMER_CREDIT_UPDATED',
      stationId: this.state.activeStation,
      payload: entry,
    });
  }

  public addStock(ingredientId: string, amount: number): void {
    const ing = this.state.ingredients[ingredientId];
    if (!ing) return;

    const updatedStock = {
      ...this.state.ingredients,
      [ingredientId]: {
        ...ing,
        currentStock: ing.currentStock + amount,
      },
    };

    this.state = {
      ...this.state,
      ingredients: updatedStock,
    };
    this.emitChange();

    this.transport.publish<{ ingredients: Record<string, RawIngredient> }>({
      type: 'STOCK_UPDATED',
      stationId: this.state.activeStation,
      payload: { ingredients: updatedStock },
    });
  }

  public resetToDefaults(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.state = getInitialState();
    this.emitChange();
    this.broadcastHeartbeat();
  }

  private applyTransitionResult(result: TransitionResult): void {
    const orderIndex = this.state.orders.findIndex((o) => o.id === result.order.id);
    if (orderIndex !== -1) {
      const newOrders = [...this.state.orders];
      newOrders[orderIndex] = result.order;
      this.state = { ...this.state, orders: newOrders };
      this.emitChange();
    }
  }
}

export const posStore = new PosStoreManager();

export function usePosStore(): PosState {
  return useSyncExternalStore(posStore.subscribe, posStore.getSnapshot);
}
