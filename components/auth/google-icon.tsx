interface GoogleIconProps {
  size?: number;
  className?: string;
}

export function GoogleIcon({ size = 16, className }: GoogleIconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.5 29.6 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.5-.2-3-.4-4.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 7 29.6 5 24 5c-7.8 0-14.5 4.4-17.7 10.8z"
      />
      <path
        fill="#4CAF50"
        d="M24 45.5c5.5 0 10.4-2 14-5.3l-6.5-5.3c-1.9 1.3-4.4 2.1-7.5 2.1-5.3 0-9.7-3.3-11.3-8L6.2 33.9C9.3 40.5 16.1 45.5 24 45.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.5 5.3c-.5.5 6.8-5 6.8-14 0-1.5-.2-3-.4-4.5z"
      />
    </svg>
  );
}
