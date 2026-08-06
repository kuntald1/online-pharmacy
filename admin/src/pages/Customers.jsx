import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import StatusPill from "../components/StatusPill";
import { api } from "../api/client";

const ROLE_FILTERS = [
  { value: "", label: "All" },
  { value: "b2c", label: "B2C" },
  { value: "b2b", label: "B2B" },
];

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    const query = new URLSearchParams();
    if (role) query.set("role", role);
    if (search) query.set("search", search);
    api
      .get(`/api/admin/customers?${query.toString()}`)
      .then(setCustomers)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 300); // debounce search
    return () => clearTimeout(timeout);
  }, [role, search]);

  return (
    <Layout
      title="Customers"
      subtitle="Everyone with a B2C or B2B account"
      action={
        <div className="flex items-center gap-2">
          <input
            className="rounded-lg border border-border px-3 py-2 text-sm w-48"
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-1 bg-bg rounded-lg p-1">
            {ROLE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setRole(f.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  role === f.value ? "bg-white shadow-card text-ink" : "text-ink-soft"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : (
        <DataTable
          rows={customers}
          emptyMessage="No customers match this filter."
          columns={[
            { key: "name", header: "Name" },
            { key: "phone", header: "Phone" },
            { key: "email", header: "Email", render: (row) => row.email || "—" },
            {
              key: "role",
              header: "Channel",
              render: (row) => <span className="uppercase text-xs text-ink-soft">{row.role}</span>,
            },
            {
              key: "is_active",
              header: "Status",
              render: (row) => <StatusPill status={row.is_active ? "active" : "inactive"} />,
            },
            {
              key: "created_at",
              header: "Joined",
              render: (row) => new Date(row.created_at).toLocaleDateString(),
            },
          ]}
        />
      )}
    </Layout>
  );
}
