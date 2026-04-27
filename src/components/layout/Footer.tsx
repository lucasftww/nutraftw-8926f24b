/**
 * Footer minimalista no estilo VitrineTurbo:
 * apenas marca centralizada + link "Crie sua Vitrine Digital".
 */
export function Footer() {
  return (
    <footer className="mt-auto py-4 bg-muted/30">
      <div className="container mx-auto px-4 flex flex-col items-center space-y-1">
        <a href="/" className="flex items-center mb-0.5">
          <span className="font-bold text-lg tracking-tight text-foreground">
            GIMPORTS
          </span>
        </a>
        <div className="flex items-center gap-4 text-sm">
          <a
            href="/login"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            Acesse sua conta
          </a>
        </div>
      </div>
    </footer>
  );
}
