using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using SathiSOS.API.Hubs;
using SathiSOS.Application.DTOs;
using SathiSOS.Application.Interfaces;
using System.Security.Claims;

namespace SathiSOS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SosController : ControllerBase
{
    private readonly IHospitalRepository _hospitals;
    private readonly IHubContext<SosHub> _hub;

    public SosController(IHospitalRepository hospitals, IHubContext<SosHub> hub)
    {
        _hospitals = hospitals;
        _hub = hub;
    }

    // 1 — TRIGGER SOS (requires logged-in driver)
    [Authorize]
    [HttpPost]
    public async Task<ActionResult<SosResponse>> TriggerSos([FromBody] SosRequest request)
    {
        try
        {
            var userId   = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userName = User.FindFirstValue(ClaimTypes.Name);

            Console.WriteLine($"SOS — Driver: {userName} ({userId}), G: {request.GForce}, Speed: {request.Speed} km/h");
            Console.WriteLine($"Note: {request.DetectionNote}");

            var nearest = await _hospitals.FindNearestAsync(
                request.Latitude, request.Longitude);

            if (nearest == null)
                return NotFound(new SosResponse
                {
                    Success = false,
                    Message = "No hospitals found nearby."
                });

            // ✅ FIXED: real-world distance via Haversine formula (meters), not raw geometry .Distance()
            var distanceMeters = HaversineDistanceMeters(
                request.Latitude, request.Longitude,
                nearest.Location.Y, nearest.Location.X  // Y = latitude, X = longitude
            );
            var distanceKm = distanceMeters / 1000.0;
            var etaMinutes = Math.Max(1, (int)Math.Ceiling((distanceKm / 40.0) * 60));

            await _hub.Clients.All.SendAsync("SosReceived", new
            {
                driverId        = userId,
                driverName      = userName,
                latitude        = request.Latitude,
                longitude       = request.Longitude,
                gForce          = request.GForce,
                speed           = request.Speed,
                detectionNote   = request.DetectionNote,
                nearestHospital = nearest.Name,
                hospitalAddress = nearest.Address,
                etaMinutes      = etaMinutes,
                distanceMeters  = distanceMeters,
                timestamp       = DateTime.UtcNow
            });

            Console.WriteLine($"SOS broadcast — Hospital: {nearest.Name}, Distance: {distanceKm:F2} km, ETA: {etaMinutes} min");

            return Ok(new SosResponse
            {
                Success         = true,
                NearestHospital = nearest.Name,
                Message         = $"SOS sent to {nearest.Name}. Help is on the way!",
                DistanceMeters  = distanceMeters,
                EtaMinutes      = etaMinutes
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"SOS ERROR: {ex.Message}");
            return StatusCode(500, new SosResponse
            {
                Success = false,
                Message = "Internal server error"
            });
        }
    }

    // 2 — LIVE LOCATION UPDATE (requires logged-in driver)
    [Authorize]
    [HttpPost("location")]
    public async Task<IActionResult> UpdateLocation([FromBody] LocationUpdate update)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            await _hub.Clients.All.SendAsync("LocationUpdated", new
            {
                driverId  = userId,
                latitude  = update.Latitude,
                longitude = update.Longitude,
                speed     = update.Speed,
                timestamp = DateTime.UtcNow
            });

            return Ok(new { success = true, message = "Location updated" });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"LOCATION ERROR: {ex.Message}");
            return StatusCode(500, new { success = false, message = "Location update failed" });
        }
    }

    // 3 — HOSPITAL ACCEPTS ALERT (public for now — hospital dashboard has no login yet)
    [HttpPost("accept")]
    public async Task<IActionResult> AcceptAlert([FromBody] AcceptRequest request)
    {
        try
        {
            Console.WriteLine($"Accept — Driver: {request.DriverId}, Hospital: {request.HospitalName}");

            await _hub.Clients.All.SendAsync("AlertAccepted", new
            {
                driverId     = request.DriverId,
                hospitalName = request.HospitalName,
                etaMinutes   = request.EtaMinutes
            });

            await _hub.Clients.All.SendAsync("HelpConfirmed", new
            {
                hospitalName = request.HospitalName,
                etaMinutes   = request.EtaMinutes,
                message      = $"Help from {request.HospitalName} is on the way! ETA: ~{request.EtaMinutes} min"
            });

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ACCEPT ERROR: {ex.Message}");
            return StatusCode(500, new { success = false });
        }
    }

    // 4 — GET ALL HOSPITALS (public)
    [HttpGet("hospitals")]
    public async Task<IActionResult> GetHospitals()
    {
        var hospitals = await _hospitals.GetAllAsync();
        return Ok(hospitals.Select(h => new { h.Id, h.Name, h.Address }));
    }

    // 5 — HEALTH CHECK (public)
    [HttpGet("test")]
    public IActionResult Test() =>
        Ok(new { message = "API is working", timestamp = DateTime.UtcNow });

    // ✅ NEW: Haversine great-circle distance calculation (returns meters)
    private static double HaversineDistanceMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371000; // Earth radius in meters
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }
}