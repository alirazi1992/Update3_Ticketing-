using Microsoft.EntityFrameworkCore;
using Ticketing.Backend.Application.DTOs;
using Ticketing.Backend.Domain.Entities;
using Ticketing.Backend.Infrastructure.Data;

namespace Ticketing.Backend.Application.Services;

public interface ICategoryService
{
    Task<IEnumerable<CategoryResponse>> GetAllAsync();
    Task<CategoryResponse?> CreateAsync(CategoryRequest request, IEnumerable<SubcategoryRequest>? subcategories = null);
    Task<CategoryResponse?> UpdateAsync(int id, CategoryRequest request);
    Task<bool> DeleteAsync(int id);
}

public class CategoryService : ICategoryService
{
    private readonly AppDbContext _context;

    public CategoryService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<CategoryResponse>> GetAllAsync()
    {
        var categories = await _context.Categories.Include(c => c.Subcategories).ToListAsync();
        return categories.Select(MapToResponse);
    }

    public async Task<CategoryResponse?> CreateAsync(CategoryRequest request, IEnumerable<SubcategoryRequest>? subcategories = null)
    {
        var category = new Category
        {
            Name = request.Name,
            Description = request.Description,
            Subcategories = subcategories?.Select(sc => new Subcategory { Name = sc.Name }).ToList() ?? new List<Subcategory>()
        };

        _context.Categories.Add(category);
        await _context.SaveChangesAsync();

        return MapToResponse(category);
    }

    public async Task<CategoryResponse?> UpdateAsync(int id, CategoryRequest request)
    {
        var category = await _context.Categories.Include(c => c.Subcategories).FirstOrDefaultAsync(c => c.Id == id);
        if (category == null)
        {
            return null;
        }

        category.Name = request.Name;
        category.Description = request.Description;
        await _context.SaveChangesAsync();
        return MapToResponse(category);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var category = await _context.Categories.FirstOrDefaultAsync(c => c.Id == id);
        if (category == null)
        {
            return false;
        }

        _context.Categories.Remove(category);
        await _context.SaveChangesAsync();
        return true;
    }

    private static CategoryResponse MapToResponse(Category category) => new()
    {
        Id = category.Id,
        Name = category.Name,
        Description = category.Description,
        Subcategories = category.Subcategories.Select(sc => new SubcategoryResponse { Id = sc.Id, Name = sc.Name })
    };
}
