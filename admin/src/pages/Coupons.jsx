import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { Field, inputClass } from "../components/Field";
import VisibilityBadge from "../components/VisibilityBadge";
import { api } from "../api/client";

const emptyForm = {
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: "",
  min_order_amount: "",
  max_uses: "",
  visibility: "b2c",
};

export default function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    api.get("/api/admin/coupons").then(setCoupons).finally(() => setLoading(false));
  }

  useEffect(load, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(coupon) {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      description: coupon.description || "",
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_order_amount: coupon.min_order_amount,
      max_uses: coupon.max_uses ?? "",
      visibility: coupon.visibility,
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order_amount: Number(form.min_order_amount || 0),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        visibility: form.visibility,
      };
      if (editingId) {
        await api.patch(`/api/admin/coupons/${editingId}`, payload);
      } else {
        await api.post("/api/admin/coupons", payload);
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

  async function toggle(id, is_active) {
    setBusyId(id);
    try {
      await api.patch(`/api/admin/coupons/${id}`, { is_active });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout
      title="Offers & Coupons"
      subtitle="Discount codes customers can apply at checkout"
      action={<Button onClick={openCreate}>Add coupon</Button>}
    >
      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : (
        <DataTable
          rows={coupons}
          emptyMessage="No coupons yet — add your first one."
          columns={[
            { key: "code", header: "Code", render: (row) => <span className="font-mono text-xs font-medium">{row.code}</span> },
            {
              key: "discount",
              header: "Discount",
              render: (row) => (row.discount_type === "percentage" ? `${row.discount_value}%` : `₹${row.discount_value}`),
            },
            { key: "min_order_amount", header: "Min. order", render: (row) => `₹${row.min_order_amount}` },
            { key: "visibility", header: "Visible to", render: (row) => <VisibilityBadge visibility={row.visibility} /> },
            { key: "used_count", header: "Used", render: (row) => `${row.used_count}${row.max_uses ? ` / ${row.max_uses}` : ""}` },
            {
              key: "is_active",
              header: "Status",
              render: (row) => (
                <button
                  onClick={() => toggle(row.id, !row.is_active)}
                  disabled={busyId === row.id}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    row.is_active ? "bg-teal-light text-teal-dark" : "bg-bg text-ink-soft"
                  }`}
                >
                  {row.is_active ? "Active" : "Inactive"}
                </button>
              ),
            },
            {
              key: "actions",
              header: "",
              render: (row) => (
                <button onClick={() => openEdit(row)} className="text-xs font-medium text-teal-dark hover:underline">
                  Edit
                </button>
              ),
            },
          ]}
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit coupon" : "Add coupon"}>
        <form onSubmit={handleSubmit}>
          <Field label="Code">
            <input className={inputClass} value={form.code} onChange={(e) => update("code", e.target.value.toUpperCase())} placeholder="WELCOME10" required />
          </Field>
          <Field label="Description (optional)">
            <input className={inputClass} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="10% off first order" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount type">
              <select className={inputClass} value={form.discount_type} onChange={(e) => update("discount_type", e.target.value)}>
                <option value="percentage">Percentage</option>
                <option value="flat">Flat amount</option>
              </select>
            </Field>
            <Field label={form.discount_type === "percentage" ? "Discount %" : "Discount ₹"}>
              <input className={inputClass} type="number" value={form.discount_value} onChange={(e) => update("discount_value", e.target.value)} required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min. order amount (₹)">
              <input className={inputClass} type="number" value={form.min_order_amount} onChange={(e) => update("min_order_amount", e.target.value)} />
            </Field>
            <Field label="Max uses (optional)">
              <input className={inputClass} type="number" value={form.max_uses} onChange={(e) => update("max_uses", e.target.value)} placeholder="Unlimited" />
            </Field>
          </div>
          <Field label="Visible to">
            <select className={inputClass} value={form.visibility} onChange={(e) => update("visibility", e.target.value)}>
              <option value="both">B2C + B2B</option>
              <option value="all">B2C + B2B + CNF</option>
              <option value="b2c">B2C only</option>
              <option value="b2b">B2B only</option>
              <option value="cnf">CNF only</option>
            </select>
          </Field>
          {error && <p className="text-red text-sm mb-4 bg-red-light rounded-lg px-3 py-2">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Save coupon"}
          </Button>
        </form>
      </Modal>
    </Layout>
  );
}
