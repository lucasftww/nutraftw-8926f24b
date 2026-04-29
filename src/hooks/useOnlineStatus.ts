import { useEffect, useState } from "react";

/**
 * Status de conectividade. Combina o sinal nativo `navigator.onLine`
 * (rápido mas mente em alguns navegadores) com escuta dos eventos
 * `online`/`offline`. SSR-safe: assume online no servidor.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}