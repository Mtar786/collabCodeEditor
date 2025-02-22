// Connect to Socket.IO
var socket = io();

// Prompt for username (used for chat and cursor tracking)
var username = prompt("Enter your name:", "Anonymous");

// Ace Editor Setup
var aceEditor = ace.edit("editor");
aceEditor.setTheme("ace/theme/monokai");
// Set mode to Python (change as needed)
aceEditor.session.setMode("ace/mode/python");

// Flag to prevent update loops
var isUpdating = false;

// When the editor changes, emit the change event to the server
aceEditor.session.on('change', function(delta) {
    if (!isUpdating) {
        socket.emit('text_change', { text: aceEditor.getValue() });
    }
});

// Update the editor when receiving new content from the server
socket.on('update_text', function(data) {
    if (aceEditor.getValue() !== data.text) {
        isUpdating = true;
        aceEditor.setValue(data.text, -1); // -1 prevents moving the cursor
        isUpdating = false;
    }
});

// --- Run Code Feature ---
document.getElementById('run-code').addEventListener('click', function() {
    var code = aceEditor.getValue();
    runCode(code);
});

function runCode(code) {
    var outputDiv = document.getElementById('output');
    outputDiv.innerHTML = 'Running code...';

    // Use the Judge0 API via RapidAPI. Replace YOUR_RAPIDAPI_KEY with your key.
    fetch("https://judge0-ce.p.rapidapi.com/submissions/?base64_encoded=false&wait=false", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-RapidAPI-Key": "YOUR_RAPIDAPI_KEY",  // Replace with your API key
            "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com"
        },
        body: JSON.stringify({
            source_code: code,
            language_id: 71  // Python 3; change as needed for other languages
        })
    })
    .then(response => response.json())
    .then(data => {
        var token = data.token;
        pollSubmission(token);
    })
    .catch(error => {
        outputDiv.innerHTML = 'Error: ' + error;
    });
}

function pollSubmission(token) {
    var outputDiv = document.getElementById('output');
    var pollUrl = "https://judge0-ce.p.rapidapi.com/submissions/" + token + "?base64_encoded=false";
    fetch(pollUrl, {
        headers: {
            "X-RapidAPI-Key": "YOUR_RAPIDAPI_KEY",  // Replace with your API key
            "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com"
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status && data.status.id < 3) {
            setTimeout(function() {
                pollSubmission(token);
            }, 1000);
        } else {
            if (data.stderr) {
                outputDiv.innerHTML = "<pre>Error: " + data.stderr + "</pre>";
            } else {
                outputDiv.innerHTML = "<pre>" + data.stdout + "</pre>";
            }
        }
    })
    .catch(error => {
        outputDiv.innerHTML = 'Error: ' + error;
    });
}

// --- Chat Feature ---
var chatForm = document.getElementById('chat-form');
var chatInput = document.getElementById('chat-input');
var usernameInput = document.getElementById('username');
var chatBox = document.getElementById('chat-box');

chatForm.addEventListener('submit', function(e) {
    e.preventDefault();
    var message = chatInput.value;
    var name = usernameInput.value || 'Anonymous';
    if (message.trim() !== '') {
        socket.emit('chat_message', { username: name, message: message });
        chatInput.value = '';
    }
});

function appendChatMessage(data) {
    var p = document.createElement('p');
    p.classList.add('chat-message');
    p.innerHTML = '<strong>' + data.username + ':</strong> ' + data.message;
    chatBox.appendChild(p);
    chatBox.scrollTop = chatBox.scrollHeight;
}

socket.on('chat_update', function(data) {
    appendChatMessage(data);
});

socket.on('chat_history', function(data) {
    data.chats.forEach(function(chat) {
        appendChatMessage(chat);
    });
});

// --- Collaborative Cursor Tracking ---

// Object to store markers by username
var userMarkers = {};

// Emit your cursor position when it changes
aceEditor.selection.on("changeCursor", function() {
    var pos = aceEditor.getCursorPosition();
    socket.emit('cursor_update', { username: username, position: pos });
});

// Listen for cursor updates from other users
socket.on('cursor_update', function(data) {
    // Remove the old marker for this user, if any
    if (userMarkers[data.username]) {
        aceEditor.session.removeMarker(userMarkers[data.username]);
    }

    // Create a new marker at the updated position.
    var Range = ace.require("ace/range").Range;
    var pos = data.position;
    var range = new Range(pos.row, pos.column, pos.row, pos.column + 1);

    // Add a marker with the CSS class "cursor-marker"
    var markerId = aceEditor.session.addMarker(range, "cursor-marker", "text", false);
    userMarkers[data.username] = markerId;
});
