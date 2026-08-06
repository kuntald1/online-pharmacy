import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import Button from "../components/Button";
import Modal from "../components/Modal";
import ImageUploader from "../components/ImageUploader";
import RichTextEditor from "../components/RichTextEditor";
import { ClickableThumbnail } from "../components/ClickableThumbnail";
import { Field, inputClass } from "../components/Field";
import InvoiceImportModal from "./InvoiceImportModal";
import { api } from "../api/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const emptyForm = {
  name: "",
  sku: "",
  description: "",
  image_urls: "",
  category_id: "",
  brand_id: "",
  batch_number: "",
  expiry_date: "",
  rack_place: "",
  variant_label: "",
  manufacturer_id: "",
  marketer_id: "",
  country_of_origin: "",
  expiry_month: "",
  expiry_year: "",
  is_spotlighted: false,
  spotlight_order: "0",
  auto_generate_relations: true,
  b2c_price: "",
  b2c_mrp: "",
  b2c_stock: "",
  b2c_reorder_level: "",
  b2b_normal_price: "",
  b2b_normal_mrp: "",
  b2b_normal_min_qty: "",
  b2b_normal_stock: "",
  b2b_normal_reorder_level: "",
  b2b_advance_price: "",
  b2b_advance_mrp: "",
  b2b_advance_min_qty: "",
  b2b_advance_stock: "",
  b2b_advance_reorder_level: "",
  cnf_price: "",
  cnf_mrp: "",
  cnf_min_qty: "",
  cnf_stock: "",
  cnf_reorder_level: "",
};

const COUNTRIES = [
  "India", "China", "United States", "Germany", "United Kingdom", "Switzerland",
  "Japan", "South Korea", "France", "Italy", "Spain", "Netherlands", "Belgium",
  "Bangladesh", "Sri Lanka", "Nepal", "Israel", "Singapore", "Ireland", "Other",
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Dropdown-plus-quick-add for a master list (Manufacturer / Marketer). Selecting an
 * item calls onSelect(id); the selected item's address is shown read-only underneath,
 * since the address belongs to the master record, not to whatever product is open. */
function MasterPicker({ label, items, valueId, onSelect, onCreate, addLabel, namePlaceholder, addressPlaceholder }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const selected = items.find((i) => i.id === Number(valueId));

  async function submitNew() {
    if (!newName.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const created = await onCreate({ name: newName.trim(), address: newAddress.trim() || null });
      onSelect(created.id);
      setAdding(false);
      setNewName("");
      setNewAddress("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Field label={label}>
        <select
          className={inputClass}
          value={valueId || ""}
          onChange={(e) => {
            if (e.target.value === "__new__") {
              setAdding(true);
            } else {
              onSelect(e.target.value ? Number(e.target.value) : null);
            }
          }}
        >
          <option value="">None</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
          <option value="__new__">+ {addLabel}</option>
        </select>
      </Field>

      {!adding && selected && (
        <div className="mt-1.5">
          <p className="text-xs text-ink-soft mb-1">Address</p>
          <p className="text-sm text-ink bg-bg rounded-lg px-3 py-2">{selected.address || "No address on file"}</p>
        </div>
      )}

      {adding && (
        <div className="mt-2 border border-border rounded-lg p-3 space-y-2">
          <input className={inputClass} placeholder={namePlaceholder} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <textarea className={inputClass} rows={2} placeholder={addressPlaceholder} value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
          {err && <p className="text-red text-xs">{err}</p>}
          <div className="flex gap-2">
            <Button type="button" onClick={submitNew} disabled={busy || !newName.trim()}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <button type="button" onClick={() => { setAdding(false); setErr(""); }} className="text-xs text-ink-soft hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Search-and-link manager for one relation type (FBT / Similar / Also bought) on
 * one product. Self-contained: loads and refreshes its own list independently of
 * the parent form, since relations save immediately (no draft state, unlike the
 * rest of the product form which saves on submit). */
function RelationPicker({ label, productId, relationType, allProducts }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api.get(`/api/admin/products/${productId}/relations?type=${relationType}`).then(setItems).catch(() => setItems([]));
  }

  useEffect(() => {
    if (productId) load();
    setSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, relationType]);

  async function add(relatedId) {
    setBusy(true);
    try {
      await api.post(`/api/admin/products/${productId}/relations`, { related_product_id: relatedId, relation_type: relationType });
      setSearch("");
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(relationId) {
    setBusy(true);
    try {
      await api.delete(`/api/admin/products/${productId}/relations/${relationId}`);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-border rounded-lg p-3 mb-3">
      <p className="text-sm font-medium text-ink mb-2">{label}</p>
      {items.length > 0 ? (
        <ul className="space-y-1.5 mb-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between text-sm">
              <span className="text-ink">
                {it.related_product_name} <span className="text-xs text-ink-soft font-mono">{it.related_product_sku}</span>
              </span>
              <button type="button" disabled={busy} onClick={() => remove(it.id)} className="text-xs font-medium text-red hover:underline disabled:opacity-50">
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-soft mb-2">None linked yet.</p>
      )}
      <input
        className={inputClass}
        placeholder="Search product to add…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {search.trim() && (
        <ul className="mt-2 max-h-32 overflow-y-auto border border-border rounded-lg divide-y divide-border">
          {allProducts
            .filter(
              (p) =>
                p.id !== productId &&
                !items.some((it) => it.related_product_id === p.id) &&
                p.name.toLowerCase().includes(search.trim().toLowerCase())
            )
            .slice(0, 8)
            .map((p) => (
              <li key={p.id}>
                <button type="button" disabled={busy} onClick={() => add(p.id)} className="w-full text-left text-sm px-3 py-2 hover:bg-bg disabled:opacity-50">
                  {p.name} <span className="text-xs text-ink-soft font-mono">{p.sku}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [marketers, setMarketers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [variantGroup, setVariantGroup] = useState([]);
  const [variantSearch, setVariantSearch] = useState("");
  const [variantBusy, setVariantBusy] = useState(false);
  const [variantSuggestions, setVariantSuggestions] = useState([]);

  function load(searchTerm = search) {
    setLoading(true);
    const query = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : "";
    Promise.all([
      api.get(`/api/admin/products${query}`),
      api.get("/api/categories"),
      api.get("/api/brands"),
      api.get("/api/admin/manufacturers"),
      api.get("/api/admin/marketers"),
    ])
      .then(([p, c, b, m, mk]) => {
        setProducts(p);
        setCategories(c);
        setBrands(b);
        setManufacturers(m);
        setMarketers(mk);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  useEffect(() => {
    const handle = setTimeout(() => load(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function buildPricing() {
    const rows = [];
    if (form.b2c_price) {
      rows.push({
        channel: "b2c",
        price: Number(form.b2c_price),
        mrp: form.b2c_mrp ? Number(form.b2c_mrp) : null,
        min_quantity: 1,
        stock: Number(form.b2c_stock || 0),
        reorder_level: Number(form.b2c_reorder_level || 0),
      });
    }
    if (form.b2b_normal_price) {
      rows.push({
        channel: "b2b_normal",
        price: Number(form.b2b_normal_price),
        mrp: form.b2b_normal_mrp ? Number(form.b2b_normal_mrp) : null,
        min_quantity: Number(form.b2b_normal_min_qty || 1),
        stock: Number(form.b2b_normal_stock || 0),
        reorder_level: Number(form.b2b_normal_reorder_level || 0),
      });
    }
    if (form.b2b_advance_price) {
      rows.push({
        channel: "b2b_advance",
        price: Number(form.b2b_advance_price),
        mrp: form.b2b_advance_mrp ? Number(form.b2b_advance_mrp) : null,
        min_quantity: Number(form.b2b_advance_min_qty || 1),
        stock: Number(form.b2b_advance_stock || 0),
        reorder_level: Number(form.b2b_advance_reorder_level || 0),
      });
    }
    if (form.cnf_price) {
      rows.push({
        channel: "cnf",
        price: Number(form.cnf_price),
        mrp: form.cnf_mrp ? Number(form.cnf_mrp) : null,
        min_quantity: Number(form.cnf_min_qty || 1),
        stock: Number(form.cnf_stock || 0),
        reorder_level: Number(form.cnf_reorder_level || 0),
      });
    }
    return rows;
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setVariantGroup([]);
    setVariantSearch("");
    setVariantSuggestions([]);
    setModalOpen(true);
  }

  function loadVariantGroup(productId) {
    api.get(`/api/admin/products/${productId}/variant-group`).then(setVariantGroup).catch(() => setVariantGroup([]));
  }

  function loadVariantSuggestions(productId) {
    api.get(`/api/admin/products/${productId}/variant-suggestions`).then(setVariantSuggestions).catch(() => setVariantSuggestions([]));
  }

  function openEdit(product) {
    const pricingFor = (channel) => product.pricing.find((p) => p.channel === channel);
    const b2c = pricingFor("b2c");
    const b2bNormal = pricingFor("b2b_normal");
    const b2bAdvance = pricingFor("b2b_advance");
    const cnf = pricingFor("cnf");

    setEditingId(product.id);
    setForm({
      name: product.name,
      sku: product.sku,
      description: product.description || "",
      image_urls: product.image_urls || "",
      category_id: product.category_id || "",
      brand_id: product.brand_id || "",
      batch_number: product.batch_number || "",
      expiry_date: product.expiry_date || "",
      rack_place: product.rack_place || "",
      variant_label: product.variant_label || "",
      manufacturer_id: product.manufacturer_id || "",
      marketer_id: product.marketer_id || "",
      country_of_origin: product.country_of_origin || "",
      expiry_month: product.expiry_month || "",
      expiry_year: product.expiry_year || "",
      is_spotlighted: product.is_spotlighted || false,
      spotlight_order: product.spotlight_order ?? 0,
      auto_generate_relations: product.auto_generate_relations ?? true,
      b2c_price: b2c?.price ?? "",
      b2c_mrp: b2c?.mrp ?? "",
      b2c_stock: b2c?.stock ?? "",
      b2c_reorder_level: b2c?.reorder_level ?? "",
      b2b_normal_price: b2bNormal?.price ?? "",
      b2b_normal_mrp: b2bNormal?.mrp ?? "",
      b2b_normal_min_qty: b2bNormal?.min_quantity ?? "",
      b2b_normal_stock: b2bNormal?.stock ?? "",
      b2b_normal_reorder_level: b2bNormal?.reorder_level ?? "",
      b2b_advance_price: b2bAdvance?.price ?? "",
      b2b_advance_mrp: b2bAdvance?.mrp ?? "",
      b2b_advance_min_qty: b2bAdvance?.min_quantity ?? "",
      b2b_advance_stock: b2bAdvance?.stock ?? "",
      b2b_advance_reorder_level: b2bAdvance?.reorder_level ?? "",
      cnf_price: cnf?.price ?? "",
      cnf_mrp: cnf?.mrp ?? "",
      cnf_min_qty: cnf?.min_quantity ?? "",
      cnf_stock: cnf?.stock ?? "",
      cnf_reorder_level: cnf?.reorder_level ?? "",
    });
    setError("");
    setVariantSearch("");
    loadVariantGroup(product.id);
    loadVariantSuggestions(product.id);
    setModalOpen(true);
  }

  async function handleLinkVariant(targetId) {
    setVariantBusy(true);
    try {
      await api.post(`/api/admin/products/${editingId}/link-variant`, { target_product_id: targetId });
      setVariantSearch("");
      loadVariantGroup(editingId);
      loadVariantSuggestions(editingId);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setVariantBusy(false);
    }
  }

  async function handleUnlinkVariant(memberId) {
    setVariantBusy(true);
    try {
      // memberId being editingId itself means "remove the product being edited
      // from the group"; otherwise it's removing one of its siblings
      await api.post(`/api/admin/products/${memberId}/unlink-variant`, {});
      loadVariantGroup(editingId);
      loadVariantSuggestions(editingId);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setVariantBusy(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const pricing = buildPricing();
    if (pricing.length === 0) {
      setError("Set a price for at least one channel (B2C, B2B Normal, B2B Advance, or CNF).");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        image_urls: form.image_urls || null,
        category_id: form.category_id ? Number(form.category_id) : null,
        brand_id: form.brand_id ? Number(form.brand_id) : null,
        batch_number: form.batch_number || null,
        expiry_date: form.expiry_date || null,
        rack_place: form.rack_place || null,
        variant_label: form.variant_label || null,
        manufacturer_id: form.manufacturer_id ? Number(form.manufacturer_id) : null,
        marketer_id: form.marketer_id ? Number(form.marketer_id) : null,
        country_of_origin: form.country_of_origin || null,
        expiry_month: form.expiry_month ? Number(form.expiry_month) : null,
        expiry_year: form.expiry_year ? Number(form.expiry_year) : null,
        is_spotlighted: form.is_spotlighted,
        spotlight_order: Number(form.spotlight_order || 0),
        auto_generate_relations: form.auto_generate_relations,
        pricing,
      };
      if (editingId) {
        await api.patch(`/api/admin/products/${editingId}`, payload);
      } else {
        await api.post("/api/admin/products", {
          ...payload,
          slug: slugify(form.name) + "-" + Math.random().toString(36).slice(2, 6),
          sku: form.sku,
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

  async function handleDelete(product) {
    if (!confirm(`Delete "${product.name}"? This can't be undone.`)) return;
    setBusyId(product.id);
    try {
      await api.delete(`/api/admin/products/${product.id}`);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleSpotlight(product) {
    setBusyId(product.id);
    try {
      await api.patch(`/api/admin/products/${product.id}`, { is_spotlighted: !product.is_spotlighted });
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function downloadTemplate(format = "xlsx") {
    const token = localStorage.getItem("pillpoints_admin_token");
    const res = await fetch(`${API_BASE}/api/admin/products/import-template?format=${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `healthycian_product_import_template.${format}`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportError("");
    setImportResult(null);
    try {
      const token = localStorage.getItem("pillpoints_admin_token");
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await fetch(`${API_BASE}/api/admin/products/import`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Import failed");
      setImportResult(data);
      load();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  }

  const categoryName = (id) => categories.find((c) => c.id === id)?.name || "—";

  return (
    <Layout
      title="Products"
      subtitle="Upload once, price per channel — set B2C pricing plus B2B Normal and Advance tiers"
      action={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setImportModalOpen(true); setImportResult(null); setImportError(""); setImportFile(null); }}>
            Import Excel/CSV
          </Button>
          <Button variant="secondary" onClick={() => setInvoiceModalOpen(true)}>
            Restock from invoice
          </Button>
          <Button onClick={openCreate}>Add product</Button>
        </div>
      }
    >
      <div className="mb-4">
        <input
          className={`${inputClass} max-w-sm`}
          placeholder="Search by name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : (
        <DataTable
          rows={products}
          emptyMessage={search ? `No products match "${search}".` : "No products yet — add your first one."}
          columns={[
            {
              key: "image_urls",
              header: "",
              render: (row) => (
                <ClickableThumbnail
                  src={row.image_urls?.split(",")[0]}
                  alt={row.name}
                  className="h-16 w-16 rounded-lg object-cover bg-bg"
                />
              ),
            },
            { key: "name", header: "Name" },
            { key: "sku", header: "SKU", render: (row) => <span className="font-mono text-xs text-ink-soft">{row.sku}</span> },
            { key: "category", header: "Category", render: (row) => categoryName(row.category_id) },
            {
              key: "variant",
              header: "Variant",
              render: (row) => (row.variant_group_id ? (row.variant_label || "Linked") : "—"),
            },
            {
              key: "spotlight",
              header: "Spotlight",
              render: (row) => (
                <button
                  onClick={() => toggleSpotlight(row)}
                  disabled={busyId === row.id}
                  title={row.is_spotlighted ? "Remove from spotlight" : "Add to spotlight"}
                  className="flex items-center gap-1 disabled:opacity-50"
                >
                  <Star
                    size={16}
                    className={row.is_spotlighted ? "fill-amber text-amber" : "text-border"}
                  />
                  {row.is_spotlighted && <span className="text-xs text-amber font-medium">#{row.spotlight_order}</span>}
                </button>
              ),
            },
            {
              key: "b2c_price",
              header: "B2C Price",
              render: (row) => {
                const p = row.pricing.find((x) => x.channel === "b2c");
                return p ? `₹${p.price}` : "—";
              },
            },
            {
              key: "stock",
              header: "Stock",
              render: (row) => {
                const p = row.pricing.find((x) => x.channel === "b2c");
                return p ? p.stock : "—";
              },
            },
            {
              key: "rack_place",
              header: "Rack",
              render: (row) => row.rack_place || "—",
            },
            {
              key: "expiry_date",
              header: "Expiry",
              render: (row) => row.expiry_date || "—",
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit product" : "Add product"} width="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Product name">
              <input className={inputClass} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Glucometer Pro" required />
            </Field>
            <Field label="SKU">
              <input
                className={inputClass}
                value={form.sku}
                onChange={(e) => update("sku", e.target.value)}
                placeholder="SKU-GLU-001"
                required
                disabled={!!editingId}
                title={editingId ? "SKU can't be changed after creation" : undefined}
              />
            </Field>
          </div>

          <Field label="Description">
            <RichTextEditor value={form.description} onChange={(html) => update("description", html)} />
          </Field>

          <Field label="Images">
            <ImageUploader value={form.image_urls} onChange={(value) => update("image_urls", value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select className={inputClass} value={form.category_id} onChange={(e) => update("category_id", e.target.value)}>
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Brand">
              <select className={inputClass} value={form.brand_id} onChange={(e) => update("brand_id", e.target.value)}>
                <option value="">None</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-2 mb-4">
            <p className="text-xs font-medium text-ink-soft mb-2 cross-mark">Inventory details</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Batch number">
                <input className={inputClass} value={form.batch_number} onChange={(e) => update("batch_number", e.target.value)} placeholder="BATCH-2026-07" />
              </Field>
              <Field label="Expiry date">
                <input className={inputClass} type="date" value={form.expiry_date} onChange={(e) => update("expiry_date", e.target.value)} />
              </Field>
              <Field label="Rack place">
                <input className={inputClass} value={form.rack_place} onChange={(e) => update("rack_place", e.target.value)} placeholder="Rack A-3" />
              </Field>
            </div>
            <p className="text-xs text-ink-soft mt-1">
              This is single-batch tracking — one batch/expiry/rack per product. If you need to track multiple
              batches of the same product separately (different expiry dates arriving over time), that's a bigger
              feature not built yet. Reorder level is set per channel below, since B2C and B2B stock levels
              usually need different thresholds.
            </p>
          </div>

          <div className="mt-2 mb-4">
            <p className="text-xs font-medium text-ink-soft mb-2 cross-mark">Variants</p>
            <Field label={'Variant label (e.g. "100 gm Gel", "200 ml Bottle")'}>
              <input
                className={inputClass}
                value={form.variant_label}
                onChange={(e) => update("variant_label", e.target.value)}
                placeholder="100 gm Gel"
              />
            </Field>

            {editingId ? (
              <div className="border border-border rounded-lg p-4 mt-2">
                {variantGroup.length > 0 ? (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-ink-soft mb-2">
                      Shown together as size options on this product's page:
                    </p>
                    <ul className="space-y-1.5">
                      {variantGroup.map((v) => (
                        <li key={v.id} className="flex items-center justify-between text-sm">
                          <span className="text-ink">{v.name} {v.variant_label ? `— ${v.variant_label}` : ""}</span>
                          <button
                            type="button"
                            disabled={variantBusy}
                            onClick={() => handleUnlinkVariant(v.id)}
                            className="text-xs font-medium text-red hover:underline disabled:opacity-50"
                          >
                            Unlink
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-ink-soft mb-3">Not linked to any other size yet.</p>
                )}

                {variantSuggestions.length > 0 && (
                  <div className="mb-3 bg-teal-light/40 border border-teal-light rounded-lg p-3">
                    <p className="text-xs font-medium text-teal-dark mb-2">
                      Looks like the same product, different size — link it?
                    </p>
                    <ul className="space-y-1.5">
                      {variantSuggestions.map((s) => (
                        <li key={s.id} className="flex items-center justify-between text-sm">
                          <span className="text-ink">{s.name} <span className="text-xs text-ink-soft font-mono">{s.sku}</span></span>
                          <button
                            type="button"
                            disabled={variantBusy}
                            onClick={() => handleLinkVariant(s.id)}
                            className="text-xs font-medium text-teal-dark hover:underline disabled:opacity-50"
                          >
                            Link
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <input
                  className={inputClass}
                  placeholder="Search another product to link as a variant…"
                  value={variantSearch}
                  onChange={(e) => setVariantSearch(e.target.value)}
                />
                {variantSearch.trim() && (
                  <ul className="mt-2 max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                    {products
                      .filter(
                        (p) =>
                          p.id !== editingId &&
                          !variantGroup.some((v) => v.id === p.id) &&
                          p.name.toLowerCase().includes(variantSearch.trim().toLowerCase())
                      )
                      .slice(0, 8)
                      .map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            disabled={variantBusy}
                            onClick={() => handleLinkVariant(p.id)}
                            className="w-full text-left text-sm px-3 py-2 hover:bg-bg disabled:opacity-50"
                          >
                            {p.name} <span className="text-xs text-ink-soft font-mono">{p.sku}</span>
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-xs text-ink-soft mt-1">
                Save this product first, then reopen it here to link other sizes as variants.
              </p>
            )}
          </div>

          <div className="mt-2 mb-4">
            <p className="text-xs font-medium text-ink-soft mb-2 cross-mark">Related products</p>
            <p className="text-xs text-ink-soft mb-2">
              Manually linked products always take priority. When a section below has nothing manually linked,
              auto-generation fills it in: <strong>Similar products</strong> uses category + brand matching (works
              immediately); <strong>Frequently bought together</strong> and <strong>Customers also bought</strong> use
              real order history, so they'll stay empty until this product has enough completed orders.
            </p>
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={form.auto_generate_relations}
                onChange={(e) => update("auto_generate_relations", e.target.checked)}
              />
              <span className="text-sm text-ink">Auto-generate when nothing is manually linked</span>
            </label>
            {editingId ? (
              <>
                <RelationPicker label="Frequently bought together" productId={editingId} relationType="fbt" allProducts={products} />
                <RelationPicker label="Similar products" productId={editingId} relationType="similar" allProducts={products} />
                <RelationPicker label="Customers who bought this item also bought" productId={editingId} relationType="also_bought" allProducts={products} />
              </>
            ) : (
              <p className="text-xs text-ink-soft mt-1">
                Save this product first, then reopen it here to link related products.
              </p>
            )}
          </div>

          <div className="mt-2 mb-4">
            <p className="text-xs font-medium text-ink-soft mb-2 cross-mark">Pricing by channel</p>

            <div className="border border-border rounded-lg p-4 mb-3">
              <p className="text-sm font-medium text-ink mb-3">B2C</p>
              <div className="grid grid-cols-4 gap-3">
                <Field label="Price (₹)">
                  <input className={inputClass} type="number" value={form.b2c_price} onChange={(e) => update("b2c_price", e.target.value)} />
                </Field>
                <Field label="MRP (₹)">
                  <input className={inputClass} type="number" value={form.b2c_mrp} onChange={(e) => update("b2c_mrp", e.target.value)} />
                </Field>
                <Field label="Stock">
                  <input className={inputClass} type="number" value={form.b2c_stock} onChange={(e) => update("b2c_stock", e.target.value)} />
                </Field>
                <Field label="Reorder level">
                  <input className={inputClass} type="number" value={form.b2c_reorder_level} onChange={(e) => update("b2c_reorder_level", e.target.value)} placeholder="e.g. 20" />
                </Field>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4 mb-3">
              <p className="text-sm font-medium text-ink mb-3">B2B — Normal tier</p>
              <div className="grid grid-cols-5 gap-3">
                <Field label="Price (₹)">
                  <input className={inputClass} type="number" value={form.b2b_normal_price} onChange={(e) => update("b2b_normal_price", e.target.value)} />
                </Field>
                <Field label="MRP (₹)">
                  <input className={inputClass} type="number" value={form.b2b_normal_mrp} onChange={(e) => update("b2b_normal_mrp", e.target.value)} />
                </Field>
                <Field label="Min. quantity">
                  <input className={inputClass} type="number" value={form.b2b_normal_min_qty} onChange={(e) => update("b2b_normal_min_qty", e.target.value)} />
                </Field>
                <Field label="Stock">
                  <input className={inputClass} type="number" value={form.b2b_normal_stock} onChange={(e) => update("b2b_normal_stock", e.target.value)} />
                </Field>
                <Field label="Reorder level">
                  <input className={inputClass} type="number" value={form.b2b_normal_reorder_level} onChange={(e) => update("b2b_normal_reorder_level", e.target.value)} placeholder="e.g. 20" />
                </Field>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4">
              <p className="text-sm font-medium text-ink mb-3">B2B — Advance tier</p>
              <div className="grid grid-cols-5 gap-3">
                <Field label="Price (₹)">
                  <input className={inputClass} type="number" value={form.b2b_advance_price} onChange={(e) => update("b2b_advance_price", e.target.value)} />
                </Field>
                <Field label="MRP (₹)">
                  <input className={inputClass} type="number" value={form.b2b_advance_mrp} onChange={(e) => update("b2b_advance_mrp", e.target.value)} />
                </Field>
                <Field label="Min. quantity">
                  <input className={inputClass} type="number" value={form.b2b_advance_min_qty} onChange={(e) => update("b2b_advance_min_qty", e.target.value)} />
                </Field>
                <Field label="Stock">
                  <input className={inputClass} type="number" value={form.b2b_advance_stock} onChange={(e) => update("b2b_advance_stock", e.target.value)} />
                </Field>
                <Field label="Reorder level">
                  <input className={inputClass} type="number" value={form.b2b_advance_reorder_level} onChange={(e) => update("b2b_advance_reorder_level", e.target.value)} placeholder="e.g. 20" />
                </Field>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4 mt-3">
              <p className="text-sm font-medium text-ink mb-3">CNF / Distributor</p>
              <div className="grid grid-cols-5 gap-3">
                <Field label="Price (₹)">
                  <input className={inputClass} type="number" value={form.cnf_price} onChange={(e) => update("cnf_price", e.target.value)} />
                </Field>
                <Field label="MRP (₹)">
                  <input className={inputClass} type="number" value={form.cnf_mrp} onChange={(e) => update("cnf_mrp", e.target.value)} />
                </Field>
                <Field label="Min. quantity">
                  <input className={inputClass} type="number" value={form.cnf_min_qty} onChange={(e) => update("cnf_min_qty", e.target.value)} />
                </Field>
                <Field label="Stock">
                  <input className={inputClass} type="number" value={form.cnf_stock} onChange={(e) => update("cnf_stock", e.target.value)} />
                </Field>
                <Field label="Reorder level">
                  <input className={inputClass} type="number" value={form.cnf_reorder_level} onChange={(e) => update("cnf_reorder_level", e.target.value)} placeholder="e.g. 20" />
                </Field>
              </div>
              <p className="text-xs text-ink-soft mt-2">
                Sets the price CNF/Distributor accounts would see. There's no storefront catalog for CNF accounts to
                browse yet — this just makes the pricing exist and ready for when that's built.
              </p>
            </div>
          </div>

          <div className="mt-2 mb-4">
            <p className="text-xs font-medium text-ink-soft mb-2 cross-mark">Compliance information</p>
            <p className="text-xs text-ink-soft mb-3">
              Shown on the product page. Leave blank for product categories that don't need it.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <MasterPicker
                label="Manufacturer"
                items={manufacturers}
                valueId={form.manufacturer_id}
                onSelect={(id) => update("manufacturer_id", id)}
                onCreate={async (payload) => {
                  const created = await api.post("/api/admin/manufacturers", payload);
                  setManufacturers((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
                  return created;
                }}
                addLabel="Add New Manufacturer"
                namePlaceholder="Sun Pharmaceutical Industries Ltd"
                addressPlaceholder="Khasra No. 1335-1340, Baddi, HP"
              />
              <MasterPicker
                label="Marketer"
                items={marketers}
                valueId={form.marketer_id}
                onSelect={(id) => update("marketer_id", id)}
                onCreate={async (payload) => {
                  const created = await api.post("/api/admin/marketers", payload);
                  setMarketers((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
                  return created;
                }}
                addLabel="Add New Marketer"
                namePlaceholder="Sun Pharmaceutical Industries Ltd"
                addressPlaceholder="Ranipool, East Sikkim"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Country of origin">
                <select className={inputClass} value={form.country_of_origin} onChange={(e) => update("country_of_origin", e.target.value)}>
                  <option value="">None</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Expiry — month">
                <select className={inputClass} value={form.expiry_month} onChange={(e) => update("expiry_month", e.target.value)}>
                  <option value="">—</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Expiry — year">
                <select className={inputClass} value={form.expiry_year} onChange={(e) => update("expiry_year", e.target.value)}>
                  <option value="">—</option>
                  {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className="mt-2 mb-4">
            <p className="text-xs font-medium text-ink-soft mb-2 cross-mark">Spotlight</p>
            <p className="text-xs text-ink-soft mb-2">
              Featured in the "In the Spotlight" promo carousel on product pages. Manually curated, not automatic.
            </p>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={form.is_spotlighted}
                onChange={(e) => update("is_spotlighted", e.target.checked)}
              />
              <span className="text-sm text-ink">Show in the Spotlight</span>
            </label>
            {form.is_spotlighted && (
              <Field label="Spotlight order (lower shows first)">
                <input
                  className={`${inputClass} max-w-[10rem]`}
                  type="number"
                  value={form.spotlight_order}
                  onChange={(e) => update("spotlight_order", e.target.value)}
                />
              </Field>
            )}
          </div>

          {error && <p className="text-red text-sm mb-4 bg-red-light rounded-lg px-3 py-2">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Save product"}
          </Button>
        </form>
      </Modal>

      <Modal open={importModalOpen} onClose={() => setImportModalOpen(false)} title="Import products from Excel or CSV">
        <div className="mb-4">
          <p className="text-sm text-ink-soft mb-3">
            Bulk-create or update products by SKU. Matching an existing SKU updates that product instead of
            creating a duplicate — safe to re-upload the same file after fixing errors. Rows sharing the same
            "variant_group_key" get linked together as size options on the storefront. Doesn't cover Frequently
            Bought Together / Similar / Also Bought — link those per-product in the edit screen instead.
          </p>
          <div className="flex gap-4">
            <button onClick={() => downloadTemplate("xlsx")} className="text-sm font-medium text-teal-dark hover:underline">
              ↓ Download template (.xlsx)
            </button>
            <button onClick={() => downloadTemplate("csv")} className="text-sm font-medium text-teal-dark hover:underline">
              ↓ Download template (.csv)
            </button>
          </div>
        </div>

        <label className="block mb-4">
          <span className="block text-xs font-medium text-ink-soft mb-1.5">Filled-in .xlsx or .csv file</span>
          <input
            type="file"
            accept=".xlsx,.xlsm,.csv"
            onChange={(e) => setImportFile(e.target.files[0] || null)}
            className={inputClass}
          />
        </label>

        {importError && <p className="text-red text-sm mb-4 bg-red-light rounded-lg px-3 py-2">{importError}</p>}

        {importResult && (
          <div className="mb-4 bg-bg rounded-lg p-3">
            <p className="text-sm text-ink mb-2">
              <span className="text-teal-dark font-medium">{importResult.created} created</span>
              {", "}
              <span className="text-blue-dark font-medium">{importResult.updated} updated</span>
            </p>
            {importResult.errors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber mb-1">{importResult.errors.length} warning(s):</p>
                <ul className="text-xs text-ink-soft list-disc list-inside space-y-0.5">
                  {importResult.errors.map((e, i) => (
                    <li key={i}>Row {e.row}: {e.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <Button onClick={handleImport} disabled={!importFile || importing} className="w-full">
          {importing ? "Importing…" : "Import"}
        </Button>
      </Modal>

      <InvoiceImportModal
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        products={products}
        onApplied={load}
      />
    </Layout>
  );
}
