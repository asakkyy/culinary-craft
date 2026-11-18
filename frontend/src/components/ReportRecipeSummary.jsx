import { useEffect, useState } from 'react';
import { api } from '../api/client';
import CoverImage from './CoverImage';

export default function ReportRecipeSummary({ recipeId }) {
  const [recipe, setRecipe] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    api
      .one(recipeId)
      .then((value) => {
        if (active) setRecipe(value);
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });
    return () => {
      active = false;
    };
  }, [recipeId]);
  if (unavailable) return <p className="info-note">Рецепт недоступен или удалён. История жалобы сохранена.</p>;
  if (!recipe)
    return (
      <p className="muted" role="status">
        Загружаем сведения о рецепте…
      </p>
    );
  return (
    <div className="report-recipe-summary">
      <CoverImage recipe={recipe} />
      <div>
        <strong>{recipe.category}</strong>
        <p>Автор: {recipe.ownerName}</p>
        <small>Состояние рецепта: {{ APPROVED: 'Опубликован', PENDING: 'На проверке', REJECTED: 'Отклонён' }[recipe.status]}</small>
      </div>
    </div>
  );
}
