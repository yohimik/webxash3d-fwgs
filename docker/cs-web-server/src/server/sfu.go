package main

import (
	"net/http"
	"os"
	"strconv"
	"time"
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
