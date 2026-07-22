import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
  const [elapsed, setElapsed] = useState(0);
  const camRef = useRef<any>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (recording) {
      setElapsed(0);
      timer.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else if (timer.current) {
      clearInterval(timer.current);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [recording]);

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

  const tooShort = recording && elapsed < 8;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={camRef} style={{ flex: 1 }} mode="video" facing="back" />

      {/* Framing guide: keep head below the top line, feet above the bottom */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
        <View style={{ position: 'absolute', top: '14%', left: '8%', right: '8%', borderTopWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', borderStyle: 'dashed' }} />
        <View style={{ position: 'absolute', bottom: '14%', left: '8%', right: '8%', borderTopWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', borderStyle: 'dashed' }} />
        <View style={{ position: 'absolute', top: '14%', bottom: '14%', left: '8%', width: 1.5, backgroundColor: 'rgba(255,255,255,0.25)' }} />
        <View style={{ position: 'absolute', top: '14%', bottom: '14%', right: '8%', width: 1.5, backgroundColor: 'rgba(255,255,255,0.25)' }} />
        <Text style={{ position: 'absolute', top: '14%', alignSelf: 'center', marginTop: 4, color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700' }}>
          head below
        </Text>
        <Text style={{ position: 'absolute', bottom: '14%', alignSelf: 'center', marginBottom: 4, color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700' }}>
          feet above
        </Text>
      </View>

      {/* Top: guidance or live timer */}
      <View style={{ position: 'absolute', top: 56, left: 0, right: 0, alignItems: 'center' }}>
        {recording ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#EF4444', marginRight: 7 }} />
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>0:{String(elapsed).padStart(2, '0')}</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>Film side-on</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>
              Whole body in frame · good light · 10–15s
            </Text>
          </View>
        )}
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
          {processing
            ? 'Analyzing…'
            : tooShort
              ? `Keep going — ${8 - elapsed}s more`
              : recording
                ? 'Tap to stop'
                : 'Tap to record'}
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
