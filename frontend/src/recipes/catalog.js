export const demoRecipes = [
  {
    id: 1,
    title: 'Сырники',
    category: 'Завтрак',
    minutes: 25,
    description: 'Нежные сырники на сковороде.',
  },
  {
    id: 2,
    title: 'Паста с томатами',
    category: 'Ужин',
    minutes: 30,
    description: 'Простой ужин с ароматными травами.',
  },
  {
    id: 3,
    title: 'Овощной салат',
    category: 'Обед',
    minutes: 15,
    description: 'Свежие овощи и лёгкая заправка.',
  },
  {
    id: 4,
    title: 'Омлет с сыром',
    category: 'Завтрак',
    minutes: 10,
    description: 'Быстрый завтрак из доступных продуктов.',
  },
];

export function filterRecipes(recipes, query = '', category = 'Все') {
  const normalizedQuery = query.trim().toLocaleLowerCase('ru');
  return recipes.filter((recipe) => {
    const matchesName = recipe.title.toLocaleLowerCase('ru').includes(normalizedQuery);
    const matchesCategory = category === 'Все' || recipe.category === category;
    return matchesName && matchesCategory;
  });
}

export function formatMinutes(minutes) {
  if (!Number.isInteger(minutes) || minutes < 1) {
    throw new RangeError('Время приготовления должно быть положительным целым числом');
  }
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} ч` : `${hours} ч ${remainder} мин`;
}
