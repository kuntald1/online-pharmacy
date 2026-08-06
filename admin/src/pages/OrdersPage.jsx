import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import StatusPill from "../components/StatusPill";
import { api } from "../api/client";

const STATUS_FLOW = ["placed", "confirmed", "packed", "shipped", "delivered", "cancelled"];

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "placed", label: "Placed" },
  { value: "confirmed", label: "Confirmed" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export default function OrdersPage({ channelGroup, title, subtitle }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    const query = new URLSearchParams({ channel_group: channelGroup });
    if (filter) query.set("status_filter", filter);
    api
      .get(`/api/admin/orders?${query.toString()}`)
      .then(setOrders)
      .finally(() => setLoading(false));
  }

  useEffect(load, [channelGroup, filter]);

  async function updateStatus(orderId, status) {
    setBusyId(orderId);
    setError("");
    try {
      await api.patch(`/api/admin/orders/${orderId}/status`, { status });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout
      title={title}
      subtitle={subtitle}
      action={
        <select
          className="rounded-lg border border-border px-3 py-2 text-sm text-ink"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      }
    >
      {error && <p className="text-red text-sm mb-4 bg-red-light rounded-lg px-3 py-2 inline-block">{error}</p>}

      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : (
        <DataTable
          rows={orders}
          emptyMessage="No orders match this filter."
          columns={[
            { key: "order_no", header: "Order", render: (row) => <span className="font-mono text-xs">{row.order_no}</span> },
            { key: "customer_name", header: "Customer", render: (row) => (
                <div>
                  <p className="text-sm text-ink">{row.customer_name}</p>
                  <p className="text-xs text-ink-soft">{row.customer_phone}</p>
                </div>
              ) },
            { key: "shipping_address", header: "Ships to", render: (row) => (
                <span className="text-xs text-ink-soft">{row.shipping_address.city}, {row.shipping_address.state}</span>
              ) },
            { key: "items", header: "Items", render: (row) => `${row.items.length} item${row.items.length === 1 ? "" : "s"}` },
            { key: "total", header: "Total", render: (row) => `₹${row.total}` },
            { key: "payment_mode", header: "Payment", render: (row) => (
                <span className="text-xs uppercase text-ink-soft">
                  {row.payment_mode === "cod" ? "COD" : "Razorpay"} · {row.payment_status}
                </span>
              ) },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <div className="flex items-center gap-2">
                  <StatusPill status={row.status} />
                  <select
                    className="text-xs border border-border rounded-md px-1.5 py-1 text-ink-soft"
                    value=""
                    disabled={busyId === row.id}
                    onChange={(e) => e.target.value && updateStatus(row.id, e.target.value)}
                  >
                    <option value="">Move to…</option>
                    {STATUS_FLOW.filter((s) => s !== row.status).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ),
            },
          ]}
        />
      )}
    </Layout>
  );
}
