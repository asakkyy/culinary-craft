import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageUpload from './ImageUpload';
URL.createObjectURL = vi.fn(() => 'blob:preview');
URL.revokeObjectURL = vi.fn();
it('показывает превью и передаёт выбранный файл', async () => {
  const onFile = vi.fn();
  render(<ImageUpload label="Аватар" onFile={onFile} />);
  const file = new File(['png'], 'avatar.png', { type: 'image/png' });
  await userEvent.setup().upload(screen.getByLabelText('Аватар'), file);
  expect(onFile).toHaveBeenCalledWith(file);
  expect(screen.getByAltText('Превью: Аватар')).toBeInTheDocument();
});
it('показывает ошибку сервера', async () => {
  render(<ImageUpload label="Фотография рецепта" onFile={() => Promise.reject(new Error('Неверный формат'))} />);
  await userEvent.setup().upload(screen.getByLabelText('Фотография рецепта'), new File(['fake'], 'fake.png', { type: 'image/png' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Неверный формат');
  expect(screen.queryByAltText('Превью: Фотография рецепта')).not.toBeInTheDocument();
});
it('даёт повторно выбрать тот же файл после ошибки', async () => {
  const onFile = vi.fn().mockRejectedValueOnce(new Error('Нет сети')).mockResolvedValueOnce();
  render(<ImageUpload label="Фото" onFile={onFile} />);
  const user = userEvent.setup();
  const file = new File(['png'], 'same.png', { type: 'image/png' });
  await user.upload(screen.getByLabelText('Фото'), file);
  await screen.findByRole('alert');
  await user.upload(screen.getByLabelText('Фото'), file);
  expect(onFile).toHaveBeenCalledTimes(2);
});
it('отклоняет слишком большой файл', async () => {
  const onFile = vi.fn();
  render(<ImageUpload label="Фото" onFile={onFile} />);
  await userEvent
    .setup()
    .upload(screen.getByLabelText('Фото'), new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('до 5 МБ');
  expect(onFile).not.toHaveBeenCalled();
});
