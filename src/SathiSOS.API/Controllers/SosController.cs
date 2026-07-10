using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using NetTopologySuite.Geometries;
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

            var driverPoint = new Point(request.Longitude, request.Latitude) { SRID = 4326 };
            var distanceMeters = nearest.Location.Distance(driverPoint);
            var distanceKm = distanceMeters / 1000.0;
            var etaMinutes = (int)Math.Ceiling((distanceKm / 40.0) * 60);

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

            Console.WriteLine($"SOS broadcast — Hospital: {nearest.Name}, ETA: {etaMinutes} min");

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
}