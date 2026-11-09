// Ekranın altından açılan panel (mobilde "bottom sheet", masaüstünde ortada pencere).
import { useEffect } from 'react';
import { IconX } from './Icons.jsx';

export default function Sheet({ title, onClose, children }) {
  // Esc ile kapat
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">
            <IconX />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
