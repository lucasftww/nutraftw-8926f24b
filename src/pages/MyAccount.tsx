import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

export default function MyAccount() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState<any>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data || {}));
    supabase
      .from("orders")
      .select("id, status, total, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => setOrders(data || []));
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
        cpf: profile.cpf,
        address_zip: profile.address_zip,
        address_street: profile.address_street,
        address_number: profile.address_number,
        address_complement: profile.address_complement,
        address_district: profile.address_district,
        address_city: profile.address_city,
        address_state: profile.address_state,
      })
      .eq("user_id", user!.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Perfil atualizado!");
  }

  async function logout() {
    await supabase.auth.signOut();
    nav("/", { replace: true });
  }

  return (
    <div className="container py-8 md:py-12 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-extrabold text-primary">Minha conta</h1>
        <Button variant="outline" onClick={logout}>
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>

      <form onSubmit={save} className="bg-card rounded-2xl border border-border p-6 space-y-4 mb-8">
        <h2 className="font-bold text-lg mb-2">Dados pessoais</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input
              value={profile.full_name || ""}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={user?.email || ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={profile.phone || ""}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input
              value={profile.cpf || ""}
              onChange={(e) => setProfile({ ...profile, cpf: e.target.value })}
            />
          </div>
        </div>

        <h2 className="font-bold text-lg mt-4 mb-2">Endereço</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input
              value={profile.address_zip || ""}
              onChange={(e) => setProfile({ ...profile, address_zip: e.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Rua</Label>
            <Input
              value={profile.address_street || ""}
              onChange={(e) => setProfile({ ...profile, address_street: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Número</Label>
            <Input
              value={profile.address_number || ""}
              onChange={(e) => setProfile({ ...profile, address_number: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Complemento</Label>
            <Input
              value={profile.address_complement || ""}
              onChange={(e) => setProfile({ ...profile, address_complement: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input
              value={profile.address_district || ""}
              onChange={(e) => setProfile({ ...profile, address_district: e.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Cidade</Label>
            <Input
              value={profile.address_city || ""}
              onChange={(e) => setProfile({ ...profile, address_city: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>UF</Label>
            <Input
              value={profile.address_state || ""}
              onChange={(e) => setProfile({ ...profile, address_state: e.target.value })}
              maxLength={2}
            />
          </div>
        </div>
        <Button type="submit" disabled={saving}>{saving ? "A guardar…" : "Guardar alterações"}</Button>
      </form>

      <div className="bg-card rounded-2xl border border-border p-6">
        <h2 className="font-bold text-lg mb-4">Meus pedidos</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Você ainda não fez nenhum pedido.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="flex justify-between items-center p-4 rounded-xl border border-border">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">#{o.id.slice(0, 8)}</p>
                  <p className="font-semibold capitalize">{o.status}</p>
                </div>
                <p className="font-display font-bold text-primary">
                  {Number(o.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
