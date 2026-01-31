package main

import (
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// LogEntry represents a single log message
type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Message   string    `json:"message"`
}

// CircularBuffer is a thread-safe ring buffer for storing log entries
type CircularBuffer struct {
	buffer   []*LogEntry
	capacity int
	head     int
	size     int
	mu       sync.RWMutex
}

// NewCircularBuffer creates a new circular buffer with the given capacity
func NewCircularBuffer(capacity int) *CircularBuffer {
	return &CircularBuffer{
		buffer:   make([]*LogEntry, capacity),
		capacity: capacity,
		head:     0,
		size:     0,
	}
}

// Add inserts a new entry, overwriting the oldest if full
func (cb *CircularBuffer) Add(entry *LogEntry) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.buffer[cb.head] = entry
	cb.head = (cb.head + 1) % cb.capacity
	if cb.size < cb.capacity {
		cb.size++
	}
}

// GetAll returns all entries in chronological order
func (cb *CircularBuffer) GetAll() []*LogEntry {
	cb.mu.RLock()
	size := cb.size
	head := cb.head
	cb.mu.RUnlock()

	if size == 0 {
		return nil
	}

	result := make([]*LogEntry, size)

	// Start from oldest entry
	start := head - size
	if start < 0 {
		start += cb.capacity
	}

	cb.mu.RLock()
	for i := 0; i < size; i++ {
		idx := (start + i) % cb.capacity
		result[i] = cb.buffer[idx]
	}
	cb.mu.RUnlock()

	return result
}

// Log streaming variables
var (
	logBuffer     *CircularBuffer
	logClients    map[*websocket.Conn]chan string
	logClientsMux sync.RWMutex
	logBroadcast  chan string
)

// logBroadcaster distributes log messages to all connected clients
func logBroadcaster() {
	for message := range logBroadcast {
		logClientsMux.RLock()
		for _, clientChan := range logClients {
			// Non-blocking send to avoid slow clients blocking broadcast
			select {
			case clientChan <- message:
			default:
				// Client is slow, skip this message
			}
		}
		logClientsMux.RUnlock()
	}
}

// broadcastLog broadcasts a log message to all connected WebSocket clients
func broadcastLog(message string) {
	entry := &LogEntry{
		Timestamp: time.Now(),
		Message:   message,
	}

	// Add to circular buffer
	if logBuffer != nil {
		logBuffer.Add(entry)
	}

	// Send to broadcast channel (non-blocking)
	select {
	case logBroadcast <- message:
	default:
		// Channel full, drop message
	}
}

// sendHistory sends the log history to a newly connected client
func sendHistory(conn *websocket.Conn) error {
	if logBuffer == nil {
		return nil
	}

	history := logBuffer.GetAll()
	if len(history) == 0 {
		return nil
	}

	// Convert to JSON message
	historyMsg := struct {
		Event string      `json:"event"`
		Logs  []*LogEntry `json:"logs"`
	}{
		Event: LogsEventHistory,
		Logs:  history,
	}

	return conn.WriteJSON(historyMsg)
}
