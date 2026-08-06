import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import Button from "../components/Button";
import SingleImageUploader from "../components/SingleImageUploader";
import { Field, inputClass } from "../components/Field";
import { api } from "../api/client";

function BrandingCard() {
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    api
      .get("/api/admin/settings?category=cms")
      .then((data) => {
        const row = data.find((s) => s.key === "site_logo_url");
        setLogoUrl(row?.value || "");
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await api.put("/api/admin/settings/site_logo_url", {
        value: logoUrl,
        category: "cms",
        label: "Site logo",
      });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="bg-white rounded-card border border-border shadow-card p-5">
      <h3 className="font-display font-semibold text-sm mb-1 cross-mark">Site logo</h3>
      <p className="text-xs text-ink-soft mb-4">
        Replaces the default Healthycian mark on the storefront and admin sidebar. Clear it to go back to the default.
      </p>
      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <>
          <SingleImageUploader value={logoUrl} onChange={setLogoUrl} label="site logo" />
          {error && <p className="text-red text-sm my-3 bg-red-light rounded-lg px-3 py-2">{error}</p>}
          {saved && <p className="text-teal-dark text-sm my-3">Saved.</p>}
          <Button type="submit" disabled={saving} className="mt-4">
            {saving ? "Saving…" : "Save logo"}
          </Button>
        </>
      )}
    </form>
  );
}

const STORE_FIELDS = [
  { key: "support_email", label: "Support email" },
  { key: "support_phone", label: "Support phone" },
  { key: "business_name", label: "Registered business name" },
  { key: "low_stock_threshold", label: "Low stock alert threshold (units)" },
];

function StoreSettingsCard() {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    api
      .get("/api/admin/settings?category=store")
      .then((data) => setValues(Object.fromEntries(data.map((s) => [s.key, s.value]))))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function saveAll(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await Promise.all(
        STORE_FIELDS.map(({ key, label }) =>
          api.put(`/api/admin/settings/${key}`, { value: values[key] || "", category: "store", label })
        )
      );
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saveAll} className="bg-white rounded-card border border-border shadow-card p-5">
      <h3 className="font-display font-semibold text-sm mb-4 cross-mark">Store settings</h3>
      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <>
          {STORE_FIELDS.map(({ key, label }) => (
            <Field key={key} label={label}>
              <input
                className={inputClass}
                value={values[key] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              />
            </Field>
          ))}
          {error && <p className="text-red text-sm mb-3 bg-red-light rounded-lg px-3 py-2">{error}</p>}
          {saved && <p className="text-teal-dark text-sm mb-3">Saved.</p>}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </>
      )}
    </form>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.post("/api/admin/change-password", { current_password: current, new_password: next });
      setCurrent("");
      setNext("");
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-card border border-border shadow-card p-5">
      <h3 className="font-display font-semibold text-sm mb-4 cross-mark">Change password</h3>
      <Field label="Current password">
        <input type="password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </Field>
      <Field label="New password">
        <input type="password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} minLength={6} required />
      </Field>
      {error && <p className="text-red text-sm mb-3 bg-red-light rounded-lg px-3 py-2">{error}</p>}
      {saved && <p className="text-teal-dark text-sm mb-3">Password updated.</p>}
      <Button type="submit" disabled={saving}>
        {saving ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}

export default function Settings() {
  return (
    <Layout title="Settings" subtitle="Store details and your account">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <BrandingCard />
        <StoreSettingsCard />
        <ChangePasswordCard />
      </div>
    </Layout>
  );
}
