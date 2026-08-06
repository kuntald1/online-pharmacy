import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ReturnRequestModal from "../components/ReturnRequestModal";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

const STATUS_LABELS = {
  placed: "Placed", confirmed: "Confirmed", packed: "Packed",
  shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled",
};

export default function OrderHistory() {
  const { isLoggedIn } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [returningItem, setReturningItem] = useState(null); // { id, product_name, quantity }
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    if (!isLoggedIn) return;
    api.get("/api/orders").then(setOrders).finally(() => setLoading(false));
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-16 text-center">
          <p className="text-ink-soft">Log in to see your orders.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display font-bold text-2xl text-ink">My Orders</h1>
          <Link to="/b2c/returns" className="text-sm font-medium text-[#02696B] hover:underline">
            My Returns
          </Link>
        </div>

        {confirmation && (
          <div className="mb-6 bg-teal-light border border-teal/30 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-ink">{confirmation}</p>
            <button onClick={() => setConfirmation("")} className="text-xs font-medium text-teal-dark hover:underline shrink-0">
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-ink-soft text-sm">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="text-ink-soft text-sm">
            No orders yet. <Link to="/b2c" className="text-[#02696B] hover:underline">Start shopping</Link>
          </p>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="border border-border rounded-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{order.order_no}</p>
                    <p className="text-xs text-ink-soft">{new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-teal-light text-teal-dark">
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>
                <div className="space-y-1.5 mb-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3">
                      <p className="text-sm text-ink-soft">
                        {item.product_name} × {item.quantity}
                      </p>
                      {order.status === "delivered" && (
                        <button
                          onClick={() => setReturningItem(item)}
                          className="text-xs font-medium text-[#02696B] hover:underline shrink-0"
                        >
                          Return
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm text-ink-soft">Total</span>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-ink">₹{order.total.toFixed(2)}</span>
                    <Link to={`/b2c/orders/${order.id}/invoice`} className="text-sm font-medium text-[#02696B] hover:underline">
                      Invoice
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
      {returningItem && (
        <ReturnRequestModal
          item={returningItem}
          onClose={() => setReturningItem(null)}
          onSubmitted={() => {
            setReturningItem(null);
            setConfirmation("Return request submitted — we'll review it and arrange a pickup.");
          }}
        />
      )}
    </div>
  );
}
