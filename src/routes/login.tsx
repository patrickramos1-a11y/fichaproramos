import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus, User } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar - Ramos Engenharia" }] }),
});

// Senha fixa interna — o usuário não precisa saber nem digitar.
const FIXED_PW = "ramos-app-fixed-pw-2025";
const emailFor = (name: string) =>
  `${name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}@app.local`;

type AppUser = { id: string; name: string; email: string };
const USE_D1_BACKEND = import.meta.env.VITE_DATA_BACKEND === "d1";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function LoginPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
    void loadUsers();
  }, [navigate]);

  const loadUsers = async () => {
    if (USE_D1_BACKEND) {
      const response = await fetch("/api/app-users");
      if (!response.ok) return toast.error("Nao foi possivel carregar os usuarios");
      const data = await response.json() as { appUsers?: AppUser[] };
      setUsers((data.appUsers ?? []) as AppUser[]);
      return;
    }
    const { data, error } = await supabase
      .from("app_users")
      .select("id, name, email")
      .order("name", { ascending: true });
    if (error) return toast.error("Não foi possível carregar os usuários");
    setUsers((data ?? []) as AppUser[]);
  };

  const signInAs = async (u: AppUser) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: u.email,
      password: FIXED_PW,
    });
    setLoading(false);
    if (error) return toast.error("Não foi possível entrar como " + u.name);
    toast.success(`Bem-vindo, ${u.name}!`);
    navigate({ to: "/" });
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (users.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
      return toast.error("Já existe um usuário com esse nome");
    }
    const email = emailFor(name);
    if (!email.includes("@")) return toast.error("Nome inválido");
    setLoading(true);
    const { error: signUpErr } = await supabase.auth.signUp({
      email,
      password: FIXED_PW,
    });
    if (signUpErr && !signUpErr.message.toLowerCase().includes("registered")) {
      setLoading(false);
      return toast.error(signUpErr.message);
    }
    // Faz login para conseguir inserir na tabela (RLS exige auth.uid).
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: FIXED_PW,
    });
    if (signInErr) {
      setLoading(false);
      return toast.error(signInErr.message);
    }
    if (USE_D1_BACKEND) {
      const response = await fetch("/api/db/sync", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          operations: [{
            operationId: `upsert:app_users:${email}`,
            table: "app_users",
            recordId: email,
            type: "upsert",
            payload: { id: email, name, email },
          }],
        }),
      });
      if (!response.ok) {
        setLoading(false);
        return toast.error(await response.text());
      }
    } else {
      const { error: insErr } = await supabase
        .from("app_users")
        .insert({ name, email });
      if (insErr && !insErr.message.toLowerCase().includes("duplicate")) {
        setLoading(false);
        return toast.error(insErr.message);
      }
    }
    setLoading(false);
    toast.success(`Usuário ${name} criado!`);
    setNewName("");
    setShowAdd(false);
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-primary text-primary-foreground font-bold text-xl">
            R
          </div>
          <h1 className="mt-3 text-xl font-semibold">Ramos Engenharia</h1>
          <p className="text-sm text-muted-foreground">Levantamento de Campo</p>
        </div>

        {!showAdd ? (
          <>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                Selecione seu usuário para entrar
              </p>
              <div className="space-y-2">
                {users.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-6">
                    Nenhum usuário cadastrado.
                  </p>
                )}
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => signInAs(u)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-left hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="font-medium">{u.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowAdd(true)}
              disabled={loading}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Cadastrar novo usuário
            </Button>
          </>
        ) : (
          <form onSubmit={addUser} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-name">Nome do usuário</Label>
              <Input
                id="new-name"
                autoFocus
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: João Silva"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              Cadastrar e entrar
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setShowAdd(false);
                setNewName("");
              }}
              disabled={loading}
            >
              Voltar
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
