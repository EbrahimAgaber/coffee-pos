/**
 * Domain Types for Coffee POS & Kitchen Display System (KDS)
 */

export type StationRole = 'DRIVE_THRU' | 'KDS' | 'CASHIER' | 'OWNER';

export type OrderStatus =
  | 'NEW_ORDER'
  | 'IN_PREPARATION'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'VOIDED';

export type TagType = 'VEHICLE' | 'BUZZER' | 'CUSTOMER_NAME' | 'TABLE';

export type ItemSize = 'S' | 'M' | 'L';

export type ModifierCategory =
  | 'SIZE'
  | 'MILK'
  | 'SWEETNESS'
  | 'TEMPERATURE'
  | 'EXTRA_SHOT'
  | 'SYRUP'
  | 'TOPPING';

export interface ItemModifier {
  id: string;
  category: ModifierCategory;
  nameAr: string;
  nameEn: string;
  priceDelta: number;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  nameAr: string;
  nameEn: string;
  unitPrice: number;
  quantity: number;
  size: ItemSize;
  modifiers: ItemModifier[];
  specialInstructions?: string;
  totalPrice: number;
}

export type PaymentMethod = 'CASH' | 'MADA' | 'SPLIT' | 'CUSTOMER_CREDIT';

export interface PaymentSplit {
  method: 'CASH' | 'MADA';
  amount: number;
}

export interface Order {
  id: string;
  orderNumber: number; // e.g. 101, 102
  formattedOrderNumber: string; // e.g. "#101"
  status: OrderStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  preparationStartedAt?: string;
  readyAt?: string;
  completedAt?: string;
  prepDurationSeconds?: number;
  stationId: string;
  attendantName?: string;
  tagType: TagType;
  tagValue: string; // e.g. "أ ب ج 1234" or "Buzzer 5"
  vehicleModel?: string; // e.g. "كامري بيضاء"
  items: OrderItem[];
  subtotal: number;
  tax: number; // 15% VAT
  total: number;
  paymentMethod?: PaymentMethod;
  paymentStatus: 'UNPAID' | 'PAID' | 'CHARGED_TO_DEBT';
  paymentSplits?: PaymentSplit[];
  cashTendered?: number;
  changeDue?: number;
  customerId?: string;
  customerName?: string;
  customerRegion?: string;
  notes?: string;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
}

export type IngredientUnit = 'g' | 'ml' | 'piece' | 'shot';

export interface RawIngredient {
  id: string;
  nameAr: string;
  nameEn: string;
  sku: string;
  unit: IngredientUnit;
  currentStock: number;
  minAlertThreshold: number;
  costPerUnit: number; // Cost in SAR per unit
}

export interface RecipeIngredientRequirement {
  ingredientId: string;
  quantityRequired: number;
}

export interface Recipe {
  id: string;
  menuItemId: string;
  nameAr: string;
  nameEn: string;
  baseIngredients: RecipeIngredientRequirement[];
  modifierAdjustments?: Record<string, RecipeIngredientRequirement[]>;
}

export interface DepletionResult {
  ingredientId: string;
  ingredientNameAr: string;
  previousStock: number;
  newStock: number;
  depletedQuantity: number;
  unit: IngredientUnit;
  isLowStock: boolean;
}

export interface Region {
  id: string;
  nameAr: string;
  nameEn: string;
  city: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  region: string; // e.g. "حي الياسمين", "حي النرجس", "حي الصحافة"
  creditLimit: number;
  currentBalance: number; // Positive = customer owes merchant
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerLedgerEntry {
  id: string;
  customerId: string;
  orderId?: string;
  date: string;
  region: string;
  type: 'SALE_CREDIT' | 'PAYMENT_RECEIVED';
  debit: number;
  credit: number;
  runningBalance: number;
  receiptNumber: string;
  notes: string;
}

export interface CashierShift {
  id: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  startingCash: number;
  cashSales: number;
  madaSales: number;
  creditSales: number;
  totalSales: number;
  orderCount: number;
  expectedCash: number;
  actualCash?: number;
  variance?: number;
  status: 'OPEN' | 'CLOSED';
}

export type MenuCategory = 'HOT' | 'COLD' | 'DRIP' | 'TEA' | 'PASTRY';

export interface MenuItem {
  id: string;
  category: MenuCategory;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  basePrice: number;
  sizes: {
    S: number;
    M: number;
    L: number;
  };
  recipeId: string;
  isAvailable: boolean;
}

export type RealtimeEventType =
  | 'ORDER_CREATED'
  | 'ORDER_STATUS_CHANGED'
  | 'ORDER_BUMPED'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'STOCK_UPDATED'
  | 'CUSTOMER_CREDIT_UPDATED'
  | 'STATION_HEARTBEAT';

export interface RealtimeEnvelope<T = unknown> {
  id: string;
  type: RealtimeEventType;
  timestamp: string;
  stationId: string;
  payload: T;
  syncSource: 'supabase' | 'broadcast_channel' | 'local_memory';
}

export interface IRealtimeTransport {
  publish<T>(event: Omit<RealtimeEnvelope<T>, 'id' | 'timestamp' | 'syncSource'>): Promise<void>;
  subscribe<T>(eventType: RealtimeEventType, handler: (event: RealtimeEnvelope<T>) => void): () => void;
  getTransportName(): 'supabase' | 'broadcast_channel' | 'local_memory';
}
