// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MirrorCaptureMacOS",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "mirror-capture-macos", targets: ["MirrorCaptureMacOS"])
    ],
    targets: [
        .executableTarget(
            name: "MirrorCaptureMacOS",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("ApplicationServices"),
                .linkedFramework("CoreGraphics")
            ]
        )
    ]
)
