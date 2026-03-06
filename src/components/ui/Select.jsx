export default function Select(props) {
  return (
    <select
      {...props}
      className={
        "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[#C47A3A]/35"
      }
    />
  );
}
