"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label?: string; // number shown inside the pin
  title: string;
  subtitle?: string;
  href?: string;
  gem?: boolean;
}

function pinIcon(p: MapPoint) {
  const size = p.label ? 30 : 22;
  const inner = p.label
    ? `<span style="font:700 13px/1 system-ui;color:#1a0806">${p.label}</span>`
    : p.gem
      ? `<span style="font-size:10px">💎</span>`
      : "";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${p.color};border:3px solid #1a0806;box-shadow:0 0 0 2px ${p.color}88,0 4px 10px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center">${inner}</div>`,
  });
}

const youIcon = L.divIcon({
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#3fd1b5;border:3px solid #fff;box-shadow:0 0 0 6px rgba(63,209,181,.3)"></div>`,
});

function FitBounds({ points, route }: { points: MapPoint[]; route?: [number, number][] }) {
  const map = useMap();
  const sig = JSON.stringify([...points.map((p) => [p.lat, p.lng]), ...(route ?? [])]);
  useEffect(() => {
    const coords = JSON.parse(sig) as [number, number][];
    if (coords.length === 1) map.setView(coords[0], 13);
    else if (coords.length > 1) map.fitBounds(L.latLngBounds(coords), { padding: [28, 28] });
  }, [map, sig]);
  return null;
}

export default function MapView({
  points,
  route,
  you,
  height = 320,
  onOpen,
}: {
  points: MapPoint[];
  route?: [number, number][];
  you?: { lat: number; lng: number } | null;
  height?: number | string;
  onOpen?: (id: string) => void;
}) {
  return (
    <div style={{ height }} className="overflow-hidden rounded-2xl border border-gold/20">
      <MapContainer
        center={[15.97, 75.8]}
        zoom={10}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
        attributionControl
      >
        <TileLayer
          className="map-tiles"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {route && route.length > 1 && (
          <>
            <Polyline positions={route} pathOptions={{ color: "#1a0806", weight: 8, opacity: 0.6 }} />
            <Polyline positions={route} pathOptions={{ color: "#e8b45a", weight: 4, dashArray: "1 0" }} />
          </>
        )}
        {points.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p)}>
            <Popup>
              <div style={{ minWidth: 150 }}>
                <b style={{ color: "#f7d997" }}>{p.title}</b>
                {p.subtitle && <div style={{ fontSize: 12, marginTop: 2 }}>{p.subtitle}</div>}
                {onOpen && (
                  <button
                    onClick={() => onOpen(p.id)}
                    style={{ marginTop: 6, color: "#3fd1b5", fontWeight: 700, fontSize: 12, background: "none", border: 0, padding: 0 }}
                  >
                    Open →
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        {you && <Marker position={[you.lat, you.lng]} icon={youIcon} />}
        <FitBounds points={points} route={route} />
      </MapContainer>
    </div>
  );
}
