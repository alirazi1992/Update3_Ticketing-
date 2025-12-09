namespace Ticketing.Backend.Domain.Entities;

public class Subcategory
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;

    public Category? Category { get; set; }
    public ICollection<Ticket> Tickets { get; set; } = new List<Ticket>();
}
