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

export function formatBrPhoneForDisplay(e164: string | null | undefined): string {
  const digits = (e164 ?? "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return e164 ?? "";
}

export function buildWhatsAppLink(phoneE164: string, message: string) {
  const digits = phoneE164.replace(/\D/g, "");
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${encoded}`;
}
