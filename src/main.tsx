import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyTheme, storedTheme } from "./app/providers";
import { startAppUpdates } from "./lib/appUpdate";
import "./styles/index.css";

applyTheme(storedTheme());
if (import.meta.env.PROD) startAppUpdates();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
