package main

import (
	"net/http"
	"os"
	"path/filepath"
)

type Server struct {
}

var disabledXPoweredBy = false
var xPoweredByValue = "yohimik"

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !disabledXPoweredBy {
		w.Header().Set("X-Powered-By", xPoweredByValue)
	}
	switch r.URL.Path {
	case "/websocket":
		websocketHandler(w, r)
	case "/config":
		configHandler(w, r)
	default:
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
