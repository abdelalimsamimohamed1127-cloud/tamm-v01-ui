import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { WorkspaceProvider } from "./hooks/useWorkspace";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <LanguageProvider>
        <WorkspaceProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </WorkspaceProvider>
      </LanguageProvider>
    </AuthProvider>
  </React.StrictMode>
);
