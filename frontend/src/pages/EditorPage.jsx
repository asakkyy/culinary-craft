import ImageUpload from '../components/ImageUpload';
import FormError from '../components/FormError';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ImagePlus, Minus, Plus, Save, ClipboardList } from 'lucide-react';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';
import { applyDraft, draftChanges, draftKey, hasDraftConflict, readDraft } from './recipeDraft';
import useRecipeDraft from './useRecipeDraft';

const categories = ['Завтраки', 'Основные блюда', 'Десерты', 'Салаты', 'Супы', 'Напитки'];
const init = {
  title: '',
  description: '',
  category: 'Завтраки',
  emoji: '🍽️',
  imageUrl: '',
  prepMinutes: '30',
  servings: '2',
  difficulty: 'Легко',
  ingredients: ['', ''],
  steps: ['', ''],
  tags: '',
};

const formatTime = new Intl.DateTimeFormat('ru', { dateStyle: 'medium', timeStyle: 'short' });

function recipeForm(recipe) {
  return {
    ...Object.fromEntries(Object.keys(init).map((name) => [name, recipe[name]])),
    prepMinutes: String(recipe.prepMinutes),
    servings: String(recipe.servings),
    imageUrl: recipe.imageUrl || '',
    tags: recipe.tags.join(', '),
  };
}

export default function EditorPage() {
  const { id } = useParams();
  const { user, setPickerOpen } = useApp();
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
  const key = draftKey(user.id, id);
  return <RecipeEditor key={key} storageKey={key} id={id} userId={user.id} />;
}

function RecipeEditor({ storageKey, id, userId }) {
  const edit = Boolean(id);
  const { notify, changed } = useApp();
  const [initial] = useState(() => readDraft(storageKey));
  const [recovery, setRecovery] = useState(initial.raw !== null);
  const [recoveryOpen, setRecoveryOpen] = useState(recovery);
  const [base, setBase] = useState(init);
  const [photo, setPhoto] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoHint, setPhotoHint] = useState(null);
  const [linkHint, setLinkHint] = useState(false);
  const [photoKey, setPhotoKey] = useState(0);
  const [createdId, setCreatedId] = useState(null);
  const [form, setForm] = useState(init);
  const sourceId = id || initial.draft?.createdId;
  const [loading, setLoading] = useState(Boolean(sourceId));
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [leaveError, setLeaveError] = useState(false);
  const leaving = useRef(false);
  const mounted = useRef(false);
  const navigate = useNavigate();
  const photoChange = photo ? 'select' : removePhoto ? 'remove' : photoHint;
  const snapshot = useMemo(
    () => (loading || loadFailed || recovery ? null : draftChanges(base, form, photoChange, createdId, linkHint)),
    [base, form, photoChange, createdId, linkHint, loading, loadFailed, recovery],
  );
  const dirty = snapshot !== null;
  const { status, flush, clear } = useRecipeDraft(storageKey, initial, snapshot);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!sourceId) return;
    let active = true;
    api
      .one(sourceId)
      .then((r) => {
        if (!active) return;
        if (!id && r.ownerId !== userId) throw new Error('Сохранённый рецепт недоступен');
        const loaded = recipeForm(r);
        setBase(loaded);
        setForm(loaded);
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
  }, [id, loadAttempt, sourceId, userId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => {
      if (leaving.current) return;
      flush(false);
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, flush]);

  const set = (name, value) => {
    if (name === 'imageUrl') setLinkHint(false);
    setForm((old) => ({ ...old, [name]: value }));
  };
  const listChange = (name, index, val) =>
    set(
      name,
      form[name].map((item, i) => (i === index ? val : item)),
    );
  const listAdd = (name) => set(name, [...form[name], '']);
  const listRemove = (name, index) => set(name, form[name].length > 1 ? form[name].filter((_, i) => i !== index) : ['']);

  function restore() {
    const draft = initial.draft;
    const restored = applyDraft(draft, base);
    const needsLink = draft.needsImageUrl || (Boolean(draft.fields.imageUrl) && base.imageUrl.startsWith('/api/media/'));
    const retryId = edit ? null : draft.createdId;
    if (!draftChanges(base, restored, draft.photo, retryId, needsLink)) clear();
    setForm(restored);
    setPhotoHint(draft.photo);
    setLinkHint(needsLink);
    setCreatedId(retryId);
    setRecovery(false);
  }

  function discard() {
    clear();
    const fresh = edit ? base : init;
    setBase(fresh);
    setForm(fresh);
    setPhoto(null);
    setRemovePhoto(false);
    setPhotoHint(null);
    setLinkHint(false);
    setCreatedId(null);
    setPhotoKey((value) => value + 1);
    setError('');
    if (!edit) setLoadFailed(false);
    setRecovery(false);
    setDiscardOpen(false);
  }

  async function submit(event) {
    event.preventDefault();
    if (recovery || saving) return;
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
    flush();
    setSaving(true);
    try {
      const saved = edit ? await api.update(id, body) : createdId ? await api.update(createdId, body) : await api.create(body);
      if (!edit && !createdId && (photo || removePhoto)) {
        flush(mounted.current, { ...snapshot, createdId: saved.id });
        if (mounted.current) setCreatedId(saved.id);
      }
      if (!mounted.current && (photo || removePhoto)) return;
      if (removePhoto) await api.deletePhoto(saved.id);
      if (photo) await api.photo(saved.id, photo);
      leaving.current = true;
      clear(mounted.current);
      if (!mounted.current) return;
      changed();
      notify('Рецепт отправлен на модерацию');
      if (blocker.state === 'blocked') blocker.reset();
      navigate(`/recipes/${saved.id}`);
    } catch (err) {
      if (mounted.current) setError(errorText(err));
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
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
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setLoading(true);
            setLoadFailed(false);
            setError('');
            setLoadAttempt((attempt) => attempt + 1);
          }}
        >
          Повторить загрузку
        </button>
        {recovery && !edit && (
          <button type="button" className="btn btn-outline" onClick={() => setDiscardOpen(true)}>
            Удалить черновик
          </button>
        )}
        <Link className="btn btn-primary" to="/profile">
          Вернуться к своим рецептам
        </Link>
        {discardOpen && (
          <ConfirmDialog title="Удалить черновик?" label="Удалить черновик" onClose={() => setDiscardOpen(false)} onConfirm={discard}>
            <p>Браузер удалит локальный черновик. Рецепт в профиле сохранится, если он уже был создан.</p>
          </ConfirmDialog>
        )}
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
      <div className="editor-draft">
        <p role="status">
          {status === 'saving' && 'Сохранение черновика…'}
          {status === 'saved' && 'Черновик сохранён'}
          {status === 'error' && 'Не удалось сохранить черновик. Проверьте доступ к хранилищу и другие открытые вкладки редактора.'}
        </p>
        {recovery && !recoveryOpen && (
          <button type="button" className="btn btn-outline" onClick={() => setRecoveryOpen(true)}>
            {initial.draft ? 'Найден черновик' : 'Черновик недоступен'}
          </button>
        )}
        {dirty && (
          <button type="button" className="btn btn-outline" onClick={() => setDiscardOpen(true)} disabled={saving}>
            Удалить черновик
          </button>
        )}
      </div>
      <section className="editor-card">
        <ImageUpload
          key={photoKey}
          label="Фотография рецепта"
          url={form.imageUrl}
          hideCurrent={removePhoto}
          busy={saving || recovery}
          onFile={(file) => {
            setPhoto(file);
            setRemovePhoto(false);
            setPhotoHint(null);
          }}
          onDelete={() => {
            if (!photo) setRemovePhoto(Boolean(form.imageUrl));
            setPhoto(null);
            setPhotoHint(null);
          }}
        />
        {photoHint && (
          <p className="info-note">
            {photoHint === 'select'
              ? 'После восстановления черновика выберите файл фотографии заново.'
              : 'Фотография рецепта сохранена. Если нужно убрать её, нажмите «Удалить изображение» ещё раз.'}
          </p>
        )}
        {(snapshot?.needsImageUrl || linkHint) && (
          <p className="info-note">Ссылка с параметрами или временный адрес не сохраняются в черновике. При необходимости укажите ссылку заново.</p>
        )}
      </section>
      {error && <FormError>{error}</FormError>}
      <form className="editor-form" onSubmit={submit}>
        <fieldset className="editor-main" disabled={saving || recovery}>
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
        </fieldset>
        <fieldset className="editor-aside" disabled={saving || recovery}>
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
                  readOnly={Boolean(photo) || form.imageUrl.startsWith('/api/media/')}
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
        </fieldset>
      </form>
      {recovery && recoveryOpen && (
        <Modal title={initial.draft ? 'Найден черновик' : 'Черновик недоступен'} onClose={() => setRecoveryOpen(false)}>
          {initial.draft ? (
            <>
              <p>
                Последнее автосохранение{' '}
                <time dateTime={new Date(initial.draft.savedAt).toISOString()}>{formatTime.format(initial.draft.savedAt)}</time>.
              </p>
              {hasDraftConflict(initial.draft, base) && (
                <p className="info-note">
                  Рецепт на сервере изменился. При восстановлении локальные изменения появятся в форме. Проверьте их перед отправкой.
                </p>
              )}
              {initial.draft.createdId && (
                <p>Рецепт №{initial.draft.createdId} уже создан. Восстановление продолжит работу с ним.</p>
              )}
              <p>Действие «Начать заново» удалит локальный черновик.</p>
            </>
          ) : (
            <p>Черновик повреждён или несовместим с этой версией приложения.</p>
          )}
          <div className="dialog-actions">
            <button type="button" className="btn btn-outline" onClick={discard}>
              Начать заново
            </button>
            {initial.draft && (
              <button type="button" className="btn btn-primary" onClick={restore}>
                Восстановить черновик
              </button>
            )}
          </div>
        </Modal>
      )}
      {discardOpen && blocker.state !== 'blocked' && (
        <ConfirmDialog title="Удалить черновик?" label="Удалить черновик" onClose={() => setDiscardOpen(false)} onConfirm={discard}>
          <p>Браузер удалит локальные изменения. На сервере сохранятся текущие данные рецепта.</p>
        </ConfirmDialog>
      )}
      {blocker.state === 'blocked' && (
        <ConfirmDialog
          title="Выйти из редактора?"
          label={leaveError ? 'Уйти без локального сохранения' : 'Сохранить черновик и выйти'}
          danger={leaveError}
          busy={saving}
          onClose={() => {
            setLeaveError(false);
            blocker.reset();
          }}
          onConfirm={() => {
            if (leaveError || flush()) {
              leaving.current = true;
              blocker.proceed();
            } else setLeaveError(true);
          }}
          error={leaveError ? 'Не удалось сохранить черновик. Останьтесь в редакторе, чтобы сохранить введённые изменения.' : null}
        >
          <p>Вы сможете восстановить введённые поля позже в этом браузере. Новый файл фотографии потребуется выбрать заново.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
