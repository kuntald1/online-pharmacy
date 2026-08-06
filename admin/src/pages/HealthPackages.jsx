import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { Field, inputClass } from "../components/Field";
import SingleImageUploader from "../components/SingleImageUploader";
import { ClickableThumbnail } from "../components/ClickableThumbnail";
import VisibilityBadge from "../components/VisibilityBadge";
import { api } from "../api/client";

const emptyForm = { title: "", image_url: "", mrp: "", price: "", link_url: "", is_popular: false, visibility: "both" };

export default function HealthPackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    api.get("/api/admin/health-packages").then(setPackages).finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(pkg) {
    setEditingId(pkg.id);
    setForm({
      title: pkg.title,
      image_url: pkg.image_url,
      mrp: pkg.mrp ?? "",
      price: pkg.price,
      link_url: pkg.link_url || "",
      is_popular: pkg.is_popular,
      visibility: pkg.visibility,
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.image_url) {
      setError("Upload an image before saving.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        image_url: form.image_url,
        mrp: form.mrp ? Number(form.mrp) : null,
        price: Number(form.price),
        link_url: form.link_url || null,
        is_popular: form.is_popular,
        visibility: form.visibility,
      };
      if (editingId) {
        await api.patch(`/api/admin/health-packages/${editingId}`, payload);
      } else {
        await api.post("/api/admin/health-packages", { ...payload, sort_order: packages.length });
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

  async function handleDelete(pkg) {
    if (!confirm(`Delete "${pkg.title}"? This can't be undone.`)) return;
    setBusyId(pkg.id);
    try {
      await api.delete(`/api/admin/health-packages/${pkg.id}`);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(pkg) {
    setBusyId(pkg.id);
    try {
      await api.patch(`/api/admin/health-packages/${pkg.id}`, { is_active: !pkg.is_active });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout
      title="Health Packages"
      subtitle="Diagnostic/checkup packages shown as a carousel on the storefront — Heart Test, Master Health Checkup, etc."
      action={<Button onClick={openCreate}>Add package</Button>}
    >
      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : (
        <DataTable
          rows={packages}
          emptyMessage="No health packages yet — add your first one."
          columns={[
            {
              key: "image_url",
              header: "",
              render: (row) => <ClickableThumbnail src={row.image_url} alt={row.title} className="h-14 w-14 rounded-lg object-cover bg-bg" />,
            },
            { key: "title", header: "Title", render: (row) => <span className={row.is_active ? "" : "text-ink-soft line-through"}>{row.title}</span> },
            {
              key: "price",
              header: "Price",
              render: (row) => (
                <span>
                  ₹{row.price} {row.mrp && <span className="text-ink-soft line-through ml-1">₹{row.mrp}</span>}
                </span>
              ),
            },
            { key: "is_popular", header: "Popular", render: (row) => (row.is_popular ? <span className="text-amber text-xs font-medium">★ Popular</span> : "—") },
            { key: "visibility", header: "Visible to", render: (row) => <VisibilityBadge visibility={row.visibility} /> },
            {
              key: "is_active",
              header: "Status",
              render: (row) => (
                <button
                  onClick={() => toggleActive(row)}
                  disabled={busyId === row.id}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${row.is_active ? "bg-teal-light text-teal-dark" : "bg-bg text-ink-soft"}`}
                >
                  {row.is_active ? "Active" : "Inactive"}
                </button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit package" : "Add package"}>
        <form onSubmit={handleSubmit}>
          <Field label="Title">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Heart Test"
              required
            />
          </Field>
          <Field label="Image">
            <SingleImageUploader value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} label="package image" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (₹)">
              <input className={inputClass} type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </Field>
            <Field label="MRP (₹, optional)">
              <input className={inputClass} type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} placeholder="For a strikethrough discount" />
            </Field>
          </div>
          <Field label="Link URL (optional — where the view/book button goes)">
            <input
              className={inputClass}
              value={form.link_url}
              onChange={(e) => setForm({ ...form, link_url: e.target.value })}
              placeholder="https://... or /contact"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Visible to">
              <select className={inputClass} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
                <option value="both">B2C + B2B</option>
                <option value="all">B2C + B2B + CNF</option>
                <option value="b2c">B2C only</option>
                <option value="b2b">B2B only</option>
                <option value="cnf">CNF only</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 mt-6 text-sm text-ink">
              <input type="checkbox" checked={form.is_popular} onChange={(e) => setForm({ ...form, is_popular: e.target.checked })} />
              Show "POPULAR" badge
            </label>
          </div>
          {error && <p className="text-red text-sm mb-4 bg-red-light rounded-lg px-3 py-2">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Save package"}
          </Button>
        </form>
      </Modal>
    </Layout>
  );
}
