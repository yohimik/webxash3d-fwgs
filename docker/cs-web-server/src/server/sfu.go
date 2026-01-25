package main

import (
	"net/http"
	"os"
	"strconv"
	"time"
	"github.com/gorilla/websocket"
	"github.com/jinzhu/configor"
	"github.com/pion/ice/v4"
	"github.com/pion/interceptor"
	"github.com/pion/webrtc/v4"
)

var addr = ":27016"

func init() {
	// Load server configuration
	disable, _ := os.LookupEnv("DISABLE_X_POWERED_BY")
	if disable == "true" {
		disabledXPoweredBy = true
	}
	xPoweredValue, has := os.LookupEnv("X_POWERED_BY_VALUE")
	if has {
		xPoweredByValue = xPoweredValue
	}

	// Load admin credentials
	adminUsername = os.Getenv("ADMIN_PANEL_USER")
	if adminUsername == "" {
		adminUsername = "admin"
		log.Warnf("ADMIN_PANEL_USER not set, using default: 'admin'")
	}

	adminPassword = os.Getenv("ADMIN_PANEL_PASSWORD")
	if adminPassword == "" {
		log.Warnf("ADMIN_PANEL_PASSWORD not set, admin panel will be disabled")
	} else {
		// Generate JWT secret
		generateJWTSecret()

		// Generate password salt
		generatePasswordSalt()

		// Initialize rate limiters
		loginRateLimiter = NewRateLimiter(5)  // 5 login attempts per minute
		rconRateLimiter = NewRateLimiter(30)  // 30 RCON commands per minute
		log.Infof("JWT authentication enabled for user: %s", adminUsername)
	}

	// Load admin panel log level (default: info)
	adminLogLevel = os.Getenv("ADMIN_LOG_LEVEL")
	if adminLogLevel == "" {
		adminLogLevel = "info"
	}
	// Validate log level
	switch adminLogLevel {
	case "debug", "info", "warn", "error", "silent":
		// Valid log level
	default:
		log.Warnf("Invalid ADMIN_LOG_LEVEL '%s', using default: 'info'", adminLogLevel)
		adminLogLevel = "info"
	}

	// Initialize log streaming
	logBuffer = NewCircularBuffer(1000)
	logClients = make(map[*websocket.Conn]chan string)
	logBroadcast = make(chan string, 256)

	// Start log broadcast goroutine
	go logBroadcaster()

	// Load engine configuration using configor
	if err := configor.Load(&appConfig); err != nil {
		log.Errorf("Failed to load configuration: %v", err)
		panic(err)
	}

	// Build and serialize the engine config JSON
	if err := buildEngineConfigJSON(); err != nil {
		log.Errorf("Failed to serialize config: %v", err)
		panic(err)
	}
}

func runSFU() {
	settingEngine := webrtc.SettingEngine{}
	settingEngine.DetachDataChannels()

	port, ok := os.LookupEnv("PORT")
	if ok {
		p, err := strconv.Atoi(port)
		if err == nil {
			udpMux, err := ice.NewMultiUDPMuxFromPort(p)
			if err != nil {
				panic(err)
			}
			settingEngine.SetICEUDPMux(udpMux)
		}
	}

	ip, ok := os.LookupEnv("IP")
	if ok {
		settingEngine.SetNAT1To1IPs([]string{ip}, webrtc.ICECandidateTypeHost)
	}

	m := &webrtc.MediaEngine{}
	err := m.RegisterDefaultCodecs()
	if err != nil {
		panic(err)
	}

	i := &interceptor.Registry{}
	err = webrtc.RegisterDefaultInterceptors(m, i)
	if err != nil {
		panic(err)
	}
	api = webrtc.NewAPI(webrtc.WithSettingEngine(settingEngine), webrtc.WithMediaEngine(m), webrtc.WithInterceptorRegistry(i))

	// Init other state
	trackLocals = map[string]*webrtc.TrackLocalStaticRTP{}

	// request a keyframe every 3 seconds
	go func() {
		ticker := time.NewTicker(time.Second * 3)
		defer ticker.Stop()
		for range ticker.C {
			dispatchKeyFrame()
		}
	}()

	// start HTTP server
	if err := http.ListenAndServe(addr, &Server{}); err != nil { //nolint: gosec
		log.Errorf("Failed to start http server: %v", err)
	}
}
