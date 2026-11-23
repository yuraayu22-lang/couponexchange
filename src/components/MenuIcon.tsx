import {
  Beef,
  Coffee,
  Cookie,
  CupSoda,
  Pizza,
  Salad,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { IconKey } from '../types';

export function MenuIcon({
  iconKey,
  className = 'w-5 h-5',
}: {
  iconKey: IconKey;
  className?: string;
}) {
  switch (iconKey) {
    case 'burger':
      return <Beef className={className} aria-hidden="true" />;
    case 'coffee':
      return <Coffee className={className} aria-hidden="true" />;
    case 'cookie':
      return <Cookie className={className} aria-hidden="true" />;
    case 'sparkles':
      return <Sparkles className={className} aria-hidden="true" />;
    case 'salad':
      return <Salad className={className} aria-hidden="true" />;
    case 'pizza':
      return <Pizza className={className} aria-hidden="true" />;
    case 'cup-soda':
      return <CupSoda className={className} aria-hidden="true" />;
    case 'utensils':
    default:
      return <Utensils className={className} aria-hidden="true" />;
  }
}
