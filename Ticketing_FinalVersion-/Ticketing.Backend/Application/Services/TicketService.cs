using Microsoft.EntityFrameworkCore;
using Ticketing.Backend.Application.DTOs;
using Ticketing.Backend.Domain.Entities;
using Ticketing.Backend.Domain.Enums;
using Ticketing.Backend.Infrastructure.Data;

namespace Ticketing.Backend.Application.Services;

public interface ITicketService
{
    Task<IEnumerable<TicketResponse>> GetTicketsAsync(Guid userId, UserRole role, TicketStatus? status, TicketPriority? priority, Guid? assignedTo, Guid? createdBy, string? search);
    Task<TicketResponse?> GetTicketAsync(Guid id, Guid userId, UserRole role);
    Task<TicketResponse?> CreateTicketAsync(Guid userId, TicketCreateRequest request);
    Task<TicketResponse?> UpdateTicketAsync(Guid id, Guid userId, UserRole role, TicketUpdateRequest request);
    Task<TicketResponse?> AssignTicketAsync(Guid id, Guid technicianId);
    Task<IEnumerable<TicketMessageDto>> GetMessagesAsync(Guid ticketId, Guid userId, UserRole role);
    Task<TicketMessageDto?> AddMessageAsync(Guid ticketId, Guid authorId, string message, TicketStatus? status = null);
}

public class TicketService : ITicketService
{
    private readonly AppDbContext _context;
    private readonly INotificationService _notificationService;

    public TicketService(AppDbContext context, INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    public async Task<IEnumerable<TicketResponse>> GetTicketsAsync(Guid userId, UserRole role, TicketStatus? status, TicketPriority? priority, Guid? assignedTo, Guid? createdBy, string? search)
    {
        // Start building a query with all the relationships we need for mapping
        var query = _context.Tickets
            .Include(t => t.Category)
            .Include(t => t.Subcategory)
            .Include(t => t.CreatedByUser)
            .Include(t => t.AssignedToUser)
            .AsQueryable();

        // Restrict tickets based on role
        query = role switch
        {
            UserRole.Client => query.Where(t => t.CreatedByUserId == userId),
            UserRole.Technician => query.Where(t => t.AssignedToUserId == userId),
            _ => query
        };

        if (status.HasValue)
        {
            query = query.Where(t => t.Status == status.Value);
        }
        if (priority.HasValue)
        {
            query = query.Where(t => t.Priority == priority.Value);
        }
        if (assignedTo.HasValue)
        {
            query = query.Where(t => t.AssignedToUserId == assignedTo.Value);
        }
        if (createdBy.HasValue)
        {
            query = query.Where(t => t.CreatedByUserId == createdBy.Value);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(t => t.Title.Contains(search) || t.Description.Contains(search));
        }

        var tickets = await query.OrderByDescending(t => t.CreatedAt).ToListAsync();
        return tickets.Select(MapToResponse);
    }

    public async Task<TicketResponse?> GetTicketAsync(Guid id, Guid userId, UserRole role)
    {
        var ticket = await _context.Tickets
            .Include(t => t.Category)
            .Include(t => t.Subcategory)
            .Include(t => t.CreatedByUser)
            .Include(t => t.AssignedToUser)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (ticket == null)
        {
            return null;
        }

        if (role == UserRole.Client && ticket.CreatedByUserId != userId)
        {
            return null;
        }

        if (role == UserRole.Technician && ticket.AssignedToUserId != userId)
        {
            return null;
        }

        return MapToResponse(ticket);
    }

    public async Task<TicketResponse?> CreateTicketAsync(Guid userId, TicketCreateRequest request)
    {
        // Clients create tickets for themselves; the role check happens in the controller
        var ticket = new Ticket
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Description = request.Description,
            CategoryId = request.CategoryId,
            SubcategoryId = request.SubcategoryId,
            Priority = request.Priority,
            Status = TicketStatus.New,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        ticket = await _context.Tickets
            .Include(t => t.Category)
            .Include(t => t.Subcategory)
            .Include(t => t.CreatedByUser)
            .Include(t => t.AssignedToUser)
            .FirstAsync(t => t.Id == ticket.Id);

        return MapToResponse(ticket);
    }

    public async Task<TicketResponse?> UpdateTicketAsync(Guid id, Guid userId, UserRole role, TicketUpdateRequest request)
    {
        var ticket = await _context.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket == null)
        {
            return null;
        }

        // Validate permission rules
        if (role == UserRole.Client && ticket.CreatedByUserId != userId)
        {
            return null;
        }
        if (role == UserRole.Technician && ticket.AssignedToUserId != userId)
        {
            return null;
        }

        if (request.Description != null && role != UserRole.Technician)
        {
            ticket.Description = request.Description;
        }

        if (request.Priority.HasValue && role != UserRole.Technician)
        {
            ticket.Priority = request.Priority.Value;
        }

        if (request.Status.HasValue)
        {
            if (role == UserRole.Client)
            {
                // Clients can only close or set waiting for client on their own tickets
                if (request.Status is TicketStatus.WaitingForClient or TicketStatus.Closed)
                {
                    ticket.Status = request.Status.Value;
                }
            }
            else if (role == UserRole.Technician)
            {
                ticket.Status = request.Status.Value;
            }
            else
            {
                ticket.Status = request.Status.Value;
            }
        }

        if (role == UserRole.Admin)
        {
            if (request.AssignedToUserId.HasValue)
            {
                ticket.AssignedToUserId = request.AssignedToUserId.Value;
            }
            ticket.DueDate = request.DueDate;
        }

        ticket.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return await GetTicketAsync(id, userId, role);
    }

    public async Task<TicketResponse?> AssignTicketAsync(Guid id, Guid technicianId)
    {
        var ticket = await _context.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket == null)
        {
            return null;
        }

        ticket.AssignedToUserId = technicianId;
        ticket.Status = TicketStatus.InProgress;
        ticket.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return await GetTicketAsync(id, technicianId, UserRole.Admin);
    }

    public async Task<IEnumerable<TicketMessageDto>> GetMessagesAsync(Guid ticketId, Guid userId, UserRole role)
    {
        var ticket = await GetTicketAsync(ticketId, userId, role);
        if (ticket == null)
        {
            return Enumerable.Empty<TicketMessageDto>();
        }

        return await _context.TicketMessages
            .Include(m => m.AuthorUser)
            .Where(m => m.TicketId == ticketId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new TicketMessageDto
            {
                Id = m.Id,
                AuthorUserId = m.AuthorUserId,
                AuthorName = m.AuthorUser!.FullName,
                AuthorEmail = m.AuthorUser.Email,
                Message = m.Message,
                CreatedAt = m.CreatedAt,
                Status = m.Status
            })
            .ToListAsync();
    }

    public async Task<TicketMessageDto?> AddMessageAsync(Guid ticketId, Guid authorId, string message, TicketStatus? status = null)
    {
        var ticket = await _context.Tickets.FirstOrDefaultAsync(t => t.Id == ticketId);
        if (ticket == null)
        {
            return null;
        }

        var author = await _context.Users.FirstOrDefaultAsync(u => u.Id == authorId);
        if (author == null)
        {
            return null;
        }

        if (author.Role == UserRole.Client && ticket.CreatedByUserId != authorId)
        {
            return null;
        }

        if (author.Role == UserRole.Technician && ticket.AssignedToUserId != authorId)
        {
            return null;
        }

        if (status.HasValue)
        {
            if (author.Role == UserRole.Client)
            {
                if (status is TicketStatus.WaitingForClient or TicketStatus.Closed)
                {
                    ticket.Status = status.Value;
                }
            }
            else
            {
                ticket.Status = status.Value;
            }
        }

        ticket.UpdatedAt = DateTime.UtcNow;

        var ticketMessage = new TicketMessage
        {
            Id = Guid.NewGuid(),
            TicketId = ticketId,
            AuthorUserId = authorId,
            Message = message,
            CreatedAt = DateTime.UtcNow,
            Status = status ?? ticket.Status
        };

        _context.TicketMessages.Add(ticketMessage);
        await _context.SaveChangesAsync();

        // Notify opposite participant
        var notifyUserId = ticket.AssignedToUserId == authorId ? ticket.CreatedByUserId : ticket.AssignedToUserId ?? ticket.CreatedByUserId;
        await _notificationService.CreateNotificationAsync(notifyUserId, $"New message on ticket '{ticket.Title}'");

        return await _context.TicketMessages
            .Include(m => m.AuthorUser)
            .Where(m => m.Id == ticketMessage.Id)
            .Select(m => new TicketMessageDto
            {
                Id = m.Id,
                AuthorUserId = m.AuthorUserId,
                AuthorName = m.AuthorUser!.FullName,
                AuthorEmail = m.AuthorUser.Email,
                Message = m.Message,
                CreatedAt = m.CreatedAt,
                Status = m.Status
            })
            .FirstAsync();
    }

    private static TicketResponse MapToResponse(Ticket ticket) => new()
    {
        Id = ticket.Id,
        Title = ticket.Title,
        Description = ticket.Description,
        CategoryId = ticket.CategoryId,
        CategoryName = ticket.Category?.Name ?? string.Empty,
        SubcategoryId = ticket.SubcategoryId,
        SubcategoryName = ticket.Subcategory?.Name,
        Priority = ticket.Priority,
        Status = ticket.Status,
        CreatedByUserId = ticket.CreatedByUserId,
        CreatedByName = ticket.CreatedByUser?.FullName ?? string.Empty,
        CreatedByEmail = ticket.CreatedByUser?.Email ?? string.Empty,
        CreatedByPhoneNumber = ticket.CreatedByUser?.PhoneNumber,
        CreatedByDepartment = ticket.CreatedByUser?.Department,
        AssignedToUserId = ticket.AssignedToUserId,
        AssignedToName = ticket.AssignedToUser?.FullName,
        AssignedToEmail = ticket.AssignedToUser?.Email,
        AssignedToPhoneNumber = ticket.AssignedToUser?.PhoneNumber,
        CreatedAt = ticket.CreatedAt,
        UpdatedAt = ticket.UpdatedAt,
        DueDate = ticket.DueDate
    };
}
