"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type VendorPin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  locality: string | null;
  lifetimeKg: number;
};

export function VendorMap({ pins }: { pins: VendorPin[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] =
      pins.length > 0
        ? [
            pins.reduce((s, p) => s + p.lng, 0) / pins.length,
            pins.reduce((s, p) => s + p.lat, 0) / pins.length,
          ]
        : [3.3792, 6.5244]; // Lagos

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center,
      zoom: 11,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("vendors", {
        type: "geojson",
        cluster: true,
        clusterRadius: 45,
        data: {
          type: "FeatureCollection",
          features: pins.map((p) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
            properties: {
              id: p.id,
              name: p.name,
              locality: p.locality ?? "",
              lifetimeKg: p.lifetimeKg,
            },
          })),
        },
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "vendors",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step", ["get", "point_count"],
            "#34d399", 10, "#059669", 30, "#065f46",
          ],
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 30, 30],
          "circle-opacity": 0.85,
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "vendors",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "unclustered",
        type: "circle",
        source: "vendors",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#059669",
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "unclustered", (e) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== "Point") return;
        const [lng, lat] = f.geometry.coordinates as [number, number];
        const props = f.properties as Record<string, string>;
        new maplibregl.Popup({ offset: 12 })
          .setLngLat([lng, lat])
          .setHTML(
            `<div style="font-family:sans-serif;font-size:13px">
              <strong>${props.name}</strong><br/>
              ${props.locality}<br/>
              ${Number(props.lifetimeKg).toLocaleString()} kg lifetime<br/>
              <a href="/vendors/${props.id}" style="color:#059669">Open profile →</a>
            </div>`,
          )
          .addTo(map);
      });
      map.on("click", "clusters", async (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = map.getSource("vendors") as maplibregl.GeoJSONSource;
        if (clusterId === undefined) return;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const geom = features[0].geometry;
        if (geom.type === "Point") {
          map.easeTo({ center: geom.coordinates as [number, number], zoom });
        }
      });
      map.on("mouseenter", "unclustered", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "unclustered", () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "clusters", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "clusters", () => { map.getCanvas().style.cursor = ""; });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-[70vh] w-full rounded-card border border-border"
      role="application"
      aria-label="Map of vendor locations"
    />
  );
}
