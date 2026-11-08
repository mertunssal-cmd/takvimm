// Seçenekli soru penceresi. App içindeki ask() fonksiyonuyla açılır:
//   const secim = await ask({ title, message, options: [{ label, value, variant }] })
export default function ChoiceDialog({ title, message, options, onChoose }) {
  return (
    <div className="overlay center" onClick={() => onChoose(null)}>
      <div className="dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {message && <p className="muted">{message}</p>}
        <div className="dialog-actions">
          {options.map((o) => (
            <button key={String(o.value)} className={`btn ${o.variant || 'secondary'}`} onClick={() => onChoose(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
