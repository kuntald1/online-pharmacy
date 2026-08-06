import { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function LoginModal({ onClose, onSuccess }) {
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
      await api.post("/api/auth/customer/send-otp", { phone: phone.trim() });
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
      const res = await api.post("/api/auth/customer/verify-otp", { phone: phone.trim(), code: code.trim() });
      login(res);
      onClose();
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-card shadow-card p-8 max-w-sm w-full">
        <button onClick={onClose} className="absolute top-4 right-4 text-ink-soft hover:text-ink" aria-label="Close">
          ×
        </button>

        <h2 className="font-display font-bold text-xl text-ink mb-1">
          {step === "phone" ? "Log in" : "Enter verification code"}
        </h2>
        <p className="text-sm text-ink-soft mb-6">
          {step === "phone"
            ? "We'll text you a one-time code — no password needed."
            : `Code sent to ${phone}`}
        </p>

        {step === "phone" ? (
          <form onSubmit={sendOtp}>
            <input
              type="tel"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91XXXXXXXXXX"
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm mb-3 focus:outline-none focus:border-[#02696B]"
            />
            {error && <p className="text-red text-sm mb-3">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#02696B] text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp}>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm mb-3 tracking-widest text-center focus:outline-none focus:border-[#02696B]"
            />
            {error && <p className="text-red text-sm mb-3">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#02696B] text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 mb-3"
            >
              {loading ? "Verifying…" : "Verify & continue"}
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
    </div>
  );
}
