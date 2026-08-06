import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import AddressForm from "../components/AddressForm";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { api } from "../api/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function deliveryDateLabel() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
}

export default function Checkout() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { items, clearCart } = useCart();

  const [syncing, setSyncing] = useState(true);
  const [summary, setSummary] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState(null);
  const [couponMessage, setCouponMessage] = useState("");
  const [couponMessageOk, setCouponMessageOk] = useState(false);
  const [savingsOpen, setSavingsOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState("cod");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn) return;
    syncCartAndLoad();
    loadAddresses();
  }, [isLoggedIn]);

  async function syncCartAndLoad(coupon) {
    setSyncing(true);
    try {
      // push the local (pre-login) cart into the real backend cart
      for (const item of items) {
        await api.post("/api/cart/items", { product_id: item.productId, channel: item.channel, quantity: item.quantity });
      }
      const query = coupon ? `?coupon_code=${encodeURIComponent(coupon)}` : "";
      const data = await api.get(`/api/cart/summary${query}`);
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function loadAddresses() {
    const data = await api.get("/api/addresses");
    setAddresses(data);
    const def = data.find((a) => a.is_default) || data[0];
    if (def) setSelectedAddressId(def.id);
    if (data.length === 0) setShowAddressForm(true);
  }

  // Re-fetches the summary only — does NOT re-push the local cart, unlike
  // syncCartAndLoad. Using syncCartAndLoad here would re-add whatever the
  // stale local (pre-login) cart snapshot still has, undoing a removal.
  async function refreshSummary() {
    const query = couponCode ? `?coupon_code=${encodeURIComponent(couponCode)}` : "";
    const data = await api.get(`/api/cart/summary${query}`);
    setSummary(data);
  }

  async function removeCartItem(itemId) {
    setError("");
    try {
      await api.delete(`/api/cart/items/${itemId}`);
      await refreshSummary();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeQuantity(item, newQty) {
    if (newQty < 1) return removeCartItem(item.item_id);
    if (item.min_quantity && newQty < item.min_quantity) return;
    if (item.stock && newQty > item.stock) return;
    setError("");
    try {
      await api.post("/api/cart/items", { product_id: item.product_id, channel: summary.channel, quantity: newQty });
      await refreshSummary();
    } catch (err) {
      setError(err.message);
    }
  }

  async function applyCoupon(e) {
    e.preventDefault();
    setError("");
    try {
      const data = await api.get(`/api/cart/summary?coupon_code=${encodeURIComponent(couponInput.trim())}`);
      setSummary(data);
      if (data.coupon_code) {
        setCouponCode(data.coupon_code);
        setCouponMessage("Coupon applied!");
        setCouponMessageOk(true);
      } else {
        setCouponMessage(data.coupon_message || "That code isn't valid");
        setCouponMessageOk(false);
      }
    } catch (err) {
      setCouponMessage(err.message);
      setCouponMessageOk(false);
    }
  }

  async function handlePlaceOrder() {
    if (!selectedAddressId) {
      setError("Choose a delivery address first");
      return;
    }
    setError("");
    setPlacing(true);
    try {
      const order = await api.post("/api/checkout", {
        address_id: selectedAddressId,
        payment_mode: paymentMode,
        coupon_code: couponCode,
      });

      if (paymentMode === "razorpay" && order.razorpay_order_id) {
        await openRazorpay(order);
      } else {
        clearCart();
        navigate(`/b2c/orders`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPlacing(false);
    }
  }

  function openRazorpay(order) {
    return new Promise((resolve, reject) => {
      api.get("/api/settings/public").then((publicSettings) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => {
          if (!publicSettings.razorpay_key_id) {
            setError("Razorpay isn't configured on this server yet — RAZORPAY_KEY_ID is missing from the environment.");
            reject(new Error("Razorpay not configured"));
            return;
          }
          const rzp = new window.Razorpay({
            key: publicSettings.razorpay_key_id,
            amount: Math.round(summary.total_payable * 100),
            currency: "INR",
            order_id: order.razorpay_order_id,
            name: "Healthycian",
            handler: async (response) => {
              try {
                await api.post("/api/payments/verify", {
                  order_id: order.id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                });
                clearCart();
                navigate(`/b2c/orders`);
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
    });
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-16 text-center">
          <p className="text-ink-soft">Log in to continue to checkout.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-10">
        <h1 className="font-display font-bold text-2xl text-ink mb-8">Order Review</h1>

        {syncing || !summary ? (
          <p className="text-ink-soft text-sm">Loading your cart…</p>
        ) : summary.items.length === 0 ? (
          <p className="text-ink-soft text-sm">Your cart is empty.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-display font-semibold text-sm text-ink">Delivery to</h2>
                  {addresses.length > 0 && (
                    <button onClick={() => setShowAddressForm((s) => !s)} className="text-sm font-medium text-[#02696B] hover:underline">
                      {showAddressForm ? "Cancel" : "+ Add new / Edit"}
                    </button>
                  )}
                </div>

                {showAddressForm ? (
                  <AddressForm
                    onSaved={(saved) => {
                      loadAddresses();
                      setSelectedAddressId(saved.id);
                      setShowAddressForm(false);
                    }}
                    onCancel={addresses.length > 0 ? () => setShowAddressForm(false) : undefined}
                  />
                ) : (
                  <div className="space-y-2">
                    {addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`block border rounded-lg p-3 cursor-pointer transition-colors ${
                          selectedAddressId === addr.id ? "border-[#02696B] bg-[#02696B]/5" : "border-border"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="radio"
                            checked={selectedAddressId === addr.id}
                            onChange={() => setSelectedAddressId(addr.id)}
                            className="mt-1"
                          />
                          <div className="text-sm">
                            <p className="font-medium text-ink">{addr.name} · {addr.phone}</p>
                            <p className="text-ink-soft">
                              {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.state} {addr.pincode}
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium text-ink-soft mb-1">Delivery by</p>
                <p className="text-sm font-semibold text-teal-dark mb-4">{deliveryDateLabel()}</p>

                <div className="space-y-3">
                  {summary.items.map((item) => (
                    <div key={item.item_id} className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-bg overflow-hidden shrink-0">
                        {item.image_url && <img src={item.image_url} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center border border-border rounded-md">
                            <button
                              onClick={() => changeQuantity(item, item.quantity - 1)}
                              className="px-2 py-0.5 text-ink-soft hover:text-ink disabled:opacity-30"
                              disabled={item.min_quantity && item.quantity <= item.min_quantity}
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <span className="px-2 text-xs text-ink">{item.quantity}</span>
                            <button
                              onClick={() => changeQuantity(item, item.quantity + 1)}
                              className="px-2 py-0.5 text-ink-soft hover:text-ink disabled:opacity-30"
                              disabled={item.stock && item.quantity >= item.stock}
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                          <button
                            onClick={() => removeCartItem(item.item_id)}
                            className="text-xs font-medium text-red hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="text-sm text-right">
                        <span className="font-medium text-ink">₹{(item.unit_price * item.quantity).toFixed(2)}</span>
                        {item.unit_mrp && item.unit_mrp > item.unit_price && (
                          <span className="text-ink-soft line-through ml-1.5">₹{(item.unit_mrp * item.quantity).toFixed(2)}</span>
                        )}
                        <p className="text-xs text-ink-soft mt-0.5">₹{item.unit_price} × {item.quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="font-display font-semibold text-sm text-ink mb-2">Savings corner</h2>
                <form onSubmit={applyCoupon} className="border border-border rounded-lg p-3 flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Apply coupon/voucher"
                    className="flex-1 min-w-0 text-sm focus:outline-none"
                  />
                  <button type="submit" className="text-sm font-medium text-[#02696B] hover:underline shrink-0">Apply</button>
                </form>
                {couponMessage && (
                  <p className={`text-xs mt-1 font-medium ${couponMessageOk ? "text-teal-dark" : "text-red"}`}>{couponMessage}</p>
                )}
              </div>

              <div className="bg-bg rounded-card p-5">
                <h2 className="font-display font-semibold text-sm text-ink mb-4">Payment details</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-soft">MRP Total</span>
                    <span className="text-ink-soft line-through">₹{summary.mrp_total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Product Discount</span>
                    <span className="text-teal-dark">-₹{summary.product_discount.toFixed(2)}</span>
                  </div>
                  {summary.coupon_discount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-ink-soft">Coupon ({summary.coupon_code})</span>
                      <span className="text-teal-dark">-₹{summary.coupon_discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Delivery Fee</span>
                    <span>
                      {summary.delivery_fee_waived > 0 && <span className="text-ink-soft line-through mr-1.5">₹{summary.delivery_fee_waived.toFixed(2)}</span>}
                      <span className="text-teal-dark font-medium">{summary.delivery_fee === 0 ? "FREE" : `₹${summary.delivery_fee.toFixed(2)}`}</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Platform Fee</span>
                    <span>
                      {summary.platform_fee_waived > 0 && <span className="text-ink-soft line-through mr-1.5">₹{summary.platform_fee_waived.toFixed(2)}</span>}
                      <span className="text-teal-dark font-medium">{summary.platform_fee === 0 ? "FREE" : `₹${summary.platform_fee.toFixed(2)}`}</span>
                    </span>
                  </div>
                </div>
                <div className="border-t border-border mt-3 pt-3 flex justify-between font-semibold text-ink">
                  <span>Total Payable</span>
                  <span>₹{summary.total_payable.toFixed(2)}</span>
                </div>
              </div>

              {summary.total_saved > 0 && (
                <div className="bg-teal-light rounded-lg p-4">
                  <button onClick={() => setSavingsOpen((s) => !s)} className="w-full flex items-center justify-between text-teal-dark font-medium text-sm">
                    You saved a total of ₹{summary.total_saved.toFixed(2)}
                    <span>{savingsOpen ? "▲" : "▼"}</span>
                  </button>
                  {savingsOpen && (
                    <div className="mt-3 space-y-1.5 text-xs text-teal-dark">
                      <div className="flex justify-between"><span>Product Discount</span><span>₹{summary.product_discount.toFixed(2)}</span></div>
                      {summary.delivery_fee_waived > 0 && (
                        <div className="flex justify-between"><span>Delivery Fee Waiver</span><span>₹{summary.delivery_fee_waived.toFixed(2)}</span></div>
                      )}
                      {summary.platform_fee_waived > 0 && (
                        <div className="flex justify-between"><span>Platform Fee Waiver</span><span>₹{summary.platform_fee_waived.toFixed(2)}</span></div>
                      )}
                      {summary.coupon_discount > 0 && (
                        <div className="flex justify-between"><span>Coupon</span><span>₹{summary.coupon_discount.toFixed(2)}</span></div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <h2 className="font-display font-semibold text-sm text-ink mb-2">Payment method</h2>
                <div className="space-y-2">
                  <label className={`flex items-center gap-2 border rounded-lg p-3 cursor-pointer text-sm ${paymentMode === "cod" ? "border-[#02696B]" : "border-border"}`}>
                    <input type="radio" checked={paymentMode === "cod"} onChange={() => setPaymentMode("cod")} />
                    Cash on Delivery
                  </label>
                  <label className={`flex items-center gap-2 border rounded-lg p-3 cursor-pointer text-sm ${paymentMode === "razorpay" ? "border-[#02696B]" : "border-border"}`}>
                    <input type="radio" checked={paymentMode === "razorpay"} onChange={() => setPaymentMode("razorpay")} />
                    Card / UPI / Netbanking (Razorpay)
                  </label>
                </div>
              </div>

              {error && <p className="text-red text-sm">{error}</p>}

              <button
                onClick={handlePlaceOrder}
                disabled={placing || !selectedAddressId}
                className="w-full bg-teal text-white font-medium py-3 rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50"
              >
                {placing ? "Placing order…" : paymentMode === "cod" ? "Place Order" : "Make Payment"}
              </button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
