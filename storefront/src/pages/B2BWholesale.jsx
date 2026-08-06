import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, ArrowLeft } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ChannelHome from "../components/ChannelHome";
import TrustBadges from "../components/TrustBadges";
import { useAuth } from "../context/AuthContext";
import { useChannel } from "../context/ChannelContext";
import { api } from "../api/client";

const emptyApplication = {
  business_name: "",
  contact_name: "",
  phone: "",
  aadhar_no: "",
  pan_no: "",
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
      await api.post("/api/b2b/send-otp", { phone: phone.trim() });
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
      const res = await api.post("/api/b2b/verify-otp", { phone: phone.trim(), code: code.trim() });
      login(res);
      onLoggedIn();
    } catch (err) {
      // The backend already returns distinct, user-facing messages for
      // "no B2B account" vs "still pending review" — pass them through as-is.
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
      <h1 className="font-display font-bold text-xl text-ink mb-1">B2B login</h1>
      <p className="text-sm text-ink-soft mb-6">
        {step === "phone"
          ? "Sign in with the phone number from your approved application — we'll text you a one-time code."
          : `Code sent to ${phone}`}
      </p>

      {step === "phone" ? (
        <form onSubmit={sendOtp} className="space-y-3">
          <input
            required
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
          />
          {error && <p className="text-red text-sm bg-red-light rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-blue text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-dark transition-colors disabled:opacity-50">
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
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm tracking-widest text-center"
          />
          {error && <p className="text-red text-sm bg-red-light rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-blue text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-dark transition-colors disabled:opacity-50">
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
      const application = await api.post("/api/b2b/apply", {
        ...form,
        driving_licence_no: form.driving_licence_no || null,
      });
      onSubmitted(application);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-5">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="font-display font-bold text-xl text-ink mb-1">Apply for a B2B account</h1>
      <p className="text-sm text-ink-soft mb-6">
        Tell us about your business. Our team verifies your documents and issues a login within 1–2 business days.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <input required value={form.business_name} onChange={(e) => update("business_name", e.target.value)} placeholder="Business name" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <input required value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} placeholder="Contact person's name" className="rounded-lg border border-border px-3 py-2.5 text-sm" />
          <input required value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="Phone number" className="rounded-lg border border-border px-3 py-2.5 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input required value={form.aadhar_no} onChange={(e) => update("aadhar_no", e.target.value)} placeholder="Aadhaar number" className="rounded-lg border border-border px-3 py-2.5 text-sm" />
          <input required value={form.pan_no} onChange={(e) => update("pan_no", e.target.value)} placeholder="PAN number" className="rounded-lg border border-border px-3 py-2.5 text-sm" />
        </div>
        <input required value={form.gst_no} onChange={(e) => update("gst_no", e.target.value)} placeholder="GST number" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" />
        <input required value={form.trade_licence_no} onChange={(e) => update("trade_licence_no", e.target.value)} placeholder="Trade licence number" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" />
        <input value={form.driving_licence_no} onChange={(e) => update("driving_licence_no", e.target.value)} placeholder="Driving licence number (optional)" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" />

        {error && <p className="text-red text-sm bg-red-light rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={loading} className="w-full bg-blue text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-dark transition-colors disabled:opacity-50">
          {loading ? "Submitting…" : "Submit application"}
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
      const res = await api.get(`/api/b2b/status/${encodeURIComponent(phone.trim())}`);
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
      <h1 className="font-display font-bold text-xl text-ink mb-1">Check application status</h1>
      <p className="text-sm text-ink-soft mb-6">Enter the phone number you applied with.</p>
      <form onSubmit={check} className="space-y-3">
        <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" />
        <button type="submit" disabled={loading} className="w-full bg-blue text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-dark transition-colors disabled:opacity-50">
          {loading ? "Checking…" : "Check status"}
        </button>
      </form>
      {error && <p className="text-red text-sm bg-red-light rounded-lg px-3 py-2 mt-3">{error}</p>}
      {status && (
        <div className="mt-4 border border-border rounded-lg p-4">
          <p className="text-sm text-ink">
            <span className="font-medium">{status.business_name}</span> — application{" "}
            <span
              className={
                status.status === "approved" ? "text-teal-dark font-medium" : status.status === "rejected" ? "text-red font-medium" : "text-amber font-medium"
              }
            >
              {status.status}
            </span>
          </p>
          {status.status === "approved" && (
            <p className="text-xs text-ink-soft mt-1">Your login credentials were sent to your phone number. Use the "B2B login" option to sign in.</p>
          )}
          {status.status === "rejected" && status.admin_note && (
            <p className="text-xs text-ink-soft mt-1">Note from our team: {status.admin_note}</p>
          )}
          {status.status === "pending" && (
            <p className="text-xs text-ink-soft mt-1">Still under review — we'll issue a login once verified.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  return (
    <div>
      {/* Category/Brand/Banner/Product sections all filter to whatever's
          marked visible to "B2B" (or "B2C + B2B") in the admin panel.
          Products show both B2B pricing tiers on their detail page. */}
      <ChannelHome channel="b2b" productTitle="Available for Wholesale" />
    </div>
  );
}

export default function B2BWholesale() {
  const { user, isLoggedIn } = useAuth();
  const { setChannel } = useChannel();
  const [pane, setPane] = useState("choose"); // choose | login | apply | applied | status
  const [applied, setApplied] = useState(null);

  useEffect(() => setChannel("b2b"), []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className={`flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 ${isLoggedIn && user?.role === "b2b" ? "pt-6" : "py-16"}`}>
        {isLoggedIn && user?.role === "b2b" ? (
          <Dashboard />
        ) : pane === "login" ? (
          <LoginPane onBack={() => setPane("choose")} onLoggedIn={() => setPane("choose")} />
        ) : pane === "apply" ? (
          <ApplyPane onBack={() => setPane("choose")} onSubmitted={(app) => { setApplied(app); setPane("applied"); }} />
        ) : pane === "status" ? (
          <StatusPane onBack={() => setPane("choose")} />
        ) : pane === "applied" ? (
          <div className="max-w-sm mx-auto text-center">
            <div className="h-14 w-14 rounded-2xl bg-teal-light text-teal-dark flex items-center justify-center mx-auto mb-5">
              <Building2 size={26} />
            </div>
            <h1 className="font-display font-bold text-xl text-ink mb-2">Application submitted</h1>
            <p className="text-sm text-ink-soft mb-6">
              Thanks, {applied?.contact_name}. We've received your application for {applied?.business_name} and it's
              now pending review. We'll send your login details to {applied?.phone} once it's approved.
            </p>
            <button onClick={() => setPane("choose")} className="text-sm font-medium text-teal-dark hover:underline">
              Back to B2B Wholesale
            </button>
          </div>
        ) : (
          <div className="max-w-md mx-auto text-center">
            <div className="h-14 w-14 rounded-2xl bg-blue-light text-blue-dark flex items-center justify-center mx-auto mb-5">
              <Building2 size={26} />
            </div>
            <h1 className="font-display font-bold text-xl text-ink mb-2">B2B Wholesale</h1>
            <p className="text-sm text-ink-soft mb-8">Sign in if you already have credentials, or apply for a new B2B account.</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => setPane("login")} className="w-full bg-blue text-white text-sm font-medium py-3 rounded-lg hover:bg-blue-dark transition-colors">
                I have a B2B login
              </button>
              <button onClick={() => setPane("apply")} className="w-full border border-border text-ink text-sm font-medium py-3 rounded-lg hover:border-blue transition-colors">
                Apply for a B2B account
              </button>
              <button onClick={() => setPane("status")} className="text-sm text-ink-soft hover:text-ink mt-1">
                Already applied? Check your status
              </button>
            </div>
          </div>
        )}
      </main>
      <TrustBadges />
      <Footer channel="b2b" />
    </div>
  );
}
