using SathiSOS.Domain.Entities;

namespace SathiSOS.Application.Interfaces;

public interface IHospitalRepository
{
    Task<Hospital?> FindNearestAsync(double latitude, double longitude);
    Task<List<Hospital>> GetAllAsync();
}