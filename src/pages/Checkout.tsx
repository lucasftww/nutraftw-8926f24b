import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";

const SHIPPING = 80;
const INSURANCE_RATE = 0.10;

export default function Checkout() {
  const { lines, total, clear } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    cpf: "",
    phone: "",
    zip: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    payment_method: "pix" as "pix" | "credit_card",
  });

  const insurance = Math.round(total * INSURANCE_RATE * 100) / 100;
  const grandTotal = total + SHIPPING + insurance;

  if (lines.length === 0)
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground mb-4">Seu carrinho está vazio.</p>
        <Button onClick={() => nav("/")}>Voltar ao catálogo</Button>
      </div>
    );

  if (!user)
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground mb-4">Faça login para finalizar o pedido.</p>
        <Button onClick={() => nav("/login?next=/checkout")}>Entrar</Button>
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data: order, error: oErr } = await supabase
        .from("orders")
        .insert({
          user_id: user!.id,
          status: "pending",
          payment_method: form.payment_method,
          subtotal: total,
          shipping: SHIPPING,
          insurance,
          total: grandTotal,
          shipping_full_name: form.full_name,
          shipping_cpf: form.cpf,
          shipping_phone: form.phone,
          shipping_zip: form.zip,
          shipping_street: form.street,
          shipping_number: form.number,
          shipping_complement: form.complement,
          shipping_district: form.district,
          shipping_city: form.city,
          shipping_state: form.state,
        })
        .select()
        .single();
      if (oErr) throw oErr;

      const items = lines.map((l) => ({
        order_id: order.id,
        product_id: l.product_id,
        product_name: l.name,
        product_image_url: l.image_url,
        unit_price: l.price,
        quantity: l.qty,
        subtotal: l.price * l.qty,
      }));
      const { error: iErr } = await supabase.from("order_items").insert(items);
      if (iErr) throw iErr;

      clear();
      toast.success("Pedido criado! Em breve entraremos em contato.");
      nav("/minha-conta");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar pedido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container py-8 md:py-12">
      <h1 className="font-display text-3xl md:text-4xl font-extrabold text-primary mb-8">Finalizar pedido</h1>

      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
          <section>
            <h2 className="font-bold text-lg mb-4">Dados de entrega</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nome completo *</Label>
                <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>CPF *</Label>
                <Input required value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Telefone *</Label>
                <Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>CEP *</Label>
                <Input required value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Rua *</Label>
                <Input required value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Número *</Label>
                <Input required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input value={form.complement} onChange={(e) => setForm({ ...form, complement: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Bairro *</Label>
                <Input required value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cidade *</Label>
                <Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>UF *</Label>
                <Input required maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-4">Forma de pagamento</h2>
            <div className="grid grid-cols-2 gap-3">
              {(["pix", "credit_card"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm({ ...form, payment_method: m })}
                  className={`p-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                    form.payment_method === m
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {m === "pix" ? "PIX" : "Cartão de crédito"}
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="bg-card rounded-2xl border border-border p-6 h-fit lg:sticky lg:top-24">
          <h2 className="font-bold text-lg mb-4">Resumo</h2>
          <div className="space-y-3 mb-4">
            {lines.map((l) => (
              <div key={l.product_id} className="flex justify-between text-sm">
                <span className="text-foreground line-clamp-1">
                  {l.qty}× {l.name}
                </span>
                <span className="font-medium shrink-0 ml-2">{formatBRL(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 py-4 border-t border-border text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatBRL(total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Frete</span><span>{formatBRL(SHIPPING)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Seguro (10%)</span><span>{formatBRL(insurance)}</span></div>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-border mb-4">
            <span className="font-bold">Total</span>
            <span className="font-display text-2xl font-extrabold text-primary">{formatBRL(grandTotal)}</span>
          </div>
          <Button type="submit" disabled={submitting} className="w-full" size="lg">
            {submitting ? "A processar…" : "Confirmar pedido"}
          </Button>
        </aside>
      </form>
    </div>
  );
}
