import CinnamonLoader from "./ui/CinnamonLoader";

export default function BunProgress({ count = 3 }) {
  return (
    <div role="progressbar" aria-label="Waiting for order confirmation" style={{ height: "calc(36px + var(--hop-height, 40px))" }} className="relative my-3 overflow-hidden border-b-4 border-brandCinnamon/40">
      <div className="absolute inset-x-0 bottom-0">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="receipt-bun absolute bottom-0 inline-flex text-brandBrown"
            style={{ left: `calc(${(i + 0.5) * 100 / count}% - 16px)`, "--phase": -(i + 0.5) / count, "--hop-delay": `${-i * 0.17}s` }}>
            <CinnamonLoader size={32} className="receipt-bun-hop" />
          </span>
        ))}
      </div>
    </div>
  );
}
