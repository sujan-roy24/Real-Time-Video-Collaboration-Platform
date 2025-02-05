// Single, clean implementation of VideoRoom class
class VideoRoom {
    constructor(roomId, username) {
        this.ROOM_ID = roomId;
        this.USERNAME = username;
        this.userId = null;
        this.localStream = null;
        this.peers = {};
        
        // UI Elements
        this.videoGrid = document.querySelector('[video-grid]');
        this.myVideo = document.createElement('video');
        this.myVideo.muted = true;

        this.chatMessages = document.getElementById('chat-messages');
        this.chatForm = document.querySelector('.chat-input-form');
        this.chatInput = document.querySelector('.chat-input');
        
        // Media Control Elements
        this.cameraBtn = document.getElementById('toggle-camera');
        this.micBtn = document.getElementById('toggle-mic');
        this.leaveBtn = document.getElementById('leave-room');
        
        // Participants List
        this.participantsList = document.getElementById('participants-list');
        this.participantCountEl = document.getElementById('participant-count');
        
        this.participants = new Map();

        // SignalR and Peer Connections
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl("/meeting")
            .withAutomaticReconnect([0, 1000, 5000, 10000])
            .configureLogging(signalR.LogLevel.Information)
            .build();
            
        this.myPeer = new Peer({
            debug: 3  // Detailed logs
        });


        this.initializeComponents();
    }

    initializeComponents() {
        this.setupPeerConnection();
        this.setupSignalRConnection();
        this.setupMediaStream();
        this.setupEventListeners();
        this.setupMediaControlListeners();
    }

    setupPeerConnection() {
        this.myPeer.on('open', (id) => {
            this.userId = id;
            console.log('Peer connection established:', id);
        });

        this.myPeer.on('error', (err) => {
            console.error('Peer connection error:', err);
            this.showErrorNotification('Peer connection failed');
        });
    }

    async setupSignalRConnection() {
        try {
            this.connection.onclose(async () => {
                console.log('SignalR connection closed. Attempting to reconnect...');
                await this.reconnect();
            });

            await this.connection.start();
            console.log('SignalR connected');

            // Wait for userId to be available
            const checkUserId = setInterval(() => {
                if (this.userId) {
                    clearInterval(checkUserId);
                    this.joinRoom();
                }
            }, 100);
        } catch (err) {
            console.error('SignalR connection failed:', err);
            this.showErrorNotification('Failed to connect to room');
        }
    }

    async joinRoom() {
        try {
            await this.connection.invoke("JoinRoom", this.ROOM_ID, this.userId, this.USERNAME);
            
            // Listen for existing participants
            this.connection.on('existing-participants', (participants) => {
                participants.forEach(participant => {
                    if (participant.userId !== this.userId) {
                        this.addParticipant(participant.userId, participant.username);
                    }
                });
            });
        } catch (err) {
            console.error('Room join error:', err);
            this.showErrorNotification('Failed to join room');
        }
    }

    async reconnect() {
        try {
            await this.connection.start();
            await this.joinRoom();
            this.reconnectPeers();
        } catch (err) {
            console.error('Reconnection failed:', err);
            setTimeout(() => this.reconnect(), 5000);
        }
    }

    reconnectPeers() {
        // Reconnect to existing participants
        this.participants.forEach((username, userId) => {
            if (userId !== this.userId) {
                this.connectNewUser(userId, this.localStream);
            }
        });
    }

    setupMediaStream() {
        navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        })
        .then(stream => {
            this.localStream = stream;
            this.addVideoStream(this.myVideo, stream);
            this.addParticipant(this.userId, this.USERNAME);
        })
        .catch(err => {
            console.error('Media stream error:', err);
            this.showErrorNotification('Failed to access camera/microphone');
        });
    }

    setupEventListeners() {
        // User Connection Listeners
        this.connection.on('user-connected', (userId, username, connectionId) => {
            if (userId === this.userId) return;
            console.log(`${username} connected with ID: ${userId}`);
            this.addParticipant(userId, username);
            this.connectNewUser(userId, this.localStream);
        });

        this.connection.on('user-disconnected', (userId, username, connectionId) => {
            console.log(`${username} disconnected`);
            this.removeParticipant(userId);
            this.closeUserPeerConnection(userId);
        });

        // Chat Message Listeners
        this.connection.on('receive-message', (username, message, senderId) => {
            this.addChatMessage(username, message, username === this.USERNAME, senderId);
        });

        // Error Handling
        this.connection.on('join-error', (errorMsg) => {
            console.error('Join Room Error:', errorMsg);
            this.showErrorNotification(errorMsg);
        });

        this.connection.on('message-error', (errorMsg) => {
            console.error('Message Send Error:', errorMsg);
            this.showErrorNotification(errorMsg);
        });

        // Peer Call Listener
        this.myPeer.on('call', call => {
            call.answer(this.localStream);
            const userVideo = document.createElement('video');
            call.on('stream', userVideoStream => {
                this.addVideoStream(userVideo, userVideoStream);
            });
            call.on('close', () => {
                userVideo.remove();
            });
        });

        // Chat Form Submit
        this.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const message = this.chatInput.value.trim();
            if (message) {
                this.sendMessage(message);
                this.chatInput.value = '';
            }
        });
    }

    setupMediaControlListeners() {
        // Camera Toggle
        this.cameraBtn.addEventListener('click', () => {
            const videoTrack = this.localStream.getVideoTracks()[0];
            videoTrack.enabled = !videoTrack.enabled;
            this.cameraBtn.classList.toggle('active');
        });

        // Microphone Toggle
        this.micBtn.addEventListener('click', () => {
            const audioTrack = this.localStream.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            this.micBtn.classList.toggle('active');
        });

        // Leave Room
        this.leaveBtn.addEventListener('click', () => {
            this.leaveRoom();
        });
    }

    sendMessage(message) {
        try {
            this.connection.invoke("SendMessage", this.ROOM_ID, message);
        } catch (err) {
            console.error('Send message error:', err);
            this.showErrorNotification('Failed to send message');
        }
    }

    addParticipant(userId, username) {
        if (!this.participants.has(userId)) {
            this.participants.set(userId, username);
            const participantEl = document.createElement('div');
            participantEl.className = 'participant-item';
            participantEl.id = `participant-${userId}`;
            participantEl.innerHTML = `
                <div class="participant-icon">${username.charAt(0).toUpperCase()}</div>
                <span>${username}</span>
            `;
            this.participantsList.appendChild(participantEl);
            this.updateParticipantCount();
        }
    }

    removeParticipant(userId) {
        const participantEl = document.getElementById(`participant-${userId}`);
        if (participantEl) {
            participantEl.remove();
        }
        this.participants.delete(userId);
        this.updateParticipantCount();
    }

    closeUserPeerConnection(userId) {
        if (this.peers[userId]) {
            this.peers[userId].close();
            delete this.peers[userId];
        }
    }

    updateParticipantCount() {
        this.participantCountEl.textContent = this.participants.size.toString();
    }

    leaveRoom() {
        // Close all peer connections
        Object.values(this.peers).forEach(peer => peer.close());
        
        // Stop media tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }

        // Redirect to home
        window.location.href = '/';
    }

    showErrorNotification(message) {
        alert(message);
    }

    connectNewUser(userId, stream) {
        const call = this.myPeer.call(userId, stream);
        const userVideo = document.createElement('video');
        
        call.on('stream', userVideoStream => {
            this.addVideoStream(userVideo, userVideoStream);
        });

        call.on('close', () => {
            userVideo.remove();
        });

        this.peers[userId] = call;
    }

    addVideoStream(video, stream) {
        video.srcObject = stream;
        video.addEventListener('loadedmetadata', () => {
            video.play().catch(err => console.error('Failed to play video:', err));
        });
        this.videoGrid.append(video);
    }
    addChatMessage(username, message, isOwnMessage, senderId) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isOwnMessage ? 'own-message' : ''}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'message-username';
        usernameSpan.textContent = username;
        
        const messageText = document.createElement('span');
        messageText.className = 'message-text';
        messageText.textContent = message;
        
        const timestamp = document.createElement('span');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageContent.appendChild(usernameSpan);
        messageContent.appendChild(messageText);
        messageContent.appendChild(timestamp);
        messageDiv.appendChild(messageContent);
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}

// Initialize room when the page loads
window.initializeRoom = function(roomId, username) {
    new VideoRoom(roomId, username);
};