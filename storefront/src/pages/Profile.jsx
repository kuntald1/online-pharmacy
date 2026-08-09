import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Camera } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { resolveImageUrl } from "../utils/media";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Profile() {
  const { channelParam } = useParams();
  const channel = channelParam || "b2c";
  const { updateUser, isLoggedIn } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function load() {
    setLoading(true);
    api
      .get("/api/profile")
      .then((p) => {
        setProfile(p);
        setForm({ name: p.name || "", email: p.email || "" });
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (isLoggedIn) load();
    else setLoading(false);
  }, [isLoggedIn]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const updated = await api.patch("/api/profile", { name: form.name, email: form.email || null });
      setProfile(updated);
      updateUser({ name: updated.name });
      setSuccess("Profile updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    setError("");
    try {
      const token = localStorage.getItem("pillpoints_token");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/api/profile/image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setProfile(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 max-w-xl mx-auto w-full px-4 sm:px-6 py-10">
        <h1 className="font-display font-bold text-2xl text-ink mb-6">My Profile</h1>

        {!isLoggedIn ? (
          <p className="text-sm text-ink-soft">Log in to view and edit your profile.</p>
        ) : loading ? (
          <div className="h-64 rounded-card bg-bg animate-pulse" />
        ) : (
          <>
            <div className="flex items-center gap-4 mb-8">
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-bg border border-border overflow-hidden flex items-center justify-center">
                  {profile.profile_image_url ? (
                    <img
                      src={resolveImageUrl(profile.profile_image_url)}
                      alt={profile.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-display font-semibold text-ink-soft">
                      {profile.name?.[0]?.toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-teal text-white flex items-center justify-center cursor-pointer hover:bg-teal-dark transition-colors">
                  <Camera size={14} />
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="hidden" disabled={uploadingImage} />
                </label>
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{profile.name}</p>
                <p className="text-xs text-ink-soft">{profile.phone}</p>
                {uploadingImage && <p className="text-xs text-ink-soft mt-1">Uploading…</p>}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-teal focus:ring-1 focus:ring-teal outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">Email (optional)</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-teal focus:ring-1 focus:ring-teal outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">Phone</label>
                <input
                  disabled
                  value={profile.phone}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-bg text-ink-soft"
                />
                <p className="text-xs text-ink-soft mt-1">Phone number can't be changed here — contact support if it needs updating.</p>
              </div>

              {error && <p className="text-red text-sm bg-red-light rounded-lg px-3 py-2">{error}</p>}
              {success && <p className="text-teal-dark text-sm bg-teal-light rounded-lg px-3 py-2">{success}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-teal text-white text-sm font-medium py-2.5 rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </form>
          </>
        )}
      </main>
      <Footer channel={channel} />
    </div>
  );
}
