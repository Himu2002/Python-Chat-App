// Initialize Socket.IO connection
const socket = io();

// Get DOM elements
const chatMessages = document.getElementById("chat-messages");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const currentUsernameSpan = document.getElementById("current-username");
const usernameInput = document.getElementById("username-input");
const updateUsernameButton = document.getElementById("update-username-button");
const messageActions = document.getElementById("message-actions");

// State variables
let currentUsername = "";
let editingMessageId = null;

// Socket event handlers
socket.on("set_username", (data) => {
    currentUsername = data.username;
    currentUsernameSpan.textContent = `Your username: ${currentUsername}`;
});

// Handle user join events
socket.on("user_joined", (data) => {
    addMessage(`${data.username} joined the chat`, "system");
});

// Handle user leave events
socket.on("user_left", (data) => {
    addMessage(`${data.username} left the chat`, "system");
});

// Handle new messages
socket.on("new_message", (data) => {
    addMessage(data.message, "user", data.username, data.avatar, data.messageId);
});

// Handle message edits
socket.on("message_edited", (data) => {
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
        const messageText = messageElement.querySelector(".message-text");
        messageText.textContent = data.newMessage;
        messageElement.classList.remove("editing");
    }
});

// Handle message deletions
socket.on("message_deleted", (data) => {
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
        messageElement.remove();
    }
});

// Handle username updates
socket.on("username_updated", (data) => {
    addMessage(`${data.old_username} changed their name to ${data.new_username}`, "system");
    if (data.old_username === currentUsername) {
        currentUsername = data.new_username;
        currentUsernameSpan.textContent = `Your username: ${currentUsername}`;
    }
});

// Event listeners
sendButton.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});
updateUsernameButton.addEventListener("click", updateUsername);

// Send message function
function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        // Add sending animation
        sendButton.classList.add('sending');
        
        // Remove animation after it completes
        setTimeout(() => {
            sendButton.classList.remove('sending');
        }, 300);
        
        socket.emit("send_message", { message });
        messageInput.value = "";
    }
}

// Update username function
function updateUsername() {
    const newUsername = usernameInput.value.trim();
    if (newUsername && newUsername !== currentUsername) {
        socket.emit("update_username", { username: newUsername });
        usernameInput.value = "";
    }
}

// Add message to chat
function addMessage(message, type, username = "", avatar = "", messageId = null) {
    const messageElement = document.createElement("div");
    messageElement.className = "message";
    if (messageId) {
        messageElement.setAttribute("data-message-id", messageId);
    }

    if (type === "user") {
        const isSentMessage = username === currentUsername;
        if (isSentMessage) {
            messageElement.classList.add("sent");
        }

        // Create avatar image
        const avatarImg = document.createElement("img");
        avatarImg.src = avatar;
        messageElement.appendChild(avatarImg);

        // Create message content container
        const contentDiv = document.createElement("div");
        contentDiv.className = "message-content";

        // Add username
        const usernameDiv = document.createElement("div");
        usernameDiv.className = "message-username";
        usernameDiv.textContent = username;
        contentDiv.appendChild(usernameDiv);

        // Add message text
        const messageText = document.createElement("div");
        messageText.className = "message-text";
        messageText.textContent = message;
        contentDiv.appendChild(messageText);

        // Add edit/delete buttons for sent messages
        if (isSentMessage) {
            const actionsDiv = document.createElement("div");
            actionsDiv.className = "message-actions";
            
            const editBtn = document.createElement("button");
            editBtn.className = "edit-message-btn";
            editBtn.textContent = "✏️ Edit";
            editBtn.onclick = (e) => {
                e.stopPropagation();
                startEditing(messageElement, message);
            };
            
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "delete-message-btn";
            deleteBtn.textContent = "🗑️ Delete";
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteMessage(messageElement);
            };
            
            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);
            contentDiv.appendChild(actionsDiv);
        }

        messageElement.appendChild(contentDiv);
    } else {
        messageElement.className = "system-message";
        messageElement.textContent = message;
    }
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Start editing a message
function startEditing(messageElement, currentMessage) {
    // Cancel any ongoing edit
    if (editingMessageId) {
        const previousEditing = document.querySelector(`[data-message-id="${editingMessageId}"]`);
        if (previousEditing) {
            previousEditing.classList.remove("editing");
        }
    }

    messageElement.classList.add("editing");
    const messageId = messageElement.getAttribute("data-message-id");

    // Create edit form
    const editForm = document.createElement("div");
    editForm.className = "edit-form";

    const editInput = document.createElement("input");
    editInput.className = "edit-input";
    editInput.value = currentMessage;
    editInput.focus();

    const editActions = document.createElement("div");
    editActions.className = "edit-actions";

    const saveBtn = document.createElement("button");
    saveBtn.className = "save-edit-btn";
    saveBtn.textContent = "Save";
    saveBtn.onclick = (e) => {
        e.stopPropagation();
        saveEdit(messageElement, editInput.value, messageId);
    };

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "cancel-edit-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.onclick = (e) => {
        e.stopPropagation();
        cancelEdit(messageElement);
    };

    editActions.appendChild(saveBtn);
    editActions.appendChild(cancelBtn);
    editForm.appendChild(editInput);
    editForm.appendChild(editActions);
    messageElement.appendChild(editForm);

    editingMessageId = messageId;

    // Handle Enter key in edit input
    editInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            saveEdit(messageElement, editInput.value, messageId);
        }
    });
}

// Save edited message
function saveEdit(messageElement, newMessage, messageId) {
    if (newMessage.trim() && newMessage !== messageElement.querySelector(".message-text").textContent) {
        socket.emit("edit_message", { messageId, newMessage });
    }
    messageElement.classList.remove("editing");
    editingMessageId = null;
}

// Cancel message editing
function cancelEdit(messageElement) {
    messageElement.classList.remove("editing");
    editingMessageId = null;
}

// Delete message
function deleteMessage(messageElement) {
    const messageId = messageElement.getAttribute("data-message-id");
    if (messageId) {
        socket.emit("delete_message", { messageId });
    }
}
