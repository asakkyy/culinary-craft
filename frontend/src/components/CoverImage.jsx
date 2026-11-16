export default function CoverImage({ recipe, className = '' }) {
  return (
    <div className={`cover-image ${className}`}>
      <div className="cover-fallback" aria-hidden="true">{recipe.emoji || '🍽️'}</div>
      {recipe.imageUrl && <img src={recipe.imageUrl} alt={recipe.title} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
    </div>
  );
}
