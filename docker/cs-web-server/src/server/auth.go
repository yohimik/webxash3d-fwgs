package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	jwtSecret     []byte
	jwtExpiration = 24 * time.Hour
)

// Claims represents the JWT claims
type Claims struct {
	Role     string `json:"role"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// LoginRequest represents the login request body
type LoginRequest struct {
	Username     string `json:"username"`
	PasswordHash string `json:"passwordHash"`
}

// LoginResponse represents the login response
type LoginResponse struct {
	Token     string `json:"token"`
	ExpiresIn int64  `json:"expiresIn"` // seconds
	LogLevel  string `json:"logLevel"`  // admin panel log level
}

// SaltResponse represents the salt response
type SaltResponse struct {
	Salt string `json:"salt"`
}

// generateJWTSecret generates a random secret key for JWT signing
func generateJWTSecret() {
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		panic("Failed to generate JWT secret: " + err.Error())
	}
	jwtSecret = secret
	log.Infof("JWT secret generated: %s", base64.StdEncoding.EncodeToString(secret))
}

// generatePasswordSalt generates a random salt for password hashing
func generatePasswordSalt() {
	saltBytes := make([]byte, 32)
	if _, err := rand.Read(saltBytes); err != nil {
		panic("Failed to generate password salt: " + err.Error())
	}
	passwordSalt = hex.EncodeToString(saltBytes)
	log.Infof("Generated password salt (64 hex chars)")
}

// generateToken creates a new JWT token for authenticated users
func generateToken(username string) (string, error) {
	expirationTime := time.Now().Add(jwtExpiration)
	claims := &Claims{
		Role:     "admin",
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "xash3d-server",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// validateToken validates and parses a JWT token
func validateToken(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, jwt.ErrSignatureInvalid
	}

	return claims, nil
}

// extractToken extracts the JWT token from the Authorization header
func extractToken(r *http.Request) string {
	bearerToken := r.Header.Get("Authorization")
	if len(strings.Split(bearerToken, " ")) == 2 {
		return strings.Split(bearerToken, " ")[1]
	}
	return ""
}

// loginHandler handles authentication and returns a JWT token
func loginHandler(w http.ResponseWriter, r *http.Request) {
	// Check if admin panel is enabled
	if adminPassword == "" || adminUsername == "" {
		http.Error(w, "Admin panel is disabled (ADMIN_PANEL_USER and ADMIN_PANEL_PASSWORD must be set)", http.StatusServiceUnavailable)
		return
	}

	// Only allow POST requests
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed, use POST", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate username and password hash are provided
	if len(req.Username) == 0 {
		http.Error(w, "Username is required", http.StatusBadRequest)
		return
	}

	if len(req.PasswordHash) == 0 {
		http.Error(w, "Password hash is required", http.StatusBadRequest)
		return
	}

	// Check credentials with constant-time hash comparison
	if !checkCredentials(req.Username, req.PasswordHash) {
		log.Warnf("Failed login attempt from %s with username: %s", r.RemoteAddr, req.Username)
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
		return
	}

	// Generate JWT token with username
	token, err := generateToken(req.Username)
	if err != nil {
		log.Errorf("Failed to generate token: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Return token
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(LoginResponse{
		Token:     token,
		ExpiresIn: int64(jwtExpiration.Seconds()),
		LogLevel:  adminLogLevel,
	})

	log.Infof("Successful login from %s as user: %s", r.RemoteAddr, req.Username)
}

// saltHandler returns the password salt for client-side hashing
func saltHandler(w http.ResponseWriter, r *http.Request) {
	// Check if admin panel is enabled
	if adminPassword == "" || adminUsername == "" {
		http.Error(w, "Admin panel is disabled (ADMIN_PANEL_USER and ADMIN_PANEL_PASSWORD must be set)", http.StatusServiceUnavailable)
		return
	}

	// Only allow GET requests
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed, use GET", http.StatusMethodNotAllowed)
		return
	}

	// Return the salt (this is public information)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SaltResponse{
		Salt: passwordSalt,
	})
}

// authMiddleware validates JWT token from request
func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Check if admin panel is enabled
		if adminPassword == "" || adminUsername == "" {
			http.Error(w, "Admin panel is disabled (ADMIN_PANEL_USER and ADMIN_PANEL_PASSWORD must be set)", http.StatusServiceUnavailable)
			return
		}

		// Extract token from header
		tokenString := extractToken(r)
		if tokenString == "" {
			http.Error(w, "Missing authorization token", http.StatusUnauthorized)
			return
		}

		// Validate token
		claims, err := validateToken(tokenString)
		if err != nil {
			log.Warnf("Invalid token from %s: %v", r.RemoteAddr, err)
			http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
			return
		}

		// Check role
		if claims.Role != "admin" {
			http.Error(w, "Insufficient permissions", http.StatusForbidden)
			return
		}

		// Verify username in token matches configured username
		if claims.Username != adminUsername {
			log.Warnf("Token username mismatch from %s: expected %s, got %s", r.RemoteAddr, adminUsername, claims.Username)
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		// Token is valid, proceed to handler
		next(w, r)
	}
}
