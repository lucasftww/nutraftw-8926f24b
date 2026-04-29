import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, Smartphone, WifiOff, Zap } from "lucide-react";

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border border-border bg-card text-card-foreground shadow-sm ${className}`}>
      {children}
    </div>
  );
}

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
    document.title = "Instalar G Imports no celular";
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  return (
    <div className="container max-w-3xl py-10 px-4">
      <header className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Smartphone className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Instale o G Imports na tela inicial
        </h1>
        <p className="mt-2 text-muted-foreground">
          Compre mais rápido, com carregamento instantâneo e funcionamento offline.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3 mb-8">
        <Card className="p-4 flex items-start gap-3">
          <Zap className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium text-sm">Mais rápido</p>
            <p className="text-xs text-muted-foreground">Cache local de imagens e telas.</p>
          </div>
        </Card>
        <Card className="p-4 flex items-start gap-3">
          <WifiOff className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium text-sm">Funciona offline</p>
            <p className="text-xs text-muted-foreground">Catálogo e carrinho sem internet.</p>
          </div>
        </Card>
        <Card className="p-4 flex items-start gap-3">
          <Download className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium text-sm">Atalho no celular</p>
            <p className="text-xs text-muted-foreground">Abra como um app nativo.</p>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        {installed || isStandalone ? (
          <div className="flex items-center gap-3 text-primary">
            <CheckCircle2 className="h-6 w-6" />
            <p className="font-medium">App instalado! Abra pelo atalho na tela inicial.</p>
          </div>
        ) : isIOS ? (
          <div>
            <h2 className="font-semibold mb-2">Como instalar no iPhone</h2>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Toque no botão <strong>Compartilhar</strong> do Safari.</li>
              <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
              <li>Confirme em <strong>Adicionar</strong>.</li>
            </ol>
          </div>
        ) : deferred ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-sm">Instale agora com 1 toque:</p>
            <Button onClick={handleInstall} size="lg" className="rounded-full">
              <Download className="h-4 w-4 mr-2" />
              Instalar app
            </Button>
          </div>
        ) : (
          <div>
            <h2 className="font-semibold mb-2">Como instalar no Android</h2>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Abra o menu (⋮) do Chrome.</li>
              <li>Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
              <li>Confirme.</li>
            </ol>
            <p className="text-xs text-muted-foreground mt-3">
              Dica: o botão de instalação automática aparece após alguns segundos navegando no site publicado.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}