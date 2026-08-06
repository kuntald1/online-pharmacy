import { useEffect, useState } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

const REASON_LABELS = {
  topup: "Wallet top-up", return_refund: "Return refund",
  order_payment: "Paid with wallet", admin_adjustment: "Adjustment by support",
};

export default function Wallet() {
  const { isLoggedIn } = useAuth();
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupBusy, setTopupBusy] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    Promise.all([api.get("/api/wallet/balance"), api.get("/api/wallet/transactions")])
      .then(([b, t]) => {
        setBalance(b.balance);
        setTransactions(t);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (isLoggedIn) load();
    else setLoading(false);
  }, [isLoggedIn]);

  async function handleTopup(e) {
    e.preventDefault();
    setError("");
    const amount = Number(topupAmount);
    if (!amount || amount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setTopupBusy(true);
    try {
      const order = await api.post("/api/wallet/topup/create-order", { amount });
      await openRazorpay(order);
    } catch (err) {
      setError(err.message);
    } finally {
      setTopupBusy(false);
    }
  }

  function openRazorpay(order) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => {
        if (!order.key_id) {
          setError("Razorpay isn't configured on this server yet.");
          reject(new Error("Razorpay not configured"));
          return;
        }
        const rzp = new window.Razorpay({
          key: order.key_id,
          amount: Math.round(order.amount * 100),
          currency: "INR",
          order_id: order.razorpay_order_id,
          name: "Healthycian Wallet Top-up",
          handler: async (response) => {
            try {
              await api.post("/api/wallet/topup/verify", {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              setTopupAmount("");
              load();
              resolve();
            } catch (err) {
              setError(err.message);
              reject(err);
            }
          },
        });
        rzp.open();
      };
      document.body.appendChild(script);
    });
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-16 text-center">
          <p className="text-ink-soft">Log in to view your wallet.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10">
        <h1 className="font-display font-bold text-2xl text-ink mb-6">My Wallet</h1>

        {loading ? (
          <div className="h-40 rounded-card bg-bg animate-pulse" />
        ) : (
          <>
            <div className="bg-teal text-white rounded-card p-6 mb-6">
              <p className="text-sm text-white/80 mb-1">Available balance</p>
              <p className="font-display font-bold text-3xl">₹{balance?.toFixed(2)}</p>
            </div>

            <form onSubmit={handleTopup} className="flex gap-2 mb-2">
              <input
                type="number"
                min="1"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                placeholder="Amount to add"
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:border-teal focus:ring-1 focus:ring-teal outline-none"
              />
              <button
                type="submit"
                disabled={topupBusy}
                className="bg-teal text-white text-sm font-medium px-5 rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50"
              >
                {topupBusy ? "Processing…" : "Add money"}
              </button>
            </form>
            {error && <p className="text-red text-sm bg-red-light rounded-lg px-3 py-2 mb-6">{error}</p>}

            <h2 className="font-display font-semibold text-base text-ink mb-3 mt-8">Transaction history</h2>
            {transactions.length === 0 ? (
              <p className="text-sm text-ink-soft">No transactions yet.</p>
            ) : (
              <div className="divide-y divide-border border border-border rounded-card">
                {transactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm text-ink">{REASON_LABELS[t.reason] || t.reason}</p>
                      <p className="text-xs text-ink-soft">
                        {new Date(t.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {t.note ? ` · ${t.note}` : ""}
                      </p>
                    </div>
                    <span className={`text-sm font-medium ${t.type === "credit" ? "text-teal-dark" : "text-red"}`}>
                      {t.type === "credit" ? "+" : "−"}₹{t.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
