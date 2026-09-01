import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

private struct HelperCommand: Decodable {
    let command: String
    let sessionId: String?
}

private final class CaptureHelper {
    private let outputQueue = DispatchQueue(label: "ai.mirror.capture.output")
    private let captureQueue = DispatchQueue(label: "ai.mirror.capture.polling")
    private var timer: DispatchSourceTimer?
    private var sessionId: String?
    private var lastApplicationKey: String?

    func handle(_ command: HelperCommand) {
        switch command.command {
        case "start":
            guard let sessionId = command.sessionId, UUID(uuidString: sessionId) != nil else {
                emitError(code: "invalid_session", message: "A valid sessionId is required")
                return
            }
            start(sessionId: sessionId)
        case "stop":
            stop()
        case "permissions":
            emitStatus("ready", permissions: accessibilityPermission())
        case "ping":
            emitStatus("pong")
        default:
            emitError(code: "unknown_command", message: "Unsupported command: \(command.command)")
        }
    }

    func emitReady() {
        emitStatus("ready", permissions: accessibilityPermission())
    }

    private func start(sessionId: String) {
        stop(emitStatusMessage: false)
        self.sessionId = sessionId
        lastApplicationKey = nil

        let promptOptions = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(promptOptions)

        let timer = DispatchSource.makeTimerSource(queue: captureQueue)
        timer.schedule(deadline: .now(), repeating: .milliseconds(750), leeway: .milliseconds(100))
        timer.setEventHandler { [weak self] in
            self?.captureFrontmostApplication()
        }
        self.timer = timer
        timer.resume()
        emitStatus("started", permissions: accessibilityPermission())
    }

    private func stop(emitStatusMessage: Bool = true) {
        timer?.setEventHandler {}
        timer?.cancel()
        timer = nil
        sessionId = nil
        lastApplicationKey = nil
        if emitStatusMessage {
            emitStatus("stopped")
        }
    }

    private func captureFrontmostApplication() {
        guard
            let sessionId,
            let application = NSWorkspace.shared.frontmostApplication
        else { return }

        let applicationName = application.localizedName ?? "Unknown application"
        let bundleIdentifier = application.bundleIdentifier ?? "unknown"
        let windowTitle = frontmostWindowTitle(processIdentifier: application.processIdentifier)
        let key = "\(bundleIdentifier)|\(windowTitle ?? "")"
        guard key != lastApplicationKey else { return }
        lastApplicationKey = key

        var payload: [String: Any] = [
            "applicationName": applicationName,
            "bundleIdentifier": bundleIdentifier,
            "processId": application.processIdentifier
        ]
        if let windowTitle, !windowTitle.isEmpty {
            payload["windowTitle"] = windowTitle
        }

        emit([
            "kind": "event",
            "event": [
                "id": UUID().uuidString.lowercased(),
                "sessionId": sessionId,
                "type": "application-focus",
                "timestamp": ISO8601DateFormatter.mirror.string(from: Date()),
                "platform": "macos",
                "source": "swift-capture-helper",
                "payload": payload
            ]
        ])
    }

    private func frontmostWindowTitle(processIdentifier: pid_t) -> String? {
        let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
        guard let windows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
            return nil
        }

        return windows.first { window in
            (window[kCGWindowOwnerPID as String] as? pid_t) == processIdentifier &&
                (window[kCGWindowLayer as String] as? Int) == 0
        }?[kCGWindowName as String] as? String
    }

    private func accessibilityPermission() -> String {
        AXIsProcessTrusted() ? "granted" : "not-determined"
    }

    private func emitStatus(_ status: String, permissions: String? = nil) {
        var message: [String: Any] = ["kind": "status", "status": status]
        if let permissions {
            message["permissions"] = permissions
        }
        emit(message)
    }

    private func emitError(code: String, message: String) {
        emit(["kind": "error", "code": code, "message": message])
    }

    private func emit(_ message: [String: Any]) {
        outputQueue.sync {
            guard let data = try? JSONSerialization.data(withJSONObject: message) else { return }
            FileHandle.standardOutput.write(data)
            FileHandle.standardOutput.write(Data([0x0A]))
        }
    }
}

private extension ISO8601DateFormatter {
    static let mirror: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

private let helper = CaptureHelper()
helper.emitReady()

while let line = readLine() {
    guard let data = line.data(using: .utf8) else { continue }
    do {
        helper.handle(try JSONDecoder().decode(HelperCommand.self, from: data))
    } catch {
        let fallback = HelperCommand(command: "invalid", sessionId: nil)
        helper.handle(fallback)
    }
}
