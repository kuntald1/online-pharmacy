import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import { api } from "../api/client";

export default function Marketing() {
  const [banners, setBanners] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/banners?channel=b2c"),
      api.get("/api/admin/coupons"),
    ])
      .then(([b, c]) => {
        setBanners(b);
        setCoupons(c);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeCoupons = coupons.filter((c) => c.is_active);

  return (
    <Layout title="Marketing" subtitle="Promotional tools currently live on the storefront">
      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <StatCard label="Active banners" value={banners.length} accent="teal" />
            <StatCard label="Active coupons" value={activeCoupons.length} hint={`${coupons.length} total`} accent="blue" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-card border border-border shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-sm cross-mark">Banners</h3>
                <Link to="/banners" className="text-xs text-teal-dark font-medium hover:underline">Manage →</Link>
              </div>
              {banners.length === 0 ? (
                <p className="text-sm text-ink-soft">No banners live right now.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {banners.slice(0, 5).map((b) => (
                    <li key={b.id} className="flex items-center gap-3 text-sm">
                      <img src={b.image_url} alt="" className="h-9 w-16 rounded-lg object-cover bg-bg shrink-0" />
                      <span className="text-ink truncate">{b.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-card border border-border shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-sm cross-mark">Coupons</h3>
                <Link to="/coupons" className="text-xs text-teal-dark font-medium hover:underline">Manage →</Link>
              </div>
              {coupons.length === 0 ? (
                <p className="text-sm text-ink-soft">No coupons yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {coupons.slice(0, 5).map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs">{c.code}</span>
                      <span className="text-ink-soft text-xs">
                        {c.discount_type === "percentage" ? `${c.discount_value}%` : `₹${c.discount_value}`} off
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <p className="text-xs text-ink-soft mt-6">
            This page surfaces what's already live via Banners and Coupons. A dedicated campaigns/email
            module (scheduled promotions, audience segments, etc.) isn't built — tell me if that's what
            you actually need here and I'll scope it properly rather than guessing.
          </p>
        </>
      )}
    </Layout>
  );
}
