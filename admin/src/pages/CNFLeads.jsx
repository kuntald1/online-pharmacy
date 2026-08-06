import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import StatusPill from "../components/StatusPill";
import Button from "../components/Button";
import { api } from "../api/client";

const FILTERS = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function CNFLeads() {
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState("new");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  function load() {
    setLoading(true);
    const query = filter ? `?status_filter=${filter}` : "";
    api.get(`/api/cnf/admin${query}`).then(setLeads).finally(() => setLoading(false));
  }

  useEffect(load, [filter]);

  async function review(id, approve) {
    setBusyId(id);
    setError("");
    try {
      const result = await api.post(`/api/cnf/admin/${id}/review`, { approve });
      if (approve) {
        setConfirmation(
          `Approved ${result.name} — they can now log in with phone ${result.contact_no} + OTP. A WhatsApp notification was sent (if configured on this environment).`
        );
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout
      title="CNF Requests"
      subtitle="Leads submitted through the storefront's CNF form — approve to issue a login, same as B2B"
      action={
        <div className="flex gap-1 bg-bg rounded-lg p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === f.value ? "bg-white shadow-card text-ink" : "text-ink-soft"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      }
    >
      {error && <p className="text-red text-sm mb-4 bg-red-light rounded-lg px-3 py-2 inline-block">{error}</p>}

      {confirmation && (
        <div className="mb-4 bg-teal-light border border-teal/30 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-ink">{confirmation}</p>
          <button onClick={() => setConfirmation("")} className="text-xs font-medium text-teal-dark hover:underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : (
        <DataTable
          rows={leads}
          emptyMessage="No CNF requests match this filter."
          columns={[
            { key: "name", header: "Name" },
            { key: "contact_no", header: "Contact" },
            { key: "business_type", header: "Business type", render: (row) => row.business_type || "—" },
            { key: "location", header: "Location", render: (row) => row.location || "—" },
            {
              key: "created_at",
              header: "Submitted",
              render: (row) => new Date(row.created_at).toLocaleString(),
            },
            {
              key: "whatsapp_notified",
              header: "WhatsApp",
              render: (row) => (
                <span className={row.whatsapp_notified ? "text-teal-dark text-xs font-medium" : "text-ink-soft text-xs"}>
                  {row.whatsapp_notified ? "Sent" : "Not sent"}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (row) => <StatusPill status={row.status} />,
            },
            {
              key: "actions",
              header: "",
              render: (row) =>
                row.status === "new" || row.status === "contacted" ? (
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      className="px-3 py-1.5 text-xs"
                      disabled={busyId === row.id}
                      onClick={() => review(row.id, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                      disabled={busyId === row.id}
                      onClick={() => review(row.id, false)}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null,
            },
          ]}
        />
      )}
    </Layout>
  );
}
