import AVFoundation
import CoreGraphics
import ExpoModulesCore
import Vision

public class ExpoPoseModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoPose")

    // Extract a COCO-17 keypoint series from a recorded video via Apple's
    // on-device body-pose model. Returns { frames: [[[x,y,score]]], fps }.
    AsyncFunction("extractPose") { (uri: String, targetFps: Double) async throws -> [String: Any] in
      try await ExpoPoseModule.extract(uri: uri, targetFps: targetFps > 0 ? targetFps : 15)
    }
  }

  // COCO-17 order, mapped to Vision's body joint names.
  private static let jointOrder: [VNHumanBodyPoseObservation.JointName] = [
    .nose, .leftEye, .rightEye, .leftEar, .rightEar,
    .leftShoulder, .rightShoulder, .leftElbow, .rightElbow,
    .leftWrist, .rightWrist, .leftHip, .rightHip,
    .leftKnee, .rightKnee, .leftAnkle, .rightAnkle,
  ]

  private static func extract(uri: String, targetFps: Double) async throws -> [String: Any] {
    guard let url = URL(string: uri) else {
      throw Exception(name: "ExpoPose", description: "Invalid video URI")
    }

    let asset = AVURLAsset(url: url)
    let duration = try await asset.load(.duration)
    let durationSeconds = CMTimeGetSeconds(duration)
    guard durationSeconds > 0.5 else {
      throw Exception(name: "ExpoPose", description: "Clip too short to analyze")
    }

    // Upright display dimensions, so the overlay can map normalized keypoints
    // onto the displayed video frame exactly.
    var displayW = 0.0
    var displayH = 0.0
    if let track = try await asset.loadTracks(withMediaType: .video).first {
      let natural = try await track.load(.naturalSize)
      let transform = try await track.load(.preferredTransform)
      let sized = natural.applying(transform)
      displayW = abs(Double(sized.width))
      displayH = abs(Double(sized.height))
    }

    let generator = AVAssetImageGenerator(asset: asset)
    generator.appliesPreferredTrackTransform = true
    generator.requestedTimeToleranceBefore = .zero
    generator.requestedTimeToleranceAfter = .zero
    generator.maximumSize = CGSize(width: 720, height: 1280)

    let step = 1.0 / targetFps
    let maxFrames = 300
    var frames: [[[Double]]] = []
    var t = 0.0
    var count = 0

    while t < durationSeconds && count < maxFrames {
      let time = CMTime(seconds: t, preferredTimescale: 600)
      var frame = [[Double]](repeating: [0.0, 0.0, 0.0], count: 17)

      if let cgImage = try? generator.copyCGImage(at: time, actualTime: nil) {
        let request = VNDetectHumanBodyPoseRequest()
        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:])
        try? handler.perform([request])
        if let obs = request.results?.first,
           let points = try? obs.recognizedPoints(.all) {
          for (i, joint) in jointOrder.enumerated() {
            if let p = points[joint], p.confidence > 0.05 {
              // Vision is normalized, origin bottom-left; flip Y to top-left.
              frame[i] = [Double(p.location.x), Double(1.0 - p.location.y), Double(p.confidence)]
            }
          }
        }
      }

      frames.append(frame)
      t += step
      count += 1
    }

    return [
      "frames": frames,
      "fps": targetFps,
      "duration": durationSeconds,
      "width": displayW,
      "height": displayH,
    ]
  }
}
