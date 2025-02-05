// Services/RoomManager.cs
public class RoomManager : IRoomManager
{
    private readonly Dictionary<string, (string roomId, string userId)> _connections 
        = new();
    private readonly Dictionary<string, HashSet<string>> _rooms 
        = new();
    private readonly object _lock = new();

    public void AddUser(string roomId, string connectionId, string userId)
    {
        lock (_lock)
        {
            _connections[connectionId] = (roomId, userId);
            
            if (!_rooms.ContainsKey(roomId))
            {
                _rooms[roomId] = new HashSet<string>();
            }
            _rooms[roomId].Add(userId);
        }
    }

    public (string? roomId, string? userId) RemoveUser(string connectionId)
    {
        lock (_lock)
        {
            if (_connections.TryGetValue(connectionId, out var connection))
            {
                _connections.Remove(connectionId);
                _rooms[connection.roomId].Remove(connection.userId);
                
                if (_rooms[connection.roomId].Count == 0)
                {
                    _rooms.Remove(connection.roomId);
                }
                
                return connection;
            }
            return (null, null);
        }
    }

    public string? GetUserId(string connectionId)
    {
        return _connections.TryGetValue(connectionId, out var connection) 
            ? connection.userId 
            : null;
    }

    public int GetRoomParticipantCount(string roomId)
    {
        return _rooms.TryGetValue(roomId, out var participants) 
            ? participants.Count 
            : 0;
    }

    public IEnumerable<string> GetRoomParticipants(string roomId)
    {
        return _rooms.TryGetValue(roomId, out var participants) 
            ? participants.ToList() 
            : Enumerable.Empty<string>();
    }
}
