import { useEffect, useId, useState } from 'react';
import { Upload } from 'lucide-react';

export default function ImageUpload({ label, url, onFile, onDelete, busy = false }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const working = busy || pending;
  const id = useId();
  const [filename, setFilename] = useState('');
  useEffect(() => {
    setPreview(null);
    setFilename('');
  }, [url]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function choose(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Выберите PNG или JPEG до 5 МБ');
      event.target.value = '';
      return;
    }
    setPreview(URL.createObjectURL(file));
    setFilename(file.name);
    setPending(true);
    try {
      await onFile(file);
    } catch (err) {
      setPreview(null);
      setFilename('');
      setError(err.message || 'Не удалось загрузить изображение');
    } finally {
      setPending(false);
      event.target.value = '';
    }
  }
  return (
    <div className="field">
      <span>{label}</span>
      <div className="upload-select">
        <input
          id={id}
          aria-label={label}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg"
          disabled={working}
          onChange={choose}
        />
        <label className="btn btn-outline" htmlFor={id}>
          <Upload aria-hidden="true" /> Выбрать изображение
        </label>
        <small>{filename || 'Файл не выбран'}</small>
      </div>
      {(preview || url) && (
        <img src={preview || url} alt={`Превью: ${label}`} style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'cover' }} />
      )}
      {(preview || url) && onDelete && (
        <button
          className="btn btn-outline"
          type="button"
          disabled={working}
          onClick={async () => {
            setError('');
            setPending(true);
            try {
              await onDelete();
              setPreview(null);
              setFilename('');
            } catch (err) {
              setError(err.message);
            } finally {
              setPending(false);
            }
          }}
        >
          Удалить изображение
        </button>
      )}
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      <small>PNG или JPEG, до 5 МБ. Сервер проверяет содержимое.</small>
    </div>
  );
}
