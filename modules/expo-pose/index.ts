import { requireNativeModule } from 'expo-modules-core';

// Native only (iOS). Absent on web / Expo Go / before the native build — the
// require throws and we degrade honestly rather than crash.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let native: any = null;
try {
  native = requireNativeModule('ExpoPose');
} catch {
  native = null;
}

export const isPoseAvailable = () => native != null;

export interface RawPose {
  /** frames[frameIndex][jointIndex 0..16] = [x, y, score], normalized, y-down. */
  frames: number[][][];
  fps: number;
}

/** Extract a COCO-17 pose keypoint series from a recorded video (Apple Vision). */
export async function extractPose(uri: string, fps = 15): Promise<RawPose> {
  if (!native) throw new Error('Pose module unavailable — needs the native build.');
  return native.extractPose(uri, fps);
}
