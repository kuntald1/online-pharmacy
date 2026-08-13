import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Camera, Loader2, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import { api } from "../api/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function ConfidenceDot({ confidence }) {
  const color = confidence === "high" ? "bg-teal" : confidence === "medium" ? "bg-amber-500" : "bg-red";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export default function StripScan() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [session, setSession] = useState(null);
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/api/stock/scan-sessions/${sessionId}`)
      .then(setSession)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  async function handleCapture(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("pillpoints_admin_token");
      const res = await fetch(`${API_BASE}/api/stock/scan-sessions/${sessionId}/scan-strip`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Couldn't read that strip — try again with better lighting");
      setSession(data.session);
      setScans((prev) => [data, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
      e.target.value = "";
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 size={24} className="animate-spin text-teal" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-6 text-center">
        <p className="text-sm text-red">{error || "Scan session not found"}</p>
      </div>
    );
  }

  const isComplete = session.status === "completed";
  const progressPct = Math.min(100, Math.round((session.scanned_qty / session.expected_qty) * 100));

  return (
    <div className="min-h-screen bg-bg">
      <header
        className="px-5 pt-5 pb-6 text-white"
        style={{ background: "linear-gradient(135deg, #1FAFE8 0%, #02A694 100%)" }}
      >
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-white/80 mb-3">
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-lg font-semibold">{session.product_name}</h1>
        <p className="text-sm text-white/80 mt-0.5">Expected batch: {session.batch_no_expected || "—"}</p>
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span>{session.scanned_qty} of {session.expected_qty} strips</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/25 overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </header>

      <main className="px-5 py-6">
        {isComplete ? (
          <div className="bg-white rounded-xl border border-border p-6 text-center">
            <CheckCircle2 size={32} className="text-teal mx-auto mb-2" />
            <p className="text-sm font-medium text-ink">All strips scanned</p>
            <p className="text-xs text-ink-soft mt-1">{session.scanned_qty} of {session.expected_qty} verified</p>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-10 cursor-pointer active:border-teal transition-colors bg-white">
            {scanning ? <Loader2 size={28} className="animate-spin text-teal" /> : <Camera size={28} className="text-ink-soft" />}
            <p className="text-sm font-medium text-ink">{scanning ? "Reading strip…" : "Tap to scan a strip"}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleCapture}
              disabled={scanning}
            />
          </label>
        )}

        {error && <p className="text-red text-sm mt-3">{error}</p>}

        {scans.length > 0 && (
          <div className="mt-6 space-y-2">
            <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">Scanned strips</p>
            {scans.map((scan) => (
              <div
                key={scan.id}
                className={`bg-white rounded-lg border p-3 flex items-center justify-between ${scan.batch_mismatch ? "border-red/40" : "border-border"}`}
              >
                <div className="flex items-center gap-2.5">
                  <ConfidenceDot confidence={scan.confidence} />
                  <div>
                    <p className="text-sm text-ink">Strip #{scan.sequence_no}</p>
                    <p className="text-xs text-ink-soft">
                      Batch: {scan.extracted_batch_no || "unreadable"} · Exp: {scan.extracted_exp_date || "—"}
                    </p>
                  </div>
                </div>
                {scan.batch_mismatch && (
                  <span className="flex items-center gap-1 text-xs text-red font-medium">
                    <AlertTriangle size={14} /> Mismatch
                  </span>
                )}
                {scan.ocr_status === "needs_retry" && (
                  <span className="text-xs text-amber-600 font-medium">Retry needed</span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
