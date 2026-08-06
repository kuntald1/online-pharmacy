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

const emptyForm = { name: "", logo_url: "", is_featured: false, visibility: "both" };

export default function Brands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    api.get("/api/admin/brands").then(setBrands).finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(brand) {
    setEditingId(brand.id);
    setForm({
      name: brand.name,
      logo_url: brand.logo_url || "",
      is_featured: brand.is_featured,
      visibility: brand.visibility,
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await api.patch(`/api/admin/brands/${editingId}`, {
          name: form.name,
          logo_url: form.logo_url || null,
          is_featured: form.is_featured,
          visibility: form.visibility,
        });
      } else {
        await api.post("/api/admin/brands", {
          name: form.name,
          slug: slugify(form.name),
          logo_url: form.logo_url || null,
          is_featured: form.is_featured,
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

  async function toggleActive(brand) {
    setBusyId(brand.id);
    try {
      await api.patch(`/api/admin/brands/${brand.id}`, { is_active: !brand.is_active });
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function toggleFeatured(brand) {
    setBusyId(brand.id);
    try {
      await api.patch(`/api/admin/brands/${brand.id}`, { is_featured: !brand.is_featured });
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(brand) {
    if (!confirm(`Delete "${brand.name}"? Any products using this brand will become unbranded. This can't be undone.`)) return;
    setBusyId(brand.id);
    try {
      await api.delete(`/api/admin/brands/${brand.id}`);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const HOMEPAGE_SLOTS = 6;
  const featuredCount = brands.filter((b) => b.is_featured).length;

  return (
    <Layout
      title="Brands"
      subtitle="Feature a brand to surface it in the storefront's “Discover New Brands” strip"
      action={<Button onClick={openCreate}>Add brand</Button>}
    >
      {!loading && (
        <p className={`text-sm mb-4 ${featuredCount > HOMEPAGE_SLOTS ? "text-amber font-medium" : "text-ink-soft"}`}>
          {featuredCount} of {HOMEPAGE_SLOTS} homepage slots checked
          {featuredCount > HOMEPAGE_SLOTS &&
            ` — only the first ${HOMEPAGE_SLOTS} will actually show on the homepage. Uncheck ${featuredCount - HOMEPAGE_SLOTS} to make sure it's the ones you want.`}
        </p>
      )}
      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : (
        <DataTable
          rows={brands}
          emptyMessage="No brands yet — add your first one."
          columns={[
            { key: "name", header: "Name", render: (row) => <span className={row.is_active ? "" : "text-ink-soft line-through"}>{row.name}</span> },
            { key: "slug", header: "Slug", render: (row) => <span className="font-mono text-xs text-ink-soft">{row.slug}</span> },
            { key: "visibility", header: "Visible to", render: (row) => <VisibilityBadge visibility={row.visibility} /> },
            {
              key: "is_featured",
              header: "Show on Homepage",
              render: (row) => (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={row.is_featured}
                    disabled={busyId === row.id}
                    onChange={() => toggleFeatured(row)}
                    className="rounded border-border text-teal focus:ring-teal"
                  />
                  <span className={row.is_featured ? "text-teal-dark text-xs font-medium" : "text-ink-soft text-xs"}>
                    {row.is_featured ? "Featured" : "Not shown"}
                  </span>
                </label>
              ),
            },
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit brand" : "Add brand"}>
        <form onSubmit={handleSubmit}>
          <Field label="Name">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Accu-Chek"
              required
            />
          </Field>
          <Field label="Logo">
            <SingleImageUploader value={form.logo_url} onChange={(url) => setForm({ ...form, logo_url: url })} label="brand logo" />
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
          <label className="flex items-center gap-2 mb-4 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
              className="rounded border-border text-teal focus:ring-teal"
            />
            Feature in "Discover New Brands"
          </label>
          {error && <p className="text-red text-sm mb-4 bg-red-light rounded-lg px-3 py-2">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Save brand"}
          </Button>
        </form>
      </Modal>
    </Layout>
  );
}
