import AVFoundation
import Darwin
import Foundation

func verify(path: String, width: Int, height: Int, duration: Double) async throws {
    let url = URL(fileURLWithPath: path)
    let asset = AVURLAsset(url: url)
    let seconds = try await asset.load(.duration).seconds
    let videoTracks = try await asset.loadTracks(withMediaType: .video)
    let audioTracks = try await asset.loadTracks(withMediaType: .audio)
    guard videoTracks.count == 1, audioTracks.count == 1,
          let video = videoTracks.first, let audio = audioTracks.first else {
        throw VerificationError("Expected one video track and one audio track")
    }
    let size = try await video.load(.naturalSize)
    let fps = try await video.load(.nominalFrameRate)
    let videoFormat = try await video.load(.formatDescriptions).first
    let audioFormat = try await audio.load(.formatDescriptions).first
    let audioDescription = audioFormat.flatMap { CMAudioFormatDescriptionGetStreamBasicDescription($0)?.pointee }
    guard seconds.isFinite, abs(seconds - duration) < 0.001,
          size.width == CGFloat(width), size.height == CGFloat(height),
          abs(fps - 30) < 0.001,
          videoFormat.map({ CMFormatDescriptionGetMediaSubType($0) }) == kCMVideoCodecType_H264,
          audioFormat.map({ CMFormatDescriptionGetMediaSubType($0) }) == kAudioFormatMPEG4AAC,
          audioDescription?.mSampleRate == 48_000,
          audioDescription?.mChannelsPerFrame == 2 else {
        throw VerificationError("Unexpected MP4 properties: \(seconds) s, \(size), \(fps) fps, \(String(describing: audioDescription))")
    }
    let atoms = videoFormat.flatMap {
        CMFormatDescriptionGetExtension($0, extensionKey: kCMFormatDescriptionExtension_SampleDescriptionExtensionAtoms)
    } as? [String: Data]
    guard let avc = atoms?["avcC"], avc.count >= 4, avc[1] == 100 else {
        throw VerificationError("Expected H.264 High profile")
    }
    let bytes = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
    print("PASS \(bytes) bytes, \(String(format: "%.3f", seconds)) s, \(width)x\(height), \(fps) fps, H.264 High, AAC 48 kHz stereo")
}

struct VerificationError: LocalizedError {
    let errorDescription: String?

    init(_ message: String) { errorDescription = message }
}

let args = CommandLine.arguments
guard args.count == 5, let width = Int(args[2]), let height = Int(args[3]),
      let duration = Double(args[4]) else {
    fputs("Usage: swift verify.swift FILE WIDTH HEIGHT SECONDS\n", stderr)
    exit(2)
}
do {
    try await verify(path: args[1], width: width, height: height, duration: duration)
} catch {
    fputs("Verification failed: \(error.localizedDescription)\n", stderr)
    exit(1)
}
