namespace SathiSOS.Domain.Entities;

public class Ambulance
{
    public Guid Id { get; set; }
    public Guid HospitalId { get; set; }
    public string PlateNumber { get; set; } = string.Empty;
    public bool IsAvailable { get; set; } = true;

    // Navigation
    public Hospital Hospital { get; set; } = null!;
}