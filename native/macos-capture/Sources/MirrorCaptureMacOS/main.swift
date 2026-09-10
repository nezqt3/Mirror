import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

private struct HelperCommand: Decodable {
    let command: String
    let sessionId: String?
    let privacy: PrivacyFilters?
    let requiresScreenCapture: Bool?
}

private struct PrivacyFilters: Decodable {
    let blockedApplications: [String]
    let blockedWindowTitleKeywords: [String]
    let blockedDomains: [String]
    let captureWindowTitles: Bool

    static let defaults = PrivacyFilters(
        blockedApplications: [],
        blockedWindowTitleKeywords: [],
        blockedDomains: [],
        captureWindowTitles: true
    )
}

private final class CaptureHelper {
    private let outputQueue = DispatchQueue(label: "ai.mirror.capture.output")
    private let captureQueue = DispatchQueue(label: "ai.mirror.capture.polling")
    private var timer: DispatchSourceTimer?
    private var sessionId: String?
    private var lastApplicationKey: String?
    private var lastHeartbeatAt: Date?
    private var privacy = PrivacyFilters.defaults

    func handle(_ command: HelperCommand) {
        switch command.command {
        case "start":
            guard let sessionId = command.sessionId, UUID(uuidString: sessionId) != nil else {
                emitError(code: "invalid_session", message: "A valid sessionId is required")
                return
            }
            start(sessionId: sessionId, privacy: command.privacy ?? .defaults)
        case "stop":
            stop()
        case "permissions":
            emitStatus(
                "ready",
                permissions: systemPermission(
                    requestAccess: true,
                    requiresScreenCapture: command.requiresScreenCapture ?? false
                )
            )
        case "applications":
            emitInstalledApplications()
        case "ping":
            emitStatus("pong")
        default:
            emitError(code: "unknown_command", message: "Unsupported command: \(command.command)")
        }
    }

    func emitReady() {
        emitStatus("ready", permissions: systemPermission())
    }

    private func start(sessionId: String, privacy: PrivacyFilters) {
        stop(emitStatusMessage: false)
        self.sessionId = sessionId
        self.privacy = privacy
        lastApplicationKey = nil
        lastHeartbeatAt = nil

        let timer = DispatchSource.makeTimerSource(queue: captureQueue)
        timer.schedule(deadline: .now(), repeating: .milliseconds(750), leeway: .milliseconds(100))
        timer.setEventHandler { [weak self] in
            self?.captureFrontmostApplication()
        }
        self.timer = timer
        timer.resume()
        emitStatus("started", permissions: systemPermission())
    }

    private func stop(emitStatusMessage: Bool = true) {
        timer?.setEventHandler {}
        timer?.cancel()
        timer = nil
        sessionId = nil
        lastApplicationKey = nil
        lastHeartbeatAt = nil
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
        emitHeartbeatIfNeeded(
            sessionId: sessionId,
            processIdentifier: application.processIdentifier
        )
        let key = "\(bundleIdentifier)|\(windowTitle ?? "")"
        guard key != lastApplicationKey else { return }
        lastApplicationKey = key

        let blockedApplication = privacy.blockedApplications.contains { candidate in
            normalized(candidate) == normalized(applicationName) ||
                normalized(candidate) == normalized(bundleIdentifier)
        }
        let blockedTitle = windowTitle.map { title in
            privacy.blockedWindowTitleKeywords.contains { candidate in
                !normalized(candidate).isEmpty && normalized(title).contains(normalized(candidate))
            }
        } ?? false
        guard !blockedApplication, !blockedTitle else { return }

        var payload: [String: Any] = [
            "applicationName": applicationName,
            "bundleIdentifier": bundleIdentifier,
            "processId": application.processIdentifier
        ]
        if privacy.captureWindowTitles, let windowTitle, !windowTitle.isEmpty {
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

    private func emitHeartbeatIfNeeded(sessionId: String, processIdentifier: pid_t) {
        let now = Date()
        if let lastHeartbeatAt, now.timeIntervalSince(lastHeartbeatAt) < 5 {
            return
        }
        self.lastHeartbeatAt = now
        emit([
            "kind": "event",
            "event": [
                "id": UUID().uuidString.lowercased(),
                "sessionId": sessionId,
                "type": "heartbeat",
                "timestamp": ISO8601DateFormatter.mirror.string(from: now),
                "platform": "macos",
                "source": "swift-capture-helper",
                "payload": [
                    "activeProcessId": processIdentifier,
                    "idle": false
                ]
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

    private func systemPermission(
        requestAccess: Bool = false,
        requiresScreenCapture: Bool = false
    ) -> String {
        var accessibilityGranted = AXIsProcessTrusted()
        if !accessibilityGranted && requestAccess {
            let prompt = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true]
                as CFDictionary
            accessibilityGranted = AXIsProcessTrustedWithOptions(prompt)
        }

        var screenCaptureGranted = !requiresScreenCapture || CGPreflightScreenCaptureAccess()
        if requiresScreenCapture && !screenCaptureGranted && requestAccess {
            screenCaptureGranted = CGRequestScreenCaptureAccess()
        }
        return accessibilityGranted && screenCaptureGranted ? "granted" : "not-determined"
    }

    private func emitInstalledApplications() {
        let fileManager = FileManager.default
        let roots = [
            URL(fileURLWithPath: "/Applications", isDirectory: true),
            fileManager.homeDirectoryForCurrentUser.appendingPathComponent("Applications", isDirectory: true),
            URL(fileURLWithPath: "/System/Applications", isDirectory: true)
        ]
        var seen = Set<String>()
        var applications: [[String: Any]] = []

        for root in roots where fileManager.fileExists(atPath: root.path) {
            guard let enumerator = fileManager.enumerator(
                at: root,
                includingPropertiesForKeys: nil,
                options: [.skipsHiddenFiles, .skipsPackageDescendants]
            ) else { continue }

            for case let url as URL in enumerator where url.pathExtension.lowercased() == "app" {
                let bundle = Bundle(url: url)
                let bundleIdentifier = bundle?.bundleIdentifier
                let name = (bundle?.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String)
                    ?? (bundle?.object(forInfoDictionaryKey: "CFBundleName") as? String)
                    ?? url.deletingPathExtension().lastPathComponent
                let identity = bundleIdentifier ?? url.standardizedFileURL.path
                guard seen.insert(identity).inserted else { continue }
                applications.append([
                    "name": name,
                    "bundleIdentifier": bundleIdentifier ?? NSNull()
                ])
            }
        }

        applications.sort {
            ($0["name"] as? String ?? "").localizedCaseInsensitiveCompare(
                $1["name"] as? String ?? ""
            ) == .orderedAscending
        }
        emit(["kind": "applications", "applications": applications])
    }

    private func normalized(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
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
        let fallback = HelperCommand(
            command: "invalid",
            sessionId: nil,
            privacy: nil,
            requiresScreenCapture: nil
        )
        helper.handle(fallback)
    }
}
