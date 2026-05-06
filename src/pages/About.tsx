import { Link } from "react-router-dom";
import { ShieldCheck, Truck, Lock, MessageCircle } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

export default function About() {
  useSEO({
     title: "Sobre — quem somos e como trabalhamos",
     description:
       "Conheça nossa curadoria de farmacêuticos importados, atendimento humano e entrega para todo o Brasil com pagamento seguro.",
    type: "website",
  });

  return (
    <div className="container max-w-3xl mx-auto px-4 py-12 md:py-16">
       <h1 className="font-display text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
         Sobre
       </h1>
       <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">
         Nascemos para tornar o acesso a produtos farmacêuticos importados
        simples, transparente e confiável. Selecionamos cada item do catálogo
        pensando em qualidade, procedência e no que realmente faz sentido para
        quem busca cuidado com a saúde sem complicação.
      </p>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Pillar
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Curadoria séria"
          text="Trabalhamos apenas com produtos que passariam no nosso próprio filtro."
        />
        <Pillar
          icon={<Truck className="h-5 w-5" />}
          title="Entrega no Brasil"
          text="Envio rastreado para todo o país, com embalagem discreta."
        />
        <Pillar
          icon={<Lock className="h-5 w-5" />}
          title="Pagamento seguro"
          text="PIX e cartão com proteção em todas as etapas."
        />
        <Pillar
          icon={<MessageCircle className="h-5 w-5" />}
          title="Suporte humano"
          text="Atendimento direto via WhatsApp para tirar dúvidas reais."
        />
      </div>

      {/* CTA único: o botão WhatsApp vive apenas no ProductFooter para evitar duplicação. */}
      <div className="mt-12">
        <Link
          to="/"
          className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary-glow transition-colors"
        >
          Ver catálogo
        </Link>
      </div>
    </div>
  );
}

function Pillar({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border/60 p-5 bg-background">
      <div className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary mb-3">
        {icon}
      </div>
      <h2 className="font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{text}</p>
    </div>
  );
}