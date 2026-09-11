import { cn } from "@/lib/utils";

type VetVaxMarkProps = {
  className?: string;
};

export default function VetVaxMark({ className }: VetVaxMarkProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("h-10 w-10", className)}>
      <defs>
        <linearGradient id="vetvax-main" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="55%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <linearGradient id="vetvax-shine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#vetvax-main)" />
      <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#vetvax-shine)" />

      <g fill="#ecfeff">
        <rect x="18" y="20" width="24" height="6" rx="3" transform="rotate(-35 18 20)" />
        <rect x="25" y="28" width="17" height="8" rx="4" transform="rotate(-35 25 28)" />
        <rect x="35" y="36" width="11" height="5" rx="2.5" transform="rotate(-35 35 36)" />
        <rect x="18" y="24" width="6" height="8" rx="3" transform="rotate(-35 18 24)" />
      </g>

      <g fill="#fef3c7">
        <ellipse cx="47" cy="42" rx="6" ry="5" />
        <circle cx="41" cy="37" r="2.2" />
        <circle cx="45.5" cy="34.5" r="2.1" />
        <circle cx="50" cy="34.2" r="2.1" />
        <circle cx="54" cy="36.8" r="2.2" />
      </g>
    </svg>
  );
}
