import type { Tutor } from "@/types/vetvax";

export function formatTutorAddressLine(t: Pick<Tutor, "street" | "number" | "city" | "neighborhood" | "uf"> | null | undefined) {
  if (!t) return "";
  const streetPart = [t.street, t.number].filter(Boolean).join(", ");
  const cityPart = [t.city].filter(Boolean).join("");
  const regionPart = [t.neighborhood, cityPart].filter(Boolean).join(" • ");
  const uf = t.uf ? String(t.uf).toUpperCase() : "";

  const tail = [regionPart, uf].filter(Boolean).join(uf && regionPart ? " • " : "");
  return [streetPart, tail].filter(Boolean).join(streetPart && tail ? " • " : "");
}

export function buildGoogleMapsUrl(t: Pick<Tutor, "street" | "number" | "city" | "neighborhood" | "uf"> | null | undefined) {
  if (!t) return null;
  const parts = [[t.street, t.number].filter(Boolean).join(", "), t.neighborhood, t.city, t.uf].filter(Boolean);
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`;
}
