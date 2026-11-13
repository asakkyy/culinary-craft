import { useMemo, useState } from 'react';
import { demoRecipes, filterRecipes, formatMinutes } from './recipes/catalog';
import './App.css';

const categories = ['Все', 'Завтрак', 'Обед', 'Ужин'];

export default function App() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Все');
  const [favorites, setFavorites] = useState([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const visibleRecipes = useMemo(() => {
    const found = filterRecipes(demoRecipes, query, category);
    return onlyFavorites ? found.filter((recipe) => favorites.includes(recipe.id)) : found;
  }, [query, category, favorites, onlyFavorites]);

  function toggleFavorite(id) {
    setFavorites((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <span className="brand">Culinary Craft</span>
        <span className="header-label">Лабораторная №5 · CI/CD и метрики</span>
      </header>
      <main className="container">
        <section className="intro">
          <p className="eyebrow">Демонстрационное приложение</p>
          <h1>Рецепты, которые хочется готовить</h1>
          <p>
            Минимальное, но работающее приложение для проверки поиска, фильтров и избранного.
            Проверки этих сценариев запускаются автоматически в GitHub Actions.
          </p>
        </section>

        <section className="filters" aria-label="Поиск рецептов">
          <label htmlFor="search">Поиск по названию</label>
          <input
            id="search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Например, сырники"
          />
          <label htmlFor="category">Категория</label>
          <select
            id="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={onlyFavorites}
              onChange={(event) => setOnlyFavorites(event.target.checked)}
            />
            Только избранное ({favorites.length})
          </label>
        </section>

        <section aria-label="Каталог рецептов">
          <div className="section-head">
            <h2>Каталог рецептов</h2>
            <p data-testid="result-count">Найдено: {visibleRecipes.length}</p>
          </div>
          {visibleRecipes.length === 0 ? (
            <p role="status" className="empty-state">
              Рецепты не найдены. Измените фильтры.
            </p>
          ) : (
            <div className="recipes">
              {visibleRecipes.map((recipe) => (
                <article key={recipe.id} className="recipe-card">
                  <div className="recipe-meta">
                    <span>{recipe.category}</span>
                    <span>{formatMinutes(recipe.minutes)}</span>
                  </div>
                  <h3>{recipe.title}</h3>
                  <p>{recipe.description}</p>
                  <button
                    className="favorite-button"
                    type="button"
                    aria-label={`${favorites.includes(recipe.id) ? 'Убрать из избранного' : 'В избранное'}: ${recipe.title}`}
                    aria-pressed={favorites.includes(recipe.id)}
                    onClick={() => toggleFavorite(recipe.id)}
                  >
                    {favorites.includes(recipe.id) ? '♥ В избранном' : '♡ В избранное'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <footer>© Culinary Craft · Мини-приложение для измеримого тестирования</footer>
    </div>
  );
}
