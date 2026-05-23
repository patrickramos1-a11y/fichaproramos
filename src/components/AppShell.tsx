import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, FolderKanban, ClipboardList, Settings, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OfflineIndicator } from "./OfflineIndicator";

const nav = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/projetos", label: "Projetos", icon: FolderKanban },
  { to: "/levantamentos", label: "Levantamentos", icon: ClipboardList },
  { to: "/configuracoes", label: "Config.", icon: Settings },
] as const;

const mobileNav = [
  { to: "/", label: "Inicio", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/levantamentos", label: "Campo", icon: ClipboardList },
  { to: "/configuracoes", label: "Config.", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const onLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        {/* Linha 1: marca + ações */}
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground font-bold">
              R
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-sm font-semibold truncate">Ramos Engenharia</div>
              <div className="text-xs text-muted-foreground truncate">Levantamento de Campo</div>
            </div>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            <OfflineIndicator />
            <button
              onClick={onLogout}
              title="Sair"
              aria-label="Sair"
              className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Linha 2: navegação rolável (mobile) / inline (desktop) */}
        <nav
          className="mx-auto hidden max-w-7xl gap-1 overflow-x-auto px-2 pb-2 md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Navegação principal"
        >
          {nav.map((n) => {
            const active = n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors min-h-[40px] ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <n.icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{n.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl px-3 py-4 pb-28 md:px-4 md:py-6 min-w-0">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-lg backdrop-blur md:hidden"
        aria-label="Navegação principal mobile"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {mobileNav.map((n) => {
            const active = n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <n.icon className="h-5 w-5 shrink-0" />
                <span className="max-w-full truncate">{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
