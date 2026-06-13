import { Outlet, createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  getSurveyTypeMeta,
  useDB,
  useDBStatus,
  addProject,
  deleteProject,
  addEmpreendimento,
  deleteEmpreendimento,
  updateClient,
  addAnnualEnvironmentalRecord,
  deleteAnnualEnvironmentalRecord,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClienteForm, emptyClienteForm, type ClienteFormValue } from "@/components/ClienteForm";
import { PurposeChips } from "@/components/FinalidadeCard";
import { StatusBadge } from "@/components/StatusBadge";
import { getSurveyEmpreendimento, getSurveyProject, getSurveysForClient } from "@/lib/surveyRelations";
import {
  ALL_SURVEY_PURPOSES,
  SURVEY_PURPOSE_LABELS,
  type AnnualEnvironmentalRecord,
  type Attachment,
  type Client,
  type Empreendimento,
  type Pendencia,
  type Survey,
  type SurveyPurpose,
} from "@/lib/types";
import {
  ANNUAL_STATUS_LABELS,
  buildAnnualAISummary,
  buildAnnualClientRequestText,
  calculateAnnualProgress,
  countAnnualOpenPending,
  countAnnualValidDocuments,
  createAnnualRecordFromPrevious,
  createAnnualUnitsFromEmpreendimentos,
  createEmptyAnnualEnvironmentalRecord,
} from "@/lib/annualEnvironmental";
import {
  Plus,
  Trash2,
  ArrowLeft,
  FolderKanban,
  Building2,
  Pencil,
  ClipboardList,
  FileText,
  AlertTriangle,
  Files,
  CheckCircle2,
  Clock3,
  MapPin,
  ChevronRight,
  UserRound,
  CalendarDays,
  Database,
} from "lucide-react";

export const Route = createFileRoute("/clientes/$id")({
  component: ClienteDetail,
});

type ClientDocRow = {
  surveyId: string;
  clientId: string;
  surveyTitle: string;
  purposeList: SurveyPurpose[];
  attachment: Attachment;
  moduleId: string;
  moduleTitle: string;
  createdAt: string;
};

type PurposeSummary = {
  purpose: SurveyPurpose;
  count: number;
  openCount: number;
  closedCount: number;
  pendingCount: number;
  latestAt?: string;
};

function ClienteDetail() {
  const { id } = Route.useParams();
  const location = useLocation();
  const db = useDB();
  const nav = useNavigate();
  const client = db.clients.find((c) => c.id === id);
  const empreendimentos = db.empreendimentos.filter((e) => e.clientId === id);
  const projects = db.projects.filter((p) => p.clientId === id);
  const surveys = getSurveysForClient(db.surveys, id, db.projects);
  const annualRecords = db.annualRecords
    .filter((record) => record.clientId === id)
    .sort((a, b) => b.yearBase - a.yearBase);
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: "", description: "", empreendimentoId: "" });
  const [empOpen, setEmpOpen] = useState(false);
  const [empForm, setEmpForm] = useState({
    name: "", cnpjCpf: "", atividade: "", cnae: "",
    endereco: "", bairro: "", cidade: "", uf: "", cep: "",
    latitude: "", longitude: "", contatoLocal: "", telefoneLocal: "", notes: "",
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<ClienteFormValue>(emptyClienteForm());
  const [activeTab, setActiveTab] = useState("geral");
  const [statusFilter, setStatusFilter] = useState<"todos" | "andamento" | "concluidos" | "pendencias">("todos");
  const [purposeFilter, setPurposeFilter] = useState<Set<SurveyPurpose>>(new Set());

  const surveyRows = useMemo(() => {
    return surveys
      .map((survey) => {
        const project = getSurveyProject(survey, db.projects);
        const empreendimento = getSurveyEmpreendimento(survey, db.empreendimentos, db.projects);
        const typeMeta = getSurveyTypeMeta(survey.type, survey.customTypeId);
        const moduleEntries = Object.entries(survey.modules ?? {});
        const totalModules = moduleEntries.length || 1;
        const doneModules = moduleEntries.filter(([, state]) => state.status === "concluido").length;
        const attachments = moduleEntries.flatMap(([moduleId, state]) =>
          (state.attachments ?? []).map((attachment) => ({
            surveyId: survey.id,
            clientId: survey.clientId,
            surveyTitle: survey.title,
            purposeList: survey.purposes ?? [],
            attachment,
            moduleId,
            moduleTitle: moduleId,
            createdAt: attachment.createdAt,
          })),
        );
        const pending = (survey.pendencias ?? []).filter((item) => item.status !== "concluido");
        const dateBase = survey.closedAt ?? survey.date ?? survey.createdAt;
        return {
          survey,
          project,
          empreendimento,
          typeMeta,
          totalModules,
          doneModules,
          progressPercent: Math.round((doneModules / totalModules) * 100),
          pending,
          attachments,
          dateBase,
        };
      })
      .sort((a, b) => String(b.dateBase ?? "").localeCompare(String(a.dateBase ?? "")));
  }, [surveys, db.projects, db.empreendimentos]);

  const openRows = surveyRows.filter((row) => !row.survey.closedAt);
  const closedRows = surveyRows.filter((row) => !!row.survey.closedAt);
  const latestSurvey = surveyRows[0];
  const totalPendencias = surveyRows.reduce((acc, row) => acc + row.pending.length, 0);
  const annualOpenPendencies = annualRecords.reduce((acc, record) => acc + countAnnualOpenPending(record), 0);
  const allDocs = surveyRows.flatMap((row) => row.attachments).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const availablePurposes = ALL_SURVEY_PURPOSES.filter((purpose) =>
    surveyRows.some((row) => (row.survey.purposes ?? []).includes(purpose)),
  );

  const purposeMatrix = useMemo<PurposeSummary[]>(() => {
    return ALL_SURVEY_PURPOSES.map((purpose) => {
      const rows = surveyRows.filter((row) => (row.survey.purposes ?? []).includes(purpose));
      return {
        purpose,
        count: rows.length,
        openCount: rows.filter((row) => !row.survey.closedAt).length,
        closedCount: rows.filter((row) => !!row.survey.closedAt).length,
        pendingCount: rows.reduce((acc, row) => acc + row.pending.length, 0),
        latestAt: rows[0]?.dateBase,
      };
    });
  }, [surveyRows]);

  const visibleSurveyRows = useMemo(() => {
    return surveyRows.filter((row) => {
      if (statusFilter === "andamento" && row.survey.closedAt) return false;
      if (statusFilter === "concluidos" && !row.survey.closedAt) return false;
      if (statusFilter === "pendencias" && row.pending.length === 0) return false;
      if (purposeFilter.size > 0 && !(row.survey.purposes ?? []).some((purpose) => purposeFilter.has(purpose))) return false;
      return true;
    });
  }, [surveyRows, statusFilter, purposeFilter]);

  const visibleOpenRows = visibleSurveyRows.filter((row) => !row.survey.closedAt);
  const visibleClosedRows = visibleSurveyRows.filter((row) => !!row.survey.closedAt);

  const purposeSentence = availablePurposes.length
    ? availablePurposes.map((purpose) => SURVEY_PURPOSE_LABELS[purpose]).join(", ")
    : "sem finalidades classificadas";

  const summaryText = `Este cliente possui dados para ${purposeSentence}. ${latestSurvey ? `O ultimo levantamento foi em ${formatDate(latestSurvey.dateBase)}.` : "Ainda nao existem levantamentos registrados."} Existem ${openRows.length} levantamento(s) em andamento, ${closedRows.length} concluido(s), ${totalPendencias} pendencia(s) de levantamento e ${annualOpenPendencies} pendencia(s) em dados ambientais anuais.`;

  const pendingRows = surveyRows.flatMap((row) =>
    row.pending.map((pendencia) => ({
      pendencia,
      survey: row.survey,
      typeMeta: row.typeMeta,
    })),
  );

  if (location.pathname.includes(`/clientes/${id}/dados-ambientais/`)) {
    return <Outlet />;
  }

  if (!client) return <AppShell><p>Cliente nao encontrado.</p></AppShell>;

  function submitProject() {
    if (!projectForm.name.trim()) return;
    const project = addProject({
      clientId: id,
      name: projectForm.name,
      description: projectForm.description,
      empreendimentoId: projectForm.empreendimentoId || undefined,
    });
    setProjectForm({ name: "", description: "", empreendimentoId: "" });
    setProjectOpen(false);
    nav({ to: "/projetos/$id", params: { id: project.id } });
  }

  function submitEmp() {
    if (!empForm.name.trim()) return;
    addEmpreendimento({ clientId: id, ...empForm });
    setEmpForm({
      name: "", cnpjCpf: "", atividade: "", cnae: "",
      endereco: "", bairro: "", cidade: "", uf: "", cep: "",
      latitude: "", longitude: "", contatoLocal: "", telefoneLocal: "", notes: "",
    });
    setEmpOpen(false);
  }

  function openEdit() {
    if (!client) return;
    const { id: _dropId, createdAt: _dropCreatedAt, ...rest } = client;
    setEditForm({ ...emptyClienteForm(), ...rest });
    setEditOpen(true);
  }

  function submitEdit() {
    if (!editForm.name.trim()) return;
    updateClient(id, editForm);
    setEditOpen(false);
  }

  function togglePurposeFilter(purpose: SurveyPurpose) {
    const next = new Set(purposeFilter);
    if (next.has(purpose)) next.delete(purpose);
    else next.add(purpose);
    setPurposeFilter(next);
  }

  return (
    <AppShell>
      <Link to="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{client.personType === "PF" ? "Pessoa fisica" : "Pessoa juridica"}</Badge>
              {(client.cidade || client.uf) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[client.cidade, client.uf].filter(Boolean).join("/")}
                </span>
              )}
            </div>
            <h1 className="mt-2 break-words text-2xl font-semibold">{client.name}</h1>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <MiniInfo label="Levantamentos" value={String(surveyRows.length)} />
            <MiniInfo label="Em andamento" value={String(openRows.length)} tone="warn" />
            <MiniInfo label="Concluidos" value={String(closedRows.length)} tone="ok" />
            <MiniInfo label="Pendencias" value={String(totalPendencias)} tone="danger" />
            <MiniInfo label="Anos ambientais" value={String(annualRecords.length)} />
            <MiniInfo label="Ultimo" value={latestSurvey ? formatDate(latestSurvey.dateBase) : "—"} />
          </div>

          <div className="max-w-4xl text-sm text-muted-foreground">
            {summaryText}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {availablePurposes.length > 0 ? (
              availablePurposes.map((purpose) => (
                <Badge key={purpose} variant="secondary" className="h-6">
                  {SURVEY_PURPOSE_LABELS[purpose]}
                </Badge>
              ))
            ) : (
              <Badge variant="outline">Sem finalidades com dados</Badge>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Link to="/levantamentos/novo" search={{ clientId: id }}>
            <Button>
              <Plus className="mr-1 h-4 w-4" /> Novo levantamento
            </Button>
          </Link>
          <Button variant="outline" onClick={openEdit}>
            <Pencil className="mr-1 h-4 w-4" /> Editar cliente
          </Button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Total de levantamentos" value={surveyRows.length} icon={<ClipboardList className="h-4 w-4" />} />
        <KpiCard label="Em andamento" value={openRows.length} icon={<Clock3 className="h-4 w-4" />} tone="warn" />
        <KpiCard label="Concluidos" value={closedRows.length} icon={<CheckCircle2 className="h-4 w-4" />} tone="ok" />
        <KpiCard label="Pendencias abertas" value={totalPendencias} icon={<AlertTriangle className="h-4 w-4" />} tone="danger" />
        <KpiCard label="Documentos e fotos" value={allDocs.length} icon={<Files className="h-4 w-4" />} />
        <KpiCard label="Dados anuais" value={annualRecords.length} icon={<Database className="h-4 w-4" />} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 flex h-auto flex-wrap">
          <TabsTrigger value="geral">Visao Geral</TabsTrigger>
          <TabsTrigger value="levantamentos">Levantamentos</TabsTrigger>
          <TabsTrigger value="finalidades">Finalidades</TabsTrigger>
          <TabsTrigger value="dados-ambientais">Dados Ambientais Anuais</TabsTrigger>
          <TabsTrigger value="pendencias">Pendencias</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="cadastro">Dados cadastrais</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resumo tecnico e gerencial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">{summaryText}</p>
              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ultimos levantamentos</div>
                  {surveyRows.length === 0 ? (
                    <EmptyHint label="Nenhum levantamento registrado para este cliente." />
                  ) : (
                    surveyRows.slice(0, 5).map((row) => (
                      <SurveyCompactRow key={row.survey.id} row={row} />
                    ))
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documentos recentes</div>
                  {allDocs.length === 0 ? (
                    <EmptyHint label="Sem documentos ou fotos vinculados ate o momento." />
                  ) : (
                    allDocs.slice(0, 6).map((doc) => (
                      <DocCompactRow key={doc.attachment.id} row={doc} />
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="levantamentos" className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "todos", label: "Todos" },
                  { id: "andamento", label: "Em andamento" },
                  { id: "concluidos", label: "Concluidos" },
                  { id: "pendencias", label: "Com pendencias" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStatusFilter(item.id as typeof statusFilter)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      statusFilter === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {ALL_SURVEY_PURPOSES.map((purpose) => {
                  const active = purposeFilter.has(purpose);
                  return (
                    <button
                      key={purpose}
                      type="button"
                      onClick={() => togglePurposeFilter(purpose)}
                      className={`rounded-full border px-3 py-1 text-xs whitespace-normal text-left transition-colors ${
                        active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"
                      }`}
                    >
                      {SURVEY_PURPOSE_LABELS[purpose]}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Em andamento</h2>
                <span className="text-xs text-muted-foreground">{visibleOpenRows.length}</span>
              </div>
              {visibleOpenRows.length === 0 ? (
                <EmptyHint label="Nenhum levantamento em andamento para os filtros atuais." />
              ) : (
                visibleOpenRows.map((row) => (
                  <SurveyMainRow key={row.survey.id} row={row} />
                ))
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Concluidos</h2>
                <span className="text-xs text-muted-foreground">{visibleClosedRows.length}</span>
              </div>
              {visibleClosedRows.length === 0 ? (
                <EmptyHint label="Nenhum levantamento concluido para os filtros atuais." />
              ) : (
                visibleClosedRows.map((row) => (
                  <SurveyMainRow key={row.survey.id} row={row} compact />
                ))
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="finalidades" className="space-y-3">
          {purposeMatrix.map((summary) => (
            <Card key={summary.purpose}>
              <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="font-medium">{SURVEY_PURPOSE_LABELS[summary.purpose]}</div>
                  <div className="text-xs text-muted-foreground">
                    {summary.count === 0
                      ? "Sem levantamento"
                      : summary.openCount > 0
                        ? "Em andamento"
                        : "Com dados"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 lg:min-w-[520px]">
                  <Metric label="Levantamentos" value={summary.count || "0"} />
                  <Metric label="Ultima atualizacao" value={summary.latestAt ? formatDate(summary.latestAt) : "—"} />
                  <Metric label="Pendencias" value={summary.pendingCount || "0"} />
                  <button
                    type="button"
                    onClick={() => {
                      setPurposeFilter(summary.count === 0 ? new Set() : new Set([summary.purpose]));
                      setActiveTab("levantamentos");
                    }}
                    className="rounded-md border px-3 py-2 text-left hover:border-primary/40"
                  >
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Ver vinculados</div>
                    <div className="mt-1 inline-flex items-center gap-1 font-medium">
                      Abrir <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="dados-ambientais" className="space-y-4">
          <AnnualRecordsPanel client={client} empreendimentos={empreendimentos} records={annualRecords} />
        </TabsContent>

        <TabsContent value="pendencias" className="space-y-3">
          {pendingRows.length === 0 ? (
            <EmptyHint label="Este cliente nao possui pendencias abertas." />
          ) : (
            pendingRows.map(({ pendencia, survey, typeMeta }) => (
              <Card key={pendencia.id}>
                <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium break-words">{pendencia.description}</div>
                    <div className="mt-1 text-xs text-muted-foreground break-words">
                      {survey.title} · {typeMeta.label}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Responsavel: {pendencia.responsible || "—"}</span>
                      <span>Criada em {formatDate(pendencia.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={pendencia.status} />
                    <Link to="/clientes/$id/levantamentos/$surveyId" params={{ id: survey.clientId, surveyId: survey.id }}>
                      <Button variant="outline" size="sm">Abrir</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="documentos" className="space-y-3">
          {allDocs.length === 0 ? (
            <EmptyHint label="Sem documentos ou fotos vinculados a este cliente." />
          ) : (
            allDocs.map((doc) => (
              <Card key={doc.attachment.id}>
                <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium break-words">{doc.attachment.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground break-words">
                      {doc.attachment.type} · {doc.surveyTitle}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{doc.purposeList.length > 0 ? doc.purposeList.map((purpose) => SURVEY_PURPOSE_LABELS[purpose]).join(", ") : "Sem finalidade"}</span>
                      <span>{formatDate(doc.createdAt)}</span>
                    </div>
                  </div>
                  <Link to="/clientes/$id/levantamentos/$surveyId" params={{ id: doc.clientId, surveyId: doc.surveyId }}>
                    <Button variant="outline" size="sm">Ver relatorio</Button>
                  </Link>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="cadastro" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <div className="text-xs text-muted-foreground">{client.personType === "PF" ? "Pessoa fisica" : "Pessoa juridica"}</div>
                <CardTitle>{client.name}</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={openEdit}><Pencil className="mr-1 h-4 w-4" /> Editar</Button>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="text-muted-foreground">CNPJ/CPF: </span>{client.cnpjCpf || "—"}</div>
              <div><span className="text-muted-foreground">IE/IM: </span>{client.ie || "—"} / {client.im || "—"}</div>
              <div className="sm:col-span-2"><span className="text-muted-foreground">Endereco: </span>{[client.address, client.bairro, client.cidade, client.uf, client.cep].filter(Boolean).join(", ") || "—"}</div>
              <div><span className="text-muted-foreground">Contato: </span>{client.contact || "—"}</div>
              <div><span className="text-muted-foreground">Telefone: </span>{client.phone || "—"}</div>
              <div className="sm:col-span-2"><span className="text-muted-foreground">E-mail: </span>{client.email || "—"}</div>
              {client.repNome && (
                <div className="sm:col-span-2 mt-2 border-t pt-2">
                  <div className="mb-1 text-xs text-muted-foreground">Representante legal</div>
                  <div>{client.repNome} {client.repCargo ? `- ${client.repCargo}` : ""}</div>
                  <div className="text-xs text-muted-foreground">RG {client.repRg || "—"} · CPF {client.repCpf || "—"} · {client.repEmail || "—"} {client.repPhone ? `· ${client.repPhone}` : ""}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Empreendimentos</CardTitle>
              <Dialog open={empOpen} onOpenChange={setEmpOpen}>
                <Button type="button" size="sm" variant="outline" onClick={() => setEmpOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Novo empreendimento
                </Button>
                <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
                  <DialogHeader><DialogTitle>Novo empreendimento</DialogTitle></DialogHeader>
                  <div className="grid gap-3">
                    <div><Label>Nome do empreendimento *</Label><Input value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>CNPJ (se diferente do cliente)</Label><Input value={empForm.cnpjCpf} onChange={(e) => setEmpForm({ ...empForm, cnpjCpf: e.target.value })} /></div>
                      <div><Label>CNAE</Label><Input value={empForm.cnae} onChange={(e) => setEmpForm({ ...empForm, cnae: e.target.value })} /></div>
                    </div>
                    <div><Label>Atividade exercida</Label><Textarea value={empForm.atividade} onChange={(e) => setEmpForm({ ...empForm, atividade: e.target.value })} /></div>
                    <div><Label>Endereco do empreendimento</Label><Input value={empForm.endereco} onChange={(e) => setEmpForm({ ...empForm, endereco: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Bairro</Label><Input value={empForm.bairro} onChange={(e) => setEmpForm({ ...empForm, bairro: e.target.value })} /></div>
                      <div><Label>CEP</Label><Input value={empForm.cep} onChange={(e) => setEmpForm({ ...empForm, cep: e.target.value })} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2"><Label>Cidade</Label><Input value={empForm.cidade} onChange={(e) => setEmpForm({ ...empForm, cidade: e.target.value })} /></div>
                      <div><Label>UF</Label><Input value={empForm.uf} onChange={(e) => setEmpForm({ ...empForm, uf: e.target.value.toUpperCase().slice(0, 2) })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Latitude</Label><Input value={empForm.latitude} onChange={(e) => setEmpForm({ ...empForm, latitude: e.target.value })} /></div>
                      <div><Label>Longitude</Label><Input value={empForm.longitude} onChange={(e) => setEmpForm({ ...empForm, longitude: e.target.value })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Contato no local</Label><Input value={empForm.contatoLocal} onChange={(e) => setEmpForm({ ...empForm, contatoLocal: e.target.value })} /></div>
                      <div><Label>Telefone no local</Label><Input value={empForm.telefoneLocal} onChange={(e) => setEmpForm({ ...empForm, telefoneLocal: e.target.value })} /></div>
                    </div>
                    <div><Label>Observacoes</Label><Textarea value={empForm.notes} onChange={(e) => setEmpForm({ ...empForm, notes: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={submitEmp}>Salvar</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2">
              {empreendimentos.length === 0 ? (
                <EmptyHint label="Sem empreendimentos cadastrados." />
              ) : (
                empreendimentos.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <div className="font-medium break-words">{entry.name}</div>
                      <div className="text-xs text-muted-foreground break-words">{entry.atividade || "—"}</div>
                      <div className="text-xs text-muted-foreground break-words">{[entry.endereco, entry.cidade, entry.uf].filter(Boolean).join(", ") || "—"}</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Excluir empreendimento? Os projetos vinculados serao desvinculados.")) deleteEmpreendimento(entry.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Projetos (secundario)</CardTitle>
              <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
                <Button type="button" size="sm" variant="outline" onClick={() => setProjectOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Novo projeto
                </Button>
                <DialogContent>
                  <DialogHeader><DialogTitle>Novo projeto</DialogTitle></DialogHeader>
                  <div className="grid gap-3">
                    <div><Label>Nome do projeto *</Label><Input value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} /></div>
                    <div>
                      <Label>Empreendimento</Label>
                      {empreendimentos.length === 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">Cadastre um empreendimento para vincular ao projeto, se desejar.</p>
                      ) : (
                        <Select value={projectForm.empreendimentoId} onValueChange={(value) => setProjectForm({ ...projectForm, empreendimentoId: value })}>
                          <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                          <SelectContent>
                            {empreendimentos.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div><Label>Descricao</Label><Textarea value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={submitProject}>Criar projeto</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2">
              {projects.length === 0 ? (
                <EmptyHint label="Sem projetos cadastrados." />
              ) : (
                projects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <Link to="/projetos/$id" params={{ id: project.id }} className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <FolderKanban className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium break-words">{project.name}</div>
                        <div className="text-xs text-muted-foreground break-words">{project.description || "—"}</div>
                      </div>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Excluir projeto?")) deleteProject(project.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
          <ClienteForm value={editForm} onChange={setEditForm} />
          <DialogFooter><Button onClick={submitEdit}>Salvar alteracoes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function AnnualRecordsPanel({
  client,
  empreendimentos,
  records,
}: {
  client: Client;
  empreendimentos: Empreendimento[];
  records: AnnualEnvironmentalRecord[];
}) {
  const nav = useNavigate();
  const dbStatus = useDBStatus();
  const suggestedYear = String(new Date().getFullYear() - 1);
  const [year, setYear] = useState(suggestedYear);
  const latest = records[0];
  const annualDbReady = dbStatus.annualRecordsAvailable !== false;

  function blockIfAnnualDbMissing() {
    if (annualDbReady) return false;
    toast.error("Banco anual nao configurado. Aplique a migration annual_environmental_records no Supabase antes de criar anos-base.");
    return true;
  }

  function cacheRecord(record?: AnnualEnvironmentalRecord) {
    if (!record || typeof window === "undefined") return;
    const payload = JSON.stringify(record);
    window.sessionStorage.setItem(`annual-record:${record.id}`, payload);
    window.localStorage.setItem(`annual-record:${record.id}`, payload);
  }

  function openRecord(recordId: string, recordToCache?: AnnualEnvironmentalRecord) {
    cacheRecord(recordToCache ?? records.find((entry) => entry.id === recordId));
    void nav({ to: "/clientes/$id/dados-ambientais/$recordId", params: { id: client.id, recordId } })
      .catch(() => {
        window.location.href = `/clientes/${client.id}/dados-ambientais/${recordId}`;
      });
  }

  function createBlank() {
    if (blockIfAnnualDbMissing()) return;
    const yearBase = Number(year);
    if (!Number.isFinite(yearBase) || yearBase < 2000) {
      toast.error("Informe um ano-base valido.");
      return;
    }
    const existing = records.find((entry) => entry.yearBase === yearBase);
    if (existing) {
      toast.info(`Ano-base ${yearBase} ja existe. Abrindo o registro.`);
      openRecord(existing.id, existing);
      return;
    }
    const record = addAnnualEnvironmentalRecord(createEmptyAnnualEnvironmentalRecord({
      clientId: client.id,
      yearBase,
      units: createAnnualUnitsFromEmpreendimentos(empreendimentos),
    }));
    toast.success(`Ano-base ${yearBase} criado.`);
    openRecord(record.id, record);
  }

  function createFromPrevious() {
    if (blockIfAnnualDbMissing()) return;
    const yearBase = Number(year);
    if (!latest) {
      toast.error("Crie primeiro um ano-base inicial.");
      return;
    }
    if (!Number.isFinite(yearBase) || yearBase < 2000) {
      toast.error("Informe um ano-base valido.");
      return;
    }
    const existing = records.find((entry) => entry.yearBase === yearBase);
    if (existing) {
      toast.info(`Ano-base ${yearBase} ja existe. Abrindo o registro.`);
      openRecord(existing.id, existing);
      return;
    }
    const record = addAnnualEnvironmentalRecord(createAnnualRecordFromPrevious(latest, yearBase));
    toast.success(`Ano-base ${yearBase} criado com base em ${latest.yearBase}.`);
    openRecord(record.id, record);
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard?.writeText(text);
      toast.success(`${label} copiado.`);
    } catch {
      window.prompt("Copie o texto abaixo:", text);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Dados Ambientais Anuais</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Memoria anual do cliente para RAPP, RIAA, relatorios ambientais, pendencias e processamento por IA.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={year}
              onChange={(event) => setYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-28"
              placeholder="Ano"
            />
            <Button type="button" onClick={createBlank} disabled={!annualDbReady}>
              <Plus className="mr-1 h-4 w-4" /> Criar ano-base
            </Button>
            <Button type="button" variant="outline" onClick={createFromPrevious} disabled={!latest || !annualDbReady}>
              <CalendarDays className="mr-1 h-4 w-4" /> Base anterior
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!annualDbReady && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <div className="font-medium">Banco anual nao configurado</div>
                  <p>
                    A tabela <code className="rounded bg-amber-100 px-1">annual_environmental_records</code> ainda nao esta disponivel no Supabase.
                    A criacao e alteracao de anos-base ficam bloqueadas para evitar registros que somem ao recarregar.
                  </p>
                  <p className="text-xs">
                    Migration local: <code>supabase/migrations/20260525090000_create_annual_environmental_records.sql</code>
                    {dbStatus.annualRecordsError ? ` · erro: ${dbStatus.annualRecordsError}` : ""}
                  </p>
                </div>
              </div>
            </div>
          )}
          {records.length === 0 ? (
            <EmptyHint label="Nenhum ano-base cadastrado para este cliente. Crie o primeiro ano para iniciar a memoria ambiental anual." />
          ) : (
            <div className="space-y-3">
              {records.map((record) => {
                const progress = calculateAnnualProgress(record);
                const pending = countAnnualOpenPending(record);
                const docs = countAnnualValidDocuments(record);
                const previous = records.find((entry) => entry.id === record.previousRecordId);
                return (
                  <Card key={record.id} className="border-border/80">
                    <CardContent className="flex flex-col gap-4 p-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">Ano-base {record.yearBase}</Badge>
                          <Badge variant="outline">{ANNUAL_STATUS_LABELS[record.status]}</Badge>
                          {previous && <Badge variant="outline">Base {previous.yearBase}</Badge>}
                        </div>
                        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                          <Metric label="Preenchimento" value={`${progress}%`} />
                          <Metric label="Pendencias" value={pending} />
                          <Metric label="Documentos" value={docs} />
                          <Metric label="Atualizado" value={formatDate(record.updatedAt)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex">
                        <Button size="sm" className="w-full" onClick={() => openRecord(record.id, record)}>Abrir gestao</Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => copy(buildAnnualClientRequestText(record, previous, client.name), "Solicitacao")}
                        >
                          Solicitar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => copy(buildAnnualAISummary(record, client.name), "Resumo para IA")}
                        >
                          IA
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Excluir este ano-base ambiental?")) deleteAnnualEnvironmentalRecord(record.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone?: "warn" | "ok" | "danger" }) {
  const toneClass = tone === "warn"
    ? "border-amber-200 bg-amber-50"
    : tone === "ok"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "danger"
        ? "border-rose-200 bg-rose-50"
        : "border-border bg-card";
  return (
    <Card className={toneClass}>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold">{value}</div>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-background/80 text-foreground">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniInfo({ label, value, tone }: { label: string; value: string; tone?: "warn" | "ok" | "danger" }) {
  const cls = tone === "warn"
    ? "border-amber-200 bg-amber-50 text-amber-900"
    : tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "danger"
        ? "border-rose-200 bg-rose-50 text-rose-900"
        : "border-border bg-background";
  return (
    <div className={`rounded-full border px-3 py-1.5 ${cls}`}>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SurveyMainRow({
  row,
  compact,
}: {
  row: {
    survey: Survey;
    project?: { name: string };
    empreendimento?: { name: string };
    typeMeta: { label: string };
    totalModules: number;
    doneModules: number;
    progressPercent: number;
    pending: Pendencia[];
    attachments: ClientDocRow[];
    dateBase?: string;
  };
  compact?: boolean;
}) {
  return (
    <Card className={compact ? "border-border/80" : "border-primary/20"}>
      <CardContent className={compact ? "p-3" : "p-4"}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={row.survey.closedAt ? "concluido" : "em_andamento"} />
              <div className="font-medium break-words">{row.survey.title}</div>
            </div>
            <div className="text-xs text-muted-foreground break-words">
              {row.typeMeta.label}
              {row.project ? ` · ${row.project.name}` : ""}
              {row.empreendimento ? ` · ${row.empreendimento.name}` : ""}
              {row.dateBase ? ` · ${formatDate(row.dateBase)}` : ""}
            </div>
            <PurposeChips purposes={row.survey.purposes} max={compact ? 4 : 6} />
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" /> {row.survey.realizadoPor || row.survey.responsavel || "Sem responsavel"}</span>
              <span>{row.doneModules}/{row.totalModules} modulos · {row.progressPercent}%</span>
              <span>{row.pending.length} pendencia(s)</span>
              <span>{row.attachments.length} doc(s)/foto(s)</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Link to="/levantamentos/$id" params={{ id: row.survey.id }} search={{ mode: "edit" }}>
              <Button variant="outline" size="sm" className="w-full">
                Campo
              </Button>
            </Link>
            <Link to="/clientes/$id/levantamentos/$surveyId" params={{ id: row.survey.clientId, surveyId: row.survey.id }}>
              <Button variant="outline" size="sm" className="w-full">
                Relatorio
              </Button>
            </Link>
            <Link to="/clientes/$id/levantamentos/$surveyId" params={{ id: row.survey.clientId, surveyId: row.survey.id }}>
              <Button variant="outline" size="sm" className="w-full">
                Documentos
              </Button>
            </Link>
            <Link to="/clientes/$id/levantamentos/$surveyId" params={{ id: row.survey.clientId, surveyId: row.survey.id }}>
              <Button variant="outline" size="sm" className="w-full">
                Pendencias
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SurveyCompactRow({
  row,
}: {
  row: {
    survey: Survey;
    typeMeta: { label: string };
    pending: Pendencia[];
    dateBase?: string;
  };
}) {
  return (
    <Link to="/clientes/$id/levantamentos/$surveyId" params={{ id: row.survey.clientId, surveyId: row.survey.id }}>
      <div className="rounded-lg border p-3 transition-colors hover:border-primary/40">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium break-words">{row.survey.title}</div>
            <div className="text-xs text-muted-foreground break-words">
              {row.typeMeta.label} · {row.dateBase ? formatDate(row.dateBase) : "Sem data"}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{row.pending.length} pend.</div>
        </div>
      </div>
    </Link>
  );
}

function DocCompactRow({ row }: { row: ClientDocRow }) {
  return (
    <Link to="/clientes/$id/levantamentos/$surveyId" params={{ id: row.clientId, surveyId: row.surveyId }}>
      <div className="rounded-lg border p-3 transition-colors hover:border-primary/40">
        <div className="font-medium break-words">{row.attachment.name}</div>
        <div className="text-xs text-muted-foreground break-words">
          {row.attachment.type} · {row.surveyTitle}
        </div>
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-center text-sm text-muted-foreground">
        {label}
      </CardContent>
    </Card>
  );
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}
