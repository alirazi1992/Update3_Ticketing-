namespace Ticketing.Backend.Application.DTOs;

public class CategoryRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class CategoryResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public IEnumerable<SubcategoryResponse> Subcategories { get; set; } = Enumerable.Empty<SubcategoryResponse>();
}

public class SubcategoryRequest
{
    public string Name { get; set; } = string.Empty;
}

public class SubcategoryResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
