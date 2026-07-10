using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace SathiSOS.API.Hubs;

// No class-level [Authorize] — the dashboard connects without a token and just
// listens for broadcasts. Only driver registration (mobile app) requires auth.
public class SosHub : Hub
{
    private static readonly Dictionary<string, string> DriverConnections = new();

    public override async Task OnConnectedAsync()
    {
        // If a valid JWT was supplied (mobile app), auto-register the driver.
        // If not (dashboard), just connect as a listener — no error.
        var userId = Context.User?.Identity?.IsAuthenticated == true
            ? (Context.UserIdentifier
                ?? Context.User?.FindFirst("sub")?.Value
                ?? Context.User?.FindFirst("nameid")?.Value)
            : null;

        if (!string.IsNullOrEmpty(userId))
        {
            DriverConnections[userId] = Context.ConnectionId;
            Console.WriteLine($"Client connected & auto-registered: {userId} -> {Context.ConnectionId}");
        }
        else
        {
            Console.WriteLine($"Client connected (no auth — likely dashboard): {Context.ConnectionId}");
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var entry = DriverConnections.FirstOrDefault(
            x => x.Value == Context.ConnectionId);
        if (entry.Key != null)
            DriverConnections.Remove(entry.Key);

        Console.WriteLine($"Client disconnected: {Context.ConnectionId}");
        await base.OnDisconnectedAsync(exception);
    }

    // Requires a valid JWT — only the mobile app (authenticated driver) can call this.
    [Authorize]
    public Task RegisterDriver(string driverId)
    {
        DriverConnections[driverId] = Context.ConnectionId;
        Console.WriteLine($"Driver registered: {driverId}");
        return Task.CompletedTask;
    }

    // Called by the dashboard when a hospital accepts an SOS — no auth required for now.
    public async Task ConfirmDispatch(string driverId, string hospitalName, int etaMinutes)
    {
        if (DriverConnections.TryGetValue(driverId, out var connId))
        {
            await Clients.Client(connId).SendAsync("HelpConfirmed", new
            {
                hospitalName,
                etaMinutes,
                message = $"Help from {hospitalName} is on the way! ETA: ~{etaMinutes} min"
            });
        }
        await Clients.All.SendAsync("AlertAccepted", new { driverId, hospitalName, etaMinutes });
    }
}