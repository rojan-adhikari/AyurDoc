import { cn } from "@/lib/utils";

export function AyurDocLogo({
  className,
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className={cn("ayurdoc-logo", className)}
      height={size}
      viewBox="0 0 64 64"
      width={size}
    >
      <defs>
        <linearGradient id="ayurdoc-leaf" x1="10" x2="52" y1="8" y2="58">
          <stop offset="0" stopColor="#0f8a62" />
          <stop offset="1" stopColor="#075848" />
        </linearGradient>
        <linearGradient id="ayurdoc-sun" x1="20" x2="47" y1="8" y2="46">
          <stop offset="0" stopColor="#f4a13a" />
          <stop offset="1" stopColor="#d96f24" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill="#f7fff9" stroke="#d5eadf" strokeWidth="2" />
      <path
        d="M31.8 47.8c-8.3-6.3-12.4-13-12.4-20.1 0-7.4 5-12.2 12.4-14.7 7.4 2.5 12.5 7.3 12.5 14.7 0 7.1-4.2 13.8-12.5 20.1Z"
        fill="url(#ayurdoc-leaf)"
      />
      <path
        d="M30.8 45.8C19 44.2 12.7 37 12.1 25.1c7.4-.7 13.2 1.4 17.2 6.2"
        fill="#5caf62"
        stroke="#f7fff9"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path
        d="M33.2 45.8C45 44.2 51.3 37 51.9 25.1c-7.4-.7-13.2 1.4-17.2 6.2"
        fill="#86bd45"
        stroke="#f7fff9"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path d="M32 18.4v22.8" stroke="#fff" strokeLinecap="round" strokeWidth="3.2" />
      <path d="M24.4 29.8H29l2.2-4.1 3.2 8.1 2.2-4h4.1" fill="none" stroke="url(#ayurdoc-sun)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" />
      <circle cx="32" cy="11" r="3.4" fill="url(#ayurdoc-sun)" />
    </svg>
  );
}
