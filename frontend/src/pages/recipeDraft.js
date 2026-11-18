const version = 1;
const maxSize = 256 * 1024;
const text = (value) => typeof value === 'string';
const list = (value) => Array.isArray(value) && value.length > 0 && value.every(text);
const numberInput = (value) => text(value) && (value === '' || Number.isFinite(Number(value)));

function publicImageUrl(value) {
  if (value === '') return true;
  if (!text(value)) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

const fields = {
  title: text,
  description: text,
  category: text,
  difficulty: text,
  prepMinutes: numberInput,
  servings: numberInput,
  ingredients: list,
  steps: list,
  tags: text,
  imageUrl: publicImageUrl,
};

export const draftKey = (userId, recipeId) => `cc-recipe-draft:${userId}:${recipeId ? `edit:${recipeId}` : 'create'}`;
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function draftChanges(base, form, photo, createdId, missingImageUrl) {
  const changes = {};
  let needsImageUrl = missingImageUrl;
  for (const name of Object.keys(fields)) {
    if (equal(base[name], form[name])) continue;
    if (name === 'imageUrl' && !publicImageUrl(form.imageUrl)) {
      needsImageUrl = true;
      continue;
    }
    changes[name] = {
      before: name === 'imageUrl' && !publicImageUrl(base.imageUrl) ? null : base[name],
      value: form[name],
    };
  }
  return Object.keys(changes).length || photo || createdId || needsImageUrl
    ? { fields: changes, photo, createdId, needsImageUrl }
    : null;
}

export function hasDraftConflict(draft, base) {
  return Object.entries(draft.fields).some(([name, change]) => !equal(base[name], change.before) && !equal(base[name], change.value));
}

export function applyDraft(draft, base) {
  const result = { ...base };
  for (const [name, change] of Object.entries(draft.fields)) {
    if (name === 'imageUrl' && base.imageUrl.startsWith('/api/media/')) continue;
    result[name] = change.value;
  }
  return result;
}

function isDraft(draft) {
  return (
    draft?.version === version &&
    Number.isSafeInteger(draft.savedAt) &&
    draft.savedAt > 0 &&
    draft.savedAt <= 8.64e15 &&
    [null, 'select', 'remove'].includes(draft.photo) &&
    (draft.createdId === null || (Number.isSafeInteger(draft.createdId) && draft.createdId > 0)) &&
    typeof draft.needsImageUrl === 'boolean' &&
    draft.fields &&
    typeof draft.fields === 'object' &&
    !Array.isArray(draft.fields) &&
    Object.entries(draft.fields).every(
      ([name, change]) =>
        Object.hasOwn(fields, name) &&
        fields[name](change?.value) &&
        ((name === 'imageUrl' && change.before === null) || fields[name](change.before)),
    )
  );
}

export function readDraft(key) {
  let raw = null;
  try {
    raw = localStorage.getItem(key);
    if (raw === null) return { raw, draft: null };
    const draft = raw.length <= maxSize && JSON.parse(raw);
    if (isDraft(draft)) return { raw, draft };
  } catch {
    if (raw === null) return { raw, draft: null, inaccessible: true };
  }
  return { raw, draft: null };
}

export function encodeDraft(snapshot) {
  const raw = JSON.stringify({ version, savedAt: Date.now(), ...snapshot });
  if (raw.length > maxSize) throw new RangeError('Draft exceeds local storage limit');
  return raw;
}
