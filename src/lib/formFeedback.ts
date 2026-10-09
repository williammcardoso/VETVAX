import { useCallback, useRef, useState } from "react";

/** Scrolls to the field, focuses it and flashes a red highlight so a skipped required field can't be missed. */
export function flashField(name: string) {
  const el = document.querySelector<HTMLElement>(`[data-field="${name}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("vetvax-field-error");
  void el.offsetWidth;
  el.classList.add("vetvax-field-error");
  window.setTimeout(() => el.querySelector<HTMLElement>("button, input, textarea, select")?.focus({ preventScroll: true }), 400);
  window.setTimeout(() => el.classList.remove("vetvax-field-error"), 3500);
}

/** Returns a class to apply to the submit button and a trigger that makes it shake. */
export function useShake() {
  const [shaking, setShaking] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const trigger = useCallback(() => {
    setShaking(false);
    window.clearTimeout(timer.current);
    window.setTimeout(() => setShaking(true), 20);
    timer.current = window.setTimeout(() => setShaking(false), 700);
  }, []);
  return { shakeClass: shaking ? "vetvax-shake" : "", trigger };
}
