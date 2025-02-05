//Hubs/Users.cs
namespace Backend.Hubs
{
    public static class Users
    {
        public static IDictionary<string, (string userId, string username)> list = 
            new Dictionary<string, (string userId, string username)>();
    }
}