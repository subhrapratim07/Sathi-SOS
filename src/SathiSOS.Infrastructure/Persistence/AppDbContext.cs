using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using SathiSOS.Domain.Entities;

namespace SathiSOS.Infrastructure.Persistence;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Hospital> Hospitals => Set<Hospital>();
    
    public DbSet<Ambulance> Ambulances => Set<Ambulance>();
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Hospital>(e => {
            e.ToTable("hospitals");
            e.Property(h => h.Id).HasColumnName("id");
            e.Property(h => h.Name).HasColumnName("name");
            e.Property(h => h.Address).HasColumnName("address");
            e.Property(h => h.Location).HasColumnName("location")
             .HasColumnType("geography(Point,4326)");
            e.Property(h => h.CreatedAt).HasColumnName("created_at");
        });

        

        modelBuilder.Entity<Ambulance>(e => {
            e.ToTable("ambulances");
            e.Property(a => a.Id).HasColumnName("id");
            e.Property(a => a.HospitalId).HasColumnName("hospital_id");
            e.Property(a => a.PlateNumber).HasColumnName("plate_number");
            e.Property(a => a.IsAvailable).HasColumnName("is_available");
        });

        modelBuilder.Entity<User>(e => {
            e.ToTable("users");
            e.Property(u => u.Id).HasColumnName("id");
            e.Property(u => u.Name).HasColumnName("name");
            e.Property(u => u.Phone).HasColumnName("phone");
            e.Property(u => u.PasswordHash).HasColumnName("password_hash");
            e.Property(u => u.Role).HasColumnName("role");
            e.Property(u => u.CreatedAt).HasColumnName("created_at");
            e.HasIndex(u => u.Phone).IsUnique();
        });
    }
}