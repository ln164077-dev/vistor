import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPageLoadTimer } from "./lib/security";

// Initialize time-based honeypot timer on load
initPageLoadTimer();

createRoot(document.getElementById("root")!).render(<App />);
