"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type PickupPin = {
  id: string;
  vendor: string;
  lat: number;
  lng: number;
  status: string;
  weight: string;
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#d97706",
  SCHEDULED: "#2563eb",
  COLLECTED: "#059669",
  CANCELLED: "#94a3b8",
};

export function PickupMap({ pins }: { pins: PickupPin[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center: [number, number] =
      pins.length > 0
        ? [pins.reduce((s, p) => s + p.lng, 0) / pins.length, pins.reduce((s, p) => s + p.lat, 0) / pins.length]
        : [3.3792, 6.5244];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center,
      zoom: 11,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      for (const p of pins) {
        const el = document.createElement("div");
        el.style.cssText = `width:16px;height:16px;border-radius:50%;background:${STATUS_COLOR[p.status] ?? "#64748b"};border:2px solid #fff;box-shadow:0 0 3px rgba(0,0,0,.4);cursor:pointer`;
        new maplibregl.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 14 }).setHTML(
              `<div style="font-family:sans-serif;font-size:13px">
                <strong>${p.vendor}</strong><br/>
                ${p.weight} · ${p.status}<br/>
                <a href="/pickups/${p.id}" style="color:#059669">Open request →</a>
              </div>`,
            ),
          )
          .addTo(map);
      }
    });

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative">
      <div ref={containerRef} className="h-[65vh] w-full rounded-card border border-border" role="application" aria-label="Map of pickup requests" />
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 rounded-md bg-surface/95 p-2 text-xs shadow">
        {Object.entries(STATUS_COLOR).map(([s, c]) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} /> {s}
          </div>
        ))}
      </div>
    </div>
  );
}
