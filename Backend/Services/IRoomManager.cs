// Services/IRoomManager.cs
public interface IRoomManager
{
    void AddUser(string roomId, string connectionId, string userId);
    (string? roomId, string? userId) RemoveUser(string connectionId);
    string? GetUserId(string connectionId);
    int GetRoomParticipantCount(string roomId);
    IEnumerable<string> GetRoomParticipants(string roomId);
}