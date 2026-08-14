import { useEffect, useState } from "react";
import { Upload, Loader2, FileText, ChevronRight, ScanLine, Pencil, Trash2 } from "lucide-react";
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

// Mirrors the mobile app's Compare screen status styling, so an admin
// looking at the web page and an employee looking at the phone see the
// same colors for the same meaning.
function ScanStatusBadge({ status }) {
  const styles = {
    matched: { bg: "bg-green-100", text: "text-green-800", label: "Matched" },
    short: { bg: "bg-red-100", text: "text-red-800", label: "Short" },
    excess: { bg: "bg-amber-100", text: "text-amber-800", label: "Excess" },
    not_scanned: { bg: "bg-ink-soft/10", text: "text-ink-soft", label: "Not scanned" },
  };
  const style = styles[status] || styles.not_scanned;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

// Full-row edit modal — used both to correct an existing scanned row and
// to manually record a count for a line item nothing's been scanned for
// yet. Uses local state seeded from the row being edited (see
// openEditModal in the page component) rather than controlled directly
// by parent state, since it's a self-contained form.
function EditRowModal({ row, onSave, onCancel }) {
  const [productName, setProductName] = useState(row.productName);
  const [batchNo, setBatchNo] = useState(row.batchNo);
  const [expDate, setExpDate] = useState(row.expDate);
  const [qty, setQty] = useState(String(row.qty));
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!batchNo.trim()) return;
    setSaving(true);
    await onSave({ productName: productName.trim(), batchNo: batchNo.trim(), expDate: expDate.trim(), qty: Math.max(0, parseInt(qty, 10) || 0) });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-base font-semibold text-ink">Edit scanned row</h3>

        {row.isUnassigned && (
          <div>
            <label className="text-xs text-ink-soft block mb-1">Product / medicine name</label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Metronidazole 400mg"
            />
          </div>
        )}

        <div>
          <label className="text-xs text-ink-soft block mb-1">Batch no.</label>
          <input
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
            value={batchNo}
            onChange={(e) => setBatchNo(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-ink-soft block mb-1">Exp date</label>
          <input
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
            value={expDate}
            onChange={(e) => setExpDate(e.target.value)}
            placeholder="MM/YYYY"
          />
        </div>

        <div>
          <label className="text-xs text-ink-soft block mb-1">Scan qty</label>
          <input
            type="number"
            min="0"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onCancel} className="text-sm text-ink-soft px-3 py-2" disabled={saving}>
            Cancel
          </button>
          <Button onClick={handleSubmit} disabled={saving || !batchNo.trim()}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function StockVerification() {
  const [invoice, setInvoice] = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [openingInvoiceId, setOpeningInvoiceId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [editingRow, setEditingRow] = useState(null);

  // Mobile-app scanning progress for the currently open invoice — lets an
  // admin see what's been scanned on a phone without opening the mobile
  // app themselves. compareResult is the same match/short/excess/
  // not_scanned data the mobile app's Compare screen shows.
  const [scanSession, setScanSession] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [loadingScanProgress, setLoadingScanProgress] = useState(false);

  // Loads the recent-invoices list on page load (and again after returning
  // to the upload screen) — this is what lets someone open this page on a
  // different device, or after a refresh, and find an invoice that was
  // already uploaded, instead of seeing a blank upload box every time.
  useEffect(() => {
    if (invoice) return;
    setLoadingRecent(true);
    api.get("/api/stock/invoices")
      .then(setRecentInvoices)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingRecent(false));
  }, [invoice]);

  async function openInvoice(id) {
    setOpeningInvoiceId(id);
    setError("");
    try {
      const data = await api.get(`/api/stock/invoices/${id}`);
      setInvoice(data);
      loadScanProgress(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setOpeningInvoiceId(null);
    }
  }

  // Fetches whether ANY device (mobile app, any employee) has started
  // scanning against this invoice, and if so, the live Compare result —
  // this is what makes mobile-app progress visible on the web admin page.
  // A 404 here just means scanning hasn't started yet, which is a normal,
  // expected state, not an error worth surfacing.
  async function loadScanProgress(invoiceId) {
    setLoadingScanProgress(true);
    setScanSession(null);
    setCompareResult(null);
    try {
      const session = await api.get(`/api/stock/invoices/${invoiceId}/latest-session`);
      setScanSession(session);
      const compare = await api.get(`/api/stock/scan-sessions/${session.id}/compare`);
      setCompareResult(compare);
    } catch {
      // no scan session yet — leave scanSession/compareResult as null
    } finally {
      setLoadingScanProgress(false);
    }
  }

  // Silent version for the live-refresh poll below — updates state
  // without toggling the loading spinner, so the table doesn't flicker
  // every few seconds while an admin is watching it.
  async function refreshScanProgressSilently(invoiceId) {
    try {
      const session = await api.get(`/api/stock/invoices/${invoiceId}/latest-session`);
      setScanSession(session);
      const compare = await api.get(`/api/stock/scan-sessions/${session.id}/compare`);
      setCompareResult(compare);
    } catch {
      // scanning may not have started yet, or session hasn't changed — fine either way
    }
  }

  // Deletes every underlying scan that got merged into this displayed
  // row — e.g. a garbled OCR read that shouldn't count at all.
  async function handleDeleteScannedRow(batchVariants, label) {
    if (!scanSession) {
      alert("Start a scan session on mobile first — nothing to delete yet.");
      return;
    }
    if (!batchVariants || batchVariants.length === 0) {
      alert("Nothing scanned for this item yet — nothing to delete.");
      return;
    }
    if (!window.confirm(`Delete all scans for "${label}"? This can't be undone.`)) return;
    try {
      await api.delete(`/api/stock/scan-sessions/${scanSession.id}/scanned-batch`, { batch_variants: batchVariants });
      await loadScanProgress(invoice.id);
    } catch (err) {
      setError(err.message);
    }
  }

  // Opens the full-row edit modal, prefilled with whatever's already
  // known — either the existing scan data, or (if nothing's been
  // scanned yet) the invoice's own expected batch/exp as a starting
  // point for a manual entry.
  function openEditModal({ productName, batchVariants, batchNo, expDate, qty, isUnassigned }) {
    setEditingRow({
      productName: productName || "",
      batchVariants: batchVariants || [],
      batchNo: batchNo || "",
      expDate: expDate || "",
      qty: qty ?? 0,
      isUnassigned,
    });
  }

  async function handleSaveEdit(form) {
    if (!scanSession) {
      alert("Start a scan session on mobile first.");
      return;
    }
    try {
      await api.patch(`/api/stock/scan-sessions/${scanSession.id}/scanned-batch`, {
        batch_variants: editingRow.batchVariants,
        new_medicine_name: editingRow.isUnassigned ? form.productName : null,
        new_batch_no: form.batchNo,
        new_exp_date: form.expDate,
        new_qty: form.qty,
      });
      setEditingRow(null);
      await loadScanProgress(invoice.id);
    } catch (err) {
      setError(err.message);
    }
  }


  // Live-refresh — while this invoice is open, poll every 4s so an admin
  // watching the page sees mobile-app scans (from any employee) appear
  // without needing to refresh the browser themselves.
  useEffect(() => {
    if (!invoice) return;
    const interval = setInterval(() => {
      refreshScanProgressSilently(invoice.id);
    }, 4000);
    return () => clearInterval(interval);
  }, [invoice?.id]);

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

  return (
    <Layout
      title="Stock Verification"
      subtitle="Upload a wholesaler invoice — strip scanning and verification happens in the mobile app"
    >
      {!invoice && (
        <div className="space-y-6 max-w-xl">
          <div className="bg-white rounded-xl border border-border p-8">
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

          <div>
            <p className="text-xs font-medium text-ink-soft uppercase tracking-wide mb-2">Recent invoices</p>
            {loadingRecent ? (
              <div className="flex items-center gap-2 text-sm text-ink-soft py-4">
                <Loader2 size={16} className="animate-spin" /> Loading…
              </div>
            ) : recentInvoices.length === 0 ? (
              <p className="text-sm text-ink-soft py-2">No invoices uploaded yet.</p>
            ) : (
              <div className="bg-white rounded-xl border border-border divide-y divide-border">
                {recentInvoices.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => openInvoice(inv.id)}
                    disabled={openingInvoiceId === inv.id}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg transition-colors disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-ink-soft shrink-0" />
                      <div>
                        <p className="text-sm text-ink">{inv.wholesaler_name || "Unknown wholesaler"}</p>
                        <p className="text-xs text-ink-soft mt-0.5">
                          Invoice {inv.invoice_no || "—"} · {inv.line_item_count} items
                        </p>
                      </div>
                    </div>
                    {openingInvoiceId === inv.id ? (
                      <Loader2 size={16} className="animate-spin text-teal shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-ink-soft shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
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

          <div className="bg-white rounded-xl border border-border p-4 flex items-center gap-3">
            {loadingScanProgress ? (
              <>
                <Loader2 size={16} className="animate-spin text-teal" />
                <p className="text-sm text-ink-soft">Checking mobile scan progress…</p>
              </>
            ) : scanSession ? (
              <>
                <ScanLine size={16} className="text-teal shrink-0" />
                <p className="text-sm text-ink">
                  {scanSession.status === "completed" ? "Scanning completed on mobile" : "Scanning in progress on mobile"}
                  {compareResult && (
                    <span className="text-ink-soft">
                      {" · "}
                      {compareResult.rows.filter((r) => r.status === "matched").length} of {compareResult.rows.length} strip items matched
                    </span>
                  )}
                </p>
              </>
            ) : (
              <>
                <ScanLine size={16} className="text-ink-soft shrink-0" />
                <p className="text-sm text-ink-soft">No scanning started yet — an employee can begin from the mobile app</p>
              </>
            )}
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
                  <th className="px-4 py-3 font-medium">Scan Qty</th>
                  <th className="px-4 py-3 font-medium">Scan status</th>
                  <th className="px-4 py-3 font-medium">Scan attempt</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {invoice.line_items.map((item) => {
                  const compareRow = compareResult?.rows.find(
                    (r) => (r.batch_no || "").trim().toLowerCase() === (item.batch_no || "").trim().toLowerCase()
                  );
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-ink">{item.product_name}</td>
                      <td className="px-4 py-3 text-ink-soft">{item.batch_no || "—"}</td>
                      <td className="px-4 py-3 text-ink-soft">{item.exp_date || "—"}</td>
                      <td className="px-4 py-3">
                        <PackTypeBadge type={item.pack_type} />
                        <span className="text-xs text-ink-soft ml-1.5">{item.pack}</span>
                      </td>
                      <td className="px-4 py-3 text-ink">{item.qty}</td>
                      <td className="px-4 py-3 text-ink font-medium">
                        {item.pack_type !== "strip" ? "—" : compareRow ? compareRow.scanned_qty : 0}
                      </td>
                      <td className="px-4 py-3">
                        {item.pack_type !== "strip" ? (
                          <span className="text-xs text-ink-soft">No scan needed</span>
                        ) : compareRow ? (
                          <ScanStatusBadge status={compareRow.status} />
                        ) : (
                          <span className="text-xs text-ink-soft">Not scanned yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{compareRow?.attempts_taken || "—"}</td>
                      <td className="px-4 py-3 text-ink-soft">{compareRow?.scanned_by_label || "—"}</td>
                      <td className="px-4 py-3">
                        {item.pack_type === "strip" && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                openEditModal({
                                  productName: item.product_name,
                                  batchVariants: compareRow?.batch_variants || [],
                                  batchNo: compareRow ? compareRow.batch_no : item.batch_no,
                                  expDate: item.exp_date,
                                  qty: compareRow ? compareRow.scanned_qty : 0,
                                  isUnassigned: false,
                                })
                              }
                              className="text-ink-soft hover:text-teal"
                              title="Edit this row's scan data"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteScannedRow(compareRow?.batch_variants, item.product_name)}
                              className="text-ink-soft hover:text-red"
                              title="Delete this scanned batch"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Scanned batches that don't match ANY line item on this invoice —
                    e.g. a wrong strip got mixed into the box. Product/Pack are left
                    blank; the Edit button now lets an admin assign a real product
                    name and correct the batch directly, if needed. */}
                {compareResult?.unexpected_scans.map((row, idx) => (
                  <tr key={`unexpected-${idx}`} className="border-b border-border last:border-0 bg-red/5">
                    <td className="px-4 py-3 text-ink-soft italic">{row.medicine_name || "— unassigned —"}</td>
                    <td className="px-4 py-3 text-ink">{row.batch_no || "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{row.exp_date || "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">—</td>
                    <td className="px-4 py-3 text-ink-soft">—</td>
                    <td className="px-4 py-3 text-ink font-medium">{row.qty}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        Not on invoice
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{row.attempts_taken || "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{row.scanned_by_label || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            openEditModal({
                              productName: row.medicine_name,
                              batchVariants: row.batch_variants,
                              batchNo: row.batch_no,
                              expDate: row.exp_date,
                              qty: row.qty,
                              isUnassigned: true,
                            })
                          }
                          className="text-ink-soft hover:text-teal"
                          title="Edit this row"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteScannedRow(row.batch_variants, row.batch_no)}
                          className="text-ink-soft hover:text-red"
                          title="Delete this scanned batch"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p className="text-red text-sm">{error}</p>}
        </div>
      )}

      {editingRow && (
        <EditRowModal row={editingRow} onCancel={() => setEditingRow(null)} onSave={handleSaveEdit} />
      )}
    </Layout>
  );
}
