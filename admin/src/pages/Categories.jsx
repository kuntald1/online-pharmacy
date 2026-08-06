import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import Button from "../components/Button";
import Modal from "../components/Modal";
import VisibilityBadge from "../components/VisibilityBadge";
import SingleImageUploader from "../components/SingleImageUploader";
import { Field, inputClass } from "../components/Field";
import { api } from "../api/client";

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const emptyForm = { name: "", image_url: "", visibility: "both" };

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    api.get("/api/admin/categories").then(setCategories).finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(category) {
    setEditingId(category.id);
    setForm({ name: category.name, image_url: category.image_url || "", visibility: category.visibility });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await api.patch(`/api/admin/categories/${editingId}`, {
          name: form.name,
          image_url: form.image_url || null,
          visibility: form.visibility,
        });
      } else {
        await api.post("/api/admin/categories", {
          name: form.name,
          slug: slugify(form.name),
          image_url: form.image_url || null,
          sort_order: categories.length,
          visibility: form.visibility,
        });
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

  async function toggleActive(category) {
    setBusyId(category.id);
    try {
      await api.patch(`/api/admin/categories/${category.id}`, { is_active: !category.is_active });
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(category) {
    if (!confirm(`Delete "${category.name}"? Any products using this category will become uncategorized. This can't be undone.`)) return;
    setBusyId(category.id);
    try {
      await api.delete(`/api/admin/categories/${category.id}`);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout
      title="Categories"
      subtitle="Shown on the storefront category grid — Fitness, Ayurveda, Homeopathy, etc."
      action={<Button onClick={openCreate}>Add category</Button>}
    >
      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : (
        <DataTable
          rows={categories}
          emptyMessage="No categories yet — add your first one."
          columns={[
            {
              key: "image_url",
              header: "",
              render: (row) =>
                row.image_url ? (
                  <img src={row.image_url} alt="" className="h-9 w-9 rounded-lg object-cover bg-bg" />
                ) : (
                  <div className="h-9 w-9 rounded-lg bg-teal-light" />
                ),
            },
            { key: "name", header: "Name", render: (row) => <span className={row.is_active ? "" : "text-ink-soft line-through"}>{row.name}</span> },
            { key: "slug", header: "Slug", render: (row) => <span className="font-mono text-xs text-ink-soft">{row.slug}</span> },
            { key: "visibility", header: "Visible to", render: (row) => <VisibilityBadge visibility={row.visibility} /> },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <button
                  onClick={() => toggleActive(row)}
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
                <div className="flex gap-3">
                  <button onClick={() => openEdit(row)} className="text-xs font-medium text-teal-dark hover:underline">
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(row)}
                    disabled={busyId === row.id}
                    className="text-xs font-medium text-red hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit category" : "Add category"}>
        <form onSubmit={handleSubmit}>
          <Field label="Name">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Diabetes Care"
              required
            />
          </Field>
          <Field label="Image">
            <SingleImageUploader value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} label="category image" />
          </Field>
          <Field label="Visible to">
            <select className={inputClass} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
              <option value="both">B2C + B2B</option>
              <option value="all">B2C + B2B + CNF</option>
              <option value="b2c">B2C only</option>
              <option value="b2b">B2B only</option>
              <option value="cnf">CNF only</option>
            </select>
          </Field>
          {error && <p className="text-red text-sm mb-4 bg-red-light rounded-lg px-3 py-2">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Save category"}
          </Button>
        </form>
      </Modal>
    </Layout>
  );
}
