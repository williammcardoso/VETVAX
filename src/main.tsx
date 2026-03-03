import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

// Força o tema claro (o app foi desenhado como SaaS light por padrão)
document.documentElement.classList.remove("dark");
document.body.classList.remove("dark");

// Evita overlay/erro fatal do dev server para AbortError do lock do Supabase Auth.
// (não afeta erros reais do app)
window.addEventListener("unhandledrejection", (event) => {
  const reason: any = (event as any).reason;
  const msg = String(reason?.message ?? reason ?? "");
  if (reason?.name === "AbortError" && msg.includes("Lock broken by another request")) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);