import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext"; // Import LanguageProvider
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import { AgentProvider } from "./contexts/AgentContext";

import "./index.css";

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Root element (#root) not found in index.html");
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <AuthProvider>
      <LanguageProvider> {/* Wrap with LanguageProvider */}
        <WorkspaceProvider>
          <AgentProvider>
            <HashRouter>
              <App />
            </HashRouter>
          </AgentProvider>
        </WorkspaceProvider>
      </LanguageProvider> {/* Close LanguageProvider */}
    </AuthProvider>
  </React.StrictMode>
);
