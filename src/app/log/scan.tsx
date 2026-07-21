import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { ModalShell } from '@/components/ModalShell';
import { lookupBarcode } from '@/lib/food';
import { useTheme } from '@/theme';

// expo-camera is a native module — absent until the dev build is rebuilt.
// Load it defensively so the rest of the app never crashes without it.
let CameraView: any = null;
let useCameraPermissions: any = null;
try {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch {
  CameraView = null;
}

export default function Scan() {
  // CameraView is a module-level constant, so this branch never changes across
  // renders — no hooks are called here, keeping hook order stable.
  if (!CameraView) return <Unavailable />;
  return <Scanner />;
}

function Unavailable() {
  const { colors } = useTheme();
  return (
    <ModalShell title="Scan Barcode">
      <View style={{ alignItems: 'center', paddingTop: 40 }}>
        <Ionicons name="hardware-chip-outline" size={40} color={colors.textMuted} />
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>
          Barcode scanning needs an app update
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 }}>
          The camera module ships in the next build. For now, use search or manual entry.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: 20, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: colors.accent, borderRadius: 12 }}>
          <Text style={{ color: colors.onAccent, fontWeight: '800' }}>Back to search</Text>
        </Pressable>
      </View>
    </ModalShell>
  );
}

function Scanner() {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [looking, setLooking] = useState(false);
  const [notFound, setNotFound] = useState<string | null>(null);
  const handled = useRef(false);

  if (!permission?.granted) {
    return (
      <ModalShell title="Scan Barcode">
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 12 }}>
            Camera access needed
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6 }}>
            Point your camera at a food barcode to log it instantly.
          </Text>
          <Pressable
            onPress={requestPermission}
            style={{ marginTop: 20, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: colors.accent, borderRadius: 12 }}>
            <Text style={{ color: colors.onAccent, fontWeight: '800' }}>Allow camera</Text>
          </Pressable>
        </View>
      </ModalShell>
    );
  }

  const onScan = async ({ data }: { data: string }) => {
    if (handled.current || looking) return;
    handled.current = true;
    setLooking(true);
    setNotFound(null);
    const item = await lookupBarcode(data);
    setLooking(false);
    if (item) {
      router.replace({ pathname: '/log/food', params: { scanned: JSON.stringify(item) } });
    } else {
      setNotFound(data);
      setTimeout(() => {
        handled.current = false;
      }, 1500);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={onScan}
      />
      <View style={{ position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Point at a food barcode</Text>
      </View>
      <View
        style={{
          position: 'absolute',
          top: '38%',
          left: '12%',
          right: '12%',
          height: 140,
          borderWidth: 2,
          borderColor: '#fff',
          borderRadius: 16,
        }}
      />
      {looking ? (
        <View style={{ position: 'absolute', bottom: 120, left: 0, right: 0, alignItems: 'center' }}>
          <ActivityIndicator color="#fff" />
          <Text style={{ color: '#fff', marginTop: 8 }}>Looking up…</Text>
        </View>
      ) : null}
      {notFound ? (
        <View style={{ position: 'absolute', bottom: 120, left: 20, right: 20, alignItems: 'center' }}>
          <Text style={{ color: '#fff', textAlign: 'center' }}>
            Not found in the food database. Try search or manual entry.
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={() => router.back()}
        style={{
          position: 'absolute',
          bottom: 50,
          alignSelf: 'center',
          backgroundColor: 'rgba(255,255,255,0.2)',
          paddingVertical: 12,
          paddingHorizontal: 28,
          borderRadius: 999,
        }}>
        <Text style={{ color: '#fff', fontWeight: '800' }}>Cancel</Text>
      </Pressable>
    </View>
  );
}
