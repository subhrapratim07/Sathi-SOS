using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SathiSOS.Infrastructure.Persistence;
using SathiSOS.Domain.Entities;
using BCrypt.Net;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AuthController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest req)
    {
        if (await _db.Users.AnyAsync(u => u.Phone == req.Phone))
            return BadRequest("Phone already registered");

        var user = new User
        {
            Name = req.Name,
            Phone = req.Phone,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = req.Role ?? "driver"
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var token = JwtHelper.GenerateToken(user, _config);
        return Ok(new { token, userId = user.Id, name = user.Name });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest req)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Phone == req.Phone);
        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized("Invalid phone or password");

        var token = JwtHelper.GenerateToken(user, _config);
        return Ok(new { token, userId = user.Id, name = user.Name });
    }
}

public record RegisterRequest(string Name, string Phone, string Password, string? Role);
public record LoginRequest(string Phone, string Password);