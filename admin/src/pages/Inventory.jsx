import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { ClickableThumbnail } from "../components/ClickableThumbnail";
import { inputClass } from "../components/Field";
import { api } from "../api/client";

function StockCell({ pricing, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(pricing.stock);
  const [saving, setSaving] = useState(false);
  const limit = pricing.reorder_level > 0 ? pricing.reorder_level : 20;
  const low = pricing.stock < limit;

  async function save() {
    setSaving(true);
    try {
      await onSave(pricing.id, Number(value));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          className="w-20 rounded-md border border-border px-2 py-1 text-sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <button onClick={save} disabled={saving} className="text-xs text-teal-dark font-medium">
          {saving ? "…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-ink-soft">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title={`Reorder level: ${limit}${pricing.reorder_level > 0 ? "" : " (default — not set for this channel)"}`}
      className={`text-sm font-medium hover:underline ${low ? (pricing.stock === 0 ? "text-red" : "text-amber") : "text-ink"}`}
    >
      {pricing.stock}
    </button>
  );
}

function isExpiringSoon(dateStr) {
  if (!dateStr) return false;
  const days = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 90;
}

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (lowStockOnly) {
      params.set("low_stock_only", "true");
      params.set("threshold", "20");
    }
    if (search) params.set("search", search);
    const query = params.toString() ? `?${params.toString()}` : "";
    api.get(`/api/admin/inventory${query}`).then(setProducts).finally(() => setLoading(false));
  }

  useEffect(load, [lowStockOnly]);

  useEffect(() => {
    const handle = setTimeout(load, 300);
    return () => clearTimeout(handle);
  }, [search]);

  async function updateStock(pricingId, stock) {
    await api.patch(`/api/admin/inventory/${pricingId}/stock`, { stock });
    load();
  }

  return (
    <Layout
      title="Inventory"
      subtitle="Stock, batch, and expiry tracking — click a stock number to edit it. Hover a stock number to see that channel's reorder level."
      action={
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} className="rounded border-border text-teal focus:ring-teal" />
          Low stock only
        </label>
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
      ) : products.length === 0 ? (
        <div className="bg-white rounded-card border border-border shadow-card p-12 text-center">
          <p className="text-ink-soft text-sm">
            {search ? `No products match "${search}".` : lowStockOnly ? "Nothing below reorder level right now." : "No products yet."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-card border border-border shadow-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg/60">
                <th className="text-left font-medium text-ink-soft text-xs uppercase tracking-wider px-5 py-3"></th>
                <th className="text-left font-medium text-ink-soft text-xs uppercase tracking-wider px-5 py-3">Product</th>
                <th className="text-left font-medium text-ink-soft text-xs uppercase tracking-wider px-5 py-3">SKU</th>
                <th className="text-left font-medium text-ink-soft text-xs uppercase tracking-wider px-5 py-3">B2C stock</th>
                <th className="text-left font-medium text-ink-soft text-xs uppercase tracking-wider px-5 py-3">B2B Normal stock</th>
                <th className="text-left font-medium text-ink-soft text-xs uppercase tracking-wider px-5 py-3">B2B Advance stock</th>
                <th className="text-left font-medium text-ink-soft text-xs uppercase tracking-wider px-5 py-3">Batch</th>
                <th className="text-left font-medium text-ink-soft text-xs uppercase tracking-wider px-5 py-3">Expiry</th>
                <th className="text-left font-medium text-ink-soft text-xs uppercase tracking-wider px-5 py-3">Rack</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-bg/40">
                  <td className="px-5 py-3.5">
                    <ClickableThumbnail src={p.image_urls?.split(",")[0]} alt={p.name} />
                  </td>
                  <td className="px-5 py-3.5">{p.name}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-ink-soft">{p.sku}</td>
                  {["b2c", "b2b_normal", "b2b_advance"].map((channel) => {
                    const pricing = p.pricing.find((pr) => pr.channel === channel);
                    return (
                      <td key={channel} className="px-5 py-3.5">
                        {pricing ? (
                          <StockCell pricing={pricing} onSave={updateStock} />
                        ) : (
                          <span className="text-ink-soft text-xs">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-5 py-3.5 font-mono text-xs text-ink-soft">{p.batch_number || "—"}</td>
                  <td className={`px-5 py-3.5 text-xs ${isExpiringSoon(p.expiry_date) ? "text-amber font-medium" : "text-ink-soft"}`}>
                    {p.expiry_date || "—"}
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft text-xs">{p.rack_place || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
