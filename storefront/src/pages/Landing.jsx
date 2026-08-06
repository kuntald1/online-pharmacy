import { useNavigate } from "react-router-dom";
import { ShoppingBag, Building2, Handshake } from "lucide-react";
import Logo from "../components/Logo";
import { useChannel } from "../context/ChannelContext";

const OPTIONS = [
  {
    key: "b2c",
    icon: ShoppingBag,
    title: "Shop B2C",
    subtitle: "For individual customers — best prices for you and your family",
    accent: "teal",
    to: "/b2c",
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

export default function Landing() {
  const navigate = useNavigate();
  const { setChannel } = useChannel();

  function choose(option) {
    if (option.key === "b2c" || option.key === "b2b") {
      setChannel(option.key);
    }
    navigate(option.to);
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-16">
      <div className="mb-10">
        <Logo size="lg" dark />
      </div>
      <p className="text-ink-soft text-center max-w-md mb-10">
        Your trusted partner in better health. Choose how you'd like to shop.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-4xl">
        {OPTIONS.map((option) => (
          <button
            key={option.key}
            onClick={() => choose(option)}
            className="group text-left bg-white border border-border rounded-card shadow-card p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${ACCENT_CLASSES[option.accent]}`}>
              <option.icon size={22} />
            </div>
            <h3 className="font-display font-semibold text-lg text-ink mb-1">{option.title}</h3>
            <p className="text-sm text-ink-soft">{option.subtitle}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
