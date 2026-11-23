export type MenuCategory = 'Food' | 'Drink' | 'Snack' | 'Special';

export type IconKey =
  | 'utensils'
  | 'burger'
  | 'coffee'
  | 'cookie'
  | 'sparkles'
  | 'salad'
  | 'pizza'
  | 'cup-soda';

export type SelectionStatus = 'saved' | 'fulfilled' | 'cancelled';

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  description: string;
  couponCost: number;
  iconKey: IconKey;
  imageUrl: string;
  available: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface SelectionRecord {
  id: string;
  userName: string;
  menuItemId: string;
  menuItemName: string;
  couponsRequired: number;
  status: SelectionStatus;
  submittedByUid: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/**
 * Synchronized with firebase-blueprint.json schema boundaries and firestore.rules.
 */
export const VALIDATION_LIMITS = {
  ITEM_NAME_MIN: 1,
  ITEM_NAME_MAX: 80,
  DESCRIPTION_MIN: 1,
  DESCRIPTION_MAX: 280,
  COUPON_COST_MIN: 1,
  COUPON_COST_MAX: 100,
  IMAGE_URL_MAX: 500,
  USER_NAME_MIN: 2,
  USER_NAME_MAX: 80,
  ID_MAX: 128,
  ID_PATTERN: /^[a-zA-Z0-9_\-]+$/,
} as const;

export const MENU_CATEGORIES: MenuCategory[] = ['Food', 'Drink', 'Snack', 'Special'];

export const ICON_KEY_OPTIONS: { value: IconKey; label: string }[] = [
  { value: 'utensils', label: 'Meal Bowl' },
  { value: 'burger', label: 'Burger & Fries' },
  { value: 'cup-soda', label: 'Cold Drink' },
  { value: 'coffee', label: 'Hot Cafe Drink' },
  { value: 'cookie', label: 'Pastry & Snack' },
  { value: 'sparkles', label: 'Special Combo' },
  { value: 'salad', label: 'Fresh Bowl' },
  { value: 'pizza', label: 'Slice & Share' },
];
