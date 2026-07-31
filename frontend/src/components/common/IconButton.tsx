import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  children: ReactNode;
};

export function IconButton({ label, active = false, children, className = "", ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`icon-button ${active ? "is-active" : ""} ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
