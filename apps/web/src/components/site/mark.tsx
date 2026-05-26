import Link from "next/link";

export function Mark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="MuseumLite home"
      className={`flex items-center gap-2.5 group ${className}`}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        className="text-gold transition-transform group-hover:scale-105"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M1 6H4V18H1V6ZM5 6H8L10 18H7L5 6ZM12 6H15L13 18H10L12 6ZM16 6H19V18H16V6ZM16 15H19V18H16V15ZM20 15H23V18H20V15Z"
          fill="currentColor"
        />
      </svg>
      <span className="font-display text-xl tracking-wide text-ivory">
        MuseumLite
      </span>
    </Link>
  );
}
