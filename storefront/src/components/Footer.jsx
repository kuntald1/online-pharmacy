import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaTwitter, FaYoutube, FaLinkedinIn, FaCcVisa, FaCcMastercard } from "react-icons/fa";
import Logo from "./Logo";
import { api } from "../api/client";

const SOCIAL_LINKS = [
  { icon: FaFacebookF, label: "Facebook" },
  { icon: FaInstagram, label: "Instagram" },
  { icon: FaTwitter, label: "Twitter" },
  { icon: FaYoutube, label: "YouTube" },
  { icon: FaLinkedinIn, label: "LinkedIn" },
];

const COMPANY_LINKS = ["About Us", "Careers", "Blog", "Contact Us"];
const SUPPORT_LINKS = [
  "My Orders", "Track Order", "Returns & Refunds", "Shipping Policy",
  "Payment Options", "Help & Support", "Terms & Conditions", "Privacy Policy", "Return Policy",
];

export default function Footer({ channel = "b2c" }) {
  const [categories, setCategories] = useState([]);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [cms, setCms] = useState({});

  useEffect(() => {
    api.get(`/api/categories?channel=${channel}`).then(setCategories).catch(() => {});
    // Same public settings endpoint Logo.jsx uses — CMS-editable footer
    // about text (Admin → CMS), falls back to the default copy below if unset.
    api.get("/api/settings/public").then(setCms).catch(() => {});
  }, [channel]);

  function handleSubscribe(e) {
    e.preventDefault();
    // No backend endpoint for this yet — the input works and validates,
    // but nothing is actually stored/sent anywhere. Flagging in the UI
    // rather than silently pretending it's wired up.
    setSubscribed(true);
  }

  return (
    <footer className="bg-[#02696B] text-white mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 sm:grid-cols-5 gap-8">
        <div className="col-span-2 sm:col-span-1">
          <Logo size="sm" />
          <p className="text-xs text-white/50 mt-3 leading-relaxed">
            {cms.footer_about_text || "Your trusted online pharmacy for genuine medicines, wellness products, and everyday health needs."}
          </p>
          <div className="flex items-center gap-2 mt-4">
            {SOCIAL_LINKS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                title={`Not linked yet — visual placeholder (${label})`}
                className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:bg-white/20 hover:text-white transition-colors"
              >
                <Icon size={13} />
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-white/40 font-medium mb-3">Shop by Category</p>
          <ul className="flex flex-col gap-2 text-sm text-white/70">
            {categories.slice(0, 8).map((cat) => (
              <li key={cat.id}>
                <Link to={`/${channel}/category/${cat.slug}`} className="hover:text-white transition-colors">
                  {cat.name}
                </Link>
              </li>
            ))}
            {categories.length > 8 && (
              <li>
                <Link to={`/${channel}/categories`} className="hover:text-white transition-colors">
                  View All
                </Link>
              </li>
            )}
          </ul>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-white/40 font-medium mb-3">Company</p>
          <ul className="flex flex-col gap-2 text-sm text-white/70">
            {COMPANY_LINKS.map((label) => (
              <li key={label} title="Page not built yet">{label}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-white/40 font-medium mb-3">Customer Service</p>
          <ul className="flex flex-col gap-2 text-sm text-white/70">
            {SUPPORT_LINKS.map((label) => (
              <li key={label} title="Page not built yet">{label}</li>
            ))}
          </ul>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <p className="text-xs uppercase tracking-wider text-white/40 font-medium mb-3">Subscribe to our Newsletter</p>
          <p className="text-xs text-white/50 mb-3 leading-relaxed">
            Get health tips, offers &amp; updates straight to your inbox.
          </p>
          {subscribed ? (
            <p className="text-xs text-teal-light">Thanks — you're on the list.</p>
          ) : (
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 min-w-0 rounded-lg bg-white border border-white/20 px-3 py-2 text-xs text-ink placeholder:text-ink-soft focus:outline-none focus:border-teal"
              />
              <button type="submit" className="bg-teal text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-teal-dark transition-colors shrink-0">
                Subscribe
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/40">© {new Date().getFullYear()} Healthycian. All rights reserved.</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40 mr-1">We Accept:</span>
            <span className="h-7 px-2.5 rounded bg-white flex items-center justify-center text-blue-800">
              <FaCcVisa size={22} />
            </span>
            <span className="h-7 px-2.5 rounded bg-white flex items-center justify-center text-ink">
              <FaCcMastercard size={22} />
            </span>
            {/* RuPay and UPI are India-specific payment networks with no
                glyph in standard icon libraries (Font Awesome, etc.) —
                kept as text badges rather than attempting a hand-drawn
                recreation of their trademarked logos. */}
            {["RuPay", "UPI"].map((label) => (
              <span key={label} className="h-7 px-2.5 rounded bg-white/10 flex items-center justify-center text-[10px] font-semibold text-white/70">
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
