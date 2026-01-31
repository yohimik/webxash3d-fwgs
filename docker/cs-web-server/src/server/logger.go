package main

import (
	"fmt"
	"os"
	"time"

	"github.com/rs/zerolog"
)

// Logger wraps zerolog and broadcasts logs to WebSocket clients
type Logger struct {
	zlog zerolog.Logger
	name string
}

// Global logger instance
var log *Logger

// InitLogger initializes the global logger
func InitLogger(name string) {
	level := zerolog.InfoLevel

	// Parse log level from environment
	levelStr := os.Getenv("LOG_LEVEL")
	switch levelStr {
	case "debug":
		level = zerolog.DebugLevel
	case "info":
		level = zerolog.InfoLevel
	case "warn":
		level = zerolog.WarnLevel
	case "error":
		level = zerolog.ErrorLevel
	}

	// Configure zerolog with console writer for pretty output
	output := zerolog.ConsoleWriter{
		Out:        os.Stdout,
		TimeFormat: time.RFC3339,
	}

	log = &Logger{
		zlog: zerolog.New(output).With().Timestamp().Str("component", name).Logger().Level(level),
		name: name,
	}
}

// broadcast sends a log message to WebSocket clients
func (l *Logger) broadcast(level, format string, args ...interface{}) {
	message := fmt.Sprintf(format, args...)
	timestamp := time.Now().Format("15:04:05")
	fullMessage := fmt.Sprintf("[%s] [%s] %s", timestamp, level, message)

	// Send to broadcast channel if initialized
	if logBroadcast != nil {
		select {
		case logBroadcast <- fullMessage:
		default:
			// Channel full, drop message
		}
	}

	// Also add to buffer if initialized
	if logBuffer != nil {
		logBuffer.Add(&LogEntry{
			Timestamp: time.Now(),
			Message:   fullMessage,
		})
	}
}

// Debugf logs a debug message
func (l *Logger) Debugf(format string, args ...interface{}) {
	l.zlog.Debug().Msgf(format, args...)
	l.broadcast("DEBUG", format, args...)
}

// Infof logs an info message
func (l *Logger) Infof(format string, args ...interface{}) {
	l.zlog.Info().Msgf(format, args...)
	l.broadcast("INFO", format, args...)
}

// Warnf logs a warning message
func (l *Logger) Warnf(format string, args ...interface{}) {
	l.zlog.Warn().Msgf(format, args...)
	l.broadcast("WARN", format, args...)
}

// Errorf logs an error message
func (l *Logger) Errorf(format string, args ...interface{}) {
	l.zlog.Error().Msgf(format, args...)
	l.broadcast("ERROR", format, args...)
}

// Debug logs a debug message (without formatting)
func (l *Logger) Debug(msg string) {
	l.zlog.Debug().Msg(msg)
	l.broadcast("DEBUG", "%s", msg)
}

// Info logs an info message (without formatting)
func (l *Logger) Info(msg string) {
	l.zlog.Info().Msg(msg)
	l.broadcast("INFO", "%s", msg)
}

// Warn logs a warning message (without formatting)
func (l *Logger) Warn(msg string) {
	l.zlog.Warn().Msg(msg)
	l.broadcast("WARN", "%s", msg)
}

// Error logs an error message (without formatting)
func (l *Logger) Error(msg string) {
	l.zlog.Error().Msg(msg)
	l.broadcast("ERROR", "%s", msg)
}

// Trace logs a trace message (mapped to debug in zerolog)
func (l *Logger) Trace(msg string) {
	l.zlog.Trace().Msg(msg)
}

// Tracef logs a trace message with formatting
func (l *Logger) Tracef(format string, args ...interface{}) {
	l.zlog.Trace().Msgf(format, args...)
}

func init() {
	// Initialize with default logger until proper initialization
	InitLogger("server")
}
