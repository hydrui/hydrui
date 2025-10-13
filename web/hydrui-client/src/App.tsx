import { useState } from "react";
import { ErrorBoundary } from "react-error-boundary";

import LoginScreen from "@/components/screens/LoginScreen/LoginScreen";
import MainScreen from "@/components/screens/MainScreen/MainScreen";
import NoAuthScreen from "@/components/screens/NoAuthScreen/NoAuthScreen";
import SetupScreen from "@/components/screens/SetupScreen/SetupScreen";
import Crash from "@/components/widgets/Crash/Crash";
import { useApiStore } from "@/store/apiStore";
import { isServerMode, noAuth } from "@/utils/serverMode";

function AppImpl() {
  const { isAuthenticated, checkingAuthentication } = useApiStore();

  if (checkingAuthentication) {
    return (
      <div className="app-loading-container">
        <div className="app-loading-spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (isServerMode) {
      if (noAuth) {
        return <NoAuthScreen />;
      } else {
        return <LoginScreen />;
      }
    } else {
      return <SetupScreen />;
    }
  }
  return <MainScreen />;
}

export function App() {
  const [errorInfo, setErrorInfo] = useState<React.ErrorInfo>();
  return (
    <ErrorBoundary
      fallbackRender={(props) => (
        <Crash componentName="Hydrui" errorInfo={errorInfo} {...props} />
      )}
      onError={(_, errorInfo) => setErrorInfo(errorInfo)}
    >
      <AppImpl />
    </ErrorBoundary>
  );
}
