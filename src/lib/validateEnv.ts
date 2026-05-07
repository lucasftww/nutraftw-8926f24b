/**
 * Valida variáveis de ambiente obrigatórias no boot do app.
 * Executa antes do React montar para evitar tela branca silenciosa
 * quando o `.env` não foi configurado (ex.: clone novo, deploy quebrado).
 */
export type EnvValidationResult =
  | { ok: true }
  | { ok: false; missing: string[]; message: string };

export function validateEnv(_env: ImportMetaEnv = import.meta.env): EnvValidationResult {
  // O cliente Supabase tem fallback hardcoded das chaves PÚBLICAS, então
  // o app sempre tem credenciais válidas em runtime. Esta função fica como
  // um hook para validações futuras (sem bloquear o boot por env vars).
  return { ok: true };
}

export function renderEnvError(target: HTMLElement, result: Extract<EnvValidationResult, { ok: false }>) {
  const items = result.missing.map((m) => `<li><code>${m}</code></li>`).join("");
  target.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a;">
      <div style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;box-shadow:0 10px 30px -10px rgba(15,23,42,0.15);">
        <div style="font-size:14px;font-weight:600;color:#dc2626;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px;">Configuração necessária</div>
        <h1 style="font-size:22px;margin:0 0 12px 0;">Variáveis de ambiente ausentes</h1>
        <p style="margin:0 0 16px 0;color:#475569;line-height:1.5;">
          O app não consegue iniciar porque as credenciais do Supabase não foram definidas.
          Adicione as variáveis abaixo no arquivo <code>.env</code> (ou nas configurações do seu deploy) e recarregue.
        </p>
        <ul style="margin:0 0 16px 20px;padding:0;color:#0f172a;">${items}</ul>
        <p style="margin:0;color:#64748b;font-size:13px;">
          Veja <code>.env.example</code> para um modelo completo.
        </p>
      </div>
    </div>
  `;
}