package server

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

func requireSession(config Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sessionToken, err := r.Cookie("hydrui-session")
		if err != nil {
			http.Error(w, "Not logged in", http.StatusUnauthorized)
			return
		}
		valid, err := validateToken(sessionToken.Value, []byte(config.Secret))
		if err != nil || !valid {
			http.Error(w, "Invalid session token", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func rewriteLLMRequestBody(r *http.Request, model string) error {
	var body map[string]json.RawMessage
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&body); err != nil {
		return fmt.Errorf("decode request body: %w", err)
	}
	if body == nil {
		return fmt.Errorf("decode request body: expected an object")
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return fmt.Errorf("decode request body: expected one JSON value")
	}
	encodedModel, err := json.Marshal(model)
	if err != nil {
		return fmt.Errorf("encode configured model: %w", err)
	}
	body["model"] = encodedModel
	encodedBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("encode request body: %w", err)
	}
	r.Body = io.NopCloser(bytes.NewReader(encodedBody))
	r.ContentLength = int64(len(encodedBody))
	r.Header.Set("Content-Type", "application/json")
	return nil
}

func newLLMProxy(config Config) http.Handler {
	target, err := url.Parse(config.LLMURL)
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "Invalid language model provider URL", http.StatusInternalServerError)
		})
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: !config.LLMSecure}

	proxy := &httputil.ReverseProxy{
		Transport:     transport,
		FlushInterval: -1,
		Director: func(r *http.Request) {
			contentType := r.Header.Get("Content-Type")
			accept := r.Header.Get("Accept")
			r.URL.Scheme = target.Scheme
			r.URL.Host = target.Host
			r.URL.Path = strings.TrimRight(target.Path, "/") + strings.TrimPrefix(r.URL.Path, "/llm")
			r.Host = target.Host
			r.Header = make(http.Header)
			if contentType != "" {
				r.Header.Set("Content-Type", contentType)
			}
			if accept != "" {
				r.Header.Set("Accept", accept)
			}
			// A nil value tells ReverseProxy not to add the caller's address.
			r.Header["X-Forwarded-For"] = nil
			if config.LLMAPIKey != "" {
				r.Header.Set("Authorization", "Bearer "+config.LLMAPIKey)
			}
		},
		ModifyResponse: func(response *http.Response) error {
			response.Header.Del("Set-Cookie")
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, _ *http.Request, _ error) {
			http.Error(w, "Error making language model request", http.StatusBadGateway)
		},
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/llm/v1/models" && r.Method == http.MethodGet:
			proxy.ServeHTTP(w, r)
		case r.URL.Path == "/llm/v1/chat/completions" && r.Method == http.MethodPost:
			if err := rewriteLLMRequestBody(r, config.LLMModel); err != nil {
				http.Error(w, "Invalid language model request", http.StatusBadRequest)
				return
			}
			proxy.ServeHTTP(w, r)
		default:
			http.Error(w, "Language model endpoint not found", http.StatusNotFound)
		}
	})
}
