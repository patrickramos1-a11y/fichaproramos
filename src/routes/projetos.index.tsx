import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useDB } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { FolderKanban, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/projetos/")({
  head: () => ({ meta: [{ title: "Projetos — Ramos Engenharia" }] }),
  component: ProjetosPage,
});

function ProjetosPage() {
  const db = useDB();
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-1">Projetos</h1>
      <p className="text-sm text-muted-foreground mb-6">{db.projects.length} cadastrados</p>
      {db.projects.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          Crie um cliente e adicione projetos a ele.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {db.projects.map((p) => {
            const c = db.clients.find((c) => c.id === p.clientId);
            const surveys = db.surveys.filter((s) => s.projectId === p.id).length;
            return (
              <Link key={p.id} to="/projetos/$id" params={{ id: p.id }}>
                <Card className="hover:border-primary transition-colors">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary"><FolderKanban className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c?.name} • {surveys} levantamento(s)</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}