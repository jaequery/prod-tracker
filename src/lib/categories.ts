export const CATEGORY_STYLES: Record<string, { label: string; color: string }> = {
  startup: { label: "Startup", color: "bg-emerald-100 text-emerald-700" },
  "open-source": { label: "OSS", color: "bg-blue-100 text-blue-700" },
  "dev-tool": { label: "Dev Tool", color: "bg-indigo-100 text-indigo-700" },
  "ai-ml": { label: "AI/ML", color: "bg-purple-100 text-purple-700" },
  "video-game": { label: "Game", color: "bg-pink-100 text-pink-700" },
  hardware: { label: "Hardware", color: "bg-orange-100 text-orange-700" },
  educational: { label: "Educational", color: "bg-cyan-100 text-cyan-700" },
  informational: { label: "Info", color: "bg-teal-100 text-teal-700" },
  research: { label: "Research", color: "bg-violet-100 text-violet-700" },
  content: { label: "Content", color: "bg-amber-100 text-amber-700" },
  demo: { label: "Demo", color: "bg-rose-100 text-rose-700" },
  hobby: { label: "Hobby", color: "bg-yellow-100 text-yellow-700" },
  other: { label: "Other", color: "bg-neutral-100 text-neutral-600" },
};

const FALLBACK_STYLE = { label: "", color: "bg-neutral-100 text-neutral-600" };

export function categoryStyle(c: string | null) {
  if (!c) return null;
  return CATEGORY_STYLES[c] ?? { label: c, color: FALLBACK_STYLE.color };
}

export function categoryLabel(c: string): string {
  return CATEGORY_STYLES[c]?.label ?? c;
}
