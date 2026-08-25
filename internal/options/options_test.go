package options

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func serverModeValues() *Values {
	values := NewDefault()
	values.ServerMode = true
	values.NoAuth = true
	values.Secret = "test-secret"
	values.HydrusURL = "http://hydrus.invalid"
	values.HydrusAPIKey = "hydrus-key"
	return values
}

func TestServerConfigIncludesLanguageModelProvider(t *testing.T) {
	t.Parallel()
	values := serverModeValues()
	values.LLMURL = "https://models.example/"
	values.LLMAPIKey = " model-key "
	values.LLMModel = " vision-model "

	config, err := values.ServerConfig(
		context.Background(),
		slog.New(slog.NewTextHandler(io.Discard, nil)),
	)
	require.NoError(t, err)
	assert.Equal(t, "https://models.example", config.LLMURL)
	assert.Equal(t, "model-key", config.LLMAPIKey)
	assert.Equal(t, "vision-model", config.LLMModel)
	assert.Equal(t, "Server Language Model", config.LLMName)
}

func TestServerConfigRequiresModelForLanguageModelProvider(t *testing.T) {
	t.Parallel()
	values := serverModeValues()
	values.LLMURL = "https://models.example"

	_, err := values.ServerConfig(
		context.Background(),
		slog.New(slog.NewTextHandler(io.Discard, nil)),
	)
	assert.EqualError(t, err, "language model is required when a language model provider URL is configured")
}
