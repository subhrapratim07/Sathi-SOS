public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;   // used as login
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "driver";          // driver | hospital | ambulance
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}