using Ticketing.Backend.Domain.Enums;

namespace Ticketing.Backend.Application.DTOs;

// 👇 Default role is Client, so Swagger can omit "role"
public record RegisterRequest(
    string FullName,
    string Email,
    string Password,
    UserRole Role = UserRole.Client,
    string? PhoneNumber = null,
    string? Department = null
);

public record LoginRequest(string Email, string Password);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public class UpdateProfileRequest
{
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Department { get; set; }
    public string? AvatarUrl { get; set; }
}

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public UserDto? User { get; set; }
}

public class UserDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Department { get; set; }
    public string? AvatarUrl { get; set; }
}
