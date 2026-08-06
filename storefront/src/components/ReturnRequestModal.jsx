import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function ReturnRequestModal({ item, onClose, onSubmitted }) {
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!reason.trim()) {
      setError("Please describe the issue");
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("pillpoints_token");
      const formData = new FormData();
      formData.append("order_item_id", item.id);
      formData.append("quantity", quantity);
      formData.append("reason", reason.trim());
      if (image) formData.append("image", image);

      const res = await fetch(`${API_BASE}/api/returns`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Couldn't submit the return request");
      onSubmitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-card shadow-card p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-ink-soft hover:text-ink" aria-label="Close">
          ×
        </button>
        <h2 className="font-display font-bold text-lg text-ink mb-1">Request a return</h2>
        <p className="text-sm text-ink-soft mb-4">{item.product_name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1.5">Quantity to return</label>
            <input
              type="number"
              min="1"
              max={item.quantity}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(item.quantity, Number(e.target.value) || 1)))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
            <p className="text-xs text-ink-soft mt-1">Ordered: {item.quantity}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1.5">What's wrong with it?</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Received a damaged pack, wrong item, expired product…"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1.5">Photo (optional, but helps us process it faster)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setImage(e.target.files[0] || null)}
              className="w-full text-sm"
            />
          </div>

          {error && <p className="text-red text-sm bg-red-light rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-teal text-white text-sm font-medium py-2.5 rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit return request"}
          </button>
          <p className="text-xs text-ink-soft text-center">
            We'll arrange a pickup and review it — refund goes to your wallet (Cash on Delivery orders) or back to
            your original payment method, depending on how you paid.
          </p>
        </form>
      </div>
    </div>
  );
}
