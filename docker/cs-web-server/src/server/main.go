package main

import (
	"bufio"
	"fmt"
	"os"
	"syscall"

	goxash3d_fwgs "github.com/yohimik/goxash3d-fwgs/pkg"
)

// setupEngineLogging redirects stdout to capture engine logs
func setupEngineLogging() {
	// Save original stdout file descriptor
	originalStdout, err := syscall.Dup(int(os.Stdout.Fd()))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to duplicate stdout: %v\n", err)
		return
	}

	// Create pipe
	r, w, err := os.Pipe()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create pipe for logging: %v\n", err)
		return
	}

	// Redirect stdout file descriptor to pipe writer
	// This affects both Go and C code (CGO)
	if err := syscall.Dup2(int(w.Fd()), int(os.Stdout.Fd())); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to redirect stdout: %v\n", err)
		return
	}

	// Start reading in background
	go func() {
		scanner := bufio.NewScanner(r)
		for scanner.Scan() {
			line := scanner.Text()

			// Broadcast to WebSocket clients
			broadcastLog(line)

			// Also write to original stdout (for Docker logs)
			if _, err := syscall.Write(originalStdout, []byte(line+"\n")); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to write to original stdout: %v\n", err)
			}
		}
	}()
}

func main() {
	goxash3d_fwgs.DefaultXash3D.Net = net

	go runSFU()

	// Setup engine log capture BEFORE starting engine
	setupEngineLogging()

	goxash3d_fwgs.DefaultXash3D.SysStart()
}
