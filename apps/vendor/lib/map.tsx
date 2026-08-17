import { WebView } from "react-native-webview";
import { View } from "react-native";
import { radius, colors } from "./theme";

export type MapPoint = { lat: number; lng: number; label: string; color: string };

/**
 * Lightweight Leaflet + OpenStreetMap map in a WebView — no Google Maps API key
 * required, so it renders in a plain APK. Shows the given points and fits them.
 */
export function MiniMap({ points, height = 220 }: { points: MapPoint[]; height?: number }) {
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const center = valid[0] ?? { lat: 6.5244, lng: 3.3792 }; // Lagos fallback

  const markers = valid
    .map(
      (p) => `L.marker([${p.lat}, ${p.lng}], {icon: dot(${JSON.stringify(p.color)})})
        .addTo(map).bindTooltip(${JSON.stringify(p.label)}, {permanent:true, direction:'top', offset:[0,-8]});`,
    )
    .join("\n");

  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0;padding:0;background:${colors.bgAlt}}</style>
</head><body><div id="map"></div><script>
function dot(color){return L.divIcon({className:'',iconSize:[18,18],iconAnchor:[9,9],
  html:'<div style="width:16px;height:16px;border-radius:50%;background:'+color+';border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>'});}
var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${center.lat}, ${center.lng}], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
var pts=[];
${markers}
${valid.map((p) => `pts.push([${p.lat}, ${p.lng}]);`).join("\n")}
if(pts.length>1){map.fitBounds(pts,{padding:[40,40]});}
</script></body></html>`;

  return (
    <View style={{ height, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.bgAlt }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{ backgroundColor: colors.bgAlt }}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}
