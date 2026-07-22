import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ModalShell } from '@/components/ModalShell';
import { analyzeVideo } from '@/lib/form';
import { useTheme } from '@/theme';

// expo-camera is native — absent until the dev build includes it.
let CameraView: any = null;
let useCameraPermissions: any = null;
try {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch {
  CameraView = null;
}

export default function Capture() {
  if (!CameraView) return <Unavailable />;
  return <Recorder />;
}

function Unavailable() {
  const { colors } = useTheme();
  return (
    <ModalShell title="Record a Run">
      <View style={{ alignItems: 'center', paddingTop: 40 }}>
        <Ionicons name="hardware-chip-outline" size={40} color={colors.textMuted} />
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>
          Recording needs the camera build
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 }}>
          The camera module ships with the barcode-scanner build. Meanwhile, tap “Try a sample” to
          see the full analysis output.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: 20, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: colors.accent, borderRadius: 12 }}>
          <Text style={{ color: colors.onAccent, fontWeight: '800' }}>Back</Text>
        </Pressable>
      </View>
    </ModalShell>
  );
}

function Recorder() {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const camRef = useRef<any>(null);

  if (!permission?.granted) {
    return (
      <ModalShell title="Record a Run">
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 12 }}>
            Camera access needed
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 }}>
            Set your phone side-on, frame your whole body, and record ~10–15s of steady running.
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

  const toggle = async () => {
    if (!camRef.current) return;
    if (recording) {
      camRef.current.stopRecording();
      return;
    }
    setRecording(true);
    try {
      const video = await camRef.current.recordAsync({ maxDuration: 20 });
      setRecording(false);
      setProcessing(true);
      const id = await analyzeVideo(video?.uri ?? '');
      setProcessing(false);
      if (id) router.replace({ pathname: '/form/[id]', params: { id } });
      else router.back(); // error surfaces on the list screen
    } catch {
      setRecording(false);
      setProcessing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={camRef} style={{ flex: 1 }} mode="video" facing="back" />
      <View style={{ position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
          Side-on · whole body in frame
        </Text>
      </View>
      <View style={{ position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' }}>
        <Pressable
          onPress={toggle}
          disabled={processing}
          style={{
            width: 74,
            height: 74,
            borderRadius: 37,
            borderWidth: 4,
            borderColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <View
            style={{
              width: recording ? 28 : 58,
              height: recording ? 28 : 58,
              borderRadius: recording ? 6 : 29,
              backgroundColor: '#EF4444',
            }}
          />
        </Pressable>
        <Text style={{ color: '#fff', marginTop: 10, fontWeight: '600' }}>
          {processing ? 'Processing…' : recording ? 'Recording — tap to stop' : 'Tap to record'}
        </Text>
      </View>
      <Pressable
        onPress={() => router.back()}
        style={{ position: 'absolute', top: 54, right: 20, padding: 8 }}>
        <Ionicons name="close" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}
