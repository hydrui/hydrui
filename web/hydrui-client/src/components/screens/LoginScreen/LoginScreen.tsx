import React, { useCallback, useRef, useState } from "react";

import PushButton from "@/components/widgets/PushButton/PushButton";
import ToastContainer from "@/components/widgets/Toast/ToastContainer";
import { client, useApiActions, verifyAuthentication } from "@/store/apiStore";

import "./index.css";

const LoginScreen: React.FC = () => {
  const { setAuthenticated } = useApiActions();
  const inputUsername = useRef("");
  const inputPassword = useRef("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (username: string, password: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/login", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        });
        if (response.status !== 200) {
          setError("Invalid username or password.");
          return;
        }
        if (await verifyAuthentication(client, "", "")) {
          setAuthenticated(true);
        } else {
          setError(
            "Hydrus API key is invalid. Check Hydrui server configuration.",
          );
        }
      } catch (err) {
        setError("Failed to connect to Hydrus API.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [setAuthenticated],
  );

  const handleSubmit = useCallback(
    async (
      e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
    ) => {
      e.preventDefault();
      await submit(inputUsername.current, inputPassword.current);
    },
    [submit],
  );

  return (
    <div className="login-screen">
      <div className="login-form-container">
        <h1 className="login-heading">Hydrui Login</h1>

        <form onSubmit={handleSubmit}>
          <div className="login-input-group">
            <label htmlFor="username" className="login-label">
              Username
            </label>
            <input
              type="text"
              id="username"
              onChange={(e) => (inputUsername.current = e.target.value)}
              className="login-input"
              placeholder="Username"
              required
            />
          </div>

          <div className="login-input-group-large">
            <label htmlFor="password" className="login-label">
              Password
            </label>
            <input
              type="password"
              id="password"
              onChange={(e) => (inputPassword.current = e.target.value)}
              className="login-input"
              placeholder="Password"
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <PushButton
            disabled={isLoading}
            variant="primary"
            onClick={handleSubmit}
          >
            {isLoading ? "Logging in..." : "Log in"}
          </PushButton>
        </form>
      </div>
      <ToastContainer />
    </div>
  );
};

export default LoginScreen;
