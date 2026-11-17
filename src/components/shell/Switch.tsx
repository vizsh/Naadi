'use client';
/** An on/off switch with a label and one line of detail. */
export function Switch({ label, detail, on, onChange, disabled = false }: { label: string; detail: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="switch" disabled={disabled} onClick={() => onChange(!on)}>
      <span className="switch-track" aria-hidden="true"><i /></span>
      <span><strong>{label}</strong><span>{detail}</span></span>
    </button>
  );
}
