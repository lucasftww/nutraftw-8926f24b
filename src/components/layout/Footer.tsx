import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground mt-20">
      <div className="container py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <img src="/logo-gimports.webp" alt="GIMPORTS" className="h-10 w-auto" />
            <span className="font-display text-2xl font-extrabold">GIMPORTS</span>
          </div>
          <p className="text-sm text-primary-foreground/80 leading-relaxed">
            Importados farmacêuticos com curadoria, preços transparentes e suporte dedicado.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-base mb-4">Links úteis</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/" className="text-primary-foreground/80 hover:text-white transition-colors">Catálogo</Link></li>
            <li><Link to="/minha-conta" className="text-primary-foreground/80 hover:text-white transition-colors">Minha conta</Link></li>
            <li><Link to="/sobre" className="text-primary-foreground/80 hover:text-white transition-colors">Sobre</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-base mb-4">Atendimento</h4>
          <p className="text-sm text-primary-foreground/80 mb-4">
            Precisa de ajuda? Fale com nossa equipe pelo WhatsApp.
          </p>
          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white text-primary font-semibold text-sm hover:bg-white/90 transition-colors"
          >
            WhatsApp
          </a>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container py-5 text-xs text-primary-foreground/70 text-center">
          © {new Date().getFullYear()} GIMPORTS · Loja online
        </div>
      </div>
    </footer>
  );
}
