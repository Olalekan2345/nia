/**
 * Structured shapes returned by commerce tools and rendered as cards on web
 * and Telegram. Everything here comes from the operational database — never
 * from the model.
 */
import type {
  BookingStatus,
  FulfillmentMethod,
  InventoryStatus,
  OfferingKind,
  OrderStatus,
  PaymentMode,
  PaymentStatus,
} from "@nia/shared";

export interface VariantCardData {
  id: string;
  name: string;
  options: Record<string, string>;
  price: number | null;
  inventoryStatus: InventoryStatus;
  available: boolean;
}

export interface ProductCardData {
  kind: "product";
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  offeringKind: OfferingKind;
  /** Lowest current price across purchasable variants (minor units). null = price on request. */
  price: number | null;
  priceMax: number | null;
  currency: string;
  unit: string | null;
  inventoryStatus: InventoryStatus;
  available: boolean;
  image: string | null;
  attributes: Record<string, string | string[]>;
  tags: string[];
  variants: VariantCardData[];
  /** Variants that matched the requested colour/size filters. */
  matchedVariantIds?: string[];
}

export interface ServiceCardData {
  kind: "service";
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  offeringKind: OfferingKind;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  durationMinutes: number | null;
  depositAmount: number | null;
  locationType: "in_store" | "at_customer" | "online";
  bookingRequirements: string | null;
  options: { name: string; priceDelta?: number | null; durationDelta?: number | null }[];
  /** ISO start of the next open slot, when availability is configured. */
  nextAvailable: string | null;
  image: string | null;
}

export interface OrderLineData {
  id: string;
  productId: string | null;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  options: Record<string, string>;
  unit: string | null;
  unitPrice: number | null;
  quantity: number;
  lineTotal: number | null;
  notes: string | null;
}

export interface OrderSummaryData {
  kind: "order";
  id: string;
  number: number | null;
  status: OrderStatus;
  statusLabel: string;
  channel: "web" | "telegram";
  items: OrderLineData[];
  fulfillmentMethod: FulfillmentMethod | null;
  deliveryArea: string | null;
  deliveryAddress: string | null;
  deliveryFee: number | null;
  subtotal: number;
  total: number;
  hasUnpricedItems: boolean;
  currency: string;
  notes: string | null;
  paymentMode: PaymentMode;
  paymentStatus: PaymentStatus;
  paymentUrl: string | null;
  memoryAssisted: boolean;
  createdAt: string;
  submittedAt: string | null;
  /** Problems that block submission ("Choose delivery or pickup", "Emerald is out of stock"). */
  blockers: string[];
}

export interface BookingSummaryData {
  kind: "booking";
  id: string;
  status: BookingStatus;
  statusLabel: string;
  serviceId: string | null;
  serviceName: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  selectedOptions: string[];
  price: number | null;
  depositAmount: number | null;
  currency: string;
  notes: string | null;
  memoryAssisted: boolean;
}

export interface SlotData {
  startAt: string;
  endAt: string;
  label: string;
  remaining: number;
}
