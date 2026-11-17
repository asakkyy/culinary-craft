import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock3, Heart, Star } from 'lucide-react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import CoverImage from './CoverImage';

export default function RecipeCard({ recipe, onChanged }) {
  const { requireUser, showError, notify, changed } = useApp();
  const [saved, setSaved] = useState(recipe.favorite);
  const [busy, setBusy] = useState(false);
  useEffect(() => setSaved(recipe.favorite), [recipe.favorite]);
  const toggle = async () => {
    if (!requireUser() || busy) return;
    setBusy(true);
    try {
      const result = await api.toggleFavorite(recipe.id);
      setSaved(result.favorite);
      notify(result.favorite ? 'Рецепт в избранном' : 'Удалено из избранного');
      changed();
      if (onChanged) onChanged();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="recipe-card">
      <Link className="recipe-card-cover" to={`/recipes/${recipe.id}`} aria-label={`Открыть рецепт: ${recipe.title}`}>
        <CoverImage recipe={recipe} />
        <span className="card-category">{recipe.category}</span>
      </Link>
      <button
        className={`favorite-button ${saved ? 'is-saved' : ''}`}
        onClick={toggle}
        aria-pressed={saved}
        title={saved ? 'Удалить из избранного' : 'Добавить в избранное'}
        disabled={busy}
        aria-label="Избранное"
      >
        <Heart size={19} fill={saved ? 'currentColor' : 'none'} />
      </button>
      <div className="recipe-card-body">
        <div className="recipe-card-meta">
          <span>
            <Clock3 size={14} /> {recipe.prepMinutes} мин
          </span>
          <span>
            <Star size={14} fill="currentColor" /> {recipe.reviewCount ? recipe.rating.toFixed(1) : 'Новинка'}
          </span>
        </div>
        <Link to={`/recipes/${recipe.id}`} className="recipe-title-link">
          <h3>{recipe.title}</h3>
        </Link>
        <p>{recipe.description}</p>
        <div className="card-bottom">
          <span>от {recipe.ownerName}</span>
          <Link to={`/recipes/${recipe.id}`} aria-label="Подробнее">
            <ArrowUpRight size={19} />
          </Link>
        </div>
      </div>
    </article>
  );
}
