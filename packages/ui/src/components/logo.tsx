import { cn } from "../utils";

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  [key: string]: unknown | undefined;
}

export function Logo({ width, height, className, ...args }: LogoProps) {
  return (
    <svg
      {...args}
      width={width ?? 40}
      height={height ?? 40}
      xmlns="http://www.w3.org/2000/svg"
      className={cn(`text-primary ${className}`)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1 6H4V18H1V6ZM5 6H8L10 18H7L5 6ZM12 6H15L13 18H10L12 6ZM16 6H19V18H16V6ZM16 15H19V18H16V15ZM20 15H23V18H20V15Z"
        fill="currentColor"
      />
    </svg>
  );
}
