/**
 * Shopping session state: what the customer is doing in THIS conversation
 * (current goal, constraints, what Nia showed, a shortlist, a list, a basket).
 *
 * It is deliberately separate from long-term memory. "I'm shopping for my
 * brother today" belongs here, not in the customer's Walrus profile; durable
 * facts reach Walrus only through extraction + the memory policy.
 */

/** Structured constraints for the current shopping goal (from tool inputs, not raw text). */
export interface ShoppingIntent {
  goal?: string;
  query?: string;
  category?: string;
  /** Major currency units. */
  budgetMax?: number;
  budgetMin?: number;
  quantity?: number;
  recipient?: string;
  occasion?: string;
  /** Hard: never shown. */
  excluded?: string[];
  /** Soft: ranked higher, never required. */
  preferred?: string[];
  colour?: string;
  size?: string;
}

/** A product Nia showed or the customer saved, small enough to put back in the prompt. */
export interface SessionItem {
  id: string;
  name: string;
  shop?: string;
  /** Formatted price label, e.g. "₦689,000". */
  price?: string;
}

export interface BasketSlotInput {
  label: string;
  query: string;
  category?: string;
  quantity?: number;
  /** Major units, per unit. */
  maxPrice?: number;
  colour?: string;
  exclude?: string[];
}

export interface BasketLineState {
  slot: string;
  productId: string;
  variantId: string | null;
  quantity: number;
}

export interface BasketState {
  goal: string;
  /** Major units, whole basket. */
  budget?: number;
  people?: number;
  slots: BasketSlotInput[];
  lines: BasketLineState[];
  /** Minor units, computed by the server. */
  total: number;
  currency: string;
}

export interface ShoppingSession {
  intent?: ShoppingIntent;
  /** The last results shown, in order — so "the second one" and "compare these" resolve. */
  lastResults?: SessionItem[];
  /** Items the customer asked Nia to keep ("save these two"). */
  shortlist?: SessionItem[];
  /** A structured shopping list ("add milk", "remove juice"). */
  list?: string[];
  /** The latest proposed basket (event cart, shopping guide). */
  basket?: BasketState;
  updatedAt?: string;
}

export const SESSION_LIMITS = { lastResults: 6, shortlist: 8, list: 30 } as const;
