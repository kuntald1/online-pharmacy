const LOW_STOCK_THRESHOLD = 20;

export default function LowStockAlerts({ products }) {
  const rows = products
    .map((p) => {
      const pricing = p.pricing.find((x) => x.channel === "b2c");
      return pricing ? { name: p.name, stock: pricing.stock } : null;
    })
    .filter((r) => r && r.stock < LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  return (
    <div className="bg-white rounded-card border border-border shadow-card p-5">
      <h3 className="font-display font-semibold text-sm mb-4 cross-mark">Low stock alerts</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing below {LOW_STOCK_THRESHOLD} units right now.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.name} className="flex items-center justify-between text-sm">
              <span className="text-ink truncate pr-3">{row.name}</span>
              <span className={row.stock === 0 ? "text-red font-medium" : "text-amber font-medium"}>
                {row.stock} left
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
