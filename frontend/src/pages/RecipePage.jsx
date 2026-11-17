import ConfirmDialog from '../components/ConfirmDialog';
import RecipeAdminActions from '../components/RecipeAdminActions';
import ReportForm from '../components/ReportForm';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Clock3, Heart, Pencil, Printer, Star, UsersRound, Send } from 'lucide-react';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';
import CoverImage from '../components/CoverImage';

const statusLabels = { PENDING: 'Ожидает проверки', APPROVED: 'Опубликован', REJECTED: 'Отклонён' };
export default function RecipePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, dataVersion, requireUser, notify, showError, changed } = useApp();
  const [recipe, setRecipe] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsError, setReviewsError] = useState('');
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  useEffect(() => {
    setRecipe(null);
    setReviews([]);
    setChecked([]);
    setError('');
  }, [id]);
  useEffect(() => {
    let active = true;
    setError('');
    setReviewsError('');
    setReviewsLoading(true);
    api
      .one(id)
      .then((result) => {
        if (active) setRecipe(result);
      })
      .catch((err) => {
        if (active) setError(errorText(err));
      });
    api
      .reviews(id)
      .then((list) => {
        if (active) setReviews(list);
      })
      .catch((err) => {
        if (active) setReviewsError(errorText(err));
      })
      .finally(() => {
        if (active) setReviewsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, dataVersion, retry]);

  async function favorite() {
    if (!requireUser()) return;
    try {
      const response = await api.toggleFavorite(id);
      notify(response.favorite ? 'Добавлено в избранное' : 'Удалено из избранного');
      changed();
    } catch (err) {
      showError(err);
    }
  }
  async function addReview(e) {
    e.preventDefault();
    if (!requireUser() || !comment.trim() || sending) return;
    setSending(true);
    try {
      await api.addReview(id, { rating, comment: comment.trim() });
      setComment('');
      notify('Отзыв опубликован');
      changed();
    } catch (err) {
      showError(err);
    } finally {
      setSending(false);
    }
  }
  async function remove() {
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await api.remove(id);
      notify('Рецепт удалён');
      changed();
      navigate('/profile');
    } catch (err) {
      setDeleteError(errorText(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (error)
    return (
      <div className="container narrow-page">
        <div className="error-box" role="alert">
          <h1>Рецепт недоступен</h1>
          <p>{error}</p>
          <button className="btn btn-outline" onClick={() => setRetry((value) => value + 1)}>
            Повторить загрузку
          </button>
          <Link to="/" className="btn btn-primary">
            Вернуться в каталог
          </Link>
        </div>
      </div>
    );
  if (!recipe)
    return (
      <div className="container narrow-page">
        <div className="loading-message" role="status">
          Готовим страницу рецепта…
        </div>
      </div>
    );
  const mine = user && (user.id === recipe.ownerId || user.role === 'ADMIN');
  const hasReviewed = reviews.some((item) => item.authorId === user?.id);
  return (
    <div className="container detail-page">
      <div className="breadcrumbs">
        <Link to="/">
          <ArrowLeft size={17} aria-hidden="true" /> Все рецепты
        </Link>
        <span>/</span>
        <span>{recipe.category}</span>
        <span>/</span>
        <span>{recipe.title}</span>
      </div>
      <div className="detail-header">
        <div>
          <div className="eyebrow muted">
            {recipe.category} <span className="sep-dot">●</span> Автор: {recipe.ownerName}
          </div>
          <h1>{recipe.title}</h1>
          <p>{recipe.description}</p>
          <div className="detail-quick-meta">
            <span>
              <Clock3 size={18} aria-hidden="true" /> {recipe.prepMinutes} минут
            </span>
            <span>
              <UsersRound size={18} aria-hidden="true" /> {recipe.servings} порции
            </span>
            <span>
              <Star size={18} fill="currentColor" aria-hidden="true" />{' '}
              {recipe.reviewCount ? `${recipe.rating} (${recipe.reviewCount})` : 'Без оценок'}
            </span>
            <span className="difficulty">{recipe.difficulty}</span>
          </div>
        </div>
        <div className="detail-header-actions">
          <button
            className={`btn ${recipe.favorite ? 'btn-primary' : 'btn-outline'}`}
            onClick={favorite}
            disabled={recipe.status !== 'APPROVED'}
            title={recipe.status !== 'APPROVED' ? 'Избранное доступно после публикации' : undefined}
          >
            <Heart size={18} fill={recipe.favorite ? 'currentColor' : 'none'} aria-hidden="true" />
            {recipe.favorite ? 'В избранном' : 'Сохранить'}
          </button>
          <button className="btn btn-outline print-btn" onClick={() => window.print()}>
            <Printer size={18} aria-hidden="true" /> Печать
          </button>
        </div>
      </div>
      {recipe.status !== 'APPROVED' && (
        <div className="status-notice">
          Статус: <strong>{statusLabels[recipe.status]}</strong>. Такой рецепт не виден гостям и другим пользователям.
        </div>
      )}
      <RecipeAdminActions recipe={recipe} />
      <CoverImage recipe={recipe} className="detail-cover" />
      <div className="detail-columns">
        <aside className="ingredients-panel">
          <div className="panel-overline">Подготовка</div>
          <h2>Ингредиенты</h2>
          <p>На {recipe.servings} порции</p>
          <div className="ingredients-list">
            {recipe.ingredients.map((ingredient, i) => (
              <label key={i} className={`ingredient-row ${checked.includes(i) ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked.includes(i)}
                  onChange={() => setChecked((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))}
                />
                <span className="ingredient-check">
                  <Check size={13} aria-hidden="true" />
                </span>
                {ingredient}
              </label>
            ))}
          </div>
          <div className="ingredients-footnote">Совет: отмечай продукты, которые уже добавил в корзину или подготовил.</div>
        </aside>
        <div className="method-panel">
          <div className="panel-overline">Приготовление</div>
          <h2>Шаг за шагом</h2>
          <p className="method-lead">Подготовьте ингредиенты и следуйте инструкции</p>
          <div className="steps-list">
            {recipe.steps.map((step, i) => (
              <div className="step-item" key={i}>
                <div className="step-number">{String(i + 1).padStart(2, '0')}</div>
                <div>
                  <h3>Шаг {i + 1}</h3>
                  <p>{step}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bon-appetit">
            <div>
              <strong>Приятного аппетита</strong>
              <p>Самое вкусное получается, когда готовишь с любовью.</p>
            </div>
          </div>
          {mine && (
            <div className="owner-actions">
              <Link className="btn btn-outline" to={`/recipes/${recipe.id}/edit`}>
                <Pencil size={16} aria-hidden="true" /> Редактировать
              </Link>
              <button className="btn btn-danger" onClick={() => setDeleting(true)}>
                Удалить рецепт
              </button>
            </div>
          )}
        </div>
      </div>
      {recipe.status === 'APPROVED' && <ReportForm key={recipe.id} recipeId={recipe.id} />}
      {deleting && (
        <ConfirmDialog
          title="Удалить рецепт?"
          label="Удалить рецепт"
          onClose={() => setDeleting(false)}
          onConfirm={remove}
          busy={deleteBusy}
          error={deleteError}
        >
          <p>Рецепт, отзывы и записи в избранном будут удалены без возможности восстановления.</p>
        </ConfirmDialog>
      )}
      <section className="reviews-section">
        <div className="reviews-header">
          <div>
            <div className="panel-overline">Опыт сообщества</div>
            <h2>Отзывы и впечатления</h2>
          </div>
          <span className="review-count">{reviews.length} отзывов</span>
        </div>
        <div className="reviews-layout">
          <div className="reviews-list">
            {reviewsLoading ? (
              <p role="status">Загружаем отзывы…</p>
            ) : reviewsError ? (
              <div className="error-box" role="alert">
                <p>Не удалось загрузить отзывы</p>
                <p>{reviewsError}</p>
                <button className="btn btn-outline" onClick={() => setRetry((value) => value + 1)}>
                  Повторить загрузку отзывов
                </button>
              </div>
            ) : reviews.length ? (
              reviews.map((review) => (
                <article className="review-card" key={review.id}>
                  <div className="review-person">
                    <span className="review-avatar">{review.authorName[0]}</span>
                    <div>
                      <strong>{review.authorName}</strong>
                      <small>{new Date(review.createdAt).toLocaleDateString('ru-RU')}</small>
                    </div>
                  </div>
                  <div className="review-stars">
                    {'★'.repeat(review.rating)}
                    <span>{'☆'.repeat(5 - review.rating)}</span>
                  </div>
                  <p>{review.comment}</p>
                </article>
              ))
            ) : (
              <div className="empty-small">Пока нет отзывов. Поделитесь впечатлением после приготовления.</div>
            )}
          </div>
          <div className="review-form-panel">
            <h3>Уже приготовил?</h3>
            <p>Расскажите, как получилось. Ваш отзыв поможет другим.</p>
            {reviewsLoading || reviewsError ? (
              <p>Форма отзыва станет доступна после загрузки списка</p>
            ) : !user ? (
              <button className="btn btn-primary" onClick={requireUser}>
                Войти, чтобы оставить отзыв
              </button>
            ) : hasReviewed ? (
              <div className="already-reviewed">
                <Check size={18} aria-hidden="true" /> Ты уже оценил этот рецепт
              </div>
            ) : recipe.status === 'APPROVED' ? (
              <form onSubmit={addReview}>
                <label>Твоя оценка</label>
                <div className="rating-input" role="group" aria-label="Твоя оценка">
                  {Array.from({ length: 5 }, (_, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setRating(i + 1)}
                      aria-label={`Оценка ${i + 1}`}
                      aria-pressed={rating === i + 1}
                      className={i < rating ? 'active' : ''}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <label htmlFor="comment">Твой отзыв</label>
                <textarea
                  id="comment"
                  minLength="3"
                  maxLength="500"
                  required
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Расскажи, что тебе понравилось…"
                  rows="4"
                />
                <button className="btn btn-primary" disabled={sending} type="submit">
                  Опубликовать <Send size={16} aria-hidden="true" />
                </button>
              </form>
            ) : (
              <p>Отзывы появятся после публикации.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
