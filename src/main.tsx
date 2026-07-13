import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
// Register strategies once at import time.
import "./simulation/dispatch/all";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
