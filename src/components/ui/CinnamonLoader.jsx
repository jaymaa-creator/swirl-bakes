export default function CinnamonLoader({ size = 20, className = "" }) {
  return (
    <span
      className={`cinnamon-loader inline-flex shrink-0 items-center justify-center ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="cinnamon-loader__rotor inline-flex h-full w-full items-center justify-center">
        <svg
          className="block h-full w-full shrink-0"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect x="4" y="4" width="24" height="24" rx="4.5" fill="currentColor" opacity="0.16" />
          <path
            d="M24.5 24.5V20.6C24.5 16.6 21.3 13.4 17.3 13.4H15.5C12.4 13.4 10 15.9 10 19C10 22.1 12.4 24.5 15.5 24.5H17.2C19.3 24.5 21 22.8 21 20.7C21 18.6 19.3 16.9 17.2 16.9H15.9C14.7 16.9 13.7 17.9 13.7 19.1C13.7 20.3 14.7 21.3 15.9 21.3C17 21.3 17.9 20.4 17.9 19.3C17.9 18.3 17.1 17.5 16.1 17.5"
            stroke="currentColor"
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  );
}
