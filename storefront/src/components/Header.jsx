import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search, Heart, ShoppingCart, User, FileText, Tag, Package, ChevronDown, Menu, X, Minus, Plus, LogOut, ArrowRightLeft } from "lucide-react";
import Logo from "./Logo";
import LoginModal from "./LoginModal";
import UploadRxModal from "./UploadRxModal";
import SearchSuggestions from "./SearchSuggestions";
import { useChannel } from "../context/ChannelContext";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

const CHANNEL_PILLS = [
  { key: "b2c", label: "B2C", to: "/b2c", colorClass: "bg-[#02696B] text-white hover:opacity-90" },
  { key: "b2b", label: "B2B Wholesale", to: "/b2b", colorClass: "bg-blue text-white hover:bg-blue-dark" },
  { key: "cnf", label: "CNF / Distributor", to: "/cnf", colorClass: "bg-[#FF9800] text-white hover:opacity-90" },
];

const ROLE_LABELS = { b2b: "B2B Wholesale", cnf: "CNF / Distributor" };

export default function Header({ onLogoClick }) {
  const { channel } = useChannel();
  const { items, removeItem, updateQuantity, itemCount, subtotal } = useCart();
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [rxModalOpen, setRxModalOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const dropdownRef = useRef(null);
  const cartRef = useRef(null);
  const accountRef = useRef(null);
  const searchRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  useEffect(() => {
    api.get(`/api/categories?channel=${channel || "b2c"}`).then(setCategories).catch(() => {});
  }, [channel]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (cartRef.current && !cartRef.current.contains(e.target)) setCartOpen(false);
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false);
      if (
        (!searchRef.current || !searchRef.current.contains(e.target)) &&
        (!mobileSearchRef.current || !mobileSearchRef.current.contains(e.target))
      ) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    setSuggestLoading(true);
    const handle = setTimeout(() => {
      api
        .get(`/api/products?channel=${channel || "b2c"}&search=${encodeURIComponent(query.trim())}`)
        .then((data) => setSuggestions(data.slice(0, 6)))
        .catch(() => setSuggestions([]))
        .finally(() => setSuggestLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, channel]);

  const [pendingSwitch, setPendingSwitch] = useState(null); // the pill object the user clicked, awaiting confirmation

  function handlePillClick(e, pill) {
    // Only B2B/CNF sessions need this guard — those are real logins tied to
    // one specific account, and silently carrying that session over to a
    // different channel would mean e.g. a B2B account's token quietly
    // getting used for a B2C cart/checkout without ever explicitly signing
    // in as a B2C customer. B2C itself needs no login to browse, so there's
    // nothing to guard when switching away from it.
    const isB2bOrCnf = isLoggedIn && (user?.role === "b2b" || user?.role === "cnf");
    if (isB2bOrCnf && user.role !== pill.key) {
      e.preventDefault();
      setPendingSwitch(pill);
    }
  }

  function confirmSwitch() {
    logout();
    navigate(pendingSwitch.to);
    setPendingSwitch(null);
  }

  function handleSearch(e) {
    e.preventDefault();
    setSuggestionsOpen(false);
    if (query.trim()) {
      navigate(`/${channel}/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <header className="border-b border-border sticky top-0 z-20">
      <div className="bg-[#02696B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4 sm:gap-8">
          <Link to={`/${channel || ""}`} onClick={onLogoClick}>
            <Logo size="md" />
          </Link>

          <form onSubmit={handleSearch} className="flex-1 hidden sm:flex relative" ref={searchRef}>
            <div className="flex w-full max-w-xl relative">
              <input
                className="flex-1 rounded-l-lg border border-white/20 px-4 py-2.5 text-sm focus:outline-none focus:border-white/50"
                placeholder="Search medicines, brands, conditions…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSuggestionsOpen(true)}
              />
              <button type="submit" className="bg-white text-[#02696B] px-5 rounded-r-lg text-sm font-medium hover:bg-white/90 transition-colors">
                Search
              </button>
              {suggestionsOpen && (
                <SearchSuggestions
                  query={query}
                  suggestions={suggestions}
                  loading={suggestLoading}
                  channel={channel || "b2c"}
                  onSelect={() => setSuggestionsOpen(false)}
                  onViewAll={handleSearch}
                />
              )}
            </div>
          </form>

          <div className="flex items-center gap-4 ml-auto sm:ml-0">
            <button
              onClick={() => (isLoggedIn ? setRxModalOpen(true) : setLoginModalOpen(true))}
              className="hidden lg:flex flex-col items-center gap-0.5 text-white/70 hover:text-white transition-colors px-1"
            >
              <FileText size={18} />
              <span className="text-[10px] leading-none">Upload Rx</span>
            </button>
            <Link
              to={`/${channel}/offers`}
              className="hidden lg:flex flex-col items-center gap-0.5 text-white/70 hover:text-white transition-colors px-1"
            >
              <Tag size={18} />
              <span className="text-[10px] leading-none">Offers</span>
            </Link>
            <button
              onClick={() => (isLoggedIn ? navigate(`/${channel}/orders`) : setLoginModalOpen(true))}
              className="hidden lg:flex flex-col items-center gap-0.5 text-white/70 hover:text-white transition-colors px-1"
            >
              <Package size={18} />
              <span className="text-[10px] leading-none">Orders</span>
            </button>
            <button
              onClick={() => (isLoggedIn ? navigate(`/${channel}/wishlist`) : setLoginModalOpen(true))}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Wishlist"
            >
              <Heart size={20} />
            </button>
            <div className="relative" ref={cartRef}>
              <button
                onClick={() => setCartOpen((o) => !o)}
                className="relative text-white/70 hover:text-white transition-colors"
                aria-label="Cart"
              >
                <ShoppingCart size={20} />
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-[#FF9800] text-white text-[10px] font-semibold flex items-center justify-center">
                    {itemCount > 9 ? "9+" : itemCount}
                  </span>
                )}
              </button>
              {cartOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-border rounded-lg shadow-card z-40 text-ink">
                  {items.length === 0 ? (
                    <p className="text-sm text-ink-soft p-6 text-center">Your cart is empty.</p>
                  ) : (
                    <>
                      <div className="max-h-80 overflow-y-auto divide-y divide-border">
                        {items.map((item) => (
                          <div key={item.key} className="flex gap-3 p-3">
                            <div className="h-14 w-14 rounded-lg bg-bg overflow-hidden shrink-0">
                              {item.image && <img src={item.image} alt="" className="h-full w-full object-cover" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-ink truncate">{item.name}</p>
                              <p className="text-xs text-ink-soft mb-1">₹{item.price}</p>
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateQuantity(item.key, item.quantity - 1)} className="h-5 w-5 rounded border border-border flex items-center justify-center hover:bg-bg">
                                  <Minus size={10} />
                                </button>
                                <span className="text-xs w-4 text-center">{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.key, item.quantity + 1)} className="h-5 w-5 rounded border border-border flex items-center justify-center hover:bg-bg">
                                  <Plus size={10} />
                                </button>
                              </div>
                            </div>
                            <button onClick={() => removeItem(item.key)} className="text-ink-soft hover:text-red shrink-0" aria-label="Remove">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="p-3 border-t border-border">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-ink">Subtotal</span>
                          <span className="text-sm font-semibold text-ink">₹{subtotal.toFixed(2)}</span>
                        </div>
                        <button
                          onClick={() => {
                            setCartOpen(false);
                            if (isLoggedIn) {
                              navigate(`/${channel}/checkout`);
                            } else {
                              setLoginModalOpen(true);
                            }
                          }}
                          className="w-full bg-teal text-white text-sm font-medium py-2.5 rounded-lg hover:bg-teal-dark transition-colors"
                        >
                          Checkout
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {isLoggedIn ? (
              <div className="relative" ref={accountRef}>
                <button
                  onClick={() => setAccountOpen((o) => !o)}
                  className="flex items-center gap-1.5 text-sm font-medium text-white border border-white/30 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors"
                >
                  <User size={16} />
                  <span className="hidden sm:inline">{user.name}</span>
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-border rounded-lg shadow-card z-40 py-1 text-ink">
                    <Link
                      to={`/${channel}/orders`}
                      onClick={() => setAccountOpen(false)}
                      className="block px-4 py-2 text-sm hover:bg-bg transition-colors"
                    >
                      My Orders
                    </Link>
                    <Link
                      to={`/${channel}/profile`}
                      onClick={() => setAccountOpen(false)}
                      className="block px-4 py-2 text-sm hover:bg-bg transition-colors"
                    >
                      My Profile
                    </Link>
                    <Link
                      to={`/${channel}/returns`}
                      onClick={() => setAccountOpen(false)}
                      className="block px-4 py-2 text-sm hover:bg-bg transition-colors"
                    >
                      My Returns
                    </Link>
                    <Link
                      to={`/${channel}/wallet`}
                      onClick={() => setAccountOpen(false)}
                      className="block px-4 py-2 text-sm hover:bg-bg transition-colors"
                    >
                      My Wallet
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setAccountOpen(false);
                      }}
                      className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red hover:bg-bg transition-colors"
                    >
                      <LogOut size={14} />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setLoginModalOpen(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-white border border-white/30 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors"
              >
                <User size={16} />
                <span className="hidden sm:inline">Login</span>
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSearch} className="sm:hidden px-4 pb-3 relative" ref={mobileSearchRef}>
          <div className="flex w-full relative">
            <input
              className="flex-1 rounded-l-lg border border-white/20 px-3 py-2 text-sm focus:outline-none focus:border-white/50"
              placeholder="Search medicines…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSuggestionsOpen(true)}
            />
            <button type="submit" className="bg-white text-[#02696B] px-4 rounded-r-lg text-sm font-medium">
              <Search size={16} />
            </button>
            {suggestionsOpen && (
              <SearchSuggestions
                query={query}
                suggestions={suggestions}
                loading={suggestLoading}
                channel={channel || "b2c"}
                onSelect={() => setSuggestionsOpen(false)}
                onViewAll={handleSearch}
              />
            )}
          </div>
        </form>
      </div>

      {/* Categories nav row — deliberately NOT part of the teal block above, keeps its own light background */}
      <div className="border-t border-border bg-bg/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-5">
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-[#02696B] px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              <Menu size={14} />
              All Categories
              <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-border rounded-lg shadow-card py-2 w-56 z-30">
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/${channel}/category/${cat.slug}`}
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-ink hover:bg-bg transition-colors"
                    >
                      {cat.name}
                    </Link>
                  ))
                ) : (
                  <p className="px-4 py-2 text-sm text-ink-soft">No categories yet.</p>
                )}
              </div>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-5 overflow-x-auto min-w-0">
            {categories.slice(0, 7).map((cat) => (
              <Link
                key={cat.id}
                to={`/${channel}/category/${cat.slug}`}
                className="text-sm text-ink-soft hover:text-teal-dark whitespace-nowrap transition-colors shrink-0"
              >
                {cat.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            {CHANNEL_PILLS.map((pill) => (
              <Link
                key={pill.key}
                to={pill.to}
                onClick={(e) => handlePillClick(e, pill)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${pill.colorClass} ${
                  channel === pill.key ? "ring-2 ring-offset-1 ring-ink/20" : ""
                }`}
              >
                {pill.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {loginModalOpen && (
        <LoginModal
          onClose={() => setLoginModalOpen(false)}
          onSuccess={() => navigate(`/${channel}/checkout`)}
        />
      )}

      <UploadRxModal open={rxModalOpen} onClose={() => setRxModalOpen(false)} channel={channel || "b2c"} />

      {pendingSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setPendingSwitch(null)} />
          <div className="relative bg-white rounded-card shadow-card p-6 max-w-sm w-full">
            <div className="h-12 w-12 rounded-full bg-amber-light text-amber flex items-center justify-center mx-auto mb-4">
              <ArrowRightLeft size={22} />
            </div>
            <h2 className="font-display font-bold text-lg text-ink text-center mb-2">Switch to {pendingSwitch.label}?</h2>
            <p className="text-sm text-ink-soft text-center mb-6">
              You're currently signed in as <span className="font-medium text-ink">{ROLE_LABELS[user?.role]}</span>.
              Switching channels will sign you out of that account first — you'll need to log back in separately if
              you come back to it later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingSwitch(null)}
                className="flex-1 border border-border text-ink text-sm font-medium py-2.5 rounded-lg hover:bg-bg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSwitch}
                className="flex-1 bg-teal text-white text-sm font-medium py-2.5 rounded-lg hover:bg-teal-dark transition-colors"
              >
                Sign out & continue
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
