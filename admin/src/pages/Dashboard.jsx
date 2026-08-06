import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import DataTable from "../components/DataTable";
import StatusPill from "../components/StatusPill";
import SalesChart from "../components/SalesChart";
import OrderStatusChart from "../components/OrderStatusChart";
import TopProducts from "../components/TopProducts";
import LowStockAlerts from "../components/LowStockAlerts";
import { api } from "../api/client";

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [pendingB2B, setPendingB2B] = useState([]);
  const [newLeads, setNewLeads] = useState([]);
  const [b2cOrders, setB2cOrders] = useState([]);
  const [b2bOrders, setB2bOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/products?channel=b2c"),
      api.get("/api/b2b/applications?status_filter=pending"),
      api.get("/api/cnf/admin?status_filter=new"),
      api.get("/api/admin/orders?channel_group=b2c"),
      api.get("/api/admin/orders?channel_group=b2b"),
    ])
      .then(([p, apps, leads, b2c, b2b]) => {
        setProducts(p);
        setPendingB2B(apps);
        setNewLeads(leads);
        setB2cOrders(b2c);
        setB2bOrders(b2b);
      })
      .finally(() => setLoading(false));
  }, []);

  const allOrders = [...b2cOrders, ...b2bOrders];
  const totalSales = allOrders.reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <Layout title="Dashboard" subtitle="Live snapshot of your catalog, orders, and pending requests">
      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Sales" value={`₹${totalSales.toLocaleString("en-IN")}`} hint={`${allOrders.length} orders`} accent="teal" />
            <StatCard label="B2C Orders" value={b2cOrders.length} accent="blue" />
            <StatCard label="B2B Orders" value={b2bOrders.length} accent="blue" />
            <StatCard
              label="Pending B2B"
              value={pendingB2B.length}
              hint="Awaiting KYC review"
              accent={pendingB2B.length > 0 ? "amber" : "teal"}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <SalesChart orders={allOrders} />
            <OrderStatusChart orders={allOrders} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <TopProducts orders={allOrders} />
            <LowStockAlerts products={products} />

            <div className="bg-white rounded-card border border-border shadow-card p-5">
              <h3 className="font-display font-semibold text-sm mb-4 cross-mark">New CNF requests</h3>
              {newLeads.length === 0 ? (
                <p className="text-sm text-ink-soft">No new CNF requests right now.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {newLeads.slice(0, 5).map((lead) => (
                    <li key={lead.id} className="flex items-center justify-between text-sm">
                      <span className="text-ink truncate pr-3">{lead.name}</span>
                      <span className={lead.whatsapp_notified ? "text-teal-dark text-xs" : "text-ink-soft text-xs"}>
                        {lead.whatsapp_notified ? "WhatsApp sent" : "Not sent"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <section>
            <h2 className="font-display font-semibold text-base mb-3 cross-mark">Pending B2B applications</h2>
            <DataTable
              emptyMessage="No pending applications right now."
              rows={pendingB2B.slice(0, 6)}
              columns={[
                { key: "business_name", header: "Business" },
                { key: "phone", header: "Phone" },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <StatusPill status={row.status} />,
                },
              ]}
            />
          </section>
        </>
      )}
    </Layout>
  );
}
