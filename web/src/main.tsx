import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import DetilInfo from "./pages/detil info";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DetilInfo />
  </StrictMode>,
);