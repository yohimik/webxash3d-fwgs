package main

import (
	netlib "net"
	"net/http"
	"sync"
	"time"
)

// RateLimiter manages rate limiting for different IP addresses
type RateLimiter struct {
	visitors map[string]*tokenBucket
	mu       sync.RWMutex
	rate     float64 // tokens per second
	capacity float64 // max tokens
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(requestsPerMinute float64) *RateLimiter {
	rl := &RateLimiter{
		visitors: make(map[string]*tokenBucket),
		rate:     requestsPerMinute / 60.0, // convert to per second
		capacity: requestsPerMinute,
	}

	// Cleanup old visitors every 5 minutes
	go rl.cleanupVisitors()

	return rl
}

// Allow checks if a request from the given IP should be allowed
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	bucket, exists := rl.visitors[ip]
	if !exists {
		bucket = newTokenBucket(rl.capacity)
		rl.visitors[ip] = bucket
	}
	rl.mu.Unlock()

	return bucket.allow(rl.rate, rl.capacity)
}

// cleanupVisitors removes old visitor entries to prevent memory leaks
func (rl *RateLimiter) cleanupVisitors() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		for ip, bucket := range rl.visitors {
			bucket.mu.Lock()
			// Remove if hasn't been used in 10 minutes
			if time.Since(bucket.lastRefill) > 10*time.Minute {
				delete(rl.visitors, ip)
			}
			bucket.mu.Unlock()
		}
		rl.mu.Unlock()
	}
}

// Middleware returns a middleware function that applies rate limiting
func (rl *RateLimiter) Middleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := getClientIP(r)

		if !rl.Allow(ip) {
			log.Warnf("Rate limit exceeded for IP: %s", ip)
			http.Error(w, "Rate limit exceeded. Please try again later.", http.StatusTooManyRequests)
			return
		}

		next(w, r)
	}
}

// getClientIP extracts the real client IP from the request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header first (for proxies/load balancers)
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		// X-Forwarded-For can contain multiple IPs, get the first one
		if ip := extractFirstIP(forwarded); ip != "" {
			return ip
		}
	}

	// Check X-Real-IP header
	realIP := r.Header.Get("X-Real-IP")
	if realIP != "" {
		return realIP
	}

	// Fall back to RemoteAddr
	ip, _, err := netlib.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// extractFirstIP extracts the first IP from a comma-separated list
func extractFirstIP(ips string) string {
	for i := 0; i < len(ips); i++ {
		if ips[i] == ',' {
			return ips[:i]
		}
	}
	return ips
}
