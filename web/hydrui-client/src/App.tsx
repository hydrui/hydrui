import LoginScreen from "@/components/screens/LoginScreen/LoginScreen";
import MainScreen from "@/components/screens/MainScreen/MainScreen";
import SetupScreen from "@/components/screens/SetupScreen/SetupScreen";
import { useApiStore } from "@/store/apiStore";
import { isServerMode } from "@/utils/serverMode";

export const App = () => {
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
};
