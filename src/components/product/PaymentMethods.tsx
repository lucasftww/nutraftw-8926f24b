/**
 * PaymentMethods — bandeiras reais de pagamento aceitas.
 * SVGs inline (sem dependência externa) com cores oficiais de cada bandeira.
 * Aumenta a confiança ao mostrar métodos concretos em vez de "pagamento seguro".
 */
export function PaymentMethods({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 flex-wrap ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
        Aceitamos
      </span>
      {/* Pix */}
      <span className="inline-flex items-center justify-center h-6 w-9 rounded bg-white border border-border shadow-sm" title="Pix">
        <svg viewBox="0 0 32 32" className="h-4 w-4">
          <path fill="#32BCAD" d="M9.6 22.4 4 16.8a1.13 1.13 0 0 1 0-1.6L9.6 9.6a1.13 1.13 0 0 1 1.6 0l5.6 5.6a1.13 1.13 0 0 1 0 1.6l-5.6 5.6a1.13 1.13 0 0 1-1.6 0Zm12.8 0-5.6-5.6a1.13 1.13 0 0 1 0-1.6l5.6-5.6a1.13 1.13 0 0 1 1.6 0L29.6 15.2a1.13 1.13 0 0 1 0 1.6L24 22.4a1.13 1.13 0 0 1-1.6 0Zm-6.4 6.4-5.6-5.6a1.13 1.13 0 0 1 0-1.6l5.6-5.6a1.13 1.13 0 0 1 1.6 0l5.6 5.6a1.13 1.13 0 0 1 0 1.6l-5.6 5.6a1.13 1.13 0 0 1-1.6 0Zm0-19.2L10.4 4a1.13 1.13 0 0 1 0-1.6 1.13 1.13 0 0 1 1.6 0l4 4 4-4a1.13 1.13 0 0 1 1.6 0 1.13 1.13 0 0 1 0 1.6l-5.6 5.6a1.13 1.13 0 0 1-1.6 0Z"/>
        </svg>
      </span>
      {/* Visa */}
      <span className="inline-flex items-center justify-center h-6 w-9 rounded bg-white border border-border shadow-sm" title="Visa">
        <svg viewBox="0 0 64 24" className="h-3 w-7">
          <text x="32" y="18" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="18" fill="#1A1F71" fontStyle="italic">VISA</text>
        </svg>
      </span>
      {/* Mastercard */}
      <span className="inline-flex items-center justify-center h-6 w-9 rounded bg-white border border-border shadow-sm" title="Mastercard">
        <svg viewBox="0 0 32 20" className="h-4 w-6">
          <circle cx="12" cy="10" r="7" fill="#EB001B"/>
          <circle cx="20" cy="10" r="7" fill="#F79E1B"/>
          <path d="M16 4.6a7 7 0 0 0 0 10.8 7 7 0 0 0 0-10.8Z" fill="#FF5F00"/>
        </svg>
      </span>
      {/* Elo */}
      <span className="inline-flex items-center justify-center h-6 w-9 rounded bg-black border border-border shadow-sm" title="Elo">
        <svg viewBox="0 0 40 16" className="h-3 w-7">
          <text x="20" y="12" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="11" fill="#fff">elo</text>
          <circle cx="11" cy="8" r="1.5" fill="#FFCB05"/>
          <circle cx="29" cy="8" r="1.5" fill="#EF4123"/>
        </svg>
      </span>
      {/* Amex */}
      <span className="inline-flex items-center justify-center h-6 w-9 rounded bg-[#006FCF] border border-border shadow-sm" title="American Express">
        <svg viewBox="0 0 40 16" className="h-3 w-7">
          <text x="20" y="12" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="9" fill="#fff">AMEX</text>
        </svg>
      </span>
      {/* Boleto */}
      <span className="inline-flex items-center justify-center h-6 px-1.5 rounded bg-white border border-border shadow-sm" title="Boleto">
        <span className="text-[9px] font-bold text-foreground tracking-tight">BOLETO</span>
      </span>
    </div>
  );
}