import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import Button from "../components/Button";
import { Field, inputClass } from "../components/Field";
import { api } from "../api/client";

// A starter set of known content blocks. Admins can also add arbitrary new
// keys below — this list just gives the common storefront blocks a friendly
// label instead of a raw key.
const KNOWN_BLOCKS = [
  { key: "homepage_hero_title", label: "Homepage hero title" },
  { key: "homepage_hero_subtitle", label: "Homepage hero subtitle" },
  { key: "footer_about_text", label: "Footer about text" },
];

export default function CMS() {
  const [settings, setSettings] = useState([]);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    api
      .get("/api/admin/settings?category=cms")
      .then((data) => {
        setSettings(data);
        setValues(Object.fromEntries(data.map((s) => [s.key, s.value])));
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function save(key, label, valueOverride) {
    setSavingKey(key);
    setError("");
    try {
      const value = valueOverride !== undefined ? valueOverride : (values[key] || "");
      await api.put(`/api/admin/settings/${key}`, {
        value,
        category: "cms",
        label,
      });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKey(null);
    }
  }

  async function addNew(e) {
    e.preventDefault();
    setError("");
    // The field is labeled "Key (auto-generated if left blank)" — this is
    // that auto-generation. Previously, leaving Key blank silently aborted
    // the whole save with no error shown, which is why a filled-in Label
    // with no Key appeared to do nothing when "Add block" was clicked.
    const label = newLabel.trim();
    const rawKey = newKey.trim() || label;
    if (!rawKey) {
      setError("Enter a label or a key before adding a block");
      return;
    }
    const key = rawKey.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!key) {
      setError("That didn't produce a usable key — try including some letters");
      return;
    }
    await save(key, label || key, newValue);
    setNewKey("");
    setNewLabel("");
    setNewValue("");
  }

  const existingKeys = new Set(settings.map((s) => s.key));
  const rows = [
    ...KNOWN_BLOCKS,
    ...settings.filter((s) => !KNOWN_BLOCKS.some((b) => b.key === s.key)).map((s) => ({ key: s.key, label: s.label })),
  ];

  return (
    <Layout title="CMS" subtitle="Edit storefront content blocks — homepage copy, footer text, and similar">
      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map(({ key, label }) => (
            <div key={key} className="bg-white rounded-card border border-border shadow-card p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-ink">{label}</p>
                {!existingKeys.has(key) && <span className="text-xs text-ink-soft">Not set yet</span>}
              </div>
              <textarea
                className={`${inputClass} mb-3`}
                rows={2}
                value={values[key] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                placeholder={`Enter ${label.toLowerCase()}…`}
              />
              <Button
                variant="secondary"
                className="px-3 py-1.5 text-xs"
                disabled={savingKey === key}
                onClick={() => save(key, label)}
              >
                {savingKey === key ? "Saving…" : "Save"}
              </Button>
            </div>
          ))}

          <form onSubmit={addNew} className="bg-white rounded-card border border-dashed border-border p-5">
            <p className="text-sm font-medium text-ink mb-3 cross-mark">Add another content block</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Label">
                <input className={inputClass} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Diabetes Care banner text" />
              </Field>
              <Field label="Key (auto-generated if left blank)">
                <input className={inputClass} value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="diabetes_banner_text" />
              </Field>
            </div>
            <Field label="Value">
              <textarea
                className={`${inputClass} mb-3`}
                rows={2}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="The actual text this block should contain"
              />
            </Field>
            <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
              Add block
            </Button>
          </form>

          {error && <p className="text-red text-sm bg-red-light rounded-lg px-3 py-2">{error}</p>}
        </div>
      )}
    </Layout>
  );
}
