"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Agent = {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  minutesAgo: number;
  tripId: string | null;
};

export function AgentsMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});
  const [agents, setAgents] = useState<Agent[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap" } },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [3.3792, 6.5244],
      zoom: 11,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch("/api/agents/locations");
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setAgents(data.agents);
        setUpdatedAt(new Date());
      } catch { /* ignore transient errors */ }
    }
    poll();
    const id = setInterval(poll, 20000);
    return () => { active = false; clearInterval(id); };
  }, []);

  // Sync markers to agents
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const a of agents) {
      seen.add(a.userId);
      const color = a.minutesAgo <= 3 ? "#008037" : a.minutesAgo <= 10 ? "#d97706" : "#94a3b8";
      let marker = markersRef.current[a.userId];
      if (!marker) {
        const el = document.createElement("div");
        el.style.cssText = "width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.2)";
        marker = new maplibregl.Marker({ element: el })
          .setLngLat([a.lng, a.lat])
          .setPopup(new maplibregl.Popup({ offset: 12 }))
          .addTo(map);
        markersRef.current[a.userId] = marker;
      }
      (marker.getElement() as HTMLElement).style.background = color;
      marker.setLngLat([a.lng, a.lat]);
      marker.getPopup()?.setHTML(`<div style="font-family:sans-serif;font-size:13px"><strong>${a.name}</strong><br/>${a.minutesAgo <= 1 ? "just now" : a.minutesAgo + " min ago"}</div>`);
    }
    // remove stale markers
    for (const id of Object.keys(markersRef.current)) {
      if (!seen.has(id)) { markersRef.current[id].remove(); delete markersRef.current[id]; }
    }
    if (agents.length > 0) {
      const b = new maplibregl.LngLatBounds();
      agents.forEach((a) => b.extend([a.lng, a.lat]));
      map.fitBounds(b, { padding: 60, maxZoom: 14, duration: 400 });
    }
  }, [agents]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted">
          {agents.length} agent{agents.length === 1 ? "" : "s"} active (last 30 min)
        </span>
        <span className="text-xs text-muted">
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString("en-NG")}` : "Loading…"} · auto-refresh 20s
        </span>
      </div>
      <div ref={containerRef} className="h-[65vh] w-full rounded-card border border-border" role="application" aria-label="Live map of field agents" />
      {agents.length === 0 && (
        <p className="mt-2 text-sm text-muted">
          No active agents right now. Agents appear here while their field app is open during a trip.
        </p>
      )}
    </div>
  );
}
