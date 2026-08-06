import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Truck, ArrowLeft } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ChannelHome from "../components/ChannelHome";
import TrustBadges from "../components/TrustBadges";
import { useAuth } from "../context/AuthContext";
import { useChannel } from "../context/ChannelContext";
import { api } from "../api/client";

const inputClass =
  "w-full rounded-lg border border-border px-3 py-2.5 text-sm text-ink focus:border-teal focus:ring-1 focus:ring-teal outline-none transition-colors";

const emptyApplication = {
  name: "",
  contact_no: "",
  business_type: "",
  location: "",
  message: "",
  gst_no: "",
  driving_licence_no: "",
  trade_licence_no: "",
};

function LoginPane({ onBack, onLoggedIn }) {
  const { login } = useAuth();
  const [step, setStep] = useState("phone"); // phone | otp
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  async function sendOtp(e) {
    e?.preventDefault();
    setError("");
    if (phone.trim().length < 8) {
      setError("Enter a valid phone number");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/cnf/send-otp", { phone: phone.trim() });
      setStep("otp");
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setError("");
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/api/cnf/verify-otp", { phone: phone.trim(), code: code.trim() });
      login(res);
      onLoggedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-5">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="font-display font-bold text-xl text-ink mb-1">CNF / Distributor login</h1>
      <p className="text-sm text-ink-soft mb-6">
        {step === "phone"
          ? "Sign in with the phone number from your approved request — we'll text you a one-time code."
          : `Code sent to ${phone}`}
      </p>

      {step === "phone" ? (
        <form onSubmit={sendOtp} className="space-y-3">
          <input required autoFocus value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className={inputClass} />
          {error && <p className="text-red text-sm bg-red-light rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-[#FF9800] text-white text-sm font-medium py-2.5 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50">
            {loading ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="space-y-3">
          <input
            required
            autoFocus
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className={`${inputClass} tracking-widest text-center`}
          />
          {error && <p className="text-red text-sm bg-red-light rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-[#FF9800] text-white text-sm font-medium py-2.5 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50">
            {loading ? "Verifying…" : "Verify & sign in"}
          </button>
          <button
            type="button"
            onClick={sendOtp}
            disabled={cooldown > 0}
            className="w-full text-sm text-ink-soft hover:text-ink disabled:opacity-50"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </form>
      )}
    </div>
  );
}

function ApplyPane({ onBack, onSubmitted }) {
  const [form, setForm] = useState(emptyApplication);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const lead = await api.post("/api/cnf", { ...form, driving_licence_no: form.driving_licence_no || null });
      onSubmitted(lead);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-5">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="font-display font-bold text-2xl text-ink mb-2">Become a CNF / Distributor</h1>
      <p className="text-sm text-ink-soft mb-8">
        Tell us a bit about your business. Once approved, we'll send login details to this phone number.
      </p>
      <form onSubmit={submit}>
        <label className="block mb-4">
          <span className="block text-xs font-medium text-ink-soft mb-1.5">Name</span>
          <input className={inputClass} value={form.name} onChange={(e) => update("name", e.target.value)} required />
        </label>
        <label className="block mb-4">
          <span className="block text-xs font-medium text-ink-soft mb-1.5">Contact number</span>
          <input className={inputClass} value={form.contact_no} onChange={(e) => update("contact_no", e.target.value)} required />
        </label>
        <label className="block mb-4">
          <span className="block text-xs font-medium text-ink-soft mb-1.5">Business type</span>
          <input className={inputClass} value={form.business_type} onChange={(e) => update("business_type", e.target.value)} placeholder="e.g. Pharmacy, Distributor" />
        </label>
        <label className="block mb-4">
          <span className="block text-xs font-medium text-ink-soft mb-1.5">Location</span>
          <input className={inputClass} value={form.location} onChange={(e) => update("location", e.target.value)} />
        </label>
        <label className="block mb-4">
          <span className="block text-xs font-medium text-ink-soft mb-1.5">GST No</span>
          <input className={inputClass} value={form.gst_no} onChange={(e) => update("gst_no", e.target.value)} required />
        </label>
        <label className="block mb-4">
          <span className="block text-xs font-medium text-ink-soft mb-1.5">Trade Licence</span>
          <input className={inputClass} value={form.trade_licence_no} onChange={(e) => update("trade_licence_no", e.target.value)} required />
        </label>
        <label className="block mb-4">
          <span className="block text-xs font-medium text-ink-soft mb-1.5">Driving Licence (optional)</span>
          <input className={inputClass} value={form.driving_licence_no} onChange={(e) => update("driving_licence_no", e.target.value)} />
        </label>
        <label className="block mb-6">
          <span className="block text-xs font-medium text-ink-soft mb-1.5">Message (optional)</span>
          <textarea className={inputClass} rows={3} value={form.message} onChange={(e) => update("message", e.target.value)} />
        </label>
        {error && <p className="text-red text-sm mb-4 bg-red-light rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={loading} className="w-full bg-[#FF9800] text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50">
          {loading ? "Submitting…" : "Submit request"}
        </button>
      </form>
    </div>
  );
}

function StatusPane({ onBack }) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function check(e) {
    e.preventDefault();
    setError("");
    setStatus(null);
    setLoading(true);
    try {
      const res = await api.get(`/api/cnf/status/${encodeURIComponent(phone.trim())}`);
      setStatus(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-5">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="font-display font-bold text-xl text-ink mb-1">Check request status</h1>
      <p className="text-sm text-ink-soft mb-6">Enter the phone number you applied with.</p>
      <form onSubmit={check} className="space-y-3">
        <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className={inputClass} />
        <button type="submit" disabled={loading} className="w-full bg-[#FF9800] text-white text-sm font-medium py-2.5 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50">
          {loading ? "Checking…" : "Check status"}
        </button>
      </form>
      {error && <p className="text-red text-sm bg-red-light rounded-lg px-3 py-2 mt-3">{error}</p>}
      {status && (
        <div className="mt-4 border border-border rounded-lg p-4">
          <p className="text-sm text-ink">
            <span className="font-medium">{status.name}</span> — request{" "}
            <span
              className={
                status.status === "approved" ? "text-teal-dark font-medium" : status.status === "rejected" ? "text-red font-medium" : "text-amber font-medium"
              }
            >
              {status.status}
            </span>
          </p>
          {status.status === "approved" && (
            <p className="text-xs text-ink-soft mt-1">Your login credentials were sent to your phone number. Use the "CNF login" option to sign in.</p>
          )}
          {(status.status === "new" || status.status === "contacted") && (
            <p className="text-xs text-ink-soft mt-1">Still under review — we'll issue a login once approved.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  return (
    <div>
      {/* CNF has its own pricing tier ("cnf"). */}
      <ChannelHome channel="cnf" productTitle="Available for Distributors" />
    </div>
  );
}

export default function CNF() {
  const { user, isLoggedIn } = useAuth();
  const { setChannel } = useChannel();
  const [pane, setPane] = useState("choose"); // choose | login | apply | applied | status
  const [applied, setApplied] = useState(null);

  useEffect(() => setChannel("cnf"), []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className={`flex-1 max-w-7xl mx-auto w-full px-4 ${isLoggedIn && user?.role === "cnf" ? "pt-6" : "py-16"}`}>
        {isLoggedIn && user?.role === "cnf" ? (
          <Dashboard />
        ) : pane === "login" ? (
          <LoginPane onBack={() => setPane("choose")} onLoggedIn={() => setPane("choose")} />
        ) : pane === "apply" ? (
          <ApplyPane onBack={() => setPane("choose")} onSubmitted={(lead) => { setApplied(lead); setPane("applied"); }} />
        ) : pane === "status" ? (
          <StatusPane onBack={() => setPane("choose")} />
        ) : pane === "applied" ? (
          <div className="max-w-sm mx-auto text-center">
            <div className="h-14 w-14 rounded-full bg-teal-light text-teal-dark flex items-center justify-center mx-auto mb-5">
              <Truck size={26} />
            </div>
            <h1 className="font-display font-bold text-xl text-ink mb-2">Request received</h1>
            <p className="text-sm text-ink-soft mb-6">
              Thanks, {applied?.name} — the Healthycian team has been notified and will review your request. We'll
              send your login details to {applied?.contact_no} once it's approved.
            </p>
            <button onClick={() => setPane("choose")} className="text-sm font-medium text-teal-dark hover:underline">
              Back to CNF / Distributor
            </button>
          </div>
        ) : (
          <div className="max-w-md mx-auto text-center">
            <div className="h-14 w-14 rounded-2xl bg-[#FFF3E0] text-[#FF9800] flex items-center justify-center mx-auto mb-5">
              <Truck size={26} />
            </div>
            <h1 className="font-display font-bold text-xl text-ink mb-2">CNF / Distributor</h1>
            <p className="text-sm text-ink-soft mb-8">Sign in if you already have credentials, or apply for a new account.</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => setPane("login")} className="w-full bg-[#FF9800] text-white text-sm font-medium py-3 rounded-lg hover:opacity-90 transition-colors">
                I have a CNF login
              </button>
              <button onClick={() => setPane("apply")} className="w-full border border-border text-ink text-sm font-medium py-3 rounded-lg hover:border-[#FF9800] transition-colors">
                Apply as a CNF / Distributor
              </button>
              <button onClick={() => setPane("status")} className="text-sm text-ink-soft hover:text-ink mt-1">
                Already applied? Check your status
              </button>
            </div>
          </div>
        )}
      </main>
      <TrustBadges />
      <Footer channel="b2c" />
    </div>
  );
}
