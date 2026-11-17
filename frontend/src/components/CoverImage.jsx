import { Utensils } from 'lucide-react';
export default function CoverImage({ recipe, className = '', priority = false }) {
  const bundled = new Set([
    'photo-1528207776546-365bb710ee93',
    'photo-1473093295043-cdd812d0e601',
    'photo-1606313564200-e75d5e30476c',
    'photo-1512621776951-a57141f2eefd',
    'photo-1547592180-85f173990554',
    'photo-1505252585461-04db1eb84625',
    'photo-1574071318508-1cdbab80d002',
    'photo-1517673400267-0251440c45dc',
  ]);
  const photo = recipe.imageUrl?.match(/^https:\/\/images\.unsplash\.com\/(photo-[\w-]+)(?:\?|$)/)?.[1];
  const src = bundled.has(photo) ? `/images/recipes/${photo}.webp` : recipe.imageUrl;
  return (
    <div className={`cover-image ${className}`}>
      <div className="cover-fallback" aria-hidden="true">
        <Utensils />
        <span>{recipe.category || 'Домашняя кухня'}</span>
      </div>
      {src && (
        <img
          key={src}
          src={src}
          alt={recipe.title}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}
    </div>
  );
}
