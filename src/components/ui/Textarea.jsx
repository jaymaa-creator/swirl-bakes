export default function Textarea(props) {
  return (
    <textarea
      {...props}
      className={
        "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-[#B58E72] focus:outline-none focus:ring-2 focus:ring-[#C47A3A]/35"
      }
    />
  );
}
