using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Ticketing.Backend.Application.DTOs;
using Ticketing.Backend.Application.Services;
using Ticketing.Backend.Domain.Enums;
using Ticketing.Backend.Infrastructure.Data;

namespace Ticketing.Backend.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IUserService _userService;

    public AuthController(IUserService userService)
    {
        _userService = userService;
    }

    // ------------------------------
    // DEBUG: لیست یوزرها برای تست لاگین
    // ------------------------------
    [HttpGet("debug-users")]
    [AllowAnonymous]
    public async Task<IActionResult> GetDebugUsers([FromServices] AppDbContext context)
    {
        var users = await context.Users
            .Select(u => new
            {
                u.Email,
                u.FullName,
                Role = u.Role.ToString(),
                u.Department
            })
            .ToListAsync();

        return Ok(users);
    }

    // ------------------------------
    // Register
    // Anonymous → فقط Client
    // Authenticated Admin → می‌تواند Technician / Admin بسازد
    // ------------------------------
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        // اگر توکن داشته باشد، نقش caller را از Claim می‌خوانیم
        var callerRole = User.Identity?.IsAuthenticated == true
            ? Enum.Parse<UserRole>(User.FindFirstValue(ClaimTypes.Role) ?? nameof(UserRole.Client))
            : UserRole.Client;

        var response = await _userService.RegisterAsync(request, callerRole);

        if (response == null)
        {
            // این حالت یعنی:
            // 1) ایمیل تکراری است
            // 2) یا caller مجوز ساخت نقش غیر از Client را ندارد
            return Conflict("Unable to register user. Email may already be in use or you are not allowed to create this role.");
        }

        return Ok(response);
    }

    // ------------------------------
    // Login
    // ------------------------------
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var response = await _userService.LoginAsync(request);
        if (response == null)
        {
            return Unauthorized("Invalid email or password.");
        }

        return Ok(response);
    }

    // ------------------------------
    // Me
    // ------------------------------
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> Me()
    {
        // ما انتظار داریم Claim اصلی، NameIdentifier = User.Id باشد
        var idValue =
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue(ClaimTypes.Email);

        if (!Guid.TryParse(idValue, out var userId))
        {
            return Unauthorized();
        }

        var user = await _userService.GetByIdAsync(userId);
        if (user == null)
        {
            return NotFound();
        }

        return Ok(user);
    }

    // ------------------------------
    // Update Profile
    // ------------------------------
    [HttpPut("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var idValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(idValue, out var userId))
        {
            return Unauthorized();
        }

        var user = await _userService.UpdateProfileAsync(userId, request);
        if (user == null)
        {
            return Conflict("Unable to update profile with the provided information.");
        }

        return Ok(user);
    }

    // ------------------------------
    // Change Password
    // ------------------------------
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var idValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(idValue, out var userId))
        {
            return Unauthorized();
        }

        var updated = await _userService.ChangePasswordAsync(userId, request.CurrentPassword, request.NewPassword);
        if (!updated)
        {
            return BadRequest("Password could not be updated.");
        }

        return NoContent();
    }
}
