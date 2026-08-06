export function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-medium text-ink-soft mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-teal focus:ring-1 focus:ring-teal outline-none transition-colors";
