import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import SalesChart from "../components/SalesChart";
import OrderStatusChart from "../components/OrderStatusChart";
import DataTable from "../components/DataTable";
import StatusPill from "../components/StatusPill";
import { api } from "../api/client";

export default function Reports() {
  const [b2cOrders, setB2cOrders] = useState([]);
  const [b2bOrders, setB2bOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/api/admin/orders?channel_group=b2c"), api.get("/api/admin/orders?channel_group=b2b")])
      .then(([b2c, b2b]) => {
        setB2cOrders(b2c);
        setB2bOrders(b2b);
      })
      .finally(() => setLoading(false));
  }, []);

  const allOrders = [...b2cOrders, ...b2bOrders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const totalSales = allOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const avgOrderValue = allOrders.length ? totalSales / allOrders.length : 0;
  const b2cSales = b2cOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const b2bSales = b2bOrders.reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <Layout title="Reports" subtitle="Sales and order performance across every channel">
      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Sales" value={`₹${totalSales.toLocaleString("en-IN")}`} hint={`${allOrders.length} orders`} accent="teal" />
            <StatCard label="Avg. Order Value" value={`₹${avgOrderValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} accent="blue" />
            <StatCard label="B2C Sales" value={`₹${b2cSales.toLocaleString("en-IN")}`} hint={`${b2cOrders.length} orders`} accent="blue" />
            <StatCard label="B2B Sales" value={`₹${b2bSales.toLocaleString("en-IN")}`} hint={`${b2bOrders.length} orders`} accent="blue" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <SalesChart orders={allOrders} />
            <OrderStatusChart orders={allOrders} />
          </div>

          <section>
            <h2 className="font-display font-semibold text-base mb-3 cross-mark">All orders</h2>
            <DataTable
              rows={allOrders}
              emptyMessage="No orders yet."
              columns={[
                { key: "order_no", header: "Order", render: (row) => <span className="font-mono text-xs">{row.order_no}</span> },
                { key: "customer_name", header: "Customer" },
                { key: "channel", header: "Channel", render: (row) => <span className="uppercase text-xs text-ink-soft">{row.channel}</span> },
                { key: "total", header: "Total", render: (row) => `₹${row.total}` },
                { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
                { key: "created_at", header: "Date", render: (row) => new Date(row.created_at).toLocaleDateString() },
              ]}
            />
          </section>
        </>
      )}
    </Layout>
  );
}
