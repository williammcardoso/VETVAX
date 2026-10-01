const PALETTE = [
  "border-[#ddd6fe] bg-[#f5f3ff] text-[#5b21b6]",
  "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]",
  "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
  "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
  "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]",
  "border-[#a7f3d0] bg-[#ecfeff] text-[#0f766e]",
  "border-[#fde68a] bg-[#fffbeb] text-[#b45309]",
];

export function getItemTone(itemName: string) {
  const value = itemName.toLowerCase();
  if (value.includes("v8") || value.includes("v10") || value.includes("polivalente")) return "border-[#ddd6fe] bg-[#f5f3ff] text-[#5b21b6]";
  if (value.includes("raiva") || value.includes("antirr")) return "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]";
  if (value.includes("giardia") || value.includes("verm")) return "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]";
  if (value.includes("lepto") || value.includes("gripe") || value.includes("influenza")) return "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]";
  if (value.includes("fiv") || value.includes("felv")) return "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]";
  const hash = value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
}
