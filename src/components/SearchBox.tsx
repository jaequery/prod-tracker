export default function SearchBox({
  initialQuery = "",
  autoFocus = false,
}: {
  initialQuery?: string;
  autoFocus?: boolean;
}) {
  return (
    <form
      action="/search"
      method="GET"
      role="search"
      className="flex items-stretch gap-2 w-full"
    >
      <input
        type="search"
        name="q"
        defaultValue={initialQuery}
        autoFocus={autoFocus}
        placeholder="Search products by title, summary, or description…"
        aria-label="Search products"
        className="flex-1 px-4 py-3 border-2 border-neutral-200 rounded-xl text-base font-500 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
      />
      <button
        type="submit"
        className="px-5 py-3 border-2 border-neutral-900 bg-neutral-900 text-white rounded-xl text-sm font-700 uppercase tracking-widest hover:bg-white hover:text-neutral-900 transition-colors"
      >
        Search
      </button>
    </form>
  );
}
