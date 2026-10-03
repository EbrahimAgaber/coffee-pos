import {
  Order,
  OrderStatus,
  Recipe,
  RawIngredient,
  DepletionResult,
  PaymentMethod,
  PaymentSplit,
} from '../types';

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW_ORDER: ['IN_PREPARATION', 'VOIDED'],
  IN_PREPARATION: ['READY_FOR_PICKUP', 'VOIDED'],
  READY_FOR_PICKUP: ['COMPLETED', 'IN_PREPARATION', 'VOIDED'],
  COMPLETED: ['VOIDED'],
  VOIDED: [],
};

export function canTransitionOrder(current: OrderStatus, next: OrderStatus): boolean {
  if (current === next) return false;
  const allowed = ALLOWED_TRANSITIONS[current] || [];
  return allowed.includes(next);
}

export function getValidNextStatuses(current: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[current] ? [...ALLOWED_TRANSITIONS[current]] : [];
}

export interface TransitionOptions {
  timestamp?: string; // ISO string, defaults to current time
  voidReason?: string;
  voidedBy?: string;
  paymentMethod?: PaymentMethod;
  paymentSplits?: PaymentSplit[];
  cashTendered?: number;
  changeDue?: number;
  recipes?: Record<string, Recipe>;
  currentIngredients?: Record<string, RawIngredient>;
  customerId?: string;
  customerName?: string;
  customerRegion?: string;
}

export interface TransitionResult {
  success: boolean;
  order: Order;
  error?: string;
  sideEffects: {
    inventoryDepletions?: DepletionResult[];
    inventoryRestorations?: DepletionResult[];
    stockAlerts?: string[];
    customerDebtDelta?: {
      customerId: string;
      customerName?: string;
      amount: number; // positive = increase debt, negative = decrease debt
      action: 'ADD_DEBT' | 'REVERSE_DEBT';
    };
    prepDurationSeconds?: number;
  };
}

/**
 * Calculates raw ingredient requirements and depletions based on recipes and modifiers.
 */
export function calculateOrderBOMDepletion(
  order: Order,
  recipes: Record<string, Recipe>,
  ingredients: Record<string, RawIngredient>
): { depletions: DepletionResult[]; alerts: string[] } {
  const requirementMap: Record<string, number> = {};

  for (const item of order.items) {
    const recipe =
      recipes[item.menuItemId] ||
      Object.values(recipes).find((r) => r.menuItemId === item.menuItemId || r.id === item.menuItemId);
    if (!recipe) continue;

    // Base ingredients
    for (const baseReq of recipe.baseIngredients) {
      requirementMap[baseReq.ingredientId] =
        (requirementMap[baseReq.ingredientId] || 0) + baseReq.quantityRequired * item.quantity;
    }

    // Modifier adjustments
    if (item.modifiers && item.modifiers.length > 0 && recipe.modifierAdjustments) {
      for (const mod of item.modifiers) {
        const adjustments = recipe.modifierAdjustments[mod.id];
        if (adjustments) {
          for (const adj of adjustments) {
            requirementMap[adj.ingredientId] =
              (requirementMap[adj.ingredientId] || 0) + adj.quantityRequired * item.quantity;
          }
        }
      }
    }
  }

  const depletions: DepletionResult[] = [];
  const alerts: string[] = [];

  for (const [ingredientId, requiredQty] of Object.entries(requirementMap)) {
    const ingredient = ingredients[ingredientId];
    if (!ingredient) continue;

    const previousStock = ingredient.currentStock;
    const newStock = Math.max(0, previousStock - requiredQty);
    const isLowStock = newStock <= ingredient.minAlertThreshold;

    depletions.push({
      ingredientId,
      ingredientNameAr: ingredient.nameAr,
      previousStock,
      newStock,
      depletedQuantity: requiredQty,
      unit: ingredient.unit,
      isLowStock,
    });

    if (isLowStock) {
      alerts.push(
        `تنبيه مخزون: المتبقي من ${ingredient.nameAr} هو ${newStock} ${ingredient.unit} (الحد الأدنى: ${ingredient.minAlertThreshold}).`
      );
    }
  }

  return { depletions, alerts };
}

/**
 * Calculates stock restoration if an order that was completed is subsequently voided.
 */
export function calculateOrderBOMRestoration(
  order: Order,
  recipes: Record<string, Recipe>,
  ingredients: Record<string, RawIngredient>
): DepletionResult[] {
  const { depletions } = calculateOrderBOMDepletion(order, recipes, ingredients);
  return depletions.map((d) => {
    const ingredient = ingredients[d.ingredientId];
    const previousStock = ingredient ? ingredient.currentStock : d.newStock;
    const restoredStock = previousStock + d.depletedQuantity;
    return {
      ingredientId: d.ingredientId,
      ingredientNameAr: d.ingredientNameAr,
      previousStock,
      newStock: restoredStock,
      depletedQuantity: -d.depletedQuantity, // Negative to denote restoration
      unit: d.unit,
      isLowStock: ingredient ? restoredStock <= ingredient.minAlertThreshold : false,
    };
  });
}

/**
 * Pure, deterministic order lifecycle state transition function.
 */
export function transitionOrder(
  order: Order,
  targetStatus: OrderStatus,
  options: TransitionOptions = {}
): TransitionResult {
  const now = options.timestamp || new Date().toISOString();

  if (!canTransitionOrder(order.status, targetStatus)) {
    return {
      success: false,
      order,
      error: `Invalid transition from ${order.status} to ${targetStatus}`,
      sideEffects: {},
    };
  }

  const updatedOrder: Order = {
    ...order,
    status: targetStatus,
    updatedAt: now,
  };

  const sideEffects: TransitionResult['sideEffects'] = {};

  switch (targetStatus) {
    case 'IN_PREPARATION': {
      if (!updatedOrder.preparationStartedAt) {
        updatedOrder.preparationStartedAt = now;
      }
      // If recalled from READY_FOR_PICKUP, clear ready timestamp
      if (order.status === 'READY_FOR_PICKUP') {
        delete updatedOrder.readyAt;
        delete updatedOrder.prepDurationSeconds;
      }
      break;
    }

    case 'READY_FOR_PICKUP': {
      updatedOrder.readyAt = now;
      const startTime = updatedOrder.preparationStartedAt || updatedOrder.createdAt;
      const startMs = new Date(startTime).getTime();
      const readyMs = new Date(now).getTime();
      const elapsedSeconds = Math.max(0, Math.round((readyMs - startMs) / 1000));
      updatedOrder.prepDurationSeconds = elapsedSeconds;
      sideEffects.prepDurationSeconds = elapsedSeconds;
      break;
    }

    case 'COMPLETED': {
      updatedOrder.completedAt = now;

      // Settle payment options
      if (options.paymentMethod) {
        updatedOrder.paymentMethod = options.paymentMethod;
      }
      if (options.paymentSplits) {
        updatedOrder.paymentSplits = options.paymentSplits;
      }
      if (typeof options.cashTendered === 'number') {
        updatedOrder.cashTendered = options.cashTendered;
        updatedOrder.changeDue = options.changeDue ?? Math.max(0, options.cashTendered - order.total);
      }

      if (options.customerId) {
        updatedOrder.customerId = options.customerId;
      }
      if (options.customerName) {
        updatedOrder.customerName = options.customerName;
      }
      if (options.customerRegion) {
        updatedOrder.customerRegion = options.customerRegion;
      }

      if (updatedOrder.paymentMethod === 'CUSTOMER_CREDIT') {
        updatedOrder.paymentStatus = 'CHARGED_TO_DEBT';
        if (updatedOrder.customerId) {
          sideEffects.customerDebtDelta = {
            customerId: updatedOrder.customerId,
            customerName: updatedOrder.customerName,
            amount: updatedOrder.total,
            action: 'ADD_DEBT',
          };
        }
      } else {
        updatedOrder.paymentStatus = 'PAID';
      }

      // Compute inventory depletion if recipes and current ingredients are provided
      if (options.recipes && options.currentIngredients) {
        const { depletions, alerts } = calculateOrderBOMDepletion(
          updatedOrder,
          options.recipes,
          options.currentIngredients
        );
        sideEffects.inventoryDepletions = depletions;
        sideEffects.stockAlerts = alerts;
      }
      break;
    }

    case 'VOIDED': {
      updatedOrder.voidedAt = now;
      updatedOrder.voidReason = options.voidReason || 'Cancelled by operator';
      if (options.voidedBy) {
        updatedOrder.voidedBy = options.voidedBy;
      }

      // If the voided order was previously COMPLETED:
      if (order.status === 'COMPLETED') {
        // Reverse inventory if recipes and ingredients are provided
        if (options.recipes && options.currentIngredients) {
          sideEffects.inventoryRestorations = calculateOrderBOMRestoration(
            order,
            options.recipes,
            options.currentIngredients
          );
        }

        // Reverse customer debt if it was charged to debt
        if (order.paymentStatus === 'CHARGED_TO_DEBT' && order.customerId) {
          sideEffects.customerDebtDelta = {
            customerId: order.customerId,
            customerName: order.customerName,
            amount: -order.total,
            action: 'REVERSE_DEBT',
          };
        }
      }
      break;
    }
  }

  return {
    success: true,
    order: updatedOrder,
    sideEffects,
  };
}
