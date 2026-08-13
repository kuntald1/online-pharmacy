import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Loader2, ScanLine, CheckCircle2 } from "lucide-react";
import Layout from "../components/Layout";
import Button from "../components/Button";
import { api } from "../api/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function PackTypeBadge({ type }) {
  const styles = {
    strip: "bg-teal/10 text-teal-dark",
    bottle: "bg-blue-500/10 text-blue-700",
    unit: "bg-ink-soft/10 text-ink-soft",
    other: "bg-amber-500/10 text-amber-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${styles[type] || styles.other}`}>
      {type}
    </span>
  );
}

export default function StockVerification() {
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [startingSessionFor, setStartingSessionFor] = useState(null);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setUploading(true);
    setInvoice(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("pillpoints_admin_token");
      const res = await fetch(`${API_BASE}/api/stock/invoices/extract`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Couldn't read that invoice");
      setInvoice(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function startScanSession(item) {
    setStartingSessionFor(item.id);
    try {
      const session = await api.post("/api/stock/scan-sessions", {
        invoice_line_item_id: item.id,
        product_name: item.product_name,
        batch_no_expected: item.batch_no,
        expected_qty: item.qty,
      });
      navigate(`/stock-verification/scan/${session.id}`);
    } catch (err) {
      setError(err.message);
      setStartingSessionFor(null);
    }
  }

  return (
    <Layout
      title="Stock Verification"
      subtitle="Upload a wholesaler invoice, then verify received strips against it"
    >
      {!invoice && (
        <div className="bg-white rounded-xl border border-border p-8 max-w-xl">
          <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-lg py-12 cursor-pointer hover:border-teal transition-colors">
            {uploading ? <Loader2 size={28} className="animate-spin text-teal" /> : <Upload size={28} className="text-ink-soft" />}
            <div className="text-center">
              <p className="text-sm font-medium text-ink">{uploading ? "Reading invoice…" : "Upload wholesaler invoice"}</p>
              <p className="text-xs text-ink-soft mt-1">JPG, PNG, or PDF</p>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
          {error && <p className="text-red text-sm mt-3">{error}</p>}
        </div>
      )}

      {invoice && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">{invoice.wholesaler_name || "Unknown wholesaler"}</p>
              <p className="text-xs text-ink-soft mt-0.5">
                Invoice {invoice.invoice_no || "—"} · {invoice.invoice_date || "—"}
              </p>
            </div>
            <Button variant="secondary" onClick={() => setInvoice(null)}>Upload another</Button>
          </div>

          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-soft">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Batch</th>
                  <th className="px-4 py-3 font-medium">Exp</th>
                  <th className="px-4 py-3 font-medium">Pack</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {invoice.line_items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-ink">{item.product_name}</td>
                    <td className="px-4 py-3 text-ink-soft">{item.batch_no || "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{item.exp_date || "—"}</td>
                    <td className="px-4 py-3">
                      <PackTypeBadge type={item.pack_type} />
                      <span className="text-xs text-ink-soft ml-1.5">{item.pack}</span>
                    </td>
                    <td className="px-4 py-3 text-ink">{item.qty}</td>
                    <td className="px-4 py-3 text-right">
                      {item.pack_type !== "strip" ? (
                        <span className="text-xs text-ink-soft">No scan needed</span>
                      ) : item.is_verified ? (
                        <span className="inline-flex items-center gap-1 text-xs text-teal-dark">
                          <CheckCircle2 size={14} /> Verified
                        </span>
                      ) : (
                        <Button
                          variant="secondary"
                          className="!px-3 !py-1.5 text-xs"
                          onClick={() => startScanSession(item)}
                          disabled={startingSessionFor === item.id}
                        >
                          <ScanLine size={14} />
                          {startingSessionFor === item.id ? "Starting…" : "Scan strips"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p className="text-red text-sm">{error}</p>}
        </div>
      )}
    </Layout>
  );
}
