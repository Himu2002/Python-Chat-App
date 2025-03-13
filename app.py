from flask import Flask, render_template, request, send_from_directory
from flask_socketio import SocketIO, emit
import random
import os
import uuid

# Initialize Flask app with static folder configuration
app = Flask(__name__, static_folder='static')
app.config['SECRET_KEY'] = 'your-secret-key'
socketio = SocketIO(app)

# Store connected users with their socket IDs as keys
users = {}

# Store messages with their unique IDs as keys
messages = {}

# Route for the main chat page
@app.route('/')
def index():
    return render_template('index.html')

# Route to serve static files (CSS, JS, images)
@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

# Handle new user connections
@socketio.on("connect")
def handle_connect():
    # Generate random username and avatar
    username = f"User_{random.randint(1000,9999)}"
    gender = random.choice(["girl","boy"])
    avatar_url = f"https://avatar.iran.liara.run/public/{gender}?username={username}"

    # Store user information
    users[request.sid] = { "username":username,"avatar":avatar_url}

    # Broadcast user join event
    emit("user_joined", {"username":username,"avatar":avatar_url},broadcast=True)
    # Set username for the new user
    emit("set_username", {"username":username})

# Handle user disconnections
@socketio.on("disconnect")
def handle_disconnect():
    user = users.pop(request.sid, None)
    if user:
        emit("user_left", {"username":user["username"]},broadcast=True)

# Handle new messages
@socketio.on("send_message")
def handle_message(data):
    user = users.get(request.sid)
    if user:
        # Generate unique message ID
        message_id = str(uuid.uuid4())
        message_data = {
            "username": user["username"],
            "avatar": user["avatar"],
            "message": data["message"],
            "messageId": message_id
        }
        # Store message
        messages[message_id] = message_data
        # Broadcast message to all users
        emit("new_message", message_data, broadcast=True)

# Handle message edits
@socketio.on("edit_message")
def handle_edit(data):
    message_id = data['messageId']
    if message_id in messages:
        # Update message content
        messages[message_id]['message'] = data['newMessage']
        # Broadcast edit to all users
        emit("message_edited", {
            "messageId": message_id,
            "newMessage": data['newMessage']
        }, broadcast=True)

# Handle message deletions
@socketio.on("delete_message")
def handle_delete(data):
    message_id = data['messageId']
    if message_id in messages:
        # Remove message from storage
        del messages[message_id]
        # Broadcast deletion to all users
        emit("message_deleted", {'messageId': message_id}, broadcast=True)

# Handle username updates
@socketio.on("update_username")
def handle_update_username(data):
    old_username = users[request.sid]["username"]
    new_username = data["username"]
    users[request.sid]["username"] = new_username

    # Broadcast username change to all users
    emit("username_updated", {
        "old_username":old_username,
        "new_username":new_username
    }, broadcast=True)

# Run the application
if __name__ == "__main__":
    socketio.run(app, debug=True) 