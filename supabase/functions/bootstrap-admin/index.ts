// Edge function temporária para criar/promover o admin inicial.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ADMIN_EMAIL = "frajolasilva60@gmail.com";
const ADMIN_PASSWORD = "Casabranca123!";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Verifica se já existe
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
      page: 1, perPage: 200,
    });
    if (listErr) throw listErr;
    let user = list.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());

    // 2) Cria se não existir
    if (!user) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });
      if (createErr) throw createErr;
      user = created.user!;
    } else {
      // garante senha conhecida + email confirmado
      await supabase.auth.admin.updateUserById(user.id, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });
    }

    // 3) Garante profile
    await supabase.from("profiles").upsert(
      { user_id: user.id, email: ADMIN_EMAIL },
      { onConflict: "user_id" },
    );

    // 4) Remove role customer e adiciona admin
    await supabase.from("user_roles").delete().eq("user_id", user.id);
    const { error: roleErr } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: "admin" });
    if (roleErr) throw roleErr;

    return new Response(
      JSON.stringify({ ok: true, user_id: user.id, email: ADMIN_EMAIL }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String((e as Error).message || e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
