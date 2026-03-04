export function normalizeBrPhone(input: string): string {
  const digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return "";

  // Remove leading 00/0
  const cleaned = digits.replace(/^0+/, "");

  // If already has country code 55
  if (cleaned.startsWith("55") && cleaned.length >= 12) {
    return `+${cleaned}`;
  }

  // If has DDD + number (10/11 digits)
  if (cleaned.length === 10 || cleaned.length === 11) {
    return `+55${cleaned}`;
  }

  // Fallback: assume BR
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

function onlyDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export function formatBrPhoneForDisplay(raw: string | null | undefined): string {
  const digits = onlyDigits(raw);
  if (!digits) return "";

  // Support legacy E.164 (+55...) and the new format (digits only).
  const br = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;

  // Expect DDD + 8/9 digits
  if (br.length === 11) {
    const ddd = br.slice(0, 2);
    const rest = br.slice(2);
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  if (br.length === 10) {
    const ddd = br.slice(0, 2);
    const rest = br.slice(2);
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }

  // If something unexpected, show the digits (never show +55 prefix explicitly).
  return br;
}

function toWhatsDigits(phoneRaw: string) {
  const d = onlyDigits(phoneRaw);
  if (!d) return "";
  // If already has BR country code
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  // If it looks like BR without country code, add it
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

export function buildWhatsAppLink(phoneRaw: string, message: string) {
  const digits = toWhatsDigits(phoneRaw);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${encoded}`;
}