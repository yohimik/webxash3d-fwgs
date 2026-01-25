package main

/*
#include <stdlib.h>

extern void Cbuf_AddText(const char* text);
*/
import "C"

import (
	"crypto/sha512"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"time"
	"unsafe"
	"github.com/gorilla/websocket"
)

var adminPassword string
var adminUsername string
var passwordSalt string  // Random salt for password hashing
var adminLogLevel string // Log level for admin panel (debug, info, warn, error)

// WebSocket logs event version constants
const (
	LogsEventVersion = "v1"
	LogsEventHistory = LogsEventVersion + ":history"
	LogsEventLog     = LogsEventVersion + ":log"
)

// checkCredentials validates both username and password hash using constant-time comparison
func checkCredentials(username, passwordHash string) bool {
	// Validate username
	usernameMatch := subtle.ConstantTimeCompare([]byte(username), []byte(adminUsername)) == 1

	// Compute expected hash: SHA-512(password + salt)
	expectedHash := computePasswordHash(adminPassword, passwordSalt)

	// Compare hashes using constant-time comparison
	hashMatch := subtle.ConstantTimeCompare([]byte(passwordHash), []byte(expectedHash)) == 1

	return usernameMatch && hashMatch
}

// computePasswordHash computes SHA-512 hash of password + salt
func computePasswordHash(password, salt string) string {
	hasher := sha512.New()
	hasher.Write([]byte(password + salt))
	hashBytes := hasher.Sum(nil)
	return hex.EncodeToString(hashBytes)
}

// configHandler returns the pre-serialized engine configuration
func configHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write(engineConfigJSON)
}

// rconHandler handles RCON commands via HTTP (requires JWT authentication via middleware)
func rconHandler(w http.ResponseWriter, r *http.Request) {
	// Only allow POST requests
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed, use POST", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var requestBody struct {
		Command interface{} `json:"command"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if requestBody.Command == nil {
		http.Error(w, "Command is required", http.StatusBadRequest)
		return
	}

	// Handle both string and array of strings
	switch cmd := requestBody.Command.(type) {
	case string:
		if cmd == "" {
			http.Error(w, "Command cannot be empty", http.StatusBadRequest)
			return
		}
		ExecuteCommand(cmd)
	case []interface{}:
		if len(cmd) == 0 {
			http.Error(w, "Command array cannot be empty", http.StatusBadRequest)
			return
		}
		for _, c := range cmd {
			if str, ok := c.(string); ok && str != "" {
				ExecuteCommand(str)
			}
		}
	default:
		http.Error(w, "Command must be a string or array of strings", http.StatusBadRequest)
		return
	}

	// Return 204 No Content
	w.WriteHeader(http.StatusNoContent)
}

// ExecuteCommand sends a command to the Xash3D engine
func ExecuteCommand(command string) {
	log.Infof("Executing RCON command: %s", command)

	// Add command to the engine's command buffer
	// We need to add a newline to ensure the command is executed
	commandWithNewline := command + "\n"
	cCommand := C.CString(commandWithNewline)
	defer C.free(unsafe.Pointer(cCommand))

	// Add the command to the buffer (will be executed on next frame)
	C.Cbuf_AddText(cCommand)
}

// adminHandler serves the admin panel
func adminHandler(w http.ResponseWriter, r *http.Request) {
	// Check if admin panel is enabled
	if adminPassword == "" || adminUsername == "" {
		http.Error(w, "Admin panel is disabled (ADMIN_PANEL_USER and ADMIN_PANEL_PASSWORD must be set)", http.StatusServiceUnavailable)
		return
	}

	// Serve admin index.html
	path := filepath.Join("public", "admin", "index.html")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, path)
}

// logsWebSocketHandler handles WebSocket connections for log streaming (requires JWT authentication)
func logsWebSocketHandler(w http.ResponseWriter, r *http.Request) {
	// Check if admin panel is enabled
	if adminPassword == "" || adminUsername == "" {
		http.Error(w, "Log streaming is disabled (ADMIN_PANEL_USER and ADMIN_PANEL_PASSWORD must be set)", http.StatusServiceUnavailable)
		return
	}

	// Upgrade to WebSocket first (auth will happen via first message)
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Errorf("Failed to upgrade HTTP to WebSocket for logs: %v", err)
		return
	}

	// Set read deadline for auth message (5 seconds)
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))

	// Read first message which should contain the auth token
	var authMsg struct {
		Event string `json:"event"`
		Token string `json:"token"`
	}
	if err := conn.ReadJSON(&authMsg); err != nil {
		log.Warnf("Failed to read auth message from %s: %v", r.RemoteAddr, err)
		conn.WriteJSON(map[string]string{"event": "v1:error", "error": "Failed to read auth message"})
		conn.Close()
		return
	}

	if authMsg.Event != "v1:auth" || authMsg.Token == "" {
		log.Warnf("Invalid auth message from %s", r.RemoteAddr)
		conn.WriteJSON(map[string]string{"event": "v1:error", "error": "Invalid auth message"})
		conn.Close()
		return
	}

	// Validate JWT token
	claims, err := validateToken(authMsg.Token)
	if err != nil {
		log.Warnf("Invalid token for WebSocket from %s: %v", r.RemoteAddr, err)
		conn.WriteJSON(map[string]string{"event": "v1:error", "error": "Invalid or expired token"})
		conn.Close()
		return
	}

	if claims.Role != "admin" {
		conn.WriteJSON(map[string]string{"event": "v1:error", "error": "Insufficient permissions"})
		conn.Close()
		return
	}

	// Verify username in token matches configured username
	if claims.Username != adminUsername {
		log.Warnf("Token username mismatch for WebSocket from %s: expected %s, got %s", r.RemoteAddr, adminUsername, claims.Username)
		conn.WriteJSON(map[string]string{"event": "v1:error", "error": "Invalid token"})
		conn.Close()
		return
	}

	// Auth successful - send confirmation
	conn.WriteJSON(map[string]string{"event": "v1:auth", "status": "ok"})

	// Reset read deadline for normal operation
	conn.SetReadDeadline(time.Time{})

	defer conn.Close()

	// Send history to client
	if err := sendHistory(conn); err != nil {
		log.Errorf("Failed to send log history: %v", err)
		return
	}

	// Create client channel
	clientChan := make(chan string, 256)

	// Register client
	logClientsMux.Lock()
	logClients[conn] = clientChan
	logClientsMux.Unlock()

	// Unregister on exit
	defer func() {
		logClientsMux.Lock()
		delete(logClients, conn)
		logClientsMux.Unlock()
		close(clientChan)
	}()

	// Read pump (for keep-alive and close detection)
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	// Write pump (sends logs to client)
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case message, ok := <-clientChan:
				if !ok {
					return
				}

				logMsg := struct {
					Event     string `json:"event"`
					Timestamp string `json:"timestamp"`
					Message   string `json:"message"`
				}{
					Event:     LogsEventLog,
					Timestamp: time.Now().Format(time.RFC3339),
					Message:   message,
				}

				if err := conn.WriteJSON(logMsg); err != nil {
					return
				}

			case <-ticker.C:
				// Send ping to keep connection alive
				if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			}
		}
	}()

	// Keep connection alive by reading messages
	for {
		if _, _, err := conn.NextReader(); err != nil {
			break
		}
	}
}
