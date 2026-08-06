import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const icon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconAnchor: [12, 41] });

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapPicker({ lat, lng, onChange }) {
  const [position, setPosition] = useState(lat && lng ? [lat, lng] : [28.6139, 77.209]); // defaults to Delhi

  function handlePick(newLat, newLng) {
    setPosition([newLat, newLng]);
    onChange(newLat, newLng);
  }

  return (
    <div className="rounded-lg overflow-hidden border border-border" data-testid="map-picker">
      <MapContainer center={position} zoom={13} style={{ height: "260px", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Marker position={position} icon={icon} />
        <ClickHandler onPick={handlePick} />
      </MapContainer>
      <p className="text-xs text-ink-soft px-3 py-2 bg-bg">Tap the map to set your exact delivery location.</p>
    </div>
  );
}
