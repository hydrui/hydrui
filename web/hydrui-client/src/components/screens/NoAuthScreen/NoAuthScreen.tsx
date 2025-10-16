import React, { useEffect, useState } from "react";

import ToastContainer from "@/components/widgets/Toast/ToastContainer";
import { client, useApiActions, verifyAuthentication } from "@/store/apiStore";

import "./index.css";

let globalLogin: Promise<void> | undefined = undefined;

const NoAuthScreen: React.FC = () => {
  const { setAuthenticated } = useApiActions();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function logIn() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/login", {
          method: "POST",
          body: JSON.stringify({ username: "", password: "" }),
        });
        if (response.status !== 200) {
          setError("Failed to create a session.");
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
        globalLogin = undefined;
      }
    }
    if (!globalLogin) {
      globalLogin = logIn();
    }
  }, [setAuthenticated]);

  return (
    <div className="no-auth-screen">
      <div className="no-auth-form-container">
        <h1 className="no-auth-heading">Start Session</h1>
        {isLoading && <p className="no-auth-message">Creating session...</p>}
        {error && <div className="no-auth-error">{error}</div>}
      </div>
      <ToastContainer />
    </div>
  );
};

export default NoAuthScreen;
