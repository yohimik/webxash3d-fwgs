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
	case "/websocket":
		websocketHandler(w, r)
	case "/config":
		configHandler(w, r)
	case "/auth/salt":
		// Public endpoint to retrieve password salt
		saltHandler(w, r)
	case "/login":
		// Login endpoint with rate limiting (5 attempts per minute)
		loginRateLimiter.Middleware(loginHandler)(w, r)
	case "/rcon":
		// RCON endpoint with rate limiting and JWT auth (30 requests per minute)
		rconRateLimiter.Middleware(authMiddleware(rconHandler))(w, r)
	case "/logs":
		// WebSocket logs endpoint (JWT validation inside handler)
		logsWebSocketHandler(w, r)
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
