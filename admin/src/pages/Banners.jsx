import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { Field, inputClass } from "../components/Field";
import SingleImageUploader from "../components/SingleImageUploader";
import { ClickableThumbnail } from "../components/ClickableThumbnail";
import { api } from "../api/client";

const emptyForm = { title: "", image_url: "", link_url: "", channel: "b2c", position: "hero" };

export default function Banners() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    api.get("/api/admin/banners").then(setBanners).finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(banner) {
    setEditingId(banner.id);
    setForm({
      title: banner.title,
      image_url: banner.image_url,
      link_url: banner.link_url || "",
      channel: banner.channel,
      position: banner.position,
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
      if (editingId) {
        await api.patch(`/api/admin/banners/${editingId}`, {
          title: form.title,
          image_url: form.image_url,
          link_url: form.link_url || null,
          channel: form.channel,
          position: form.position,
        });
      } else {
        await api.post("/api/admin/banners", {
          ...form,
          link_url: form.link_url || null,
          sort_order: banners.length,
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

  async function handleDelete(banner) {
    if (!confirm(`Delete "${banner.title}"? This can't be undone.`)) return;
    setBusyId(banner.id);
    try {
      await api.delete(`/api/admin/banners/${banner.id}`);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const CHANNEL_LABELS = { b2c: "B2C", b2b: "B2B", cnf: "CNF", both: "B2C + B2B", all: "B2C + B2B + CNF" };
  const POSITION_LABELS = { hero: "Hero", promo_strip: "Promo strip", channel_cards: "Channel cards" };

  return (
    <Layout
      title="Banners"
      subtitle="Hero and promo-strip images for the B2C and B2B storefronts"
      action={<Button onClick={openCreate}>Add banner</Button>}
    >
      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : (
        <DataTable
          rows={banners}
          emptyMessage="No banners yet — add your first one."
          columns={[
            {
              key: "image_url",
              header: "",
              render: (row) => <ClickableThumbnail src={row.image_url} alt={row.title} className="h-9 w-16 rounded-lg object-cover bg-bg" />,
            },
            { key: "title", header: "Title", render: (row) => <span className={row.is_active ? "" : "text-ink-soft line-through"}>{row.title}</span> },
            { key: "channel", header: "Channel", render: (row) => <span className="text-xs text-ink-soft">{CHANNEL_LABELS[row.channel] || row.channel}</span> },
            { key: "position", header: "Position", render: (row) => POSITION_LABELS[row.position] || row.position },
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit banner" : "Add banner"}>
        <form onSubmit={handleSubmit}>
          <Field label="Title">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Flat 20% off on first order"
              required
            />
          </Field>
          <Field label="Image">
            <SingleImageUploader value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} label="banner image" />
          </Field>
          <Field label="Link URL (optional)">
            <input
              className={inputClass}
              value={form.link_url}
              onChange={(e) => setForm({ ...form, link_url: e.target.value })}
              placeholder="/category/diabetes-care"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Channel">
              <select
                className={inputClass}
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
              >
                <option value="b2c">B2C</option>
                <option value="b2b">B2B</option>
                <option value="cnf">CNF</option>
                <option value="both">B2C + B2B</option>
                <option value="all">B2C + B2B + CNF</option>
              </select>
            </Field>
            <Field label="Position">
              <select
                className={inputClass}
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              >
                <option value="hero">Hero</option>
                <option value="promo_strip">Promo strip</option>
                <option value="channel_cards">Channel cards (B2C / B2B / CNF)</option>
              </select>
            </Field>
          </div>
          {error && <p className="text-red text-sm mb-4 bg-red-light rounded-lg px-3 py-2">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Save banner"}
          </Button>
        </form>
      </Modal>
    </Layout>
  );
}
