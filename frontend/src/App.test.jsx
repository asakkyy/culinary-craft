import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('Culinary Craft — UI integration tests', () => {
  it('renders a catalog of four recipes', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Каталог рецептов' })).toBeInTheDocument();
    expect(screen.getByText('Найдено: 4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Сырники' })).toBeInTheDocument();
  });

  it('filters recipes with the search input', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск по названию' }), {
      target: { value: 'СЫРНИК' },
    });
    expect(screen.getByText('Найдено: 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Сырники' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Овощной салат' })).not.toBeInTheDocument();
  });

  it('filters by category and displays empty state', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Категория' }), {
      target: { value: 'Ужин' },
    });
    expect(screen.getByText('Найдено: 1')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск по названию' }), {
      target: { value: 'сырники' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('Рецепты не найдены');
  });

  it('adds and removes recipes from favorites', () => {
    render(<App />);
    const favoriteButton = screen.getByRole('button', { name: 'В избранное: Сырники' });
    fireEvent.click(favoriteButton);
    expect(screen.getByRole('button', { name: 'Убрать из избранного: Сырники' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Только избранное/ }));
    expect(screen.getByText('Найдено: 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Сырники' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Убрать из избранного: Сырники' }));
    expect(screen.getByRole('status')).toHaveTextContent('Рецепты не найдены');
  });

  it('allows toggling favorite mode when no recipes are saved', () => {
    render(<App />);
    const region = screen.getByRole('region', { name: 'Каталог рецептов' });
    expect(within(region).getAllByRole('article')).toHaveLength(4);
    fireEvent.click(screen.getByRole('checkbox', { name: /Только избранное/ }));
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /Только избранное/ }));
    expect(within(region).getAllByRole('article')).toHaveLength(4);
  });
});
