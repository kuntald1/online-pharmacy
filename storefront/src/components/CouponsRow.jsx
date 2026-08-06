import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { api } from "../api/client";

function describeCoupon(c) {
  const off = c.discount_type === "percentage" ? `${c.discount_value}%` : `₹${c.discount_value}`;
  return `Get extra ${off} off${c.description ? ` — ${c.description}` : ""}`;
}

export default function CouponsRow({ channel }) {
  const [coupons, setCoupons] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    api.get(`/api/coupons/active?channel=${channel}`).then(setCoupons).catch(() => setCoupons([]));
  }, [channel]);

  function copy(code) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1500);
    });
  }

  if (!coupons || coupons.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="text-xs font-medium text-ink-soft mb-2 uppercase tracking-wider">Coupons</p>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {coupons.map((c) => (
          <div
            key={c.id}
            className="shrink-0 w-64 border border-dashed border-teal/50 bg-teal-light/40 rounded-lg px-3 py-2.5"
          >
            <p className="text-xs text-ink leading-snug mb-1">{describeCoupon(c)}</p>
            {c.min_order_amount > 0 && (
              <p className="text-[11px] text-ink-soft mb-2">Min cart value: ₹{c.min_order_amount}</p>
            )}
            <button
              onClick={() => copy(c.code)}
              className="flex items-center gap-1.5 text-xs font-semibold text-teal-dark bg-white border border-teal/40 rounded-md px-2 py-1 hover:bg-teal-light transition-colors"
            >
              {copiedCode === c.code ? <Check size={12} /> : <Copy size={12} />}
              {copiedCode === c.code ? "Copied" : c.code}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
