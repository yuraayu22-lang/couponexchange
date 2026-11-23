import { IconKey, MenuCategory } from '../types';

export interface DefaultMenuSeed {
  id: string;
  name: string;
  category: MenuCategory;
  description: string;
  couponCost: number;
  iconKey: IconKey;
  imageUrl: string;
  available: boolean;
}

export const DEFAULT_MENU_ITEMS: DefaultMenuSeed[] = [
  {
    id: 'food-item-a',
    name: 'Food Item A',
    category: 'Food',
    description:
      'Grilled teriyaki chicken over warm steamed jasmine rice, toasted sesame seeds, and crisp seasonal greens.',
    couponCost: 2,
    iconKey: 'utensils',
    imageUrl: '/src/assets/images/menu_food_a_1795404523212.jpg',
    available: true,
  },
  {
    id: 'food-item-b',
    name: 'Food Item B',
    category: 'Food',
    description:
      'Brioche cheeseburger layered with cheddar, crisp lettuce, and ripe tomato alongside golden seasoned fries.',
    couponCost: 3,
    iconKey: 'burger',
    imageUrl: '/src/assets/images/menu_food_b_1795404524056.jpg',
    available: true,
  },
  {
    id: 'drink-item-a',
    name: 'Drink Item A',
    category: 'Drink',
    description:
      'Chilled iced matcha oat latte or sparkling citrus yuzu cooler poured over crystal ice with fresh mint.',
    couponCost: 1,
    iconKey: 'cup-soda',
    imageUrl: '/src/assets/images/menu_drink_a_1795404523098.jpg',
    available: true,
  },
  {
    id: 'snack-item-a',
    name: 'Snack Item A',
    category: 'Snack',
    description:
      'Warm cinnamon-sugar churro bites paired with a flaky artisanal butter croissant in a bakery box.',
    couponCost: 2,
    iconKey: 'cookie',
    imageUrl: '/src/assets/images/menu_snack_a_1795404522849.jpg',
    available: true,
  },
  {
    id: 'special-item',
    name: 'Special Item',
    category: 'Special',
    description:
      'Complete chef meal tray featuring a glazed salmon rice bowl, crispy dumplings, and chilled iced fruit tea.',
    couponCost: 5,
    iconKey: 'sparkles',
    imageUrl: '/src/assets/images/menu_special_combo_1795404522676.jpg',
    available: true,
  },
];

export const PRESET_IMAGE_OPTIONS = [
  { label: 'No photo (Icon Card)', value: '' },
  { label: 'Teriyaki Rice Bowl', value: '/src/assets/images/menu_food_a_1795404523212.jpg' },
  { label: 'Brioche Burger & Fries', value: '/src/assets/images/menu_food_b_1795404524056.jpg' },
  { label: 'Iced Matcha & Citrus Tea', value: '/src/assets/images/menu_drink_a_1795404523098.jpg' },
  { label: 'Churros & Croissant Box', value: '/src/assets/images/menu_snack_a_1795404522849.jpg' },
  { label: 'Deluxe Salmon Feast Tray', value: '/src/assets/images/menu_special_combo_1795404522676.jpg' },
];
