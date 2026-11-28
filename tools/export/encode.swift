import AVFoundation
import CoreGraphics
import CoreVideo
import Darwin
import Foundation
import ImageIO

struct ExportError: LocalizedError {
    let errorDescription: String?

    init(_ message: String) { errorDescription = message }
}

func makeFrame(_ url: URL, pool: CVPixelBufferPool, width: Int, height: Int) throws -> CVPixelBuffer {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
          image.width == width, image.height == height else {
        throw ExportError("Invalid frame or dimensions: \(url.lastPathComponent)")
    }

    var buffer: CVPixelBuffer?
    guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer) == kCVReturnSuccess,
          let buffer else {
        throw ExportError("Could not allocate a pixel buffer")
    }
    guard CVPixelBufferLockBaseAddress(buffer, []) == kCVReturnSuccess else {
        throw ExportError("Could not lock the pixel buffer")
    }
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    let bitmapInfo = CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.noneSkipFirst.rawValue
    guard let context = CGContext(
        data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height,
        bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
        space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: bitmapInfo
    ) else {
        throw ExportError("Could not create a frame drawing context")
    }
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return buffer
}

func encode(directory: URL, destination: URL, width: Int, height: Int, count: Int) async throws {
    let writer = try AVAssetWriter(outputURL: destination, fileType: .mp4)
    writer.shouldOptimizeForNetworkUse = true
    let video = AVAssetWriterInput(mediaType: .video, outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [
            AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
            AVVideoAverageBitRateKey: 14_000_000,
            AVVideoExpectedSourceFrameRateKey: 30,
        ],
    ])
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: video, sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
        kCVPixelBufferCGImageCompatibilityKey as String: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
    ])
    let audio = AVAssetWriterInput(mediaType: .audio, outputSettings: [
        AVFormatIDKey: kAudioFormatMPEG4AAC,
        AVSampleRateKey: 48_000,
        AVNumberOfChannelsKey: 2,
        AVEncoderBitRateKey: 256_000,
    ])
    guard writer.canAdd(video) else { throw ExportError("AVAssetWriter rejected the H.264 video input") }
    writer.add(video)
    guard writer.canAdd(audio) else { throw ExportError("AVAssetWriter rejected the AAC audio input") }
    writer.add(audio)

    let wav = AVURLAsset(url: directory.appendingPathComponent("audio.wav"))
    guard let track = try await wav.loadTracks(withMediaType: .audio).first else {
        throw ExportError("The exported WAV has no audio track")
    }
    let end = CMTime(value: Int64(count), timescale: 30)
    let reader = try AVAssetReader(asset: wav)
    reader.timeRange = CMTimeRange(start: .zero, duration: end)
    let pcm = AVAssetReaderTrackOutput(track: track, outputSettings: [
        AVFormatIDKey: kAudioFormatLinearPCM,
        AVLinearPCMBitDepthKey: 16,
        AVLinearPCMIsFloatKey: false,
        AVLinearPCMIsBigEndianKey: false,
        AVLinearPCMIsNonInterleaved: false,
    ])
    pcm.alwaysCopiesSampleData = false
    guard reader.canAdd(pcm) else { throw ExportError("Could not read WAV as PCM") }
    reader.add(pcm)
    guard reader.startReading() else { throw reader.error ?? ExportError("WAV reader failed") }
    guard writer.startWriting() else { throw writer.error ?? ExportError("MP4 writer failed") }
    writer.startSession(atSourceTime: .zero)
    defer {
        if writer.status == .writing { writer.cancelWriting() }
        if reader.status == .reading { reader.cancelReading() }
    }
    guard let pool = adaptor.pixelBufferPool else { throw ExportError("Missing pixel buffer pool") }

    var frame = 0
    var audioFinished = false
    var wroteAudio = false
    var lastProgress = ProcessInfo.processInfo.systemUptime
    while frame < count || !audioFinished {
        guard writer.status == .writing else {
            throw writer.error ?? ExportError("MP4 writer stopped unexpectedly")
        }
        var progressed = false
        if frame < count && video.isReadyForMoreMediaData {
            try autoreleasepool {
                let file = directory.appendingPathComponent(String(format: "%06d.jpg", frame))
                let buffer = try makeFrame(file, pool: pool, width: width, height: height)
                guard adaptor.append(buffer, withPresentationTime: CMTime(value: Int64(frame), timescale: 30)) else {
                    throw writer.error ?? ExportError("Could not append video frame \(frame)")
                }
            }
            frame += 1
            print("Encode \(frame)/\(count)")
            fflush(stdout)
            if frame == count { video.markAsFinished() }
            progressed = true
        }
        if !audioFinished && audio.isReadyForMoreMediaData {
            if let sample = pcm.copyNextSampleBuffer() {
                guard audio.append(sample) else {
                    throw writer.error ?? ExportError("Could not append audio")
                }
                wroteAudio = true
            } else {
                guard reader.status == .completed, wroteAudio else {
                    throw reader.error ?? ExportError("WAV contains no readable audio samples")
                }
                audio.markAsFinished()
                audioFinished = true
            }
            progressed = true
        }
        if progressed {
            lastProgress = ProcessInfo.processInfo.systemUptime
        } else {
            guard ProcessInfo.processInfo.systemUptime - lastProgress < 60 else {
                throw ExportError("MP4 encoder stopped accepting samples")
            }
            try await Task.sleep(nanoseconds: 2_000_000)
        }
    }

    writer.endSession(atSourceTime: end)
    await writer.finishWriting()
    guard writer.status == .completed else {
        throw writer.error ?? ExportError("MP4 writer could not finalize")
    }
}

@main
struct Encoder {
    static func main() async {
        let args = CommandLine.arguments
        guard args.count == 6, let width = Int(args[3]), let height = Int(args[4]),
              let count = Int(args[5]), width > 0, height > 0, count > 0 else {
            fputs("Usage: encode FRAME_DIRECTORY OUTPUT WIDTH HEIGHT FRAME_COUNT\n", stderr)
            exit(2)
        }
        do {
            try await encode(directory: URL(fileURLWithPath: args[1]),
                             destination: URL(fileURLWithPath: args[2]),
                             width: width, height: height, count: count)
        } catch {
            fputs("Encoder failed: \(error.localizedDescription)\n", stderr)
            exit(1)
        }
    }
}
