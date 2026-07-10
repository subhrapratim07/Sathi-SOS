using NetTopologySuite.Geometries;

namespace SathiSOS.Domain.Entities;

public class Hospital
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public Point Location { get; set; } = null!;  // GPS point (PostGIS)
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<Ambulance> Ambulances { get; set; } = new List<Ambulance>();
}