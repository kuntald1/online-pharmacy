import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Printer, ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import logo from "../assets/healthycian_logo.png";

const STATUS_LABELS = {
  placed: "Placed", confirmed: "Confirmed", packed: "Packed",
  shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled",
};

export default function Invoice() {
  const { orderId } = useParams();
  const { isLoggedIn } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) return;
    api.get(`/api/orders/${orderId}`).then(setOrder).finally(() => setLoading(false));
  }, [isLoggedIn, orderId]);

  if (!isLoggedIn) {
    return <p className="max-w-2xl mx-auto py-16 text-center text-sm text-ink-soft">Log in to see this invoice.</p>;
  }
  if (loading) {
    return <p className="max-w-2xl mx-auto py-16 text-center text-sm text-ink-soft">Loading…</p>;
  }
  if (!order) {
    return <p className="max-w-2xl mx-auto py-16 text-center text-sm text-ink-soft">Couldn't find that order.</p>;
  }

  const itemsTotal = order.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8 print:hidden">
          <Link to="/b2c/orders" className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
            <ArrowLeft size={16} />
            Back to orders
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-[#02696B] text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90"
          >
            <Printer size={16} />
            Print / Save as PDF
          </button>
        </div>

        <div className="border border-border rounded-card p-8">
          <div className="flex items-start justify-between mb-8 pb-6 border-b border-border">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="Healthycian"
                className="h-10 w-10 object-contain rounded"
              />
              <div>
                <h1 className="font-display font-bold text-xl text-ink mb-1">Healthycian</h1>
                <p className="text-xs text-ink-soft">Tax invoice</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-ink">{order.order_no}</p>
              <p className="text-xs text-ink-soft">
                {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <span className="inline-block mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-teal-light text-teal-dark">
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
          </div>

          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink-soft uppercase tracking-wider">
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 font-medium text-center">Qty</th>
                <th className="pb-2 font-medium text-right">Unit price</th>
                <th className="pb-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="py-2.5 text-ink">{item.product_name}</td>
                  <td className="py-2.5 text-center text-ink-soft">{item.quantity}</td>
                  <td className="py-2.5 text-right text-ink-soft">₹{item.unit_price.toFixed(2)}</td>
                  <td className="py-2.5 text-right text-ink font-medium">₹{(item.unit_price * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-soft">Items total</span>
                <span className="text-ink">₹{itemsTotal.toFixed(2)}</span>
              </div>
              {order.product_discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-soft">Product discount</span>
                  <span className="text-teal-dark">-₹{order.product_discount.toFixed(2)}</span>
                </div>
              )}
              {order.coupon_discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-soft">Coupon ({order.coupon_code})</span>
                  <span className="text-teal-dark">-₹{order.coupon_discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ink-soft">Delivery fee</span>
                <span className="text-ink">{order.delivery_fee === 0 ? "FREE" : `₹${order.delivery_fee.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Platform fee</span>
                <span className="text-ink">{order.platform_fee === 0 ? "FREE" : `₹${order.platform_fee.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-ink">
                <span>Total paid</span>
                <span>₹{order.total.toFixed(2)}</span>
              </div>
              <p className="text-xs text-ink-soft pt-1">
                Payment method: {order.payment_mode === "cod" ? "Cash on Delivery" : "Card / UPI / Netbanking"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
