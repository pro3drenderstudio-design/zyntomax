import { useRef } from "react";
import { Modal, View } from "react-native";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system/legacy";
import { Txt, Button, Row } from "./ui";
import { colors, space, radius } from "./theme";

const HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>html,body{margin:0;height:100%;background:#fff;touch-action:none}#c{display:block;width:100%;height:100%}</style>
</head><body><canvas id="c"></canvas><script>
var c=document.getElementById('c'),x=c.getContext('2d'),drawing=false,dirty=false;
function resize(){var r=window.devicePixelRatio||1;c.width=c.clientWidth*r;c.height=c.clientHeight*r;x.scale(r,r);x.lineWidth=2.5;x.lineCap='round';x.strokeStyle='#0f172a';}
resize();
function pos(e){var r=c.getBoundingClientRect();var t=e.touches?e.touches[0]:e;return[t.clientX-r.left,t.clientY-r.top];}
function start(e){drawing=true;dirty=true;var p=pos(e);x.beginPath();x.moveTo(p[0],p[1]);e.preventDefault();}
function move(e){if(!drawing)return;var p=pos(e);x.lineTo(p[0],p[1]);x.stroke();e.preventDefault();}
function end(){drawing=false;}
c.addEventListener('mousedown',start);c.addEventListener('mousemove',move);window.addEventListener('mouseup',end);
c.addEventListener('touchstart',start);c.addEventListener('touchmove',move);c.addEventListener('touchend',end);
function clearPad(){x.clearRect(0,0,c.width,c.height);dirty=false;}
function savePad(){window.ReactNativeWebView.postMessage(dirty?c.toDataURL('image/png'):'empty');}
</script></body></html>`;

export function SignaturePad({ visible, onCancel, onDone }: {
  visible: boolean; onCancel: () => void; onDone: (uri: string) => void;
}) {
  const webRef = useRef<WebView>(null);

  async function handleMessage(e: { nativeEvent: { data: string } }) {
    const data = e.nativeEvent.data;
    if (!data || data === "empty") { onCancel(); return; }
    const base64 = data.replace(/^data:image\/png;base64,/, "");
    const uri = `${FileSystem.cacheDirectory}sig-${Date.now()}.png`;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    onDone(uri);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.md }}>
        <Txt variant="h3">Vendor signature</Txt>
        <Txt variant="small" color={colors.muted}>Ask the vendor to sign, confirming this weigh-in.</Txt>
        <View style={{ flex: 1, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" }}>
          <WebView ref={webRef} originWhitelist={["*"]} source={{ html: HTML }} onMessage={handleMessage} scrollEnabled={false} />
        </View>
        <Row gap={space.sm}>
          <View style={{ flex: 1 }}><Button title="Clear" variant="secondary" small onPress={() => webRef.current?.injectJavaScript("clearPad();true;")} /></View>
          <View style={{ flex: 1 }}><Button title="Cancel" variant="ghost" small onPress={onCancel} /></View>
          <View style={{ flex: 1 }}><Button title="Save" small onPress={() => webRef.current?.injectJavaScript("savePad();true;")} /></View>
        </Row>
      </View>
    </Modal>
  );
}
