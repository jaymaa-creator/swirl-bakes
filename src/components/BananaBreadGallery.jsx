const PHOTOS = [
  {
    src: "/banana-bread-loaf.webp",
    alt: "Banana bread loaf with a slice on a wooden board",
    className: "sm:col-span-2 sm:row-span-2",
  },
  {
    src: "/banana-bread-slices.webp",
    alt: "Sliced banana bread served on a ceramic plate",
    className: "sm:col-span-1",
  },
  {
    src: "/banana-bread-board.webp",
    alt: "Banana bread with a banana and baking tools on a wooden board",
    caption: "Chocolate-chip variation from a previous kitchen bake",
    className: "sm:col-span-1",
  },
  {
    src: "/banana-bread-choc-chip.webp",
    alt: "A banana bread loaf with chocolate chips on a wooden board",
    caption: "Chocolate-chip variation from a previous kitchen bake",
    className: "sm:col-span-2",
  },
];

export default function BananaBreadGallery() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4" data-reveal="left">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-inkMuted">From The Oven</div>
          <h2 className="mt-2 text-3xl text-ink sm:text-4xl">Banana bread, baked for sharing.</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-inkMuted">
          A few scenes from our latest banana bread bake, from the first slice to the last crumb.
        </p>
      </div>

      <div className="mt-7 grid auto-rows-[210px] gap-3 sm:grid-cols-4 sm:auto-rows-[190px]">
        {PHOTOS.map((photo) => (
          <figure
            key={photo.src}
            className={`relative overflow-hidden rounded-card bg-[#E9DCCF] ${photo.className}`}
            data-reveal="up"
          >
            <img
              src={photo.src}
              alt={photo.alt}
              className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
              loading="lazy"
              decoding="async"
            />
            {photo.caption ? (
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brandBrown/80 to-transparent px-4 pb-3 pt-10 text-xs font-medium text-white">
                {photo.caption}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  );
}
