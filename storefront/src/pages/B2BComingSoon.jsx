import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function B2BComingSoon() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="text-center max-w-md">
          <div className="h-14 w-14 rounded-2xl bg-blue-light text-blue-dark flex items-center justify-center mx-auto mb-5">
            <Building2 size={26} />
          </div>
          <h1 className="font-display font-bold text-xl text-ink mb-2">B2B storefront is next</h1>
          <p className="text-sm text-ink-soft mb-6">
            The B2B onboarding form (KYC — Aadhaar, PAN, GST, Driving Licence, Trade Licence), application
            status tracking, and the gated wholesale catalog aren't built yet. Wholesale pricing shouldn't be
            publicly visible before that login gate exists, so this page intentionally shows nothing yet
            rather than exposing it.
          </p>
          <Link to="/" className="text-sm font-medium text-teal-dark hover:underline">
            ← Back to landing page
          </Link>
        </div>
      </main>
      <Footer channel="b2b" />
    </div>
  );
}
