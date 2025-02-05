using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;

namespace Backend.Hubs
{
    public class VideoHub : Hub
    {
        private static readonly ConcurrentDictionary<string, RoomParticipant> _participants 
            = new ConcurrentDictionary<string, RoomParticipant>();

        public async Task JoinRoom(string roomId, string userId, string username)
        {
            try
            {
                // Remove any existing connections for this user
                var existingConnections = _participants
                    .Where(p => p.Value.UserId == userId)
                    .Select(p => p.Key)
                    .ToList();

                foreach (var existingConnectionId in existingConnections)
                {
                    _participants.TryRemove(existingConnectionId, out _);
                }

                // Add new connection
                _participants[Context.ConnectionId] = new RoomParticipant
                {
                    RoomId = roomId,
                    UserId = userId,
                    Username = username
                };

                await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
                
                // Broadcast to room participants
                await Clients.Group(roomId).SendAsync("user-connected", userId, username, Context.ConnectionId);
                
                // Notify about existing participants in the room
                var roomParticipants = _participants
                    .Where(p => p.Value.RoomId == roomId)
                    .Select(p => new { p.Value.UserId, p.Value.Username })
                    .ToList();

                await Clients.Caller.SendAsync("existing-participants", roomParticipants);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("join-error", ex.Message);
                Console.WriteLine($"Join Room Error: {ex}");
            }
        }

        public async Task SendMessage(string roomId, string message)
        {
            try
            {
                if (!_participants.TryGetValue(Context.ConnectionId, out var participant))
                {
                    throw new InvalidOperationException("User not found in room");
                }

                await Clients.Group(roomId).SendAsync("receive-message", 
                    participant.Username, 
                    message, 
                    Context.ConnectionId);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("message-error", ex.Message);
                Console.WriteLine($"Send Message Error: {ex}");
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            try
            {
                if (_participants.TryRemove(Context.ConnectionId, out var participant))
                {
                    await Clients.Group(participant.RoomId).SendAsync(
                        "user-disconnected", 
                        participant.UserId, 
                        participant.Username,
                        Context.ConnectionId
                    );
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Disconnect Error: {ex}");
            }
            
            await base.OnDisconnectedAsync(exception);
        }

        public class RoomParticipant
        {
            public string RoomId { get; set; }
            public string UserId { get; set; }
            public string Username { get; set; }
        }
    }
}