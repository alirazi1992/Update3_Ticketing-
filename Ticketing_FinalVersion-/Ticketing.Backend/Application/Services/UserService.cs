using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Ticketing.Backend.Application.DTOs;
using Ticketing.Backend.Domain.Entities;
using Ticketing.Backend.Domain.Enums;
using Ticketing.Backend.Infrastructure.Auth;
using Ticketing.Backend.Infrastructure.Data;

namespace Ticketing.Backend.Application.Services;

public interface IUserService
{
    // Main register method used by AuthController (with creatorRole)
    Task<AuthResponse?> RegisterAsync(RegisterRequest request, UserRole creatorRole);

    // Convenience overload (self-register: treated as Client)
    Task<AuthResponse?> RegisterAsync(RegisterRequest request);

    Task<AuthResponse?> LoginAsync(LoginRequest request);
    Task<UserDto?> GetByIdAsync(Guid id);
    Task<IEnumerable<UserDto>> GetAllAsync();
    Task<IEnumerable<UserDto>> GetTechniciansAsync();
    Task<UserDto?> UpdateProfileAsync(Guid userId, UpdateProfileRequest request);
    Task<bool> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword);
}

public class UserService : IUserService
{
    private readonly AppDbContext _context;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IPasswordHasher<User> _passwordHasher;

    public UserService(
        AppDbContext context,
        IJwtTokenGenerator jwtTokenGenerator,
        IPasswordHasher<User> passwordHasher)
    {
        _context = context;
        _jwtTokenGenerator = jwtTokenGenerator;
        _passwordHasher = passwordHasher;
    }

    /// <summary>
    /// ساده‌ترین حالت: هر کسی از بیرون ثبت‌نام کند → Client
    /// (برای سناریوهایی که creatorRole مهم نیست)
    /// </summary>
    public Task<AuthResponse?> RegisterAsync(RegisterRequest request)
    {
        // برای self-register از سمت سایت
        return RegisterAsync(request, UserRole.Client);
    }

    /// <summary>
    /// متد اصلی ثبت‌نام با در نظر گرفتن نقش سازنده (creatorRole)
    /// - اگر هیچ یوزری در سیستم نباشد → اولین یوزر Admin می‌شود (bootstrap)
    /// - اگر Creator ادمین باشد → می‌تواند Technician / Admin بسازد
    /// - اگر Creator ادمین نباشد → همیشه کاربر جدید Client می‌شود
    /// </summary>
    public async Task<AuthResponse?> RegisterAsync(RegisterRequest request, UserRole creatorRole)
    {
        var normalizedEmail = request.Email.ToLowerInvariant();

        // 1) اگر ایمیل تکراری است، رد کن
        var exists = await _context.Users.AnyAsync(u => u.Email == normalizedEmail);
        if (exists)
        {
            // AuthController وقتی null بگیرد، 403 یا 409 برمی‌گرداند
            return null;
        }

        // 2) آیا این اولین یوزر سیستم است؟
        var hasAnyUsers = await _context.Users.AnyAsync();

        UserRole effectiveRole;

        if (!hasAnyUsers)
        {
            // 🔥 بوت‌استرپ: اولین یوزر سیستم همیشه Admin می‌شود
            effectiveRole = UserRole.Admin;
        }
        else
        {
            // بعد از اولین یوزر:
            // اگر سازنده Admin است → می‌تواند نقش را تعیین کند
            // اگر سازنده Admin نیست → همیشه Client
            effectiveRole = creatorRole == UserRole.Admin
                ? request.Role
                : UserRole.Client;
        }

        // 3) ساختن یوزر جدید
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = request.FullName,
            Email = normalizedEmail,
            Role = effectiveRole,
            PhoneNumber = request.PhoneNumber,
            Department = request.Department,
            CreatedAt = DateTime.UtcNow
        };

        // 4) هش کردن پسورد
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // 5) ساختن توکن + DTO
        return new AuthResponse
        {
            Token = _jwtTokenGenerator.GenerateToken(user),
            User = MapToDto(user)
        };
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var normalizedEmail = request.Email.ToLowerInvariant();

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail);

        if (user == null)
        {
            return null;
        }

        var verifyResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verifyResult == PasswordVerificationResult.Failed)
        {
            return null;
        }

        return new AuthResponse
        {
            Token = _jwtTokenGenerator.GenerateToken(user),
            User = MapToDto(user)
        };
    }

    public async Task<UserDto?> GetByIdAsync(Guid id)
    {
        var user = await _context.Users.FindAsync(id);
        return user == null ? null : MapToDto(user);
    }

    public async Task<IEnumerable<UserDto>> GetAllAsync()
    {
        return await _context.Users
            .OrderBy(u => u.FullName)
            .Select(u => MapToDto(u))
            .ToListAsync();
    }

    public async Task<IEnumerable<UserDto>> GetTechniciansAsync()
    {
        return await _context.Users
            .Where(u => u.Role == UserRole.Technician)
            .OrderBy(u => u.FullName)
            .Select(u => MapToDto(u))
            .ToListAsync();
    }

    public async Task<UserDto?> UpdateProfileAsync(Guid userId, UpdateProfileRequest request)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var normalizedEmail = request.Email.ToLowerInvariant();
            var emailInUse = await _context.Users.AnyAsync(u => u.Email == normalizedEmail && u.Id != userId);
            if (emailInUse)
            {
                return null;
            }

            user.Email = normalizedEmail;
        }

        if (!string.IsNullOrWhiteSpace(request.FullName))
        {
            user.FullName = request.FullName;
        }

        if (request.PhoneNumber != null)
        {
            user.PhoneNumber = request.PhoneNumber;
        }

        if (request.Department != null)
        {
            user.Department = request.Department;
        }

        if (request.AvatarUrl != null)
        {
            user.AvatarUrl = request.AvatarUrl;
        }

        await _context.SaveChangesAsync();
        return MapToDto(user);
    }

    public async Task<bool> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            return false;
        }

        var verifyResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, currentPassword);
        if (verifyResult == PasswordVerificationResult.Failed)
        {
            return false;
        }

        user.PasswordHash = _passwordHasher.HashPassword(user, newPassword);
        await _context.SaveChangesAsync();
        return true;
    }

    private static UserDto MapToDto(User user) => new()
    {
        Id = user.Id,
        FullName = user.FullName,
        Email = user.Email,
        Role = user.Role,
        PhoneNumber = user.PhoneNumber,
        Department = user.Department,
        AvatarUrl = user.AvatarUrl
    };
}
