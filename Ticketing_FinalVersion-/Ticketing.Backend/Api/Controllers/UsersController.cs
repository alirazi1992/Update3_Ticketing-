using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ticketing.Backend.Application.Services;
using Ticketing.Backend.Domain.Enums;

namespace Ticketing.Backend.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _userService.GetAllAsync();
        return Ok(users);
    }

    [HttpGet("technicians")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<IActionResult> GetTechnicians()
    {
        var users = await _userService.GetTechniciansAsync();
        return Ok(users);
    }
}
