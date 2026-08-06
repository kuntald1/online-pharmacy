import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { Field, inputClass } from "../components/Field";
import { api } from "../api/client";

const emptyForm = { pincode: "", label: "", delivery_days: 1, is_deliverable: true };

export default function DeliveryZones() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    api.get("/api/admin/delivery-zones").then(setZones).finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(zone) {
    setEditingId(zone.id);
    setForm({ pincode: zone.pincode, label: zone.label || "", delivery_days: zone.delivery_days, is_deliverable: zone.is_deliverable });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        pincode: form.pincode,
        label: form.label || null,
        delivery_days: Number(form.delivery_days),
        is_deliverable: form.is_deliverable,
      };
      if (editingId) {
        await api.patch(`/api/admin/delivery-zones/${editingId}`, payload);
      } else {
        await api.post("/api/admin/delivery-zones", payload);
      }
      setModalOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(zone) {
    if (!confirm(`Delete delivery estimate for ${zone.pincode}?`)) return;
    setBusyId(zone.id);
    try {
      await api.delete(`/api/admin/delivery-zones/${zone.id}`);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout
      title="Delivery Zones"
      subtitle="Pincode-based delivery estimates — shown to customers when they check delivery date on a product page"
      action={<Button onClick={openCreate}>Add pincode</Button>}
    >
      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : (
        <DataTable
          rows={zones}
          emptyMessage="No pincodes configured yet — add your first one. Until then, customers checking any pincode will see 'no confirmed estimate yet'."
          columns={[
            { key: "pincode", header: "Pincode", render: (row) => <span className="font-mono text-sm font-medium">{row.pincode}</span> },
            { key: "label", header: "Area", render: (row) => row.label || "—" },
            {
              key: "delivery_days",
              header: "Delivery time",
              render: (row) => (row.is_deliverable ? `${row.delivery_days} day${row.delivery_days !== 1 ? "s" : ""}` : "—"),
            },
            {
              key: "is_deliverable",
              header: "Status",
              render: (row) => (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${row.is_deliverable ? "bg-teal-light text-teal-dark" : "bg-red-light text-red"}`}>
                  {row.is_deliverable ? "Deliverable" : "Not serviceable"}
                </span>
              ),
            },
            {
              key: "actions",
              header: "",
              render: (row) => (
                <div className="flex gap-3">
                  <button onClick={() => openEdit(row)} className="text-xs font-medium text-teal-dark hover:underline">
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(row)}
                    disabled={busyId === row.id}
                    className="text-xs font-medium text-red hover:underline disabled:opacity-50"
                  >
                    {busyId === row.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit delivery zone" : "Add pincode"}>
        <form onSubmit={handleSubmit}>
          <Field label="Pincode">
            <input className={inputClass} value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} placeholder="700016" required />
          </Field>
          <Field label="Area label (optional)">
            <input className={inputClass} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Kolkata Metro" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Delivery time (days)">
              <input className={inputClass} type="number" min="0" value={form.delivery_days} onChange={(e) => setForm({ ...form, delivery_days: e.target.value })} required />
            </Field>
            <label className="flex items-center gap-2 mt-6 text-sm text-ink">
              <input type="checkbox" checked={form.is_deliverable} onChange={(e) => setForm({ ...form, is_deliverable: e.target.checked })} />
              We deliver here
            </label>
          </div>
          {error && <p className="text-red text-sm mb-4 bg-red-light rounded-lg px-3 py-2">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Save pincode"}
          </Button>
        </form>
      </Modal>
    </Layout>
  );
}
