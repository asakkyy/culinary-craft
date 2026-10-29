import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App component', () => {
  it('renders without crashing', () => {
    render(<App />);
    // Просто проверяем, что компонент отрендерился
    expect(document.body).toBeInTheDocument();
  });
});