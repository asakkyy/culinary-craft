import ImageUpload from '../components/ImageUpload';
import FormError from '../components/FormError';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ImagePlus, Minus, Plus, Save, ClipboardList } from 'lucide-react';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';

const categories = ['Завтраки', 'Основные блюда', 'Десерты', 'Салаты', 'Супы', 'Напитки'];
const init = {
  title: '',
  description: '',
  category: 'Завтраки',
  emoji: '🍽️',
  imageUrl: '',
  prepMinutes: 30,
  servings: 2,
  difficulty: 'Легко',
  ingredients: ['', ''],
  steps: ['', ''],
  tags: '',
};

export default function EditorPage() {
  const { id } = useParams();
  const edit = Boolean(id);
  const { user, setPickerOpen, notify, changed } = useApp();
  const [photo, setPhoto] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [createdId, setCreatedId] = useState(null);
  const [form, setForm] = useState(init);
  const [loading, setLoading] = useState(edit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (!edit || !user?.id) return;
    setLoading(true);
    setLoadFailed(false);
    let active = true;
    api
      .one(id)
      .then((r) => {
        if (active) setForm({ ...r, tags: r.tags.join(', ') });
      })
      .catch((err) => {
        if (active) {
          setError(errorText(err));
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, edit, user?.id]);
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving]);
  const set = (name, value) => {
    setDirty(true);
    setForm((old) => ({ ...old, [name]: value }));
  };
  const listChange = (name, index, val) =>
    set(
      name,
      form[name].map((item, i) => (i === index ? val : item)),
    );
  const listAdd = (name) => set(name, [...form[name], '']);
  const listRemove = (name, index) => set(name, form[name].length > 1 ? form[name].filter((_, i) => i !== index) : ['']);
  async function submit(event) {
    event.preventDefault();
    if (!user) {
      setPickerOpen(true);
      return;
    }
    const ingredients = form.ingredients.map((s) => s.trim()).filter(Boolean);
    const steps = form.steps.map((s) => s.trim()).filter(Boolean);
    if (!ingredients.length || !steps.length) {
      setError('Добавь хотя бы один ингредиент и один шаг.');
      return;
    }
    const body = {
      ...form,
      ingredients,
      steps,
      tags: form.tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      prepMinutes: Number(form.prepMinutes),
      servings: Number(form.servings),
    };
    setError('');
    setSaving(true);
    try {
      const saved = edit ? await api.update(id, body) : createdId ? await api.update(createdId, body) : await api.create(body);
      setCreatedId(saved.id);
      if (removePhoto) await api.deletePhoto(saved.id);
      if (photo) await api.photo(saved.id, photo);
      changed();
      setDirty(false);
      notify('Рецепт отправлен на модерацию');
      navigate(`/recipes/${saved.id}`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }
  if (!user)
    return (
      <div className="container narrow-page">
        <div className="empty-state">
          <h2>Войдите, чтобы создать рецепт</h2>
          <p>Сохраняйте рецепты в своём аккаунте и отправляйте их на публикацию.</p>
          <button className="btn btn-primary" onClick={() => setPickerOpen(true)}>
            Войти
          </button>
        </div>
      </div>
    );
  if (loading)
    return (
      <div className="container narrow-page">
        <div className="loading-message">Загружаем форму…</div>
      </div>
    );
  if (loadFailed)
    return (
      <section className="container narrow-page">
        <h1>Рецепт недоступен</h1>
        <div className="error-box" role="alert">
          {error}
        </div>
        <Link className="btn btn-primary" to="/profile">
          Вернуться к своим рецептам
        </Link>
      </section>
    );
  return (
    <div className="container editor-page">
      <Link to={edit ? `/recipes/${id}` : '/profile'} className="back-link">
        <ArrowLeft size={17} aria-hidden="true" /> Назад
      </Link>
      <div className="editor-heading">
        <div>
          <div className="eyebrow muted">
            <ClipboardList aria-hidden="true" /> Авторский рецепт
          </div>
          <h1>{edit ? 'Изменить рецепт' : 'Поделись своим рецептом'}</h1>
          <p>Заполни ингредиенты и шаги, чтобы каждый смог повторить твоё блюдо.</p>
        </div>
      </div>
      <section className="editor-card">
        <ImageUpload
          label="Фотография рецепта"
          url={removePhoto ? '' : form.imageUrl}
          busy={saving}
          onFile={(file) => {
            setDirty(true);
            setPhoto(file);
            setRemovePhoto(false);
          }}
          onDelete={() => {
            setDirty(true);
            setPhoto(null);
            setRemovePhoto(true);
          }}
        />
      </section>
      {error && <FormError>{error}</FormError>}
      <form className="editor-form" onSubmit={submit}>
        <div className="editor-main">
          <section className="editor-card">
            <div className="editor-section-title">
              <span>01</span>
              <div>
                <h2>Основная информация</h2>
                <p>Начнём со знакомства с блюдом.</p>
              </div>
            </div>
            <div className="field">
              <label htmlFor="title">
                Название рецепта <b>*</b>
              </label>
              <input
                id="title"
                name="title"
                required
                minLength="3"
                maxLength="100"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Например, бабушкины сырники"
              />
            </div>
            <div className="field">
              <label htmlFor="description">
                Краткое описание <b>*</b>
              </label>
              <textarea
                id="description"
                name="description"
                required
                minLength="15"
                maxLength="1500"
                rows="4"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Что делает это блюдо особенным?"
              />
            </div>
            <div className="form-two-col">
              <div className="field">
                <label htmlFor="category">Категория</label>
                <select id="category" name="category" value={form.category} onChange={(e) => set('category', e.target.value)}>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="difficulty">Сложность</label>
                <select id="difficulty" name="difficulty" value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
                  <option>Легко</option>
                  <option>Средне</option>
                  <option>Сложно</option>
                </select>
              </div>
            </div>
            <div className="form-two-col">
              <div className="field">
                <label htmlFor="minutes">Время, минут</label>
                <input
                  id="minutes"
                  name="minutes"
                  type="number"
                  min="1"
                  max="1440"
                  value={form.prepMinutes}
                  onChange={(e) => set('prepMinutes', e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="servings">Порции</label>
                <input
                  id="servings"
                  name="servings"
                  type="number"
                  min="1"
                  max="30"
                  value={form.servings}
                  onChange={(e) => set('servings', e.target.value)}
                  required
                />
              </div>
            </div>
          </section>
          <section className="editor-card">
            <div className="editor-section-title">
              <span>02</span>
              <div>
                <h2>Ингредиенты</h2>
                <p>Перечисли всё, что понадобится.</p>
              </div>
            </div>
            <div className="dynamic-fields">
              {form.ingredients.map((value, i) => (
                <div className="dynamic-row" key={i}>
                  <span>{i + 1}.</span>
                  <input
                    aria-label={`Ингредиент ${i + 1}`}
                    value={value}
                    onChange={(e) => listChange('ingredients', i, e.target.value)}
                    placeholder="Например, Мука — 200 г"
                  />
                  <button type="button" className="remove-row" onClick={() => listRemove('ingredients', i)} aria-label="Удалить ингредиент">
                    <Minus size={18} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            <button className="add-row" type="button" onClick={() => listAdd('ingredients')}>
              <Plus size={17} aria-hidden="true" /> Добавить ингредиент
            </button>
          </section>
          <section className="editor-card">
            <div className="editor-section-title">
              <span>03</span>
              <div>
                <h2>Способ приготовления</h2>
                <p>Разбей процесс на понятные шаги.</p>
              </div>
            </div>
            <div className="dynamic-fields">
              {form.steps.map((value, i) => (
                <div className="dynamic-row step-field" key={i}>
                  <span>{i + 1}.</span>
                  <textarea
                    aria-label={`Шаг ${i + 1}`}
                    rows="2"
                    value={value}
                    onChange={(e) => listChange('steps', i, e.target.value)}
                    placeholder="Что нужно сделать на этом шаге?"
                  />
                  <button type="button" className="remove-row" onClick={() => listRemove('steps', i)} aria-label="Удалить шаг">
                    <Minus size={18} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            <button className="add-row" type="button" onClick={() => listAdd('steps')}>
              <Plus size={17} aria-hidden="true" /> Добавить шаг
            </button>
          </section>
        </div>
        <aside className="editor-aside">
          <section className="editor-card">
            <div className="editor-section-title">
              <span>04</span>
              <div>
                <h2>Оформление</h2>
                <p>Сделаем блюдо узнаваемым.</p>
              </div>
            </div>
            <div className="field">
              <label htmlFor="image">Ссылка на фотографию</label>
              <div className="input-with-icon">
                <ImagePlus size={19} aria-hidden="true" />
                <input
                  id="image"
                  name="image"
                  type="text"
                  readOnly={form.imageUrl.startsWith('/api/media/')}
                  value={form.imageUrl}
                  onChange={(e) => set('imageUrl', e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <small>Можно загрузить фотографию выше или указать ссылку на существующее изображение.</small>
            </div>
            <div className="field">
              <label htmlFor="tags">Теги через запятую</label>
              <input
                id="tags"
                name="tags"
                value={form.tags}
                onChange={(e) => set('tags', e.target.value)}
                placeholder="Быстро, Домашнее, Без мяса"
              />
            </div>
          </section>
          <div className="editor-submit">
            <div className="review-note">
              <p>
                <strong>Рецепт попадёт на проверку</strong>
                <br />
                Модератор опубликует его в общем каталоге после одобрения.
              </p>
            </div>
            <button className="btn btn-primary btn-block" disabled={saving} type="submit">
              <Save size={18} aria-hidden="true" />
              {saving ? 'Сохраняем…' : edit ? 'Сохранить изменения' : 'Отправить рецепт'}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <Link to="/profile" className="cancel-link">
              Отмена
            </Link>
          </div>
        </aside>
      </form>
    </div>
  );
}
