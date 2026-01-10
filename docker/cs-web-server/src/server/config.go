package main

import (
	"encoding/json"
	"strings"
)

// Config holds the application configuration
type Config struct {
	Engine struct {
		Arguments string `env:"ENGINE_ARGS" required:"false"`
		Console   string `env:"ENGINE_CONSOLE" required:"false"`
		GameDir   string `env:"GAME_DIR" required:"true"`
	}
	Libraries struct {
		Client           string `env:"CLIENT_WASM_PATH" required:"true"`
		Server           string `env:"SERVER_WASM_PATH" required:"true"`
		Menu             string `env:"MENU_WASM_PATH" required:"true"`
		Extras           string `env:"EXTRAS_PATH" required:"true"`
		Filesystem       string `env:"FILESYSTEM_WASM_PATH" required:"true"`
		DynamicLibraries string `env:"DYNAMIC_LIBRARIES" required:"true"`
		FilesMap         string `env:"FILES_MAP" required:"true"`
	}
}

// EngineConfig holds the configuration for the Xash3D engine (JSON response)
type EngineConfig struct {
	Arguments        []string          `json:"arguments"`
	Console          []string          `json:"console"`
	GameDir          string            `json:"game_dir"`
	Libraries        map[string]string `json:"libraries"`
	DynamicLibraries []string          `json:"dynamic_libraries"`
	FilesMap         map[string]string `json:"files_map"`
}

var (
	appConfig        Config
	engineConfigJSON []byte
)

// sliceArgs converts a comma-separated string into a slice of strings
func sliceArgs(value string) []string {
	if value == "" {
		return []string{}
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// parseFilesMap converts "from:to,from:to" format into map[string]string
func parseFilesMap(value string) map[string]string {
	result := make(map[string]string)
	if value == "" {
		return result
	}
	pairs := strings.Split(value, ",")
	for _, pair := range pairs {
		parts := strings.SplitN(strings.TrimSpace(pair), ":", 2)
		if len(parts) == 2 {
			result[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
		}
	}
	return result
}

// buildEngineConfigJSON builds and serializes the engine config JSON
func buildEngineConfigJSON() error {
	engineConfig := EngineConfig{
		Arguments: sliceArgs(appConfig.Engine.Arguments),
		Console:   sliceArgs(appConfig.Engine.Console),
		GameDir:   appConfig.Engine.GameDir,
		Libraries: map[string]string{
			"client":     appConfig.Libraries.Client,
			"server":     appConfig.Libraries.Server,
			"extras":     appConfig.Libraries.Extras,
			"menu":       appConfig.Libraries.Menu,
			"filesystem": appConfig.Libraries.Filesystem,
		},
		DynamicLibraries: sliceArgs(appConfig.Libraries.DynamicLibraries),
		FilesMap:         parseFilesMap(appConfig.Libraries.FilesMap),
	}

	var err error
	engineConfigJSON, err = json.Marshal(engineConfig)
	return err
}
