/* eslint-disable @next/next/no-img-element */
export function Avatar({ name, src, size = 36 }: { name: string; src: string | null; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  return src ? (
    <img src={src} alt={name} style={style} className="shrink-0 rounded-full object-cover ring-1 ring-line" />
  ) : (
    <span style={style} className="flex shrink-0 items-center justify-center rounded-full bg-accent font-display font-semibold text-white" aria-label={name}>
      {initials}
    </span>
  );
}
