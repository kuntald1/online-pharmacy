import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const STATUS_LABELS = {
  requested: "Requested", pickup_scheduled: "Pickup scheduled", picked_up: "Picked up",
  approved: "Approved", rejected: "Rejected",
};
const STATUS_STYLES = {
  requested: "bg-bg text-ink-soft",
  pickup_scheduled: "bg-blue-light text-blue-dark",
  picked_up: "bg-blue-light text-blue-dark",
  approved: "bg-teal-light text-teal-dark",
  rejected: "bg-red-light text-red",
};

export default function MyReturns() {
  const { isLoggedIn } = useAuth();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) return;
    api.get("/api/returns").then(setReturns).finally(() => setLoading(false));
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-16 text-center">
          <p className="text-ink-soft">Log in to see your return requests.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display font-bold text-2xl text-ink">My Returns</h1>
          <Link to="/b2c/orders" className="text-sm font-medium text-[#02696B] hover:underline">
            My Orders
          </Link>
        </div>

        {loading ? (
          <p className="text-ink-soft text-sm">Loading…</p>
        ) : returns.length === 0 ? (
          <p className="text-ink-soft text-sm">No return requests yet.</p>
        ) : (
          <div className="space-y-4">
            {returns.map((r) => (
              <div key={r.id} className="border border-border rounded-card p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-medium text-ink">Return #{r.id} — Order {r.order_id}</p>
                    <p className="text-xs text-ink-soft">
                      {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · Qty {r.quantity}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLES[r.status]}`}>
                    {STATUS_LABELS[r.status] || r.status}
                  </span>
                </div>
                <p className="text-sm text-ink-soft mb-2">{r.reason}</p>
                {r.image_url && (
                  <img src={`${API_BASE}${r.image_url}`} alt="Return evidence" className="h-20 w-20 rounded-lg object-cover mb-2" />
                )}
                {r.status === "approved" && (
                  <p className="text-sm text-teal-dark font-medium">
                    Refund of ₹{r.refund_amount} {r.refund_method === "wallet" ? "credited to your wallet" : "processed to your original payment method"}
                  </p>
                )}
                {r.status === "rejected" && r.admin_note && (
                  <p className="text-sm text-red">{r.admin_note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
