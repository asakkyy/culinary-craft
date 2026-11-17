import { StrictMode, useState } from 'react';
import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Открыть окно</button>
      {open && (
        <Modal title="Проверка фокуса" onClose={() => setOpen(false)}>
          <p>Содержимое</p>
        </Modal>
      )}
    </>
  );
}
it('возвращает фокус на кнопку открытия и снимает блокировку прокрутки в StrictMode', async () => {
  render(
    <StrictMode>
      <Harness />
    </StrictMode>,
  );
  const user = userEvent.setup();
  const opener = screen.getByRole('button', { name: 'Открыть окно' });
  await user.click(opener);
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Проверка фокуса');
  expect(document.body.style.overflow).toBe('hidden');
  await user.click(screen.getByRole('button', { name: 'Закрыть окно' }));
  expect(opener).toHaveFocus();
  expect(document.body.style.overflow).toBe('');
});
