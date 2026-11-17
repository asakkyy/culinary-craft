import { createElement, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ChefHat, Coffee, Soup, CakeSlice, Salad, Utensils, GlassWater, Search, Clock3 } from 'lucide-react';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';
import RecipeCard from '../components/RecipeCard';
import CoverImage from '../components/CoverImage';

const categories = [
  ['Все рецепты', Utensils],
  ['Завтраки', Coffee],
  ['Основные блюда', ChefHat],
  ['Десерты', CakeSlice],
  ['Салаты', Salad],
  ['Супы', Soup],
  ['Напитки', GlassWater],
];
export default function CatalogPage() {
  const { dataVersion } = useApp();
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('search') || '');
  const [data, setData] = useState({ content: [], total: 0, totalPages: 0 });
  const [collection, setCollection] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const category = params.get('category') || 'Все рецепты';
  const sort = params.get('sort') || 'popular';
  const page = Math.max(0, Number(params.get('page')) || 0);
  const search = params.get('search') || '';
  const visiblePages = [...new Set([0, page - 1, page, page + 1, data.totalPages - 1])]
    .filter((value) => value >= 0 && value < data.totalPages)
    .sort((a, b) => a - b);
  const changeParams = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, val] of Object.entries(patch)) {
      if (!val || val === 'Все рецепты' || (key === 'sort' && val === 'popular')) next.delete(key);
      else next.set(key, String(val));
    }
    setParams(next, { preventScrollReset: true });
  };
  useEffect(() => {
    setInput(search);
  }, [search]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api
      .catalog({ search, category, sort, page, size: 6 })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(errorText(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, category, sort, page, dataVersion, retry]);
  useEffect(() => {
    let active = true;
    api
      .catalog({ sort: 'quick', size: 3, page: 0 })
      .then((result) => {
        if (active) setCollection(result.content);
      })
      .catch(() => {
        if (active) setCollection([]);
      });
    return () => {
      active = false;
    };
  }, [dataVersion]);
  const featured = collection[0];
  return (
    <>
      <section className="hero-section">
        <div className="container hero-layout">
          <div className="hero-copy">
            <div className="eyebrow">Culinary Craft · Домашняя кухня</div>
            <h1>
              Хорошая еда
              <br />
              начинается
              <br />
              <em>с рецепта</em>
            </h1>
            <p>Проверенные идеи для обычного ужина и особенного случая. Найдите своё блюдо — и сохраните в личную книгу.</p>
            <div className="hero-buttons">
              <a className="btn btn-primary btn-lg" href="#catalog">
                Найти рецепт <ArrowUpRight />
              </a>
              <Link className="btn btn-text" to="/create">
                Поделиться своим <ArrowRight />
              </Link>
            </div>
            <div className="hero-caption">Готовим, делимся, повторяем</div>
          </div>
          <div className="hero-visual">
            {featured ? (
              <Link to={`/recipes/${featured.id}`} className="hero-feature">
                <CoverImage recipe={featured} priority />
                <div className="hero-feature-caption">
                  <span>
                    {featured.category} · {featured.prepMinutes} мин
                  </span>
                  <strong>{featured.title}</strong>
                  <span>
                    Открыть рецепт <ArrowUpRight />
                  </span>
                </div>
              </Link>
            ) : (
              <div className="hero-photo" role="img" aria-label="Домашнее блюдо с овощами" />
            )}
          </div>
        </div>
      </section>
      <section className="intro-strip">
        <div className="container intro-strip-inner">
          <span>
            <BookMark /> Личная книга рецептов
          </span>
          <span>
            <Clock3 /> Время приготовления в каждой карточке
          </span>
          <span>
            <ChefHat /> Рецепты от сообщества
          </span>
        </div>
      </section>
      <section className="catalog-section container" id="catalog" aria-label="Каталог рецептов">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Книга рецептов</div>
            <h2>Что приготовим сегодня?</h2>
            <p>Выберите категорию или найдите блюдо по названию и тегам</p>
          </div>
        </div>
        <div className="categories" role="group" aria-label="Категории рецептов">
          {categories.map(([name, Icon]) => (
            <button
              key={name}
              aria-pressed={category === name}
              className={`category-pill ${category === name ? 'active' : ''}`}
              onClick={() => changeParams({ category: name, page: '' })}
            >
              {createElement(Icon)}
              {name}
            </button>
          ))}
        </div>
        <div className="catalog-toolbar">
          <form
            className="search-box"
            onSubmit={(e) => {
              e.preventDefault();
              changeParams({ search: input.trim(), page: '' });
            }}
          >
            <Search />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Название блюда или тег"
              aria-label="Поиск рецептов"
            />
            <button type="submit">
              Найти <ArrowRight />
            </button>
          </form>
          <div className="sort-control">
            <label htmlFor="recipe-sort">Сортировка:</label>
            <select id="recipe-sort" value={sort} onChange={(e) => changeParams({ sort: e.target.value, page: '' })}>
              <option value="popular">Популярные</option>
              <option value="newest">Сначала новые</option>
              <option value="rating">По рейтингу</option>
              <option value="quick">Быстрые</option>
            </select>
          </div>
        </div>
        <div className="results-header" aria-live="polite">
          <strong>{loading ? 'Загружаем рецепты…' : `Найдено ${data.total} рецептов`}</strong>
          {(search || category !== 'Все рецепты') && (
            <button className="btn btn-text" onClick={() => setParams({})}>
              Сбросить фильтры
            </button>
          )}
        </div>
        {error && (
          <div className="error-box" role="alert">
            <strong>Не удалось загрузить рецепты</strong>
            <p>{error}</p>
            <button className="btn btn-outline" onClick={() => setRetry((v) => v + 1)}>
              Повторить загрузку
            </button>
          </div>
        )}
        {!error &&
          (loading ? (
            <div className="recipe-grid" aria-label="Загрузка рецептов">
              {Array.from({ length: 6 }, (_, i) => (
                <div className="card-skeleton" key={i} />
              ))}
            </div>
          ) : data.content.length ? (
            <div className="recipe-grid">
              {data.content.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Search />
              <h3>Пока ничего не нашли</h3>
              <p>Попробуйте другую категорию или более короткий запрос</p>
              {!search && category === 'Все рецепты' && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setInput('');
                    setParams({});
                  }}
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          ))}
        {!error && data.totalPages > 1 && (
          <nav className="pagination" aria-label="Страницы каталога">
            <button disabled={loading || page === 0} onClick={() => changeParams({ page: page - 1 || '' })}>
              Назад
            </button>
            {visiblePages.map((i) => (
              <button
                key={i}
                aria-current={page === i ? 'page' : undefined}
                className={page === i ? 'active' : ''}
                disabled={loading}
                onClick={() => changeParams({ page: i || '' })}
              >
                {i + 1}
              </button>
            ))}
            <button disabled={loading || page + 1 >= data.totalPages} onClick={() => changeParams({ page: page + 1 })}>
              Далее
            </button>
          </nav>
        )}
      </section>
      {!!collection.length && (
        <section className="collection-section container" aria-label="Быстрые рецепты">
          <div className="section-heading">
            <div>
              <div className="eyebrow">На каждый день</div>
              <h2>Когда времени немного</h2>
              <p>Рецепты с самым коротким временем приготовления в каталоге</p>
            </div>
            <Link className="btn btn-text" to="/?sort=quick#catalog">
              Все быстрые рецепты <ArrowRight />
            </Link>
          </div>
          <div className="recipe-grid">
            {collection.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        </section>
      )}
      <section className="bottom-banner">
        <div className="container banner-inner">
          <div>
            <div className="eyebrow">Семейные рецепты и новые находки</div>
            <h2>У каждого блюда есть история</h2>
            <p>Сохраните свою — с ингредиентами, фотографией и понятными шагами</p>
          </div>
          <Link className="btn btn-primary" to="/create">
            Добавить рецепт <ArrowUpRight />
          </Link>
        </div>
      </section>
    </>
  );
}
function BookMark() {
  return <Utensils />;
}
