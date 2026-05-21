import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, Smartphone, WifiOff, Zap, Sparkles } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const isIOS =
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS only
      window.navigator.standalone === true);

  useEffect(() => {
    document.title = "Instalar no celular — Royal Vitta";
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const installedHandler = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  return (
    <section className="container max-w-2xl py-10 md:py-14 px-4 animate-in fade-in duration-500">
      {/* HERO — eyebrow + ícone gradient + título em gradient parcial */}
      <header className="text-center mb-10">
        <div className="relative mx-auto h-16 w-16 md:h-20 md:w-20 mb-4">
          <div
            aria-hidden
            className="absolute inset-0 rounded-2xl bg-gradient-brand opacity-15 blur-xl"
          />
          <div className="relative h-full w-full rounded-2xl bg-gradient-brand flex items-center justify-center shadow-lg shadow-primary/20">
            <Smartphone className="h-8 w-8 md:h-10 md:w-10 text-white" strokeWidth={1.75} />
          </div>
        </div>
        <p className="inline-flex items-center gap-1.5 text-2xs sm:text-xs font-bold uppercase tracking-[0.18em] text-secondary-text mb-2">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
          App Royal Vitta
        </p>
        <h1 className="font-display text-2xl md:text-4xl font-extrabold tracking-tight leading-[1.1]">
          Instale na{" "}
          <span className="bg-gradient-brand bg-clip-text text-transparent">
            tela inicial
          </span>
        </h1>
        <p className="mt-3 text-sm md:text-base text-muted-foreground leading-relaxed max-w-md mx-auto">
          Carregamento instantâneo, funcionamento offline e atalho direto
          no celular — sem precisar baixar pela loja.
        </p>
      </header>

      {/* BENEFITS — cards com tones diferenciados */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <Benefit
          icon={Zap}
          title="Mais rápido"
          text="Cache local de imagens e telas — primeiro carregamento dispensa rede."
          tone="primary"
        />
        <Benefit
          icon={WifiOff}
          title="Funciona offline"
          text="Catálogo e carrinho continuam acessíveis sem internet."
          tone="cyan"
        />
        <Benefit
          icon={Download}
          title="Atalho no celular"
          text="Abra como um app nativo, sem barra de navegador."
          tone="success"
        />
      </div>

      {/* ACTION CARD — instalação contextual */}
      <div className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-card">
        {installed || isStandalone ? (
          <div className="flex items-center gap-3 text-success">
            <div className="inline-flex h-10 w-10 rounded-xl bg-success/10 items-center justify-center">
              <CheckCircle2 className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div>
              <p className="font-bold text-foreground">App instalado!</p>
              <p className="text-xs text-muted-foreground mt-0.5">Abra pelo atalho na tela inicial.</p>
            </div>
          </div>
        ) : isIOS ? (
          <div>
            <h2 className="font-bold text-base mb-3 flex items-center gap-2">
              <span className="inline-flex h-7 w-7 rounded-lg bg-primary/10 text-primary items-center justify-center text-sm font-extrabold">

              </span>
              Como instalar no iPhone
            </h2>
            <ol className="space-y-2.5 text-sm text-foreground/80">
              <Step n={1}>Toque no botão <strong className="text-foreground">Compartilhar</strong> do Safari.</Step>
              <Step n={2}>Escolha <strong className="text-foreground">Adicionar à Tela de Início</strong>.</Step>
              <Step n={3}>Confirme em <strong className="text-foreground">Adicionar</strong>.</Step>
            </ol>
          </div>
        ) : deferred ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-bold text-foreground">Instalação automática disponível</p>
              <p className="text-xs text-muted-foreground mt-0.5">1 toque e o app aparece na sua tela.</p>
            </div>
            <Button onClick={handleInstall} size="lg" className="rounded-full bg-secondary hover:bg-secondary/90 text-secondary-foreground shrink-0">
              <Download className="h-4 w-4 mr-2" />
              Instalar agora
            </Button>
          </div>
        ) : (
          <div>
            <h2 className="font-bold text-base mb-3">Como instalar no Android</h2>
            <ol className="space-y-2.5 text-sm text-foreground/80">
              <Step n={1}>Abra o menu (<span className="font-mono">⋮</span>) do Chrome.</Step>
              <Step n={2}>Toque em <strong className="text-foreground">Instalar app</strong> ou <strong className="text-foreground">Adicionar à tela inicial</strong>.</Step>
              <Step n={3}>Confirme.</Step>
            </ol>
            <p className="text-2xs text-muted-foreground/80 mt-4 pt-3 border-t border-border/40">
              Dica: o botão de instalação automática aparece após alguns segundos navegando no site publicado.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

const TONE: Record<"primary" | "cyan" | "success", string> = {
  primary: "bg-primary/10 text-primary",
  cyan: "bg-brand-cyan/15 text-brand-cyan-text",
  success: "bg-success/10 text-success",
};

function Benefit({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: typeof Zap;
  title: string;
  text: string;
  tone: "primary" | "cyan" | "success";
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all">
      <div className={`inline-flex h-9 w-9 rounded-xl items-center justify-center mb-2.5 ${TONE[tone]}`}>
        <Icon className="h-4.5 w-4.5" strokeWidth={2.25} />
      </div>
      <p className="font-bold text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{text}</p>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 inline-flex h-6 w-6 rounded-full bg-primary/10 text-primary items-center justify-center text-2xs font-extrabold tabular-nums">
        {n}
      </span>
      <span className="leading-relaxed pt-0.5">{children}</span>
    </li>
  );
}
