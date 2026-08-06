import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useCart } from "../context/CartContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const inputClass = "w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-teal focus:ring-1 focus:ring-teal outline-none";

const CONFIDENCE_STYLE = {
  high: "bg-teal-light text-teal-dark",
  medium: "bg-amber-light text-amber",
  low: "bg-red-light text-red",
};

export default function UploadRxModal({ open, onClose, channel = "b2c" }) {
  const { addItem } = useCart();
  const [step, setStep] = useState("upload"); // upload | review | done
  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [result, setResult] = useState(null); // full RxExtractOut
  const [rows, setRows] = useState([]); // working copy, one per extracted item
  const [addedCount, setAddedCount] = useState(0);

  function reset() {
    setStep("upload");
    setFile(null);
    setExtractError("");
    setResult(null);
    setRows([]);
    setAddedCount(0);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleExtract() {
    if (!file) return;
    setExtracting(true);
    setExtractError("");
    try {
      const token = localStorage.getItem("pillpoints_token");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/api/prescriptions/extract`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Couldn't read that prescription");

      setResult(data);
      setRows(
        data.items.map((item, i) => ({
          key: i,
          raw_text: item.raw_text,
          confidence: item.confidence,
          matches: item.matches,
          selected_product_id: item.matches[0]?.id || "",
          quantity: 1,
          include: item.matches.length > 0,
        }))
      );
      setStep("review");
    } catch (err) {
      setExtractError(err.message);
    } finally {
      setExtracting(false);
    }
  }

  function updateRow(key, field, value) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function handleAddToCart() {
    let count = 0;
    rows.forEach((r) => {
      if (!r.include || !r.selected_product_id) return;
      const product = r.matches.find((m) => m.id === Number(r.selected_product_id));
      if (!product || product.price == null) return;
      addItem(
        { id: product.id, slug: product.slug, name: product.name, image_urls: product.image_url },
        { channel, price: product.price },
        channel,
        Number(r.quantity) || 1
      );
      count += 1;
    });
    setAddedCount(count);
    setStep("done");
  }

  const anyRxRequired = rows.some((r) => {
    const p = r.matches.find((m) => m.id === Number(r.selected_product_id));
    return r.include && p?.is_prescription_required;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-card shadow-card p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <button onClick={handleClose} className="absolute top-4 right-4 text-ink-soft hover:text-ink" aria-label="Close">
          ×
        </button>
        <h2 className="font-display font-bold text-xl text-ink mb-4">Upload prescription</h2>

        {step === "upload" && (
        <div>
          <p className="text-sm text-ink-soft mb-4">
            Upload a photo or PDF of your doctor's prescription. We'll read it and suggest matching products —
            you'll review everything before anything is added to your cart.
          </p>
          <label className="block mb-4">
            <span className="block text-xs font-medium text-ink-soft mb-1.5">Prescription file (JPG, PNG, or PDF)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files[0] || null)}
              className={inputClass}
            />
          </label>
          {extractError && <p className="text-red text-sm mb-4 bg-red-light rounded-lg px-3 py-2">{extractError}</p>}
          <button
            onClick={handleExtract}
            disabled={!file || extracting}
            className="w-full bg-teal text-white text-sm font-medium py-2.5 rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50"
          >
            {extracting ? "Reading your prescription…" : "Read prescription"}
          </button>
        </div>
      )}

      {step === "review" && (
        <div>
          <div className="flex items-start gap-2 bg-amber-light rounded-lg px-3 py-2.5 mb-4">
            <AlertTriangle size={16} className="text-amber shrink-0 mt-0.5" />
            <p className="text-xs text-ink">{result.warning}</p>
          </div>

          {(result.doctor_name || result.patient_name) && (
            <p className="text-xs text-ink-soft mb-3">
              {result.patient_name && <>Patient: <span className="font-medium text-ink">{result.patient_name}</span> · </>}
              {result.doctor_name && <>Dr. {result.doctor_name}</>}
              {result.prescription_date && <> · {result.prescription_date}</>}
            </p>
          )}

          {rows.length === 0 ? (
            <p className="text-sm text-ink-soft">Nothing legible was found on this prescription — try a clearer photo, or add items to your cart manually.</p>
          ) : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {rows.map((r) => (
                <div key={r.key} className={`border border-border rounded-lg p-3 ${!r.include ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm text-ink">{r.raw_text}</p>
                      <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-1 ${CONFIDENCE_STYLE[r.confidence] || CONFIDENCE_STYLE.low}`}>
                        {r.confidence} confidence
                      </span>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-ink-soft shrink-0">
                      <input type="checkbox" checked={r.include} onChange={(e) => updateRow(r.key, "include", e.target.checked)} />
                      Add
                    </label>
                  </div>

                  {r.matches.length === 0 ? (
                    <p className="text-xs text-ink-soft">
                      No matching product found in our catalog —{" "}
                      <Link to={`/${channel}`} onClick={handleClose} className="text-[#02696B] hover:underline">search manually</Link>.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        className={`${inputClass} col-span-2`}
                        value={r.selected_product_id}
                        disabled={!r.include}
                        onChange={(e) => updateRow(r.key, "selected_product_id", e.target.value)}
                      >
                        {r.matches.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.price != null ? `— ₹${m.price}` : ""}{m.is_prescription_required ? " (Rx)" : ""}
                          </option>
                        ))}
                      </select>
                      <input
                        className={inputClass}
                        type="number"
                        min="1"
                        value={r.quantity}
                        disabled={!r.include}
                        onChange={(e) => updateRow(r.key, "quantity", e.target.value)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {anyRxRequired && (
            <p className="text-xs text-ink-soft mt-3">
              One or more items need a valid prescription — your uploaded prescription is saved and our pharmacist
              will verify it before your order ships.
            </p>
          )}

          <button
            onClick={handleAddToCart}
            disabled={!rows.some((r) => r.include && r.selected_product_id)}
            className="w-full bg-teal text-white text-sm font-medium py-2.5 rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50 mt-4"
          >
            Add selected items to cart
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-4">
          <p className="text-sm text-ink mb-4">
            {addedCount > 0
              ? `${addedCount} item${addedCount !== 1 ? "s" : ""} added to your cart.`
              : "Nothing was added — no items were selected."}
          </p>
          <div className="flex flex-col gap-2">
            <Link to={`/${channel}/checkout`} onClick={handleClose} className="w-full bg-teal text-white text-sm font-medium py-2.5 rounded-lg hover:bg-teal-dark transition-colors">
              Go to checkout
            </Link>
            <button onClick={handleClose} className="text-sm text-ink-soft hover:text-ink">
              Continue shopping
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
