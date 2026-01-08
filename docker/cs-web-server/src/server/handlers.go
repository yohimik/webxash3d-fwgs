package main

import (
	"net/http"
)

// configHandler returns the pre-serialized engine configuration
func configHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write(engineConfigJSON)
}
