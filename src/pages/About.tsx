import { Link } from "react-router-dom";
import { ShieldCheck, Truck, Lock, MessageCircle, ArrowRight, Sparkles } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

export default function About() {
  useSEO({
    title: "Sobre — quem somos e como trabalhamos",
    description:
      "Conheça nossa curadoria de farmacêuticos importados, atendimento humano e entrega para todo o Brasil com pagamento seguro.",
    type: "website",
  });

  return (
    <section className="container max-w-4xl mx-auto px-4 py-10 md:py-14 animate-in fade-in duration-500">
      {/* HERO — eyebrow + título com gradient + lead */}
      <div className="max-w-2xl">
        <p className="inline-flex items-center gap-1.5 text-2xs sm:text-xs font-bold uppercase tracking-[0.18em] text-secondary-text mb-3">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
          Sobre a Royal Vitta
        </p>
        <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05]">
          Farmacêuticos importados,{" "}
          <span className="bg-gradient-brand bg-clip-text text-transparent">
            sem mistério
          </span>
          .
        </h1>
        <p className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed">
          Nascemos para tornar o acesso a produtos farmacêuticos importados
          simples, transparente e confiável. Selecionamos cada item do catálogo
          pensando em qualidade, procedência e no que realmente faz sentido para
          quem busca cuidado com a saúde sem complicação.
        </p>
      </div>

      {/* PILARES — grid 2x2 com cards refinados */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <Pillar
          icon={ShieldCheck}
          title="Curadoria séria"
          text="Trabalhamos apenas com produtos que passariam no nosso próprio filtro. Sem catálogo inflado."
          tone="primary"
        />
        <Pillar
          icon={Truck}
          title="Entrega no Brasil"
          text="Envio rastreado para todo o país, com embalagem discreta e prazo previsível."
          tone="cyan"
        />
        <Pillar
          icon={Lock}
          title="Pagamento seguro"
          text="PIX (5% OFF à vista) e cartão em até 3x sem juros — criptografia ponta a ponta."
          tone="success"
        />
        <Pillar
          icon={MessageCircle}
          title="Suporte humano"
          text="Atendimento direto via WhatsApp para tirar dúvidas reais — sem chatbot genérico."
          tone="whatsapp"
        />
      </div>

      {/* CTA FINAL — chamada clara para o catálogo */}
      <div className="mt-12 md:mt-16 rounded-3xl border border-border/60 bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-6 sm:p-8 text-center">
        <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">
          Pronto para começar?
        </h2>
        <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-md mx-auto">
          Explore o catálogo curado e encontre seu produto com preço transparente
          no PIX.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary-glow active:scale-[0.98] transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Ver catálogo
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </Link>
      </div>
    </section>
  );
}

const TONE_CLASSES: Record<"primary" | "cyan" | "success" | "whatsapp", string> = {
  primary: "bg-primary/10 text-primary",
  cyan: "bg-brand-cyan/15 text-brand-cyan-text",
  success: "bg-success/10 text-success",
  whatsapp: "bg-whatsapp/10 text-whatsapp",
};

function Pillar({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
  tone: "primary" | "cyan" | "success" | "whatsapp";
}) {
  return (
    <div className="rounded-2xl border border-border/60 p-5 bg-card hover:border-primary/30 hover:shadow-sm transition-all">
      <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl mb-3 ${TONE_CLASSES[tone]}`}>
        <Icon className="h-5 w-5" strokeWidth={2.25} />
      </div>
      <h3 className="font-bold text-sm text-foreground">{title}</h3>
      <p className="text-sm-plus text-muted-foreground mt-1.5 leading-relaxed">{text}</p>
    </div>
  );
}
