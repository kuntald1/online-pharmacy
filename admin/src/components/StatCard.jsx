export default function StatCard({ label, value, hint, accent = "teal" }) {
  const accents = {
    teal: "text-teal",
    blue: "text-blue",
    amber: "text-amber",
    red: "text-red",
  };
  return (
    <div className="bg-white rounded-card border border-border shadow-card p-5">
      <p className="text-xs uppercase tracking-wider text-ink-soft font-medium cross-mark">{label}</p>
      <p className={`font-display font-semibold text-3xl mt-2 ${accents[accent]}`}>{value}</p>
      {hint && <p className="text-xs text-ink-soft mt-1">{hint}</p>}
    </div>
  );
}
