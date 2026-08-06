import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Button from "../components/Button";
import { ClickableThumbnail } from "../components/ClickableThumbnail";
import { api } from "../api/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "requested", label: "Requested" },
  { value: "pickup_scheduled", label: "Pickup scheduled" },
  { value: "picked_up", label: "Picked up" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_STYLES = {
  requested: "bg-bg text-ink-soft",
  pickup_scheduled: "bg-blue-light text-blue-dark",
  picked_up: "bg-blue-light text-blue-dark",
  approved: "bg-teal-light text-teal-dark",
  rejected: "bg-red-light text-red",
};

const CHANNEL_LABELS = { b2c: "B2C", b2b_normal: "B2B Normal", b2b_advance: "B2B Advance", cnf: "CNF" };

export default function Returns() {
  const [returns, setReturns] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [decisionModal, setDecisionModal] = useState(null); // { returnRequest, action: 'approved'|'rejected' }
  const [note, setNote] = useState("");

  function load() {
    setLoading(true);
    const query = filter ? `?status_filter=${filter}` : "";
    api.get(`/api/admin/returns${query}`).then(setReturns).finally(() => setLoading(false));
  }

  useEffect(load, [filter]);

  async function updateStatus(id, status, admin_note) {
    setBusyId(id);
    setError("");
    try {
      await api.patch(`/api/admin/returns/${id}/status`, { status, admin_note: admin_note || null });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function openDecision(returnRequest, action) {
    setNote("");
    setDecisionModal({ returnRequest, action });
  }

  async function confirmDecision() {
    await updateStatus(decisionModal.returnRequest.id, decisionModal.action, note);
    setDecisionModal(null);
  }

  return (
    <Layout
      title="Returns"
      subtitle="Customer return requests from B2C, B2B, and CNF — review, arrange pickup, approve or reject"
      action={
        <select className="rounded-lg border border-border px-3 py-2 text-sm text-ink" value={filter} onChange={(e) => setFilter(e.target.value)}>
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
          rows={returns}
          emptyMessage="No return requests match this filter."
          columns={[
            {
              key: "image_url",
              header: "",
              render: (row) => row.image_url
                ? <ClickableThumbnail src={`${API_BASE}${row.image_url}`} alt="Return evidence" className="h-12 w-12 rounded-lg object-cover bg-bg" />
                : <div className="h-12 w-12 rounded-lg bg-bg" />,
            },
            {
              key: "order_no", header: "Order", render: (row) => (
                <div>
                  <p className="text-sm font-mono text-ink">{row.order_no}</p>
                  <span className="text-[10px] font-medium text-ink-soft uppercase">{CHANNEL_LABELS[row.channel] || row.channel}</span>
                </div>
              ),
            },
            {
              key: "customer_name", header: "Customer", render: (row) => (
                <div>
                  <p className="text-sm text-ink">{row.customer_name}</p>
                  <p className="text-xs text-ink-soft">{row.customer_phone}</p>
                </div>
              ),
            },
            {
              key: "product_name", header: "Item", render: (row) => (
                <div className="max-w-[220px]">
                  <p className="text-sm text-ink">{row.product_name} × {row.quantity}</p>
                  <p className="text-xs text-ink-soft truncate" title={row.reason}>{row.reason}</p>
                </div>
              ),
            },
            {
              key: "refund", header: "Refund", render: (row) => row.refund_amount
                ? <span className="text-xs text-ink-soft">₹{row.refund_amount} · {row.refund_method === "wallet" ? "Wallet" : "Original payment"}</span>
                : "—",
            },
            {
              key: "status", header: "Status", render: (row) => (
                <div className="flex flex-col gap-1.5 items-start">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[row.status]}`}>
                    {STATUS_FILTERS.find((f) => f.value === row.status)?.label || row.status}
                  </span>
                  {row.status !== "approved" && row.status !== "rejected" && (
                    <div className="flex gap-1.5 flex-wrap">
                      {row.status === "requested" && (
                        <button
                          disabled={busyId === row.id}
                          onClick={() => updateStatus(row.id, "pickup_scheduled")}
                          className="text-[11px] font-medium text-blue-dark hover:underline"
                        >
                          Schedule pickup
                        </button>
                      )}
                      {row.status === "pickup_scheduled" && (
                        <button
                          disabled={busyId === row.id}
                          onClick={() => updateStatus(row.id, "picked_up")}
                          className="text-[11px] font-medium text-blue-dark hover:underline"
                        >
                          Mark picked up
                        </button>
                      )}
                      <button
                        disabled={busyId === row.id}
                        onClick={() => openDecision(row, "approved")}
                        className="text-[11px] font-medium text-teal-dark hover:underline"
                      >
                        Approve
                      </button>
                      <button
                        disabled={busyId === row.id}
                        onClick={() => openDecision(row, "rejected")}
                        className="text-[11px] font-medium text-red hover:underline"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={!!decisionModal}
        onClose={() => setDecisionModal(null)}
        title={decisionModal?.action === "approved" ? "Approve return" : "Reject return"}
      >
        {decisionModal && (
          <div>
            <p className="text-sm text-ink-soft mb-3">
              {decisionModal.returnRequest.product_name} × {decisionModal.returnRequest.quantity} — {decisionModal.returnRequest.customer_name}
            </p>
            {decisionModal.action === "approved" && (
              <p className="text-sm text-ink mb-3">
                This will automatically refund the customer (wallet for Cash on Delivery orders, or their original
                payment method otherwise) and add {decisionModal.returnRequest.quantity} unit(s) back to{" "}
                {CHANNEL_LABELS[decisionModal.returnRequest.channel] || decisionModal.returnRequest.channel} stock.
              </p>
            )}
            <label className="block text-xs font-medium text-ink-soft mb-1.5">Note to customer (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm mb-4"
              placeholder={decisionModal.action === "rejected" ? "Explain why this wasn't approved…" : ""}
            />
            <Button onClick={confirmDecision} className="w-full">
              Confirm {decisionModal.action === "approved" ? "approval" : "rejection"}
            </Button>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
