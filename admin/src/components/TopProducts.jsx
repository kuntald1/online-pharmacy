export default function TopProducts({ orders }) {
  const totals = {};
  for (const order of orders) {
    for (const item of order.items) {
      totals[item.product_name] = (totals[item.product_name] || 0) + item.quantity;
    }
  }
  const rows = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="bg-white rounded-card border border-border shadow-card p-5">
      <h3 className="font-display font-semibold text-sm mb-4 cross-mark">Top selling products</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-soft">No sales recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(([name, qty]) => (
            <li key={name} className="flex items-center justify-between text-sm">
              <span className="text-ink truncate pr-3">{name}</span>
              <span className="text-ink-soft shrink-0">{qty} units</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-soft mt-4">Based on units sold across currently loaded orders.</p>
    </div>
  );
}
