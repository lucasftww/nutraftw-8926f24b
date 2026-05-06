import { useEffect, useState } from "react";
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
import { ProductThumb } from "@/components/admin/ProductThumb";
import { EmptyState } from "@/components/admin/EmptyState";
import { queryKeys } from "@/lib/queryKeys";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "@/components/admin/AdminErrorBanner";
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
      className={`bg-card rounded-2xl border p-3 flex gap-2 ${selected.has(p.id) ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
    >
      {sortable && <DragHandle handleProps={sort.handleProps} />}
      <label className="shrink-0 mt-1 inline-flex items-center justify-center w-5 h-5 rounded border border-input cursor-pointer">
        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSel(p.id)} className="sr-only" aria-label={`Selecionar ${p.name}`} />
        {selected.has(p.id) && <Check className="h-3.5 w-3.5 text-primary" />}
      </label>
      <ProductThumb src={p.image_url} size="lg" alt={p.name} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-snug line-clamp-2">{p.name}</p>
        <p className="text-xs text-muted-foreground truncate">{p.category?.name || "Sem categoria"}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="font-bold text-primary text-sm">{formatBRL(p.price)}</span>
          <StockBadge stock={p.stock} />
        </div>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button onClick={() => setEditing(p)} aria-label="Editar" title="Editar" className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-muted"><Pencil className="h-4 w-4" /></button>
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
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkAction, setBulkAction] = useState<"" | "activate" | "deactivate" | "feature" | "unfeature" | "stock_set" | "stock_inc" | "delete">("");
  const [bulkValue, setBulkValue] = useState<string>("");
  const PAGE_SIZE = 30;
  const qc = useQueryClient();
  const { confirm } = useConfirm();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => { setPage(0); }, [debouncedQuery]);

  async function load() {
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
    const [pr, cr] = await Promise.all([
      q,
      supabase.from("categories").select("*").order("display_order"),
    ]);
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
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, debouncedQuery]);
  useEffect(() => { setSelected(new Set()); }, [page, debouncedQuery]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const f = editing;
    const basePayload = {
      name: f.name,
      slug: f.slug || slugify(f.name),
      description: f.description || null,
      active_principle: f.active_principle || null,
      composition: f.composition || null,
      meta_title: f.meta_title?.trim() || null,
      meta_description: f.meta_description?.trim() || null,
      price: Number(f.price) || 0,
      stock: Number(f.stock) || 0,
      image_url: f.image_url || null,
      category_id: f.category_id || null,
      is_featured: !!f.is_featured,
      is_new_release: !!f.is_new_release,
      is_active: f.is_active !== false,
    };
    const payload: any = f.id
      ? basePayload
      : { ...basePayload, sale_price: null, is_on_offer: false };
    const before = f.id ? items.find((p) => p.id === f.id) : null;
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
      toast.error(error.message);
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
      toast.error(error.message);
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
      load();
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
    const { data, error } = await supabase.from("products").insert(payload).select().maybeSingle();
    if (error) {
      logSupabaseError("Duplicar produto", error, { source_id: p.id });
      toast.error(error.message);
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
    const ids = Array.from(selected);
    let payload: Partial<{ is_active: boolean; is_featured: boolean; stock: number }> = {};
    let needsConfirm = false;
    let summary = "";
    if (bulkAction === "activate") { payload = { is_active: true }; summary = "ativados"; }
    else if (bulkAction === "deactivate") { payload = { is_active: false }; summary = "desativados"; }
    else if (bulkAction === "feature") { payload = { is_featured: true }; summary = "destacados"; }
    else if (bulkAction === "unfeature") { payload = { is_featured: false }; summary = "removidos do destaque"; }
    else if (bulkAction === "stock_set") {
      needsConfirm = true;
      const v = parseInt(bulkValue, 10);
      if (Number.isNaN(v) || v < 0) { toast.error("Informe um stock válido (≥ 0)"); return; }
      payload = { stock: v }; summary = `stock = ${v}`;
    } else if (bulkAction === "stock_inc") {
      const delta = parseInt(bulkValue, 10);
      if (Number.isNaN(delta)) { toast.error("Informe um valor inteiro (positivo ou negativo)"); return; }
      const ok = await confirm({
        title: `Ajustar stock de ${ids.length} produto${ids.length === 1 ? "" : "s"}?`,
        description: `Será somado ${delta >= 0 ? "+" : ""}${delta} ao stock atual de cada produto.`,
      });
      if (!ok) return;
      setBulkBusy(true);
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
      if (error) { toast.error(error.message); return; }
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
    if (error) { toast.error(error.message); return; }
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
    const results = await Promise.all(
      updates.map((u) => supabase.from("products").update({ display_order: u.display_order } as any).eq("id", u.id)),
    );
    const failed = results.filter((r) => r.error);
    if (failed.length) {
      toast.error(`Falha ao salvar nova ordem (${failed.length})`);
      load();
    } else {
      toast.success("Ordem atualizada");
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
    }
  }

  async function exportCsv() {
    toast.info("Gerando CSV…");
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, price, sale_price, stock, is_active, is_featured, is_new_release, is_on_offer, active_principle, composition, description, meta_title, meta_description, category:categories(name)")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) { toast.error(error.message); return; }
    const rows = data || [];
    const esc = (v: any) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
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
      <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar produto ou princípio ativo…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {totalCount != null && (
          <span className="text-xs text-muted-foreground">
            {totalCount} {totalCount === 1 ? "produto" : "produtos"}
          </span>
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} title="Exportar todos os produtos para CSV"><Download className="h-4 w-4" /> CSV</Button>
          <Button onClick={() => setEditing({ is_active: true })}><Plus className="h-4 w-4" /> Novo produto</Button>
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
              <option value="delete">Remover</option>
            </select>
            {(bulkAction === "stock_set" || bulkAction === "stock_inc") && (
              <Input
                type="number"
                inputMode="numeric"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder={bulkAction === "stock_set" ? "Novo stock" : "+/− qtd"}
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
        <table className="w-full text-sm">
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
                <ImageUpload value={editing.image_url || ""} onChange={(url) => setEditing({ ...editing, image_url: url })} />
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
                  placeholder={editing.name ? `${editing.name} | Royal Vita` : "Use o nome do produto se vazio"}
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
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        )}
      </AdminModal>
    </>
  );
}