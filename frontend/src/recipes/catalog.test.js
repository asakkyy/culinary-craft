import { describe, expect, it } from 'vitest';
import { demoRecipes, filterRecipes, formatMinutes } from './catalog';

describe('filterRecipes — unit tests', () => {
  it('returns all recipes for empty filters', () => {
    expect(filterRecipes(demoRecipes)).toHaveLength(4);
  });

  it('searches without case sensitivity and ignores whitespace', () => {
    expect(filterRecipes(demoRecipes, ' СЫРНИК ')).toEqual([demoRecipes[0]]);
  });

  it('filters by category', () => {
    expect(filterRecipes(demoRecipes, '', 'Завтрак')).toHaveLength(2);
  });

  it('combines category and text search', () => {
    expect(filterRecipes(demoRecipes, 'паста', 'Завтрак')).toEqual([]);
    expect(filterRecipes(demoRecipes, 'паста', 'Ужин')).toEqual([demoRecipes[1]]);
  });

  it('does not mutate the input array', () => {
    const copy = [...demoRecipes];
    filterRecipes(demoRecipes, 'салат');
    expect(demoRecipes).toEqual(copy);
  });
});

describe('formatMinutes — unit tests', () => {
  it('formats minutes', () => {
    expect(formatMinutes(25)).toBe('25 мин');
  });

  it('formats hours', () => {
    expect(formatMinutes(120)).toBe('2 ч');
    expect(formatMinutes(90)).toBe('1 ч 30 мин');
  });

  it('rejects invalid duration', () => {
    expect(() => formatMinutes(0)).toThrow(RangeError);
    expect(() => formatMinutes(1.5)).toThrow(RangeError);
    expect(() => formatMinutes(-1)).toThrow(RangeError);
  });
});
