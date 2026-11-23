import { useState } from 'react';
import { IconKey, MenuCategory } from '../types';
import { MenuIcon } from './MenuIcon';

const CATEGORY_GRADIENTS: Record<MenuCategory, string> = {
  Food: 'from-amber-50 via-orange-50 to-stone-100 text-orange-700',
  Drink: 'from-emerald-50 via-teal-50 to-stone-100 text-emerald-700',
  Snack: 'from-yellow-50 via-amber-50 to-stone-100 text-amber-700',
  Special: 'from-rose-50 via-orange-50 to-stone-100 text-rose-700',
};

export function MenuItemMedia({
  name,
  category,
  iconKey,
  imageUrl,
  className = 'aspect-[4/3]',
}: {
  name: string;
  category: MenuCategory;
  iconKey: IconKey;
  imageUrl: string;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(imageUrl && imageUrl.trim().length > 0 && !imgFailed);

  return (
    <div
      className={`relative w-full overflow-hidden bg-stone-100 ${className}`}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
        />
      ) : (
        <div
          className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br ${
            CATEGORY_GRADIENTS[category] ?? CATEGORY_GRADIENTS.Food
          }`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/90 border border-stone-200/80 shadow-xs">
            <MenuIcon iconKey={iconKey} className="w-7 h-7" />
          </div>
          <span className="text-xs font-medium text-stone-600 px-3 text-center truncate max-w-full">
            {name}
          </span>
        </div>
      )}
    </div>
  );
}
