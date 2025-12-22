import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";

import "./index.css";

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Root element (#root) not found in index.html");
}

ReactDOM.createRoot(rootEl).render(
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
