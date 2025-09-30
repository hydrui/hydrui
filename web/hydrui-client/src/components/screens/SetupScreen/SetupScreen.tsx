import React, { useCallback, useEffect, useRef, useState } from "react";

import PushButton from "@/components/widgets/PushButton/PushButton";
import { client, useApiStore, verifyAuthentication } from "@/store/apiStore";

import "./index.css";

const SetupScreen: React.FC = () => {
  const {
    apiKey,
    baseUrl,
    actions: { setCredentials, setAuthenticated },
  } = useApiStore();

  const apiKeyInput = useRef<HTMLInputElement>(null);
  const baseUrlInput = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (baseUrl: string, apiKey: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const success = await verifyAuthentication(client, apiKey, baseUrl);
        if (!success) {
          setError("Invalid API key. Please check your key and try again.");
          return;
        }
        setCredentials(apiKey, baseUrl);
        setAuthenticated(true);
      } catch (err) {
        setError(
          "Failed to connect to Hydrus API. Please check the URL and try again.",
        );
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [setCredentials, setAuthenticated],
  );

  // Check URL hash parameters on mount
  useEffect(() => {
    if (
      window.location.hash &&
      window.location.hash.startsWith("#") &&
      !isLoading
    ) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const hashBaseUrl = hashParams.get("baseUrl");
      const hashApiKey = hashParams.get("apiKey");

      if (hashBaseUrl && hashApiKey) {
        submit(hashBaseUrl, hashApiKey);
        // Clear hash after attempting login
        hashParams.delete("baseUrl");
        hashParams.delete("apiKey");
        window.location.hash = hashParams.toString();
      }
    }
  }, [isLoading, submit]);

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();
    if (!baseUrlInput.current || !apiKeyInput.current) {
      return;
    }
    submit(baseUrlInput.current.value, apiKeyInput.current.value);
  };

  return (
    <div className="setup-screen">
      <div className="setup-form-container">
        <h1 className="setup-heading">Hydrui Setup</h1>
        <form onSubmit={handleSubmit}>
          <div className="setup-input-group">
            <label htmlFor="baseUrl" className="setup-label">
              API URL
            </label>
            <input
              type="text"
              name="hydrusApiUrl"
              id="baseUrl"
              ref={baseUrlInput}
              defaultValue={baseUrl}
              className="setup-input"
              placeholder="Enter your Hydrus API URL"
              required
            />
          </div>

          <div className="setup-input-group-large">
            <label htmlFor="apiKey" className="setup-label">
              API Key
            </label>
            <input
              type="password"
              name="hydrusApiKey"
              id="apiKey"
              ref={apiKeyInput}
              defaultValue={apiKey}
              className="setup-input"
              placeholder="Enter your Hydrus API key"
              required
            />
            <p className="setup-help-text">
              You can find this in hydrus client under Services &gt; Review
              Services &gt; Client API. This information will be stored locally
              in your browser and used only to communicate with the hydrus API.
            </p>
          </div>

          {error && (
            <div className="setup-error">
              <p>{error}</p>
              <p>
                <small>
                  Check the{" "}
                  <a href="https://hydrui.dev/en/docs/basic-usage/getting-started/">
                    Getting Started
                  </a>{" "}
                  documentation if you need help.
                </small>
              </p>
            </div>
          )}

          <div className="setup-form-buttons">
            <PushButton
              onClick={handleSubmit}
              disabled={isLoading}
              variant="primary"
            >
              {isLoading ? "Connecting..." : "Connect"}
            </PushButton>
            <a
              className={"push-button primary"}
              href="https://hydrui.dev/en/docs/basic-usage/getting-started/"
              title={
                "The Getting Started documentation walks you through setting up an API key."
              }
            >
              Help
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SetupScreen;
