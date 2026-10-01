import AppKit

// Run from the repository root on macOS to regenerate the native banana emoji icons.
for size in [32, 180] {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    NSColor(srgbRed: 16/255, green: 24/255, blue: 19/255, alpha: 1).setFill()
    NSBezierPath(rect: NSRect(x: 0, y: 0, width: size, height: size)).fill()
    let text = NSAttributedString(string: "🍌", attributes: [.font: NSFont(name: "Apple Color Emoji", size: CGFloat(size) * 0.72)!])
    let bounds = text.size()
    text.draw(at: NSPoint(x: (CGFloat(size)-bounds.width)/2, y: (CGFloat(size)-bounds.height)/2))
    NSGraphicsContext.restoreGraphicsState()
    let name = size == 180 ? "apple-touch-icon.png" : "favicon-32.png"
    try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "assets/" + name))
}
