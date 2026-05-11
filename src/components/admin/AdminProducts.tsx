import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, slugify } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Search, Package, Download, Check, Copy, GripVertical } from "lucide-react";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { AdminModal } from "@/components/admin/AdminModal";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { ProductThumb } from "@/components/admin/ProductThumb";
import { EmptyState } from "@/components/admin/EmptyState";
import { queryKeys } from "@/lib/queryKeys";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "@/components/admin/AdminErrorBanner";
import { friendlyErrorMessage } from "@/lib/friendlyError";
import { logAdminAction, shallowDiff } from "@/lib/auditLog";
import { auditUpdateIntegrity } from "@/lib/integrityAudit";
import { SortableList, useSortableRow, DragHandle } from "@/components/admin/SortableList";
import { StockBadge } from "@/components/admin/StockBadge";

function ProductMobileRow({ p, sortable, selected, toggleSel, setEditing, duplicate, del }: any) {
  const sort = useSortableRow(p.id);
  return (
    <li
      ref={sortable ? sort.setNodeRef : undefined}
      style={sortable ? sort.style : undefined}
      className={`bg-card rounded-2xl border p-3 ${selected.has(p.id) ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
    >
      <div className="flex gap-3 items-start">
        <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
          {sortable && <DragHandle handleProps={sort.handleProps} />}
          <label className="inline-flex items-center justify-center w-5 h-5 rounded border border-input cursor-pointer">
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSel(p.id)} className="sr-only" aria-label={`Selecionar ${p.name}`} />
            {selected.has(p.id) && <Check className="h-3.5 w-3.5 text-primary" />}
          </label>
        </div>
        <ProductThumb src={p.image_url} size="lg" alt={p.name} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug line-clamp-2">{p.name}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{p.category?.name || "Sem categoria"}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="font-bold text-primary text-sm">{formatBRL(p.price)}</span>
            <StockBadge stock={p.stock} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 mt-2.5 pt-2.5 border-t border-border/60">
        <button onClick={() => setEditing(p)} aria-label="Editar" title="Editar" className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg hover:bg-muted text-xs"><Pencil className="h-3.5 w-3.5" /> Editar</button>
        <button onClick={() => duplicate(p)} aria-label="Duplicar" title="Duplicar" className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-muted"><Copy className="h-4 w-4" /></button>
        <button onClick={() => del(p.id)} aria-label="Remover" title="Remover" className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
      </div>
    </li>
  );
}

function ProductTableRow({ p, sortable, selected, toggleSel, setEditing, duplicate, del }: any) {
  const sort = useSortableRow(p.id);
  return (
    <tr
      ref={sortable ? (sort.setNodeRef as any) : undefined}
      style={sortable ? sort.style : undefined}
      className={`border-t border-border ${selected.has(p.id) ? "bg-primary/5" : ""} ${sortable && sort.isDragging ? "bg-muted/50" : ""}`}
    >
      <td className="px-2 py-3 w-10">
        {sortable ? (
          <DragHandle handleProps={sort.handleProps} />
        ) : (
          <span className="inline-block w-8" />
        )}
      </td>
      <td className="px-3 py-3">
        <input type="checkbox" aria-label={`Selecionar ${p.name}`} checked={selected.has(p.id)} onChange={() => toggleSel(p.id)} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <ProductThumb src={p.image_url} size="sm" alt={p.name} />
          <div>
            <p className="font-medium">{p.name}</p>
            {!p.is_active && <span className="text-xs text-muted-foreground">Inativo</span>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.category?.name || "—"}</td>
      <td className="px-4 py-3 text-right font-semibold">{formatBRL(p.price)}</td>
      <td className="px-4 py-3 text-right hidden md:table-cell">
        <StockBadge stock={p.stock} />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <button onClick={() => setEditing(p)} aria-label="Editar" title="Editar" className="p-1.5 hover:bg-muted rounded mr-1"><Pencil className="h-4 w-4" /></button>
        <button onClick={() => duplicate(p)} aria-label="Duplicar" title="Duplicar" className="p-1.5 hover:bg-muted rounded mr-1"><Copy className="h-4 w-4" /></button>
        <button onClick={() => del(p.id)} aria-label="Remover" title="Remover" className="p-1.5 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="h-4 w-4" /></button>
      </td>
    </tr>
  );
}

export function AdminProducts() {
  const settings = useSiteSettings();
  const brandName = settings.brand_name || "Royal Vitta";
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkAction, setBulkAction] = useState<"" | "activate" | "deactivate" | "feature" | "unfeature" | "stock_set" | "stock_inc" | "price_set" | "price_inc_pct" | "delete">("");
  const [bulkValue, setBulkValue] = useState<string>("");
  const PAGE_SIZE = 30;
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const loadReqRef = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => { setPage(0); }, [debouncedQuery]);

  async function load() {
    const requestId = ++loadReqRef.current;
    setLoading(true);
    setError(null);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase
      .from("products")
      .select("*, category:categories(name)", { count: "exact" })
      .order(debouncedQuery ? "created_at" : "display_order", { ascending: !debouncedQuery })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (debouncedQuery) {
      const safe = debouncedQuery.replace(/[%_,()*:"'\\]/g, " ").trim();
      q = q.or(`name.ilike.%${safe}%,active_principle.ilike.%${safe}%`);
    }
    const [pr, cr, br] = await Promise.all([
      q,
      supabase.from("categories").select("*").order("display_order"),
      supabase.from("brands").select("*").order("display_order").order("name"),
    ]);
    if (requestId !== loadReqRef.current) return;
    if (pr.error) {
      const info = logSupabaseError("Carregar produtos", pr.error, { table: "products" });
      setError(info);
      toast.error(`Produtos: ${info.message}`);
      setLoading(false);
      return;
    }
    if (cr.error) {
      const info = logSupabaseError("Carregar categorias", cr.error, { table: "categories" });
      setError(info);
      toast.error(`Categorias: ${info.message}`);
      setLoading(false);
      return;
    }
    setItems(pr.data || []);
    setTotalCount(pr.count ?? null);
    setCats(cr.data || []);
    setBrands(br.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [page, debouncedQuery]);
  useEffect(() => { setSelected(new Set()); }, [page, debouncedQuery]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const f = editing;
    // Validações que o `required` do HTML não cobre.
    const nameTrim = (f.name || "").trim();
    if (nameTrim.length < 2) {
      toast.error("Informe o nome do produto.");
      return;
    }
    const priceNum = Number(String(f.price ?? "").replace(",", "."));
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error("Preço deve ser maior que zero.");
      return;
    }
    const stockNum = Number.parseInt(String(f.stock ?? 0), 10);
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      toast.error("Estoque inválido.");
      return;
    }
    const slugTrim = (f.slug || "").trim();
    const basePayload = {
      name: nameTrim,
      slug: slugTrim ? slugify(slugTrim) : slugify(nameTrim),
      description: f.description || null,
      active_principle: f.active_principle || null,
      composition: f.composition || null,
      meta_title: f.meta_title?.trim() || null,
      meta_description: f.meta_description?.trim() || null,
      price: priceNum,
      stock: stockNum,
      image_url: f.image_url || null,
      category_id: f.category_id || null,
      brand_id: f.brand_id || null,
      is_featured: !!f.is_featured,
      is_new_release: !!f.is_new_release,
      is_active: f.is_active !== false,
    };
    const payload: any = f.id
      ? basePayload
      : { ...basePayload, sale_price: null, is_on_offer: false };
    const before = f.id ? items.find((p) => p.id === f.id) : null;
    setSaving(true);
    const { data, error } = f.id
      ? await supabase.from("products").update(payload).eq("id", f.id).select().maybeSingle()
      : await supabase.from("products").insert(payload).select().maybeSingle();
    if (error) {
      logSupabaseError("Guardar produto", error, { id: f.id, name: payload.name });
      if (f.id) {
        await auditUpdateIntegrity({
          table: "products", id: f.id, payload, error,
          summary: `Produto "${payload.name}"`,
        });
      }
      toast.error(friendlyErrorMessage(error));
    } else {
      toast.success("Produto guardado");
      const saved: any = data || payload;
      logAdminAction({
        action: f.id ? "update" : "create",
        entity: "products",
        entityId: saved?.id ?? f.id ?? null,
        summary: `Produto "${payload.name}"`,
        diff: f.id ? shallowDiff(before, saved) : { after: saved },
      });
      if (f.id && saved?.id) {
        const r = await auditUpdateIntegrity({
          table: "products", id: saved.id, payload,
          summary: `Produto "${payload.name}"`,
        });
        if (!r.ok) {
          toast.warning(`Divergência detectada após salvar (${r.divergedKeys.join(", ")}). Veja o log.`);
        }
      }
      setEditing(null);
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      qc.invalidateQueries({ queryKey: queryKeys.products.detailRoot });
      load();
    }
    setSaving(false);
  }

  async function del(id: string) {
    const before = items.find((p) => p.id === id);
    const ok = await confirm({
      title: "Remover produto?",
      description: `O produto "${before?.name ?? "selecionado"}" será removido permanentemente. Esta ação não pode ser desfeita.`,
      variant: "destructive",
      confirmLabel: "Remover",
    });
    if (!ok) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      logSupabaseError("Remover produto", error, { id });
      toast.error(friendlyErrorMessage(error));
    } else {
      toast.success("Removido");
      logAdminAction({
        action: "delete",
        entity: "products",
        entityId: id,
        summary: `Produto removido: ${before?.name ?? id.slice(0, 8)}`,
        diff: { before },
      });
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      if (items.length === 1 && page > 0) {
        setPage((p) => Math.max(0, p - 1));
      } else {
        load();
      }
    }
  }

  async function duplicate(p: any) {
    const baseSlug = `${p.slug}-copia`;
    let finalSlug = baseSlug;
    for (let i = 2; i < 50; i++) {
      const { data: existing } = await supabase.from("products").select("id").eq("slug", finalSlug).maybeSingle();
      if (!existing) break;
      finalSlug = `${baseSlug}-${i}`;
    }
    const payload = {
      name: `${p.name} (cópia)`,
      slug: finalSlug,
      description: p.description,
      active_principle: p.active_principle,
      composition: p.composition,
      price: p.price,
      sale_price: p.sale_price,
      stock: 0,
      image_url: p.image_url,
      category_id: p.category_id,
      is_featured: false,
      is_new_release: false,
      is_on_offer: false,
      is_active: false,
    };
    let { data, error } = await supabase.from("products").insert(payload).select().maybeSingle();
    // Race TOCTOU: outro admin pode ter criado o slug entre o probe e o insert.
    // Em caso de conflict, retentamos uma vez com sufixo de timestamp.
    if (error && (error as any).code === "23505") {
      const retrySlug = `${baseSlug}-${Date.now().toString(36)}`;
      const retry = await supabase
        .from("products")
        .insert({ ...payload, slug: retrySlug })
        .select()
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      logSupabaseError("Duplicar produto", error, { source_id: p.id });
      toast.error(friendlyErrorMessage(error));
      return;
    }
    toast.success("Produto duplicado (rascunho inativo)");
    logAdminAction({
      action: "create",
      entity: "products",
      entityId: (data as any)?.id ?? null,
      summary: `Produto duplicado de "${p.name}"`,
      diff: { after: data, source_id: p.id },
    });
    qc.invalidateQueries({ queryKey: queryKeys.products.all });
    setEditing(data);
    load();
  }

  function toggleSel(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAllVisible() {
    setSelected((s) => s.size === items.length ? new Set() : new Set(items.map((p) => p.id)));
  }

  async function runBulk() {
    if (!bulkAction || selected.size === 0) return;
    // Guard reentrante: clique duplo durante confirm/await podia disparar
    // duas execuções de price_inc_pct em paralelo (preço dobrado).
    if (bulkBusy) return;
    const ids = Array.from(selected);
    let payload: Partial<{ is_active: boolean; is_featured: boolean; stock: number; price: number }> = {};
    let needsConfirm = false;
    let summary = "";
    if (bulkAction === "activate") { payload = { is_active: true }; summary = "ativados"; }
    else if (bulkAction === "deactivate") { payload = { is_active: false }; summary = "desativados"; }
    else if (bulkAction === "feature") { payload = { is_featured: true }; summary = "destacados"; }
    else if (bulkAction === "unfeature") { payload = { is_featured: false }; summary = "removidos do destaque"; }
    else if (bulkAction === "stock_set") {
      needsConfirm = true;
      const trimmed = bulkValue.trim();
      // Aceita só inteiros não-negativos. `parseInt` engole "0.5" como 0
      // e descarta sufixos ("3abc" -> 3) — usamos regex pra rejeitar.
      if (!/^\d+$/.test(trimmed)) { toast.error("Informe um stock válido (inteiro ≥ 0)"); return; }
      const v = parseInt(trimmed, 10);
      if (!Number.isFinite(v) || v < 0) { toast.error("Informe um stock válido (≥ 0)"); return; }
      payload = { stock: v }; summary = `stock = ${v}`;
    } else if (bulkAction === "price_set") {
      needsConfirm = true;
      const v = Number(String(bulkValue).replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) { toast.error("Informe um preço válido (> 0)"); return; }
      payload = { price: v }; summary = `preço = ${formatBRL(v)}`;
    } else if (bulkAction === "price_inc_pct") {
      const pct = Number(String(bulkValue).replace(",", "."));
      if (!Number.isFinite(pct)) { toast.error("Informe % (ex: 10 ou -5)"); return; }
      setBulkBusy(true); // Guard antes do await para evitar duplo clique no confirm.
      const ok = await confirm({
        title: `Reajustar preço de ${ids.length} produto${ids.length === 1 ? "" : "s"}?`,
        description: `Cada preço será multiplicado por ${(1 + pct / 100).toFixed(4)} (${pct >= 0 ? "+" : ""}${pct}%). Arredondado a 2 casas.`,
      });
      if (!ok) { setBulkBusy(false); return; }
      let okC = 0, fail = 0;
      for (const id of ids) {
        const cur = Number(items.find((p) => p.id === id)?.price ?? 0);
        const next = Math.max(0, Math.round(cur * (1 + pct / 100) * 100) / 100);
        const { error } = await supabase.from("products").update({ price: next }).eq("id", id);
        if (error) fail++; else okC++;
      }
      setBulkBusy(false);
      logAdminAction({
        action: "update", entity: "products", entityId: null,
        summary: `Preço reajustado em ${okC} produtos (${pct >= 0 ? "+" : ""}${pct}%)`,
        diff: { ids, pct },
      });
      if (okC) toast.success(`${okC} produto${okC === 1 ? "" : "s"} reajustado${okC === 1 ? "" : "s"}`);
      if (fail) toast.error(`${fail} falharam`);
      setSelected(new Set()); setBulkAction(""); setBulkValue("");
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      load();
      return;
    } else if (bulkAction === "stock_inc") {
      const trimmed = bulkValue.trim();
      // Inteiro com sinal opcional. Bloqueia decimais ("0.5" virava 0 silenciosamente).
      if (!/^-?\d+$/.test(trimmed)) { toast.error("Informe um valor inteiro (positivo ou negativo)"); return; }
      const delta = parseInt(trimmed, 10);
      if (!Number.isFinite(delta)) { toast.error("Informe um valor inteiro (positivo ou negativo)"); return; }
      setBulkBusy(true); // Guard antes do await para evitar duplo clique no confirm.
      const ok = await confirm({
        title: `Ajustar stock de ${ids.length} produto${ids.length === 1 ? "" : "s"}?`,
        description: `Será somado ${delta >= 0 ? "+" : ""}${delta} ao stock atual de cada produto.`,
      });
      if (!ok) { setBulkBusy(false); return; }
      let okC = 0, fail = 0;
      for (const id of ids) {
        const cur = items.find((p) => p.id === id)?.stock ?? 0;
        const next = Math.max(0, cur + delta);
        const { error } = await supabase.from("products").update({ stock: next }).eq("id", id);
        if (error) fail++; else okC++;
      }
      setBulkBusy(false);
      logAdminAction({
        action: "update",
        entity: "products",
        entityId: null,
        summary: `Stock ajustado em ${okC} produtos (${delta >= 0 ? "+" : ""}${delta})`,
        diff: { ids, delta },
      });
      if (okC) toast.success(`${okC} produto${okC === 1 ? "" : "s"} atualizado${okC === 1 ? "" : "s"}`);
      if (fail) toast.error(`${fail} falharam`);
      setSelected(new Set()); setBulkAction(""); setBulkValue("");
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      load();
      return;
    } else if (bulkAction === "delete") {
      const ok = await confirm({
        title: `Remover ${ids.length} produto${ids.length === 1 ? "" : "s"}?`,
        description: "Esta ação não pode ser desfeita.",
        variant: "destructive",
        confirmLabel: "Remover",
      });
      if (!ok) return;
      setBulkBusy(true);
      const { error } = await supabase.from("products").delete().in("id", ids);
      setBulkBusy(false);
      if (error) { toast.error(friendlyErrorMessage(error)); return; }
      logAdminAction({ action: "delete", entity: "products", entityId: null, summary: `${ids.length} produtos removidos`, diff: { ids } });
      toast.success(`${ids.length} removido${ids.length === 1 ? "" : "s"}`);
      setSelected(new Set()); setBulkAction(""); setBulkValue("");
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      load();
      return;
    }

    if (needsConfirm) {
      const ok = await confirm({
        title: `Aplicar a ${ids.length} produto${ids.length === 1 ? "" : "s"}?`,
        description: `Os produtos selecionados terão ${summary}.`,
      });
      if (!ok) return;
    }

    setBulkBusy(true);
    const { error } = await supabase.from("products").update(payload).in("id", ids);
    setBulkBusy(false);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    logAdminAction({
      action: "update",
      entity: "products",
      entityId: null,
      summary: `${ids.length} produtos ${summary}`,
      diff: { ids, payload },
    });
    toast.success(`${ids.length} atualizado${ids.length === 1 ? "" : "s"}`);
    setSelected(new Set()); setBulkAction(""); setBulkValue("");
    qc.invalidateQueries({ queryKey: queryKeys.products.all });
    load();
  }

  if (error) return <AdminErrorBanner error={error} onRetry={load} />;
  const totalPages = totalCount != null ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : null;

  const canReorder = !debouncedQuery;

  async function reorderProducts(next: any[]) {
    const baseOffset = page * PAGE_SIZE * 10;
    const updates = next.map((p, i) => ({ id: p.id, display_order: baseOffset + (i + 1) * 10 }));
    setItems(next.map((p, i) => ({ ...p, display_order: baseOffset + (i + 1) * 10 })));
    // allSettled: uma falha de rede em um produto não aborta os outros updates.
    // Antes, com Promise.all + reject implícito, só relatávamos o primeiro erro.
    const settled = await Promise.allSettled(
      updates.map((u) => supabase.from("products").update({ display_order: u.display_order } as any).eq("id", u.id)),
    );
    const failed: { id: string; reason: string }[] = [];
    settled.forEach((r, i) => {
      if (r.status === "rejected") {
        failed.push({ id: updates[i].id, reason: String(r.reason) });
      } else if (r.value?.error) {
        failed.push({ id: updates[i].id, reason: r.value.error.message });
      }
    });
    if (failed.length) {
      console.error("[AdminProducts] reorder failures", failed);
      toast.error(`Falha ao salvar nova ordem (${failed.length} de ${updates.length})`);
      load();
    } else {
      toast.success("Ordem atualizada");
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
    }
  }

  async function exportCsv() {
    toast.info("Gerando CSV…");
    let q = supabase
      .from("products")
      .select("id, name, slug, price, sale_price, stock, is_active, is_featured, is_new_release, is_on_offer, active_principle, composition, description, meta_title, meta_description, category:categories(name)")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (debouncedQuery) {
      const safe = debouncedQuery.replace(/[%_,()*:"'\\]/g, " ").trim();
      q = q.or(`name.ilike.%${safe}%,active_principle.ilike.%${safe}%`);
    }
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    const rows = data || [];
    // PostgREST limita a 1000 linhas por padrão, mesmo com .limit(5000).
    // Se atingirmos 1000, a lista pode estar incompleta — avisamos o admin.
    if (rows.length >= 1000) {
      toast.warning(`Exportados ${rows.length} produtos (limite atingido — aplique filtros para exportar todos).`);
    }
    const esc = (v: any) => {
      if (v == null) return "";
      let s = String(v).replace(/"/g, '""');
      // Sanitiza prefixos de fórmula (CSV injection — Excel executaria como expressão).
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\n;]/.test(s) ? `"${s}"` : s;
    };
    const headers = ["id","name","slug","category","price","sale_price","stock","is_active","is_featured","is_new_release","is_on_offer","active_principle","composition","description","meta_title","meta_description"];
    const lines = [headers.join(",")];
    for (const r of rows as any[]) {
      lines.push([
        r.id, r.name, r.slug, r.category?.name ?? "",
        r.price, r.sale_price ?? "", r.stock,
        r.is_active, r.is_featured, r.is_new_release, r.is_on_offer,
        r.active_principle ?? "", r.composition ?? "", r.description ?? "",
        r.meta_title ?? "", r.meta_description ?? "",
      ].map(esc).join(","));
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `produtos-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} produtos exportados`);
  }

  return (
    <>
      <div className="mb-4 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 pr-24" placeholder="Buscar produto ou princípio ativo…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {totalCount != null && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums pointer-events-none">
              {totalCount} {totalCount === 1 ? "produto" : "produtos"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} title="Exportar todos os produtos para CSV" className="flex-1 sm:flex-none"><Download className="h-4 w-4" /> CSV</Button>
          <Button onClick={() => setEditing({ is_active: true })} className="flex-1 sm:flex-none"><Plus className="h-4 w-4" /> Novo produto</Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 px-4 py-2.5 bg-primary/10 border border-primary/30 rounded-xl text-sm flex-wrap">
          <span className="font-semibold text-primary">{selected.size} selecionado{selected.size === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              disabled={bulkBusy}
              value={bulkAction}
              onChange={(e) => { setBulkAction(e.target.value as any); setBulkValue(""); }}
              className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
            >
              <option value="">Ação em massa…</option>
              <option value="activate">Ativar</option>
              <option value="deactivate">Desativar</option>
              <option value="feature">Destacar</option>
              <option value="unfeature">Remover destaque</option>
              <option value="stock_set">Definir estoque</option>
              <option value="stock_inc">Somar ao estoque (±)</option>
              <option value="price_set">Definir preço</option>
              <option value="price_inc_pct">Reajustar preço (%)</option>
              <option value="delete">Remover</option>
            </select>
            {(bulkAction === "stock_set" || bulkAction === "stock_inc" || bulkAction === "price_set" || bulkAction === "price_inc_pct") && (
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder={
                  bulkAction === "stock_set" ? "Novo stock" :
                  bulkAction === "stock_inc" ? "+/− qtd" :
                  bulkAction === "price_set" ? "Novo preço (R$)" :
                  "% (ex: 10 ou -5)"
                }
                className="h-9 w-28"
              />
            )}
            <Button size="sm" disabled={!bulkAction || bulkBusy} onClick={runBulk}>Aplicar</Button>
            <Button variant="outline" size="sm" onClick={() => { setSelected(new Set()); setBulkAction(""); setBulkValue(""); }}>Limpar</Button>
          </div>
        </div>
      )}

      {canReorder && !loading && items.length > 0 && (
        <p className="text-xs text-muted-foreground mb-2 hidden md:block">
          💡 Arraste pelo ícone <GripVertical className="inline h-3 w-3" /> para reordenar como aparecerá no site.
        </p>
      )}
      <ul className="md:hidden space-y-2">
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="h-20 bg-muted/50 rounded-2xl animate-pulse" />
        ))}
        {!loading && (canReorder ? (
          <SortableList items={items} onReorder={reorderProducts}>
            {items.map((p) => (
              <ProductMobileRow key={p.id} p={p} sortable selected={selected} toggleSel={toggleSel} setEditing={setEditing} duplicate={duplicate} del={del} />
            ))}
          </SortableList>
        ) : items.map((p) => (
          <ProductMobileRow key={p.id} p={p} sortable={false} selected={selected} toggleSel={toggleSel} setEditing={setEditing} duplicate={duplicate} del={del} />
        )))}
        {!loading && items.length === 0 && (
          <li className="bg-card rounded-2xl border border-border">
            <EmptyState
              icon={Package}
              title="Nenhum produto encontrado"
              description={debouncedQuery ? "Tente outra busca ou limpe o filtro." : "Cadastre seu primeiro produto para começar a vender."}
              action={!debouncedQuery && (
                <Button onClick={() => setEditing({ is_active: true })}><Plus className="h-4 w-4" /> Novo produto</Button>
              )}
            />
          </li>
        )}
      </ul>

      <div className="hidden md:block bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-2 py-3 w-10"></th>
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos"
                  checked={items.length > 0 && selected.size === items.length}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = selected.size > 0 && selected.size < items.length;
                    }
                  }}
                  onChange={toggleAllVisible}
                />
              </th>
              <th className="text-left px-4 py-3">Produto</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Categoria</th>
              <th className="text-right px-4 py-3">Preço</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">Estoque</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-4 py-3" colSpan={7}><div className="h-10 bg-muted/50 rounded animate-pulse" /></td>
              </tr>
            ))}
            {!loading && canReorder && (
              <SortableList items={items} onReorder={reorderProducts}>
                {items.map((p) => (
                  <ProductTableRow key={p.id} p={p} sortable selected={selected} toggleSel={toggleSel} setEditing={setEditing} duplicate={duplicate} del={del} />
                ))}
              </SortableList>
            )}
            {!loading && !canReorder && items.map((p) => (
              <ProductTableRow key={p.id} p={p} sortable={false} selected={selected} toggleSel={toggleSel} setEditing={setEditing} duplicate={duplicate} del={del} />
            ))}
            {!loading && items.length === 0 && (
              <tr><td colSpan={7}>
                <EmptyState
                  icon={Package}
                  title="Nenhum produto encontrado"
                  description={debouncedQuery ? "Tente outra busca ou limpe o filtro." : "Cadastre seu primeiro produto para começar a vender."}
                  action={!debouncedQuery && (
                    <Button onClick={() => setEditing({ is_active: true })}><Plus className="h-4 w-4" /> Novo produto</Button>
                  )}
                />
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {totalPages && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-muted-foreground">Página {page + 1} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1 || loading} onClick={() => setPage((p) => p + 1)}>Próxima →</Button>
          </div>
        </div>
      )}

      <AdminModal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Editar produto" : "Novo produto"} size="lg">
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2 sm:col-span-2"><Label>Nome</Label><Input required value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Slug</Label><Input value={editing.slug || ""} placeholder="auto" onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
              <div className="space-y-2"><Label>Categoria</Label>
                <select className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" value={editing.category_id || ""} onChange={(e) => setEditing({ ...editing, category_id: e.target.value || null })}>
                  <option value="">— Sem categoria —</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Marca</Label>
                <select className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" value={editing.brand_id || ""} onChange={(e) => setEditing({ ...editing, brand_id: e.target.value || null })}>
                  <option value="">— Sem marca —</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Preço (R$)</Label><Input type="number" step="0.01" min="0" required value={editing.price ?? ""} onChange={(e) => setEditing({ ...editing, price: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Preço promocional (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="—"
                  value={editing.sale_price ?? ""}
                  readOnly
                  disabled
                  title="Editável apenas pela aba Promoções (registra histórico)"
                />
                <p className="text-[11px] text-muted-foreground">Use a aba <strong>Promoções</strong> para alterar (mantém histórico).</p>
              </div>
              <div className="space-y-2"><Label>Estoque</Label><Input type="number" min="0" value={editing.stock ?? 0} onChange={(e) => setEditing({ ...editing, stock: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Imagem</Label>
                <ImageUpload value={editing.image_url || ""} onChange={(url) => setEditing((prev: any) => prev ? { ...prev, image_url: url } : prev)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Descrição</Label>
                <textarea
                  className="w-full rounded-xl border border-input bg-background p-3 text-sm min-h-[90px] focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all scrollbar-thin"
                  placeholder="Descrição curta do produto, apresentação e observações."
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div className="space-y-2"><Label>Princípio ativo</Label><Input value={editing.active_principle || ""} onChange={(e) => setEditing({ ...editing, active_principle: e.target.value })} /></div>
              <div className="space-y-2"><Label>Composição</Label><Input value={editing.composition || ""} onChange={(e) => setEditing({ ...editing, composition: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2 pt-3 mt-1 border-t border-border">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SEO (opcional)</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Meta título <span className="text-xs text-muted-foreground font-normal">(até 60 caracteres)</span></Label>
                <Input
                  maxLength={70}
                  value={editing.meta_title || ""}
                  placeholder={editing.name ? `${editing.name} | ${brandName}` : "Use o nome do produto se vazio"}
                  onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">{(editing.meta_title || "").length}/60</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Meta descrição <span className="text-xs text-muted-foreground font-normal">(até 160 caracteres)</span></Label>
                <textarea
                  className="w-full rounded-xl border border-input bg-background p-3 text-sm min-h-[60px]"
                  maxLength={180}
                  value={editing.meta_description || ""}
                  placeholder="Texto curto que aparece no Google/redes sociais"
                  onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">{(editing.meta_description || "").length}/160</p>
              </div>
              <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!editing.is_featured} onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })} />
                  Em destaque
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!editing.is_new_release} onChange={(e) => setEditing({ ...editing, is_new_release: e.target.checked })} />
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 leading-none">LANÇAMENTO</span>
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!editing.is_on_offer} disabled title="Gerenciado pela aba Promoções" />
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-1.5 py-0.5 leading-none">OFERTA</span>
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.is_active !== false} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                  Ativo
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-border sticky bottom-0 bg-card">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </div>
          </form>
        )}
      </AdminModal>
    </>
  );
}