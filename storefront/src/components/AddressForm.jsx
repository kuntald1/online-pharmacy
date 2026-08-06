import { useState } from "react";
import MapPicker from "./MapPicker";
import { api } from "../api/client";

const empty = { name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "", latitude: null, longitude: null };

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

export default function AddressForm({ onSaved, onCancel, initial }) {
  const [form, setForm] = useState(initial || empty);
  const [showMap, setShowMap] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = { ...form, is_default: form.is_default ?? false };
      const saved = initial?.id
        ? await api.patch(`/api/addresses/${initial.id}`, payload)
        : await api.post("/api/addresses", payload);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Full name" className="rounded-lg border border-border px-3 py-2 text-sm" />
        <input required value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="Phone" className="rounded-lg border border-border px-3 py-2 text-sm" />
      </div>
      <input required value={form.line1} onChange={(e) => update("line1", e.target.value)} placeholder="House no., building, street" className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
      <input value={form.line2 || ""} onChange={(e) => update("line2", e.target.value)} placeholder="Landmark (optional)" className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
      <div className="grid grid-cols-3 gap-3">
        <input required value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="City" className="rounded-lg border border-border px-3 py-2 text-sm" />
        <select required value={form.state} onChange={(e) => update("state", e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm">
          <option value="">State</option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input required value={form.pincode} onChange={(e) => update("pincode", e.target.value)} placeholder="Pincode" className="rounded-lg border border-border px-3 py-2 text-sm" />
      </div>

      <button
        type="button"
        onClick={() => setShowMap((s) => !s)}
        className="text-sm font-medium text-[#02696B] hover:underline"
      >
        {form.latitude ? "Update exact location on map" : "Choose exact location on map"} {showMap ? "▲" : "▼"}
      </button>

      {showMap && (
        <MapPicker
          lat={form.latitude}
          lng={form.longitude}
          onChange={(lat, lng) => {
            update("latitude", lat);
            update("longitude", lng);
          }}
        />
      )}
      {form.latitude && !showMap && (
        <p className="text-xs text-teal-dark">Pinned at {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}</p>
      )}

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={!!form.is_default} onChange={(e) => update("is_default", e.target.checked)} className="rounded border-border" />
        Set as default address
      </label>

      {error && <p className="text-red text-sm">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="flex-1 bg-[#02696B] text-white text-sm font-medium py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50">
          {saving ? "Saving…" : "Save address"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2.5 text-sm text-ink-soft hover:text-ink">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
