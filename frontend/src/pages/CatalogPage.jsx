import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight, ChefHat, Clock3, Search, SlidersHorizontal, Sparkles, Utensils } from 'lucide-react';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';
import RecipeCard from '../components/RecipeCard';

const categories = [
  { name: 'Все рецепты', icon: '✳' }, { name: 'Завтраки', icon: '🥐' },
  { name: 'Основные блюда', icon: '🍝' }, { name: 'Десерты', icon: '🍰' },
  { name: 'Салаты', icon: '🥗' }, { name: 'Супы', icon: '🥣' }, { name: 'Напитки', icon: '🍹' },
];

export default function CatalogPage() {
  const { dataVersion } = useApp();
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('search') || '');
  const [data, setData] = useState({ content: [], total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const category = params.get('category') || 'Все рецепты';
  const sort = params.get('sort') || 'popular';
  const page = Math.max(0, Number(params.get('page')) || 0);
  const search = params.get('search') || '';
  const visiblePages = [...new Set([0, page - 1, page, page + 1, data.totalPages - 1])]
    .filter(value => value >= 0 && value < data.totalPages).sort((a, b) => a - b);
  const changeParams = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, val] of Object.entries(patch)) {
      if (!val || val === 'Все рецепты' || (key === 'sort' && val === 'popular')) next.delete(key);
      else next.set(key, String(val));
    }
    setParams(next);
  };
  useEffect(() => { setInput(search); }, [search]);
  useEffect(() => {
    let valid = true;
    setLoading(true); setError('');
    api.catalog({ search, category, sort, page, size: 6 }).then((result) => { if (valid) setData(result); })
      .catch((err) => { if (valid) setError(errorText(err)); })
      .finally(() => { if (valid) setLoading(false); });
    return () => { valid = false; };
  }, [search, category, sort, page, dataVersion]);

  return <>
    <section className="hero-section"><div className="container hero-layout">
      <div className="hero-copy"><div className="eyebrow"><Sparkles size={15} /> ТВОЁ ВДОХНОВЕНИЕ НА КАЖДЫЙ ДЕНЬ</div>
        <h1>Вкусно жить —<br/><em>просто.</em></h1>
        <p>Тысяча поводов собраться за одним столом. Находи любимые рецепты, пробуй новое и делись тем, что приготовлено с душой.</p>
        <div className="hero-buttons"><a className="btn btn-primary btn-lg" href="#catalog">Найти рецепт <ArrowUpRight size={19}/></a>
          <Link className="btn btn-outline btn-lg" to="/create">Поделиться своим <ArrowRight size={18}/></Link></div>
        <div className="hero-stats"><div><strong>06</strong><small>категорий</small></div><span></span><div><strong>100%</strong><small>вдохновения</small></div><span></span><div><strong>∞</strong><small>идей на ужин</small></div></div>
      </div>
      <div className="hero-visual"><div className="hero-photo" role="img" aria-label="Красочная домашняя еда"/>
        <div className="hero-sticker"><span>СОЗДАНО С</span><strong>♥</strong><span>ЛЮБОВЬЮ</span></div>
        <div className="hero-floating"><span className="hero-floating-icon">✨</span><div><strong>Немного волшебства</strong><small>в каждой тарелке</small></div></div>
        <div className="hero-dots" aria-hidden="true">✴ ✳ ✴</div>
      </div>
    </div></section>

    <section className="intro-strip"><div className="container intro-strip-inner"><span><ChefHat size={19}/> Готовь с удовольствием</span><span>✳</span><span><Utensils size={19}/> Сохраняй любимое</span><span>✳</span><span><Clock3 size={19}/> Делись вдохновением</span></div></section>

    <section className="catalog-section container" id="catalog"><div className="section-heading"><div><div className="eyebrow muted">НАША КОЛЛЕКЦИЯ</div><h2>Что приготовим <em>сегодня?</em></h2><p>От простых завтраков до особенных ужинов — выбирай по настроению.</p></div><span className="handwritten">Сделано с любовью ♡</span></div>
      <div className="categories" role="group" aria-label="Категории рецептов">
        {categories.map((item) => <button key={item.name} className={`category-pill ${category === item.name ? 'active' : ''}`} onClick={() => changeParams({ category: item.name, page: '' })}><span>{item.icon}</span>{item.name}</button>)}
      </div>
      <div className="catalog-toolbar"><form className="search-box" onSubmit={(e) => { e.preventDefault(); changeParams({ search: input.trim(), page: '' }); }}><Search size={20}/><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Найти что-нибудь вкусное..." aria-label="Поиск рецептов"/><button type="submit">Найти <ArrowRight size={16}/></button></form>
        <div className="sort-control"><SlidersHorizontal size={17}/><label htmlFor="recipe-sort">Сортировка:</label><select id="recipe-sort" value={sort} onChange={(e) => changeParams({ sort: e.target.value, page: '' })}><option value="popular">Популярные</option><option value="newest">Сначала новые</option><option value="rating">По рейтингу</option><option value="quick">Быстрые</option></select></div>
      </div>
      <div className="results-header"><strong>{loading ? 'Загружаем рецепты…' : `Найдено ${data.total} рецептов`}</strong><span>Листай ниже за вкусными идеями <ArrowDown size={16}/></span></div>
      {error && <div className="error-box" role="alert"><strong>Не удалось загрузить рецепты</strong><p>{error}</p><small>Проверь, что Spring Boot запущен, затем обнови страницу.</small></div>}
      {!error && (loading ? <div className="recipe-grid">{Array.from({ length: 6 }, (_, i) => <div className="card-skeleton" key={i}/>)}</div> : data.content.length ?
        <div className="recipe-grid">{data.content.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe}/>)}</div> :
        <div className="empty-state"><span>🔎</span><h3>Пока ничего не нашли</h3><p>Попробуй другую категорию или более короткий запрос.</p><button className="btn btn-primary" onClick={() => { setInput(''); setParams({}); }}>Сбросить фильтры</button></div>)}
      {!error && data.totalPages > 1 && <nav className="pagination" aria-label="Страницы каталога"><button disabled={loading || page === 0} onClick={() => changeParams({ page: page - 1 || '' })}>Назад</button>{visiblePages.map(i => <button key={i} aria-current={page === i ? 'page' : undefined} className={page === i ? 'active' : ''} disabled={loading} onClick={() => changeParams({ page: i || '' })}>{i + 1}</button>)}<button disabled={loading || page >= data.totalPages - 1} onClick={() => changeParams({ page: page + 1 })}>Далее</button></nav>}
    </section>
    <section className="bottom-banner"><div className="container banner-inner"><div className="banner-emoji">👩🏻‍🍳</div><div><div className="eyebrow light">ТВОЯ ИСТОРИЯ ВКУСА</div><h2>Есть рецепт, который <em>все обожают?</em></h2><p>Сохрани его здесь и подари другим немного своего вдохновения.</p></div><Link to="/create" className="btn btn-light">Добавить рецепт <ArrowUpRight size={19}/></Link></div></section>
  </>;
}
