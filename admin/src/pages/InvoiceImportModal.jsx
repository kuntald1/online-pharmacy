import { useState } from "react";
import { Plus, X } from "lucide-react";
import Modal from "../components/Modal";
import Button from "../components/Button";
import { Field, inputClass } from "../components/Field";
import { api } from "../api/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function bestMatch(item, products) {
  const skuGuess = (item.sku || "").trim().toLowerCase();
  if (skuGuess) {
    const bySku = products.find((p) => p.sku.toLowerCase() === skuGuess);
    if (bySku) return bySku.id;
  }
  const nameGuess = (item.name || "").trim().toLowerCase();
  if (nameGuess) {
    const exact = products.find((p) => p.name.trim().toLowerCase() === nameGuess);
    if (exact) return exact.id;
    const partial = products.find(
      (p) => p.name.toLowerCase().includes(nameGuess) || nameGuess.includes(p.name.toLowerCase())
    );
    if (partial) return partial.id;
  }
  return "";
}

let allocationKeySeq = 0;
function newAllocation(channel, quantity) {
  allocationKeySeq += 1;
  return { key: allocationKeySeq, channel, quantity_received: quantity };
}

export default function InvoiceImportModal({ open, onClose, products, onApplied }) {
  const [step, setStep] = useState("upload"); // upload | review
  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [meta, setMeta] = useState(null); // { supplier_name, invoice_number, invoice_date }
  const [rows, setRows] = useState([]);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const [applyError, setApplyError] = useState("");

  function reset() {
    setStep("upload");
    setFile(null);
    setExtractError("");
    setMeta(null);
    setRows([]);
    setApplyResult(null);
    setApplyError("");
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
      const token = localStorage.getItem("pillpoints_admin_token");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/api/admin/products/extract-invoice`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Extraction failed");
      if (data.error) throw new Error(data.error);

      setMeta({ supplier_name: data.supplier_name, invoice_number: data.invoice_number, invoice_date: data.invoice_date });
      setRows(
        (data.line_items || []).map((item, i) => ({
          key: i,
          extracted_name: item.name || "",
          extracted_sku: item.sku || "",
          unit_cost: item.unit_cost,
          mrp: item.mrp,
          manufacturer: item.manufacturer,
          matched_product_id: bestMatch(item, products),
          batch_number: item.batch_number || "",
          expiry_date: item.expiry_date || "",
          skip: false,
          // The full received quantity starts allocated to B2C by default —
          // split it across channels with "+ Split into another channel"
          // below, e.g. 40 received → 20 to B2C, 20 to B2B Normal.
          allocations: [newAllocation("b2c", item.quantity || 1)],
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

  function updateAllocation(rowKey, allocKey, field, value) {
    setRows((rs) =>
      rs.map((r) =>
        r.key !== rowKey
          ? r
          : { ...r, allocations: r.allocations.map((a) => (a.key === allocKey ? { ...a, [field]: value } : a)) }
      )
    );
  }

  function addAllocation(rowKey) {
    setRows((rs) =>
      rs.map((r) => (r.key === rowKey ? { ...r, allocations: [...r.allocations, newAllocation("b2c", 1)] } : r))
    );
  }

  function removeAllocation(rowKey, allocKey) {
    setRows((rs) =>
      rs.map((r) =>
        r.key !== rowKey ? r : { ...r, allocations: r.allocations.filter((a) => a.key !== allocKey) }
      )
    );
  }

  async function handleApply() {
    setApplying(true);
    setApplyError("");
    try {
      const payload = rows
        .filter((r) => !r.skip && r.matched_product_id)
        .flatMap((r) =>
          r.allocations
            .filter((a) => a.quantity_received > 0)
            .map((a) => ({
              product_id: Number(r.matched_product_id),
              channel: a.channel,
              quantity_received: Number(a.quantity_received),
              batch_number: r.batch_number || null,
              expiry_date: r.expiry_date || null,
            }))
        );
      if (payload.length === 0) {
        setApplyError("No rows are ready to apply — match at least one row to a product.");
        return;
      }
      const result = await api.post("/api/admin/products/apply-invoice", payload);
      setApplyResult(result);
      onApplied();
    } catch (err) {
      setApplyError(err.message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Restock from invoice" width="max-w-3xl">
      {step === "upload" && (
        <div>
          <p className="text-sm text-ink-soft mb-4">
            Upload a photo or PDF of a supplier invoice. Claude reads it and extracts each line item — you'll
            review and correct everything before anything is saved. Nothing updates automatically.
          </p>
          <label className="block mb-4">
            <span className="block text-xs font-medium text-ink-soft mb-1.5">Invoice file (JPG, PNG, or PDF)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files[0] || null)}
              className={inputClass}
            />
          </label>
          {extractError && <p className="text-red text-sm mb-4 bg-red-light rounded-lg px-3 py-2">{extractError}</p>}
          <Button onClick={handleExtract} disabled={!file || extracting} className="w-full">
            {extracting ? "Reading invoice…" : "Extract line items"}
          </Button>
        </div>
      )}

      {step === "review" && !applyResult && (
        <div>
          {meta && (meta.supplier_name || meta.invoice_number) && (
            <p className="text-xs text-ink-soft mb-3">
              {meta.supplier_name && <>Supplier: <span className="font-medium text-ink">{meta.supplier_name}</span> · </>}
              {meta.invoice_number && <>Invoice #{meta.invoice_number} · </>}
              {meta.invoice_date && <>{meta.invoice_date}</>}
            </p>
          )}
          <p className="text-xs text-ink-soft mb-3">
            Review each row — match it to the right product, split the received quantity across channels if it
            needs to go to more than one, fix batch/expiry, and confirm. Unmatched rows are skipped unless you
            pick a product.
          </p>

          <div className="max-h-[55vh] overflow-y-auto border border-border rounded-lg divide-y divide-border">
            {rows.map((r) => {
              const rowTotal = r.allocations.reduce((sum, a) => sum + (Number(a.quantity_received) || 0), 0);
              return (
                <div key={r.key} className={`p-3 ${r.skip ? "opacity-40" : ""}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-medium text-ink">{r.extracted_name || "(no name read)"}</p>
                      <p className="text-xs text-ink-soft">
                        {r.extracted_sku && <>SKU on invoice: {r.extracted_sku} · </>}
                        {r.unit_cost != null && <>Cost: ₹{r.unit_cost} · </>}
                        {r.mrp != null && <>MRP: ₹{r.mrp} · </>}
                        {r.manufacturer && <>{r.manufacturer}</>}
                      </p>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-ink-soft shrink-0">
                      <input type="checkbox" checked={r.skip} onChange={(e) => updateRow(r.key, "skip", e.target.checked)} />
                      Skip
                    </label>
                  </div>

                  <select
                    className={`${inputClass} mb-2`}
                    value={r.matched_product_id}
                    disabled={r.skip}
                    onChange={(e) => updateRow(r.key, "matched_product_id", e.target.value)}
                  >
                    <option value="">— Select product —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>

                  {/* One row per channel allocation — this is what lets a single
                      invoice line (e.g. 40 units) split across, say, 20 to B2C
                      stock and 20 to B2B Normal stock, each recorded separately. */}
                  <div className="space-y-2">
                    {r.allocations.map((a) => (
                      <div key={a.key} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                        <select
                          className={inputClass}
                          value={a.channel}
                          disabled={r.skip}
                          onChange={(e) => updateAllocation(r.key, a.key, "channel", e.target.value)}
                        >
                          <option value="b2c">B2C</option>
                          <option value="b2b_normal">B2B Normal</option>
                          <option value="b2b_advance">B2B Advance</option>
                          <option value="cnf">CNF</option>
                        </select>
                        <input
                          className={inputClass}
                          type="number"
                          min="1"
                          value={a.quantity_received}
                          disabled={r.skip}
                          onChange={(e) => updateAllocation(r.key, a.key, "quantity_received", e.target.value)}
                          placeholder="Qty"
                        />
                        <button
                          type="button"
                          onClick={() => removeAllocation(r.key, a.key)}
                          disabled={r.skip || r.allocations.length === 1}
                          aria-label="Remove this channel"
                          className="text-ink-soft hover:text-red disabled:opacity-30 p-1"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <button
                      type="button"
                      onClick={() => addAllocation(r.key)}
                      disabled={r.skip}
                      className="flex items-center gap-1 text-xs font-medium text-teal-dark hover:underline disabled:opacity-40"
                    >
                      <Plus size={12} /> Split into another channel
                    </button>
                    <span className="text-xs text-ink-soft">Total across channels: {rowTotal}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input
                      className={inputClass}
                      value={r.batch_number}
                      disabled={r.skip}
                      onChange={(e) => updateRow(r.key, "batch_number", e.target.value)}
                      placeholder="Batch #"
                    />
                    <input
                      className={inputClass}
                      type="date"
                      value={r.expiry_date}
                      disabled={r.skip}
                      onChange={(e) => updateRow(r.key, "expiry_date", e.target.value)}
                    />
                  </div>

                  {!r.matched_product_id && !r.skip && (
                    <p className="text-xs text-amber mt-1">No confident match found — pick the right product or check Skip.</p>
                  )}
                </div>
              );
            })}
          </div>

          {applyError && <p className="text-red text-sm mt-4 bg-red-light rounded-lg px-3 py-2">{applyError}</p>}
          <p className="text-xs text-ink-soft mt-3">
            This only updates stock quantity, batch number, and expiry date — selling price is never changed from
            invoice data. Adjust pricing separately if needed. Batch/expiry apply to the product as a whole, not
            per channel — if different channels genuinely received different batches, restock them in two
            separate passes.
          </p>
          <Button onClick={handleApply} disabled={applying} className="w-full mt-3">
            {applying ? "Updating inventory…" : "Confirm & update inventory"}
          </Button>
        </div>
      )}

      {applyResult && (
        <div>
          <p className="text-sm text-ink mb-2">
            <span className="text-teal-dark font-medium">{applyResult.updated} product(s) updated</span>
          </p>
          {applyResult.errors.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-amber mb-1">{applyResult.errors.length} warning(s):</p>
              <ul className="text-xs text-ink-soft list-disc list-inside space-y-0.5">
                {applyResult.errors.map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
            </div>
          )}
          <Button onClick={handleClose} className="w-full">
            Done
          </Button>
        </div>
      )}
    </Modal>
  );
}
