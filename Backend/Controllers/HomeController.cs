// Controllers/HomeController.cs
using Microsoft.AspNetCore.Mvc;
using Backend.Models;

namespace Backend.Controllers
{
    public class HomeController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }

        [HttpPost]
        public IActionResult CreateRoom([FromBody] User user)
        {
            if (string.IsNullOrEmpty(user.Username))
            {
                return BadRequest("Username is required");
            }
            
            // Optional: You could use roomType to generate specific room names or apply special configurations
            string roomId = Guid.NewGuid().ToString();
            
            return Ok(new { roomId = roomId });
        }

        [HttpGet("/{roomId}")]
        public IActionResult Room(string roomId)
        {
            // The actual username check will happen on the client side
            ViewBag.RoomId = roomId;
            return View();
        }

        [HttpPost]
        public IActionResult ValidateUsername([FromBody] User user)
        {
            if (string.IsNullOrEmpty(user.Username))
            {
                return BadRequest("Username is required");
            }
            return Ok();
        }
    }
}