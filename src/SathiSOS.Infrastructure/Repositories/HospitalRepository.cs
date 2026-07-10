using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using SathiSOS.Application.Interfaces;
using SathiSOS.Domain.Entities;
using SathiSOS.Infrastructure.Persistence;

namespace SathiSOS.Infrastructure.Repositories;

public class HospitalRepository : IHospitalRepository
{
    private readonly AppDbContext _context;
    public HospitalRepository(AppDbContext context) => _context = context;

    public async Task<Hospital?> FindNearestAsync(double latitude, double longitude)
    {
        var driverLocation = new Point(longitude, latitude) { SRID = 4326 };
        return await _context.Hospitals
            .OrderBy(h => h.Location.Distance(driverLocation))
            .FirstOrDefaultAsync();
    }

    public async Task<List<Hospital>> GetAllAsync()
    {
        return await _context.Hospitals.ToListAsync();
    }
}