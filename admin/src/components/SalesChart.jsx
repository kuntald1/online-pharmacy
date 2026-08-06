import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const CHANNEL_COLOR = "#02A694";

function buildSeries(orders, days = 7) {
  const now = new Date();
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), total: 0 });
  }
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
  for (const order of orders) {
    const key = order.created_at.slice(0, 10);
    if (byKey[key]) byKey[key].total += Number(order.total);
  }
  return buckets;
}

export default function SalesChart({ orders }) {
  const data = buildSeries(orders);
  const hasData = data.some((d) => d.total > 0);

  return (
    <div className="bg-white rounded-card border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-sm cross-mark">Sales overview</h3>
        <span className="text-xs text-ink-soft">Last 7 days</span>
      </div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E1E8E7" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5B6B69" }} axisLine={{ stroke: "#E1E8E7" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#5B6B69" }} axisLine={false} tickLine={false} width={50} />
            <Tooltip
              formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Sales"]}
              contentStyle={{ borderRadius: 10, border: "1px solid #E1E8E7", fontSize: 12 }}
            />
            <Line type="monotone" dataKey="total" stroke={CHANNEL_COLOR} strokeWidth={2.5} dot={{ r: 3, fill: CHANNEL_COLOR }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[220px] flex items-center justify-center text-sm text-ink-soft">
          No sales in the last 7 days yet.
        </div>
      )}
    </div>
  );
}
