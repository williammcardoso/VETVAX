import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

// Força o tema claro (o app foi desenhado como SaaS light por padrão)
document.documentElement.classList.remove("dark");
document.body.classList.remove("dark");

createRoot(document.getElementById("root")!).render(<App />);