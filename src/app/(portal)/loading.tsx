// Esqueleto mostrado enquanto a página carrega (melhora a percepção de velocidade).
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="h-3 w-24 rounded bg-grid" />
      <div className="h-7 w-64 rounded bg-grid" />
      <div className="h-4 w-96 max-w-full rounded bg-grid" />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-brand border border-line bg-line md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-surface" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 rounded-brand border border-line bg-surface" />)}
      </div>
    </div>
  );
}
