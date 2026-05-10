import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // SVG removido propositalmente: o formato permite <script> embutido e,
  // quando aberto direto pela URL pública, executa JS no domínio do site
  // (XSS armazenado). Loja só precisa de raster.
  const ALLOWED_MIME = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
  ];
  const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "gif", "avif"];
  const MAX_BYTES = 5 * 1024 * 1024;

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  async function handleFile(file: File) {
    const rawExt = (file.name.split(".").pop() || "").toLowerCase();

    if (!file.name || file.size === 0) {
      toast.error("Arquivo inválido", {
        description: "O arquivo selecionado está vazio ou corrompido.",
      });
      return;
    }

    const mimeOk = file.type ? ALLOWED_MIME.includes(file.type) : false;
    const extOk = ALLOWED_EXT.includes(rawExt);

    if (!mimeOk && !extOk) {
      toast.error("Formato não suportado", {
        description: `"${file.name}" não é uma imagem válida. Use JPG, PNG, WEBP, GIF ou AVIF.`,
      });
      return;
    }

    if (file.type && !file.type.startsWith("image/")) {
      toast.error("Tipo de arquivo inválido", {
        description: `O tipo detectado foi "${file.type}". Envie apenas arquivos de imagem.`,
      });
      return;
    }

    if (file.size > MAX_BYTES) {
      toast.error("Arquivo muito grande", {
        description: `Tamanho: ${formatSize(file.size)}. O limite é 5 MB. Reduza a imagem antes de enviar.`,
      });
      return;
    }

    setUploading(true);
    // só permite extensões seguras de imagem; evita nomes maliciosos no path do bucket
    const ext = ALLOWED_EXT.includes(rawExt) ? rawExt : "jpg";
    const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast.error("Falha no envio", { description: error.message });
      if (mountedRef.current) setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    if (mountedRef.current) onChange(data.publicUrl);
    toast.success("Imagem enviada", {
      description: `${file.name} (${formatSize(file.size)})`,
    });
    if (mountedRef.current) setUploading(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="URL da imagem ou enviar arquivo"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
        {value && (
          <Button type="button" variant="outline" onClick={() => onChange("")}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ALLOWED_MIME.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {value && (
        <div className="rounded-xl border border-border p-2 bg-muted/30 inline-block">
          <img src={value} alt="Preview" className="h-24 w-24 object-contain" />
        </div>
      )}
    </div>
  );
}
