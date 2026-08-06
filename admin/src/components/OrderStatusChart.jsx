import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const STATUS_COLORS = {
  placed: "#94A3A6",
  confirmed: "#1FAFE8",
  packed: "#8B5CF6",
  shipped: "#E8A33D",
  delivered: "#02A694",
  cancelled: "#D6483F",
};

const STATUS_ORDER = ["placed", "confirmed", "packed", "shipped", "delivered", "cancelled"];

export default function OrderStatusChart({ orders }) {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
  for (const order of orders) {
    if (counts[order.status] !== undefined) counts[order.status] += 1;
  }
  const data = STATUS_ORDER.map((status) => ({ name: status, value: counts[status] })).filter((d) => d.value > 0);
  const total = orders.length;

  return (
    <div className="bg-white rounded-card border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-sm cross-mark">Order status</h3>
        <span className="text-xs text-ink-soft">{total} total</span>
      </div>
      {total > 0 ? (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [value, name]}
              contentStyle={{ borderRadius: 10, border: "1px solid #E1E8E7", fontSize: 12, textTransform: "capitalize" }}
            />
            <Legend
              verticalAlign="middle"
              align="right"
              layout="vertical"
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span className="text-xs text-ink-soft capitalize">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[220px] flex items-center justify-center text-sm text-ink-soft">
          No orders yet.
        </div>
      )}
    </div>
  );
}
