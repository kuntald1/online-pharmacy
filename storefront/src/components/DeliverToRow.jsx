import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import AddressForm from "./AddressForm";
import LoginModal from "./LoginModal";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function DeliverToRow({ inStock }) {
  const { isLoggedIn } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [pincodeInput, setPincodeInput] = useState("");
  const [pincodeResult, setPincodeResult] = useState(null);
  const [checkingPincode, setCheckingPincode] = useState(false);
  const [addressEstimate, setAddressEstimate] = useState(null);

  async function checkPincode(e) {
    e.preventDefault();
    if (pincodeInput.trim().length < 4) return;
    setCheckingPincode(true);
    setPincodeResult(null);
    try {
      const data = await api.get(`/api/delivery-estimate?pincode=${encodeURIComponent(pincodeInput.trim())}`);
      setPincodeResult(data);
    } catch (err) {
      setPincodeResult({ deliverable: false, message: err.message });
    } finally {
      setCheckingPincode(false);
    }
  }

  function load() {
    setLoading(true);
    api.get("/api/addresses").then(setAddresses).finally(() => setLoading(false));
  }

  useEffect(() => {
    if (isLoggedIn) load();
    else setLoading(false);
  }, [isLoggedIn]);

  const defaultAddress = addresses.find((a) => a.is_default) || addresses[0];

  // Real delivery-zone lookup for the saved address, replacing what used to
  // be a hardcoded "Today, by 5pm" heuristic with no actual pincode logic
  // behind it — this now reflects whatever an admin has configured for that
  // pincode in Admin -> Delivery Zones (or honestly says it's unconfirmed).
  useEffect(() => {
    if (!defaultAddress?.pincode) {
      setAddressEstimate(null);
      return;
    }
    api
      .get(`/api/delivery-estimate?pincode=${encodeURIComponent(defaultAddress.pincode)}`)
      .then(setAddressEstimate)
      .catch(() => setAddressEstimate(null));
  }, [defaultAddress?.pincode]);

  if (!isLoggedIn) {
    return (
      <div className="mb-6">
        <p className="text-xs font-medium text-ink-soft mb-1.5 uppercase tracking-wider">Deliver to</p>
        {/* No login required to check this - matches the backend endpoint,
            which is deliberately public for exactly this reason. */}
        <form onSubmit={checkPincode} className="flex gap-2 mb-1.5">
          <input
            value={pincodeInput}
            onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter pincode"
            inputMode="numeric"
            className="flex-1 max-w-[160px] rounded-lg border border-border px-3 py-1.5 text-sm focus:border-teal focus:ring-1 focus:ring-teal outline-none"
          />
          <button
            type="submit"
            disabled={checkingPincode || pincodeInput.trim().length < 4}
            className="text-sm font-medium text-white bg-teal px-4 py-1.5 rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50"
          >
            {checkingPincode ? "Checking…" : "Check"}
          </button>
        </form>
        {pincodeResult && (
          <p className={`text-xs mb-2 ${pincodeResult.deliverable ? "text-teal-dark font-medium" : "text-ink-soft"}`}>
            {pincodeResult.message}
          </p>
        )}
        <button onClick={() => setLoginModalOpen(true)} className="text-sm text-[#02696B] hover:underline">
          Log in to save your address for next time
        </button>
        {loginModalOpen && (
          <LoginModal onClose={() => setLoginModalOpen(false)} onSuccess={() => setLoginModalOpen(false)} />
        )}
      </div>
    );
  }

  if (loading) {
    return <div className="h-14 rounded-lg bg-bg animate-pulse mb-6" />;
  }

  return (
    <div className="mb-6">
      <p className="text-xs font-medium text-ink-soft mb-1 uppercase tracking-wider">Deliver to</p>

      {defaultAddress ? (
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm">
            <span className="font-medium text-ink">{defaultAddress.pincode}</span>{" "}
            <span className="text-ink-soft">
              {defaultAddress.name}, {defaultAddress.line1}, {defaultAddress.city}, {defaultAddress.state}
            </span>
            <p className="mt-0.5">
              <span className="text-[#7B3FA0] font-medium">
                {!addressEstimate
                  ? "Checking delivery date…"
                  : addressEstimate.deliverable
                  ? `Delivery: by ${new Date(addressEstimate.delivery_date).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}`
                  : addressEstimate.message}
              </span>{" "}
              <span className={inStock ? "text-teal-dark" : "text-red"}>{inStock ? "In stock" : "Out of stock"}</span>
            </p>
          </div>
          <button onClick={() => setEditing(true)} aria-label="Change address" className="text-ink-soft hover:text-ink shrink-0 mt-0.5">
            <Pencil size={14} />
          </button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="text-sm text-[#02696B] hover:underline">
          Add a delivery address
        </button>
      )}

      {editing && (
        <div className="mt-3 border border-border rounded-lg p-4">
          <AddressForm
            initial={defaultAddress}
            onSaved={() => {
              setEditing(false);
              load();
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}
    </div>
  );
}
