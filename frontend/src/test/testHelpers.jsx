import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';

export const anna = { id: 1, name: 'Анна Петрова', role: 'USER', initials: 'АП', subtitle: 'Любитель' };
export const admin = { id: 3, name: 'Марина Волкова', role: 'ADMIN', initials: 'МВ', subtitle: 'Модератор' };

export const recipe = {
  id: 123, title: 'Тестовый домашний суп', description: 'Вкусный домашний суп из овощей',
  category: 'Супы', emoji: '🍜', imageUrl: '', prepMinutes: 30, servings: 2,
  difficulty: 'Легко', ingredients: ['Вода', 'Морковь'], steps: ['Нарезать', 'Сварить'],
  tags: ['Домашнее'], ownerId: 1, ownerName: 'Анна Петрова', status: 'APPROVED',
  rating: 4.5, reviewCount: 1, favorite: false, createdAt: '2026-01-01T00:00:00Z',
};

export function renderPage(component, path = '/') {
  return render(<MemoryRouter initialEntries={[path]}>{component}</MemoryRouter>);
}
