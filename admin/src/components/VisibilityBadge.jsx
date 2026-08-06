const STYLES = {
  b2c: "bg-teal-light text-teal-dark",
  b2b: "bg-blue-light text-blue-dark",
  cnf: "bg-amber-light text-amber",
  both: "bg-bg text-ink-soft",
  all: "bg-purple-100 text-purple-700",
};

const LABELS = { b2c: "B2C only", b2b: "B2B only", cnf: "CNF only", both: "B2C + B2B", all: "B2C + B2B + CNF" };

export default function VisibilityBadge({ visibility }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STYLES[visibility] || STYLES.both}`}>
      {LABELS[visibility] || "B2C + B2B"}
    </span>
  );
}
