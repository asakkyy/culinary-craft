import { useEffect, useState } from 'react';

export default function ImageUpload({ label, url, onFile, onDelete, busy = false }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function choose(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Выберите PNG или JPEG до 5 МБ'); event.target.value = ''; return;
    }
    setPreview(URL.createObjectURL(file));
    try { await onFile(file); } catch (err) { setError(err.message || 'Не удалось загрузить изображение'); }
  }
  return <div className="field"><label>{label}<input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={choose}/></label>
    {(preview || url) && <img src={preview || url} alt={`Превью: ${label}`} style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'cover' }}/>}
    {url && onDelete && <button className="btn btn-outline" type="button" disabled={busy} onClick={async () => {
      setError(''); try { await onDelete(); setPreview(null); } catch (err) { setError(err.message); }
    }}>Удалить изображение</button>}
    {error && <p role="alert" className="error-box">{error}</p>}
    <small>PNG или JPEG, до 5 МБ. Сервер проверяет содержимое.</small>
  </div>;
}
