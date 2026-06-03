import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  // Dev: Vite transforms TS on the fly. Prod: esbuild emits dist/sw.js at root scope.
  const swUrl = import.meta.env.DEV ? "/src/sw.ts" : "/sw.js";
  navigator.serviceWorker.register(swUrl, { type: "module" });
}
