package main

import (
	netlib "net"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// tokenMultiplier is the fixed-point precision for atomic token operations
const tokenMultiplier = 1000

// atomicTokenBucket uses atomic operations for lock-free rate limiting (Vyukov style)
type atomicTokenBucket struct {
	// Packed state: upper 32 bits = tokens (fixed-point), lower 32 bits = timestamp
	state uint64
}

// newAtomicTokenBucket creates a new atomic token bucket with full capacity
func newAtomicTokenBucket(capacity float64) *atomicTokenBucket {
	initialTokens := uint32(capacity * tokenMultiplier)
	initialTime := uint32(time.Now().Unix())
	state := (uint64(initialTokens) << 32) | uint64(initialTime)
	return &atomicTokenBucket{state: state}
}

// allow checks if a request should be allowed using CAS operations
func (tb *atomicTokenBucket) allow(rate float64, capacity float64) bool {
	for {
		oldState := atomic.LoadUint64(&tb.state)
		oldTokens := float64(oldState>>32) / tokenMultiplier
		oldTime := int64(oldState & 0xFFFFFFFF)

		now := time.Now().Unix()
		elapsed := float64(now - oldTime)

		// Refill tokens based on elapsed time
		newTokens := oldTokens + elapsed*rate
		if newTokens > capacity {
			newTokens = capacity
		}

		// Check if we can consume a token
		if newTokens < 1 {
			return false
		}

		// Consume one token
		newTokens -= 1

		// Pack new state
		newState := (uint64(newTokens*tokenMultiplier) << 32) | uint64(now)

		// CAS operation - retry on contention
		if atomic.CompareAndSwapUint64(&tb.state, oldState, newState) {
			return true
		}
		// Another goroutine modified state, retry
	}
}

// getLastTime returns the last refill time (for cleanup)
func (tb *atomicTokenBucket) getLastTime() int64 {
	state := atomic.LoadUint64(&tb.state)
	return int64(state & 0xFFFFFFFF)
}

// RateLimiter manages rate limiting for different IP addresses using lock-free operations
type RateLimiter struct {
	visitors sync.Map // map[string]*atomicTokenBucket - lock-free reads/writes
	rate     float64  // tokens per second
	capacity float64  // max tokens
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(requestsPerMinute float64) *RateLimiter {
	rl := &RateLimiter{
		rate:     requestsPerMinute / 60.0, // convert to per second
		capacity: requestsPerMinute,
	}

	// Cleanup old visitors every 5 minutes
	go rl.cleanupVisitors()

	return rl
}

// Allow checks if a request from the given IP should be allowed (lock-free)
func (rl *RateLimiter) Allow(ip string) bool {
	// Try to load existing bucket
	value, loaded := rl.visitors.LoadOrStore(ip, newAtomicTokenBucket(rl.capacity))
	bucket := value.(*atomicTokenBucket)

	// If we just created it, it already has full capacity
	if !loaded {
		// Consume one token from the new bucket
		return bucket.allow(rl.rate, rl.capacity)
	}

	return bucket.allow(rl.rate, rl.capacity)
}

// cleanupVisitors removes old visitor entries to prevent memory leaks
func (rl *RateLimiter) cleanupVisitors() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now().Unix()
		rl.visitors.Range(func(key, value interface{}) bool {
			bucket := value.(*atomicTokenBucket)
			lastTime := bucket.getLastTime()
			// Remove if hasn't been used in 10 minutes
			if now-lastTime > 600 {
				rl.visitors.Delete(key)
			}
			return true
		})
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
