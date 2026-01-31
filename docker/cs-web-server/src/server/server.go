package main

import (
	"net/http"
	"os"
	"path/filepath"
)

type Server struct {
}

var (
	disabledXPoweredBy = false
	xPoweredByValue    = "yohimik"

	// Rate limiters
	loginRateLimiter *RateLimiter
	rconRateLimiter  *RateLimiter
)

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !disabledXPoweredBy {
		w.Header().Set("X-Powered-By", xPoweredByValue)
	}
	switch r.URL.Path {
	// WebRTC WebSocket - no version needed (protocol-level)
	case "/websocket":
		websocketHandler(w, r)

	// Versioned REST API v1
	case "/v1/auth":
		switch r.Method {
		case http.MethodGet:
			// GET /v1/auth - retrieve password salt
			saltHandler(w, r)
		case http.MethodPost:
			// POST /v1/auth - login with rate limiting
			loginRateLimiter.Middleware(loginHandler)(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}

	case "/v1/config":
		configHandler(w, r)

	case "/v1/rcon":
		// RCON endpoint with rate limiting and JWT auth (30 requests per minute)
		rconRateLimiter.Middleware(authMiddleware(rconHandler))(w, r)

	// WebSocket logs endpoint - versioned path
	case "/websocket/logs":
		logsWebSocketHandler(w, r)

	// Admin panel
	case "/admin", "/admin/":
		adminHandler(w, r)

	default:
		// Serve from public directory
		p := r.URL.Path
		if r.URL.Path == "/" {
			p = "index.html"
		}
		path := filepath.Join("public", p)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, path)
	}
}
