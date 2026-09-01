using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

namespace MirrorCapture.Helper;

internal sealed record HelperCommand(string Command, string? SessionId);

internal sealed class CaptureService : IDisposable
{
    private readonly object outputLock = new();
    private Timer? timer;
    private string? sessionId;
    private string? lastWindowKey;

    public void Handle(HelperCommand command)
    {
        switch (command.Command)
        {
            case "start" when Guid.TryParse(command.SessionId, out _):
                Start(command.SessionId!);
                break;
            case "start":
                Emit(new { kind = "error", code = "invalid_session", message = "A valid sessionId is required" });
                break;
            case "stop":
                Stop();
                break;
            case "permissions":
                EmitStatus("ready", "granted");
                break;
            case "ping":
                EmitStatus("pong");
                break;
            default:
                Emit(new { kind = "error", code = "unknown_command", message = $"Unsupported command: {command.Command}" });
                break;
        }
    }

    public void EmitReady() => EmitStatus("ready", "granted");

    private void Start(string newSessionId)
    {
        Stop(emitStatus: false);
        sessionId = newSessionId;
        lastWindowKey = null;
        timer = new Timer(_ => CaptureForegroundWindow(), null, TimeSpan.Zero, TimeSpan.FromMilliseconds(750));
        EmitStatus("started", "granted");
    }

    private void Stop(bool emitStatus = true)
    {
        timer?.Dispose();
        timer = null;
        sessionId = null;
        lastWindowKey = null;
        if (emitStatus) EmitStatus("stopped");
    }

    private void CaptureForegroundWindow()
    {
        var currentSessionId = sessionId;
        if (currentSessionId is null) return;

        var handle = NativeMethods.GetForegroundWindow();
        if (handle == IntPtr.Zero) return;

        NativeMethods.GetWindowThreadProcessId(handle, out var processId);
        var titleLength = NativeMethods.GetWindowTextLength(handle);
        var title = new StringBuilder(titleLength + 1);
        _ = NativeMethods.GetWindowText(handle, title, title.Capacity);

        string processName;
        try
        {
            processName = Process.GetProcessById((int)processId).ProcessName;
        }
        catch
        {
            processName = "Unknown application";
        }

        var windowTitle = title.ToString();
        var key = $"{processId}|{windowTitle}";
        if (key == lastWindowKey) return;
        lastWindowKey = key;

        Emit(new
        {
            kind = "event",
            @event = new
            {
                id = Guid.NewGuid().ToString(),
                sessionId = currentSessionId,
                type = "application-focus",
                timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'"),
                platform = "windows",
                source = "dotnet-capture-helper",
                payload = new { applicationName = processName, processId, windowTitle }
            }
        });
    }

    private void EmitStatus(string status, string? permissions = null)
    {
        if (permissions is null)
        {
            Emit(new { kind = "status", status });
            return;
        }

        Emit(new { kind = "status", status, permissions });
    }

    private void Emit(object message)
    {
        lock (outputLock)
        {
            Console.Out.WriteLine(JsonSerializer.Serialize(message));
            Console.Out.Flush();
        }
    }

    public void Dispose() => Stop(emitStatus: false);
}

internal static class NativeMethods
{
    [DllImport("user32.dll")]
    internal static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    internal static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

    [DllImport("user32.dll", EntryPoint = "GetWindowTextLengthW", CharSet = CharSet.Unicode)]
    internal static extern int GetWindowTextLength(IntPtr window);

    [DllImport("user32.dll", EntryPoint = "GetWindowTextW", CharSet = CharSet.Unicode)]
    internal static extern int GetWindowText(IntPtr window, StringBuilder text, int maximumCount);
}

internal static class Program
{
    private static void Main()
    {
        using var service = new CaptureService();
        service.EmitReady();

        string? line;
        while ((line = Console.ReadLine()) is not null)
        {
            try
            {
                var command = JsonSerializer.Deserialize<HelperCommand>(line, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
                if (command is not null) service.Handle(command);
            }
            catch (JsonException exception)
            {
                Console.Error.WriteLine($"Invalid command: {exception.Message}");
            }
        }
    }
}
