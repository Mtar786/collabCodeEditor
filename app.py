from flask import Flask, render_template
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

# Global variable for shared code text
editor_text = "// Start coding collaboratively...\nfunction hello() {\n  console.log('Hello, world!');\n}\n"

# Global list to store chat messages (if using chat)
chat_messages = []

@app.route('/')
def index():
    # Pass the initial code and chat history to the template.
    return render_template('index.html', text=editor_text, chats=chat_messages)

@socketio.on('connect')
def handle_connect():
    # Send the current editor text and chat history when a client connects.
    emit('update_text', {'text': editor_text})
    emit('chat_history', {'chats': chat_messages})

@socketio.on('text_change')
def handle_text_change(data):
    global editor_text
    editor_text = data['text']
    print("Updated text:", editor_text)
    emit('update_text', {'text': editor_text}, broadcast=True)

@socketio.on('chat_message')
def handle_chat_message(data):
    chat_messages.append(data)
    print("New chat message:", data)
    emit('chat_update', data, broadcast=True)

# --- New: Collaborative Cursor Tracking ---
@socketio.on('cursor_update')
def handle_cursor_update(data):
    # Broadcast the cursor position to all clients except the sender.
    emit('cursor_update', data, broadcast=True, include_self=False)

if __name__ == '__main__':
    socketio.run(app, port=5000, debug=True)


