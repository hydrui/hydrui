import { useState } from "react";
import { ErrorBoundary } from "react-error-boundary";

import LoginScreen from "@/components/screens/LoginScreen/LoginScreen";
import MainScreen from "@/components/screens/MainScreen/MainScreen";
import SetupScreen from "@/components/screens/SetupScreen/SetupScreen";
import Crash from "@/components/widgets/Crash/Crash";
import { useApiStore } from "@/store/apiStore";
import { isServerMode } from "@/utils/serverMode";

function AppImpl() {
  const { isAuthenticated, checkingAuthentication } = useApiStore();

  if (checkingAuthentication) {
    return (
      <div className="app-loading-container">
        <div className="app-loading-spinner"></div>
      </div>
    );
  }

  if (!isServerMode) {
    if (!isAuthenticated) {
      return <SetupScreen />;
    }
  } else {
    if (!isAuthenticated) {
      return <LoginScreen />;
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
