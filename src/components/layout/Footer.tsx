export function Footer() {
  return (
    <footer className="bg-white border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="font-bold text-xl text-primary">GIMPORTS</span>
            </div>
            <p className="text-muted-foreground text-sm">
              A sua loja de importados com os melhores preços e garantia de qualidade.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-foreground mb-4">Links Úteis</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="/" className="hover:text-primary transition-colors">
                  Produtos
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/5511999999999"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  Suporte
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-foreground mb-4">Atendimento</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Precisa de ajuda? Fale com nosso suporte diretamente pelo WhatsApp.
            </p>
            <a
              href="https://wa.me/5511999999999"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl transition-all border-2 h-12 px-6 font-medium w-full border-green-500 text-green-600 hover:bg-green-50 hover:border-green-600"
            >
              <svg
                aria-hidden="true"
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
              </svg>
              Suporte via WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} GIMPORTS - Todos os direitos reservados</p>
        </div>
      </div>
    </footer>
  );
}
