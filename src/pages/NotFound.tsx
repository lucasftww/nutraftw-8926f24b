export default function NotFound() {
  return (
    <div className="container py-32 text-center">
      <h1 className="font-display text-6xl font-extrabold text-primary mb-3">404</h1>
      <p className="text-muted-foreground mb-6">Página não encontrada.</p>
      <a href="/" className="text-primary font-semibold hover:underline">← Voltar ao catálogo</a>
    </div>
  );
}
