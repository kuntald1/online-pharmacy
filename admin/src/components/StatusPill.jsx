const STATUS_STYLES = {
  pending: { bg: "bg-amber-light", text: "text-amber", dot: "bg-amber" },
  approved: { bg: "bg-teal-light", text: "text-teal-dark", dot: "bg-teal" },
  rejected: { bg: "bg-red-light", text: "text-red", dot: "bg-red" },
  new: { bg: "bg-blue-light", text: "text-blue-dark", dot: "bg-blue" },
  contacted: { bg: "bg-amber-light", text: "text-amber", dot: "bg-amber" },
  closed: { bg: "bg-teal-light", text: "text-teal-dark", dot: "bg-teal" },
  active: { bg: "bg-teal-light", text: "text-teal-dark", dot: "bg-teal" },
  inactive: { bg: "bg-bg", text: "text-ink-soft", dot: "bg-ink-soft" },
};

export default function StatusPill({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.inactive;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${style.bg} ${style.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}
