import { useNavigate } from "react-router-dom";
import { ShoppingBag, Building2, Handshake, X } from "lucide-react";
import Logo from "./Logo";
import { useChannel } from "../context/ChannelContext";

const OPTIONS = [
  {
    key: "b2c",
    icon: ShoppingBag,
    title: "Shop B2C",
    subtitle: "For individual customers — best prices for you and your family",
    accent: "teal",
    to: null, // already home, just close the modal
  },
  {
    key: "b2b",
    icon: Building2,
    title: "Shop B2B Wholesale",
    subtitle: "For businesses & dealers — exclusive wholesale pricing",
    accent: "blue",
    to: "/b2b",
  },
  {
    key: "cnf",
    icon: Handshake,
    title: "Become a CNF / Distributor",
    subtitle: "Grow your business with Healthycian",
    accent: "ink",
    to: "/cnf",
  },
];

const ACCENT_CLASSES = {
  teal: "bg-teal-light text-teal-dark group-hover:bg-teal group-hover:text-white",
  blue: "bg-blue-light text-blue-dark group-hover:bg-blue group-hover:text-white",
  ink: "bg-bg text-ink-soft group-hover:bg-ink group-hover:text-white",
};

export default function ChannelModal({ onClose }) {
  const navigate = useNavigate();
  const { setChannel } = useChannel();

  function choose(option) {
    setChannel(option.key === "b2c" ? "b2c" : option.key);
    if (option.to) navigate(option.to);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-card shadow-card p-8 max-w-lg w-full">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-soft hover:text-ink transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex justify-center mb-4">
          <Logo size="md" dark />
        </div>
        <p className="text-center text-ink-soft text-sm mb-6">
          Your trusted partner in better health. Choose how you'd like to shop.
        </p>

        <div className="flex flex-col gap-3">
          {OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => choose(option)}
              className="group text-left bg-white border border-border rounded-lg p-4 hover:shadow-card transition-all flex items-center gap-3"
            >
              <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center transition-colors ${ACCENT_CLASSES[option.accent]}`}>
                <option.icon size={18} />
              </div>
              <div>
                <h3 className="font-display font-semibold text-sm text-ink">{option.title}</h3>
                <p className="text-xs text-ink-soft">{option.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
