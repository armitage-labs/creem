import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App.jsx";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!convexUrl) {
  throw new Error(
    "VITE_CONVEX_URL is required for the connected billing demo.",
  );
}

const convex = new ConvexReactClient(convexUrl);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </React.StrictMode>,
);
