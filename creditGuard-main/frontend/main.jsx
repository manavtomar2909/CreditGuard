import React from "react";
import ReactDOM from "react-dom/client";
import FraudGuardDashboard from "./FraudGuardDashboard";

// main.jsx / index.jsx
import { BrowserRouter } from "react-router-dom";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <FraudGuardDashboard />
    </BrowserRouter>
  </React.StrictMode>,
);
