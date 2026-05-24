import React from "react";
import { createRoot } from "react-dom/client";
import { ScreensaverApp } from "./ScreensaverApp";
import "../styles.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ScreensaverApp />
  </React.StrictMode>,
);
