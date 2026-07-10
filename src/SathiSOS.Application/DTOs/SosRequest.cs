namespace SathiSOS.Application.DTOs;

public class SosRequest
{
    public string DriverId { get; set; }
    public string DriverName { get; set; } = "Unknown Driver";
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double GForce { get; set; }
    public double Speed { get; set; }
    public string DetectionNote { get; set; } = "";
}

public class SosResponse
{
    public bool Success { get; set; }
    public string NearestHospital { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public double DistanceMeters { get; set; }
    public int EtaMinutes { get; set; }
}

public class LocationUpdate
{
    public Guid DriverId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double Speed { get; set; }
}

public class AcceptRequest
{
    public string DriverId { get; set; } = string.Empty;
    public string HospitalName { get; set; } = string.Empty;
    public int EtaMinutes { get; set; }
}