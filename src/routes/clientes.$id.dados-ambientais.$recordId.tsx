import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDB, useDBStatus, addAnnualEnvironmentalRecord, updateAnnualEnvironmentalRecord, deleteAnnualEnvironmentalRecord } from "@/lib/store";
import {
  ANNUAL_DATA_STATUS_LABELS,
  ANNUAL_MONTH_LABELS,
  ANNUAL_PENDING_STATUS_LABELS,
  ANNUAL_SECTION_LABELS,
  ANNUAL_STATUS_LABELS,
  buildAnnualAISummary,
  buildAnnualClientRequestText,
  buildAnnualComparison,
  calculateAnnualProgress,
  countAnnualOpenPending,
  countAnnualValidDocuments,
  emptyMonthlyValues,
  formatAnnualNumber,
  lineItemTotal,
  monthlyTotal,
  annualId,
  normalizeAnnualEnvironmentalRecord,
  type AnnualLineSectionKey,
} from "@/lib/annualEnvironmental";
import {
  ANNUAL_MONTH_KEYS,
  type AnnualAnalysis,
  type AnnualDataStatus,
  type AnnualDocument,
  type AnnualEnergyRow,
  type AnnualEnvironmentalRecord,
  type AnnualEnvironmentalUnit,
  type AnnualLineItem,
  type AnnualMonthKey,
  type AnnualOperationalPeriod,
  type AnnualPendingItem,
  type AnnualPendingStatus,
  type AnnualRecordSectionKey,
  type AnnualRecordStatus,
  type AnnualStaffSchedulePeriod,
  type AnnualVehicle,
  type AnnualWaterEffluentEntry,
} from "@/lib/types";
import {
  ArrowLeft,
  Clipboard,
  Download,
  FileText,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/clientes/$id/dados-ambientais/$recordId")({
  component: AnnualRecordPage,
});

const STATUS_OPTIONS = Object.keys(ANNUAL_STATUS_LABELS) as AnnualRecordStatus[];
const DATA_STATUS_OPTIONS = Object.keys(ANNUAL_DATA_STATUS_LABELS) as AnnualDataStatus[];
const PENDING_STATUS_OPTIONS = Object.keys(ANNUAL_PENDING_STATUS_LABELS) as AnnualPendingStatus[];
const SECTION_OPTIONS = Object.keys(ANNUAL_SECTION_LABELS) as AnnualRecordSectionKey[];

function AnnualRecordPage() {
  const { id, recordId } = Route.useParams();
  const db = useDB();
  const dbStatus = useDBStatus();
  const client = db.clients.find((entry) => entry.id === id);
  const record = db.annualRecords.find((entry) => entry.id === recordId);
  const previous = record?.previousRecordId
    ? db.annualRecords.find((entry) => entry.id === record.previousRecordId)
    : db.annualRecords
        .filter((entry) => entry.clientId === id && record && entry.yearBase < record.yearBase)
        .sort((a, b) => b.yearBase - a.yearBase)[0];
  const [activeTab, setActiveTab] = useState("geral");

  useEffect(() => {
    if (record || !dbStatus.hydrated || typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(`annual-record:${recordId}`)
      ?? window.localStorage.getItem(`annual-record:${recordId}`);
    if (!raw) return;
    try {
      const restored = normalizeAnnualEnvironmentalRecord(JSON.parse(raw));
      if (restored.id !== recordId || restored.clientId !== id) return;
      addAnnualEnvironmentalRecord(restored);
      toast.success("Ano-base recuperado do armazenamento local.");
    } catch (err) {
      console.warn("[annual] failed to restore cached annual record", err);
    }
  }, [dbStatus.hydrated, id, record, recordId]);

  if (!dbStatus.hydrated) {
    return (
      <AppShell>
        <Link to="/clientes/$id" params={{ id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao cliente
        </Link>
        <Card className="mt-4">
          <CardContent className="p-6 text-sm text-muted-foreground">Carregando dados ambientais anuais...</CardContent>
        </Card>
      </AppShell>
    );
  }

  if (!client || !record) {
    return (
      <AppShell>
        <Link to="/clientes/$id" params={{ id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao cliente
        </Link>
        <Card className="mt-4">
          <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">Ano-base nao encontrado.</div>
            <p>
              O registro nao foi carregado do banco nem do armazenamento local deste navegador. Volte ao cliente e abra o ano-base novamente.
            </p>
            <p>
              Se isso continuar acontecendo em producao, a tabela anual do Supabase ainda precisa ser aplicada para salvar esses registros no servidor.
            </p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const currentClient = client;
  const currentRecord = record;
  const progress = calculateAnnualProgress(currentRecord);
  const openPending = countAnnualOpenPending(currentRecord);
  const validDocuments = countAnnualValidDocuments(currentRecord);

  function patch(data: Partial<AnnualEnvironmentalRecord>) {
    updateAnnualEnvironmentalRecord(currentRecord.id, data);
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard?.writeText(text);
      toast.success("Texto copiado.");
    } catch {
      window.prompt("Copie o texto abaixo:", text);
    }
  }

  function downloadJson() {
    const blob = new Blob([buildAnnualAISummary(currentRecord, currentClient.name)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${currentClient.name}-${currentRecord.yearBase}-dados-ambientais.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("JSON gerado.");
  }

  return (
    <AppShell>
      <Link to="/clientes/$id" params={{ id }} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {currentClient.name}
      </Link>

      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Dados Ambientais Anuais</Badge>
            <Badge variant="outline">Ano-base {currentRecord.yearBase}</Badge>
            {previous && <Badge variant="outline">Base anterior {previous.yearBase}</Badge>}
          </div>
          <h1 className="break-words text-2xl font-semibold">{currentClient.name}</h1>
          <p className="max-w-4xl text-sm text-muted-foreground">
            Central de gestao anual para RAPP/RIAA, relatorios ambientais, documentos, pendencias e resumo estruturado para IA.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[460px]">
          <MetricCard label="Preenchimento" value={`${progress}%`} />
          <MetricCard label="Pendencias" value={openPending} tone={openPending ? "danger" : "ok"} />
          <MetricCard label="Documentos" value={validDocuments} />
          <MetricCard label="Atualizado" value={formatDate(currentRecord.updatedAt)} />
        </div>
      </div>

      <Card className="mb-5">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[240px_1fr_auto] lg:items-center">
          <div>
            <Label>Status do ano-base</Label>
            <select
              value={currentRecord.status}
              onChange={(event) => patch({ status: event.target.value as AnnualRecordStatus })}
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{ANNUAL_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Progresso geral</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => copyText(buildAnnualClientRequestText(currentRecord, previous, currentClient.name))}>
              <Clipboard className="mr-1 h-4 w-4" /> Solicitar dados
            </Button>
            <Button variant="outline" onClick={() => copyText(buildAnnualAISummary(currentRecord, currentClient.name))}>
              <FileText className="mr-1 h-4 w-4" /> Copiar IA
            </Button>
            <Button variant="outline" onClick={downloadJson}>
              <Download className="mr-1 h-4 w-4" /> JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          <TabsTrigger value="geral">Visao Geral</TabsTrigger>
          <TabsTrigger value="identificacao">Identificacao</TabsTrigger>
          <TabsTrigger value="unidades">Unidades</TabsTrigger>
          <TabsTrigger value="operacionais">Dados Operacionais</TabsTrigger>
          <TabsTrigger value="energia">Energia</TabsTrigger>
          <TabsTrigger value="materias">Materias-primas</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="residuos">Residuos</TabsTrigger>
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="funcionarios">Funcionarios/Horarios</TabsTrigger>
          <TabsTrigger value="veiculos">Veiculos</TabsTrigger>
          <TabsTrigger value="agua">Agua/Efluentes</TabsTrigger>
          <TabsTrigger value="analises">Analises</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="pendencias">Pendencias</TabsTrigger>
          <TabsTrigger value="consolidacao">Consolidacao</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          <OverviewTab record={currentRecord} previous={previous} clientName={currentClient.name} patch={patch} />
        </TabsContent>
        <TabsContent value="identificacao">
          <IdentificationTab record={currentRecord} patch={patch} />
        </TabsContent>
        <TabsContent value="unidades">
          <UnitsTab record={currentRecord} patch={patch} />
        </TabsContent>
        <TabsContent value="operacionais">
          <OperationalTab record={currentRecord} patch={patch} />
        </TabsContent>
        <TabsContent value="energia">
          <EnergyTab record={currentRecord} patch={patch} />
        </TabsContent>
        <TabsContent value="materias">
          <LineItemsTab record={currentRecord} patch={patch} sectionKey="rawMaterials" title="Materias-primas" />
        </TabsContent>
        <TabsContent value="produtos">
          <LineItemsTab record={currentRecord} patch={patch} sectionKey="products" title="Produtos produzidos" />
        </TabsContent>
        <TabsContent value="residuos">
          <LineItemsTab record={currentRecord} patch={patch} sectionKey="residues" title="Residuos gerados" />
        </TabsContent>
        <TabsContent value="insumos">
          <LineItemsTab record={currentRecord} patch={patch} sectionKey="inputs" title="Insumos" />
        </TabsContent>
        <TabsContent value="funcionarios">
          <StaffTab record={currentRecord} patch={patch} />
        </TabsContent>
        <TabsContent value="veiculos">
          <VehiclesTab record={currentRecord} patch={patch} />
        </TabsContent>
        <TabsContent value="agua">
          <WaterTab record={currentRecord} patch={patch} />
        </TabsContent>
        <TabsContent value="analises">
          <AnalysesTab record={currentRecord} patch={patch} />
        </TabsContent>
        <TabsContent value="documentos">
          <DocumentsTab record={currentRecord} patch={patch} />
        </TabsContent>
        <TabsContent value="pendencias">
          <PendingTab record={currentRecord} patch={patch} />
        </TabsContent>
        <TabsContent value="consolidacao">
          <ConsolidationTab record={currentRecord} previous={previous} clientName={currentClient.name} patch={patch} copyText={copyText} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function OverviewTab({
  record,
  previous,
  clientName,
  patch,
}: {
  record: AnnualEnvironmentalRecord;
  previous?: AnnualEnvironmentalRecord;
  clientName: string;
  patch: (data: Partial<AnnualEnvironmentalRecord>) => void;
}) {
  const comparison = useMemo(() => buildAnnualComparison(record, previous), [record, previous]);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <Card>
        <CardHeader>
          <CardTitle>Resumo do ano-base</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={record.consolidation.technicalSummary ?? ""}
            onChange={(event) => patch({ consolidation: { ...record.consolidation, technicalSummary: event.target.value } })}
            placeholder="Escreva o resumo tecnico do ano-base, principais dados, pendencias e observacoes de conferencia."
            className="min-h-40"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Unidades" value={record.units.length} />
            <MetricCard label="Docs" value={countAnnualValidDocuments(record)} />
            <MetricCard label="Pendencias abertas" value={countAnnualOpenPending(record)} tone={countAnnualOpenPending(record) ? "danger" : "ok"} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Comparacao com ano anterior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!previous ? (
            <p className="text-sm text-muted-foreground">Sem ano-base anterior vinculado para comparacao.</p>
          ) : (
            comparison.map((item) => (
              <div key={item.label} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.label}</span>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <span>Atual: {formatAnnualNumber(item.currentTotal)}</span>
                  <span>Anterior: {formatAnnualNumber(item.previousTotal)}</span>
                  <span>Var.: {item.variationPercent == null ? "-" : `${formatAnnualNumber(item.variationPercent, 1)}%`}</span>
                </div>
              </div>
            ))
          )}
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            {buildAnnualClientRequestText(record, previous, clientName).split("\n").slice(0, 4).join(" ")}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function IdentificationTab({ record, patch }: RecordTabProps) {
  const idf = record.identification;
  return (
    <Card>
      <CardHeader><CardTitle>Identificacao do ano-base</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <Field label="Periodo inicial"><Input type="date" value={idf.periodStart ?? ""} onChange={(e) => patch({ identification: { ...idf, periodStart: e.target.value } })} /></Field>
        <Field label="Periodo final"><Input type="date" value={idf.periodEnd ?? ""} onChange={(e) => patch({ identification: { ...idf, periodEnd: e.target.value } })} /></Field>
        <Field label="Responsavel interno"><Input value={idf.responsibleInternal ?? ""} onChange={(e) => patch({ identification: { ...idf, responsibleInternal: e.target.value } })} /></Field>
        <Field label="Responsavel do cliente"><Input value={idf.responsibleClient ?? ""} onChange={(e) => patch({ identification: { ...idf, responsibleClient: e.target.value } })} /></Field>
        <Field label="Data da solicitacao"><Input type="date" value={idf.requestDate ?? ""} onChange={(e) => patch({ identification: { ...idf, requestDate: e.target.value } })} /></Field>
        <Field label="Data de recebimento"><Input type="date" value={idf.receivedDate ?? ""} onChange={(e) => patch({ identification: { ...idf, receivedDate: e.target.value } })} /></Field>
        <Field label="Observacoes gerais" className="md:col-span-2">
          <Textarea value={idf.observations ?? ""} onChange={(e) => patch({ identification: { ...idf, observations: e.target.value } })} />
        </Field>
      </CardContent>
    </Card>
  );
}

function UnitsTab({ record, patch }: RecordTabProps) {
  function updateUnit(unitId: string, data: Partial<AnnualEnvironmentalUnit>) {
    patch({ units: record.units.map((unit) => (unit.id === unitId ? { ...unit, ...data } : unit)) });
  }
  return (
    <EditorCard
      title="Unidades do cliente"
      actionLabel="Adicionar unidade"
      onAdd={() => patch({ units: [...record.units, { id: annualId("unit"), name: "Nova unidade", active: true }] })}
    >
      <div className="grid gap-3">
        {record.units.length === 0 && <EmptyInline>Nenhuma unidade cadastrada. Adicione fabrica, escritorio ou unidade operacional.</EmptyInline>}
        {record.units.map((unit) => (
          <div key={unit.id} className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[1fr_120px_120px_auto]">
            <Input value={unit.name} onChange={(e) => updateUnit(unit.id, { name: e.target.value })} placeholder="Nome da unidade" />
            <Input value={unit.cidade ?? ""} onChange={(e) => updateUnit(unit.id, { cidade: e.target.value })} placeholder="Cidade" />
            <Input value={unit.uf ?? ""} onChange={(e) => updateUnit(unit.id, { uf: e.target.value.toUpperCase().slice(0, 2) })} placeholder="UF" />
            <Button variant="ghost" size="sm" onClick={() => patch({ units: record.units.filter((entry) => entry.id !== unit.id) })}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Textarea className="lg:col-span-4" value={unit.notes ?? ""} onChange={(e) => updateUnit(unit.id, { notes: e.target.value })} placeholder="Observacoes da unidade" />
          </div>
        ))}
      </div>
    </EditorCard>
  );
}

function OperationalTab({ record, patch }: RecordTabProps) {
  const periods = record.operationalData.periods;
  function update(itemId: string, data: Partial<AnnualOperationalPeriod>) {
    patch({ operationalData: { periods: periods.map((item) => (item.id === itemId ? { ...item, ...data } : item)) } });
  }
  return (
    <EditorCard title="Dados operacionais" actionLabel="Adicionar periodo" onAdd={() => patch({ operationalData: { periods: [...periods, { id: annualId("op"), status: "pendente" }] } })}>
      <Table>
        <TableHeader><TableRow><TableHead>Unidade</TableHead><TableHead>Periodo</TableHead><TableHead>Atividade</TableHead><TableHead>Funcionarios</TableHead><TableHead>Horario</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {periods.map((item) => (
            <TableRow key={item.id}>
              <TableCell><UnitSelect units={record.units} value={item.unitId} onChange={(unitId) => update(item.id, { unitId })} /></TableCell>
              <TableCell><MonthRange value={item} onChange={(data) => update(item.id, data)} /></TableCell>
              <TableCell><Input value={item.activity ?? ""} onChange={(e) => update(item.id, { activity: e.target.value })} /></TableCell>
              <TableCell><Input type="number" value={item.staffCount ?? ""} onChange={(e) => update(item.id, { staffCount: toNumber(e.target.value) })} /></TableCell>
              <TableCell><Input value={item.schedule ?? ""} onChange={(e) => update(item.id, { schedule: e.target.value })} /></TableCell>
              <TableCell><DataStatusSelect value={item.status} onChange={(status) => update(item.id, { status })} /></TableCell>
              <TableCell><DeleteButton onClick={() => patch({ operationalData: { periods: periods.filter((entry) => entry.id !== item.id) } })} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </EditorCard>
  );
}

function EnergyTab({ record, patch }: RecordTabProps) {
  const rows = record.energy.rows;
  function update(rowId: string, data: Partial<AnnualEnergyRow>) {
    patch({ energy: { rows: rows.map((row) => (row.id === rowId ? { ...row, ...data } : row)) } });
  }
  function ensureRows() {
    const existing = new Set(rows.map((row) => row.unitId));
    const next = [
      ...rows,
      ...record.units.filter((unit) => !existing.has(unit.id)).map((unit) => ({
        id: annualId("energy"),
        unitId: unit.id,
        monthly: emptyMonthlyValues(),
        status: "pendente" as AnnualDataStatus,
      })),
    ];
    patch({ energy: { rows: next.length ? next : [{ id: annualId("energy"), monthly: emptyMonthlyValues(), status: "pendente" }] } });
  }
  return (
    <EditorCard title="Consumo de energia" actionLabel="Criar linhas por unidade" onAdd={ensureRows}>
      <MonthlyTable
        rows={rows}
        units={record.units}
        getName={(row) => unitName(record.units, row.unitId)}
        onMonthChange={(row, month, value) => update(row.id, { monthly: { ...row.monthly, [month]: value } })}
        onObservationChange={(row, observation) => update(row.id, { observation })}
        onStatusChange={(row, status) => update(row.id, { status })}
        onDelete={(row) => patch({ energy: { rows: rows.filter((entry) => entry.id !== row.id) } })}
      />
    </EditorCard>
  );
}

function LineItemsTab({ record, patch, sectionKey, title }: RecordTabProps & { sectionKey: AnnualLineSectionKey; title: string }) {
  const section = record[sectionKey];
  const items = section.items;
  function update(itemId: string, data: Partial<AnnualLineItem>) {
    patch({ [sectionKey]: { items: items.map((item) => (item.id === itemId ? { ...item, ...data } : item)) } } as Partial<AnnualEnvironmentalRecord>);
  }
  return (
    <EditorCard
      title={title}
      actionLabel="Adicionar item"
      onAdd={() => patch({ [sectionKey]: { items: [...items, { id: annualId("item"), name: "", unit: "kg", monthly: emptyMonthlyValues(), status: "pendente", validationState: "novo" }] } } as Partial<AnnualEnvironmentalRecord>)}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[220px]">Item</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead>Unid. cliente</TableHead>
            {ANNUAL_MONTH_KEYS.map((month) => <TableHead key={month}>{ANNUAL_MONTH_LABELS[month]}</TableHead>)}
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Obs.</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell><Input value={item.name} onChange={(e) => update(item.id, { name: e.target.value })} placeholder="Nome do item" /></TableCell>
              <TableCell><Input value={item.unit ?? ""} onChange={(e) => update(item.id, { unit: e.target.value })} className="w-20" /></TableCell>
              <TableCell><UnitSelect units={record.units} value={item.unitId} onChange={(unitId) => update(item.id, { unitId })} /></TableCell>
              {ANNUAL_MONTH_KEYS.map((month) => (
                <TableCell key={month}>
                  <Input className="w-24" type="number" value={item.monthly?.[month] ?? ""} onChange={(e) => update(item.id, { monthly: { ...item.monthly, [month]: toNumber(e.target.value) } })} />
                </TableCell>
              ))}
              <TableCell className="whitespace-nowrap font-medium">{formatAnnualNumber(lineItemTotal(item))}</TableCell>
              <TableCell><DataStatusSelect value={item.status} onChange={(status) => update(item.id, { status })} /></TableCell>
              <TableCell><Input value={item.observation ?? ""} onChange={(e) => update(item.id, { observation: e.target.value })} className="min-w-[180px]" /></TableCell>
              <TableCell><DeleteButton onClick={() => patch({ [sectionKey]: { items: items.filter((entry) => entry.id !== item.id) } } as Partial<AnnualEnvironmentalRecord>)} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </EditorCard>
  );
}

function StaffTab({ record, patch }: RecordTabProps) {
  const periods = record.staffAndSchedules.periods;
  function update(itemId: string, data: Partial<AnnualStaffSchedulePeriod>) {
    patch({ staffAndSchedules: { periods: periods.map((item) => (item.id === itemId ? { ...item, ...data } : item)) } });
  }
  return (
    <EditorCard title="Funcionarios e horarios" actionLabel="Adicionar periodo" onAdd={() => patch({ staffAndSchedules: { periods: [...periods, { id: annualId("staff"), status: "pendente" }] } })}>
      <Table>
        <TableHeader><TableRow><TableHead>Unidade</TableHead><TableHead>Periodo</TableHead><TableHead>Qtd.</TableHead><TableHead>Horario</TableHead><TableHead>Observacao</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {periods.map((item) => (
            <TableRow key={item.id}>
              <TableCell><UnitSelect units={record.units} value={item.unitId} onChange={(unitId) => update(item.id, { unitId })} /></TableCell>
              <TableCell><MonthRange value={item} onChange={(data) => update(item.id, data)} /></TableCell>
              <TableCell><Input type="number" value={item.staffCount ?? ""} onChange={(e) => update(item.id, { staffCount: toNumber(e.target.value) })} /></TableCell>
              <TableCell><Input value={item.schedule ?? ""} onChange={(e) => update(item.id, { schedule: e.target.value })} /></TableCell>
              <TableCell><Input value={item.observation ?? ""} onChange={(e) => update(item.id, { observation: e.target.value })} /></TableCell>
              <TableCell><DataStatusSelect value={item.status} onChange={(status) => update(item.id, { status })} /></TableCell>
              <TableCell><DeleteButton onClick={() => patch({ staffAndSchedules: { periods: periods.filter((entry) => entry.id !== item.id) } })} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </EditorCard>
  );
}

function VehiclesTab({ record, patch }: RecordTabProps) {
  const items = record.vehicles.items;
  function update(itemId: string, data: Partial<AnnualVehicle>) {
    patch({ vehicles: { items: items.map((item) => (item.id === itemId ? { ...item, ...data } : item)) } });
  }
  return (
    <EditorCard title="Veiculos" actionLabel="Adicionar veiculo" onAdd={() => patch({ vehicles: { items: [...items, { id: annualId("vehicle"), status: "pendente", validationState: "novo" }] } })}>
      <Table>
        <TableHeader><TableRow><TableHead>Modelo</TableHead><TableHead>Placa</TableHead><TableHead>Ano</TableHead><TableHead>Combustivel</TableHead><TableHead>Situacao</TableHead><TableHead>Status</TableHead><TableHead>Obs.</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell><Input value={item.model ?? ""} onChange={(e) => update(item.id, { model: e.target.value })} /></TableCell>
              <TableCell><Input value={item.plate ?? ""} onChange={(e) => update(item.id, { plate: e.target.value.toUpperCase() })} /></TableCell>
              <TableCell><Input value={item.year ?? ""} onChange={(e) => update(item.id, { year: e.target.value })} /></TableCell>
              <TableCell><Input value={item.fuel ?? ""} onChange={(e) => update(item.id, { fuel: e.target.value })} /></TableCell>
              <TableCell><Input value={item.situation ?? ""} onChange={(e) => update(item.id, { situation: e.target.value })} /></TableCell>
              <TableCell><DataStatusSelect value={item.status} onChange={(status) => update(item.id, { status })} /></TableCell>
              <TableCell><Input value={item.observation ?? ""} onChange={(e) => update(item.id, { observation: e.target.value })} /></TableCell>
              <TableCell><DeleteButton onClick={() => patch({ vehicles: { items: items.filter((entry) => entry.id !== item.id) } })} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </EditorCard>
  );
}

function WaterTab({ record, patch }: RecordTabProps) {
  const entries = record.waterEffluents.entries;
  function update(itemId: string, data: Partial<AnnualWaterEffluentEntry>) {
    patch({ waterEffluents: { ...record.waterEffluents, entries: entries.map((item) => (item.id === itemId ? { ...item, ...data } : item)) } });
  }
  return (
    <EditorCard title="Agua, efluentes e ETE" actionLabel="Adicionar registro" onAdd={() => patch({ waterEffluents: { ...record.waterEffluents, applicable: true, entries: [...entries, { id: annualId("water"), status: "pendente" }] } })}>
      <Table>
        <TableHeader><TableRow><TableHead>Unidade</TableHead><TableHead>Consumo agua</TableHead><TableHead>Origem</TableHead><TableHead>Efluente</TableHead><TableHead>Sistema</TableHead><TableHead>Eficiencia</TableHead><TableHead>Status</TableHead><TableHead>Obs.</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {entries.map((item) => (
            <TableRow key={item.id}>
              <TableCell><UnitSelect units={record.units} value={item.unitId} onChange={(unitId) => update(item.id, { unitId })} /></TableCell>
              <TableCell><Input type="number" value={item.waterConsumption ?? ""} onChange={(e) => update(item.id, { waterConsumption: toNumber(e.target.value) })} /></TableCell>
              <TableCell><Input value={item.waterOrigin ?? ""} onChange={(e) => update(item.id, { waterOrigin: e.target.value })} /></TableCell>
              <TableCell><Input type="number" value={item.effluentVolume ?? ""} onChange={(e) => update(item.id, { effluentVolume: toNumber(e.target.value) })} /></TableCell>
              <TableCell><Input value={item.treatmentSystem ?? ""} onChange={(e) => update(item.id, { treatmentSystem: e.target.value })} /></TableCell>
              <TableCell><Input value={item.efficiency ?? ""} onChange={(e) => update(item.id, { efficiency: e.target.value })} /></TableCell>
              <TableCell><DataStatusSelect value={item.status} onChange={(status) => update(item.id, { status })} /></TableCell>
              <TableCell><Input value={item.observation ?? ""} onChange={(e) => update(item.id, { observation: e.target.value })} /></TableCell>
              <TableCell><DeleteButton onClick={() => patch({ waterEffluents: { ...record.waterEffluents, entries: entries.filter((entry) => entry.id !== item.id) } })} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </EditorCard>
  );
}

function AnalysesTab({ record, patch }: RecordTabProps) {
  const items = record.analyses.items;
  function update(itemId: string, data: Partial<AnnualAnalysis>) {
    patch({ analyses: { items: items.map((item) => (item.id === itemId ? { ...item, ...data } : item)) } });
  }
  return (
    <EditorCard title="Analises ambientais" actionLabel="Adicionar analise" onAdd={() => patch({ analyses: { items: [...items, { id: annualId("analysis"), status: "pendente", validationState: "novo" }] } })}>
      <Table>
        <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Data</TableHead><TableHead>Laboratorio</TableHead><TableHead>Validade</TableHead><TableHead>Resultado</TableHead><TableHead>Proxima</TableHead><TableHead>Status</TableHead><TableHead>Obs.</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell><Input value={item.type ?? ""} onChange={(e) => update(item.id, { type: e.target.value })} /></TableCell>
              <TableCell><Input type="date" value={item.date ?? ""} onChange={(e) => update(item.id, { date: e.target.value })} /></TableCell>
              <TableCell><Input value={item.laboratory ?? ""} onChange={(e) => update(item.id, { laboratory: e.target.value })} /></TableCell>
              <TableCell><Input value={item.validity ?? ""} onChange={(e) => update(item.id, { validity: e.target.value })} /></TableCell>
              <TableCell><Input value={item.generalResult ?? ""} onChange={(e) => update(item.id, { generalResult: e.target.value })} /></TableCell>
              <TableCell><Input type="date" value={item.nextRecommendedAnalysis ?? ""} onChange={(e) => update(item.id, { nextRecommendedAnalysis: e.target.value })} /></TableCell>
              <TableCell><DataStatusSelect value={item.status} onChange={(status) => update(item.id, { status })} /></TableCell>
              <TableCell><Input value={item.observation ?? ""} onChange={(e) => update(item.id, { observation: e.target.value })} /></TableCell>
              <TableCell><DeleteButton onClick={() => patch({ analyses: { items: items.filter((entry) => entry.id !== item.id) } })} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </EditorCard>
  );
}

function DocumentsTab({ record, patch }: RecordTabProps) {
  const docs = record.documents;
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const next: AnnualDocument[] = [];
    for (const file of Array.from(files)) {
      next.push({
        id: annualId("doc"),
        name: file.name,
        type: file.type || "application/octet-stream",
        dataUrl: await fileToDataUrl(file),
        createdAt: new Date().toISOString(),
        status: "recebido",
      });
    }
    patch({ documents: [...docs, ...next] });
  }
  function update(docId: string, data: Partial<AnnualDocument>) {
    patch({ documents: docs.map((doc) => (doc.id === docId ? { ...doc, ...data } : doc)) });
  }
  return (
    <EditorCard title="Documentos e evidencias" actionLabel="" onAdd={() => undefined}>
      <div className="mb-4">
        <Input type="file" multiple onChange={(event) => void addFiles(event.target.files)} />
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Documento</TableHead><TableHead>Secao</TableHead><TableHead>Status</TableHead><TableHead>Observacao</TableHead><TableHead>Data</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {docs.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell className="font-medium">{doc.name}</TableCell>
              <TableCell><SectionSelect value={doc.section} onChange={(section) => update(doc.id, { section })} /></TableCell>
              <TableCell><DataStatusSelect value={doc.status} onChange={(status) => update(doc.id, { status })} /></TableCell>
              <TableCell><Input value={doc.observation ?? ""} onChange={(e) => update(doc.id, { observation: e.target.value })} /></TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(doc.createdAt)}</TableCell>
              <TableCell><DeleteButton onClick={() => patch({ documents: docs.filter((entry) => entry.id !== doc.id) })} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </EditorCard>
  );
}

function PendingTab({ record, patch }: RecordTabProps) {
  const items = record.pendingItems;
  function update(itemId: string, data: Partial<AnnualPendingItem>) {
    patch({ pendingItems: items.map((item) => (item.id === itemId ? { ...item, ...data, resolvedAt: data.status === "resolvido" ? new Date().toISOString() : item.resolvedAt } : item)) });
  }
  return (
    <EditorCard title="Pendencias de dados" actionLabel="Adicionar pendencia" onAdd={() => patch({ pendingItems: [...items, { id: annualId("pending"), description: "", status: "em_aberto", createdAt: new Date().toISOString() }] })}>
      <Table>
        <TableHeader><TableRow><TableHead>Pendencia</TableHead><TableHead>Secao</TableHead><TableHead>Responsavel</TableHead><TableHead>Prazo</TableHead><TableHead>Status</TableHead><TableHead>Obs.</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell><Input value={item.description} onChange={(e) => update(item.id, { description: e.target.value })} className="min-w-[260px]" /></TableCell>
              <TableCell><SectionSelect value={item.section} onChange={(section) => update(item.id, { section })} /></TableCell>
              <TableCell><Input value={item.responsible ?? ""} onChange={(e) => update(item.id, { responsible: e.target.value })} /></TableCell>
              <TableCell><Input type="date" value={item.dueDate ?? ""} onChange={(e) => update(item.id, { dueDate: e.target.value })} /></TableCell>
              <TableCell><PendingStatusSelect value={item.status} onChange={(status) => update(item.id, { status })} /></TableCell>
              <TableCell><Input value={item.observation ?? ""} onChange={(e) => update(item.id, { observation: e.target.value })} /></TableCell>
              <TableCell><DeleteButton onClick={() => patch({ pendingItems: items.filter((entry) => entry.id !== item.id) })} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </EditorCard>
  );
}

function ConsolidationTab({
  record,
  previous,
  clientName,
  patch,
  copyText,
}: RecordTabProps & { previous?: AnnualEnvironmentalRecord; clientName: string; copyText: (text: string) => Promise<void> }) {
  const requestText = buildAnnualClientRequestText(record, previous, clientName);
  const aiSummary = buildAnnualAISummary(record, clientName);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Solicitacao ao cliente</CardTitle>
          <Button variant="outline" size="sm" onClick={() => copyText(requestText)}><Clipboard className="mr-1 h-4 w-4" /> Copiar</Button>
        </CardHeader>
        <CardContent><Textarea readOnly value={requestText} className="min-h-[360px] font-mono text-xs" /></CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Resumo estruturado para IA</CardTitle>
          <Button variant="outline" size="sm" onClick={() => copyText(aiSummary)}><Clipboard className="mr-1 h-4 w-4" /> Copiar</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea readOnly value={aiSummary} className="min-h-[360px] font-mono text-xs" />
          <Button
            onClick={() => patch({ consolidation: { ...record.consolidation, aiSummaryText: aiSummary, clientRequestText: requestText, exportedAt: new Date().toISOString() } })}
          >
            <Save className="mr-1 h-4 w-4" /> Salvar consolidacao gerada
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function MonthlyTable<T extends { id: string; unitId?: string; monthly: Partial<Record<AnnualMonthKey, number | null>>; status?: AnnualDataStatus; observation?: string }>({
  rows,
  units,
  getName,
  onMonthChange,
  onObservationChange,
  onStatusChange,
  onDelete,
}: {
  rows: T[];
  units: AnnualEnvironmentalUnit[];
  getName: (row: T) => string;
  onMonthChange: (row: T, month: AnnualMonthKey, value: number | null) => void;
  onObservationChange: (row: T, observation: string) => void;
  onStatusChange: (row: T, status: AnnualDataStatus) => void;
  onDelete: (row: T) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[180px]">Unidade</TableHead>
          {ANNUAL_MONTH_KEYS.map((month) => <TableHead key={month}>{ANNUAL_MONTH_LABELS[month]}</TableHead>)}
          <TableHead>Total</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Obs.</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{getName(row) || unitName(units, row.unitId)}</TableCell>
            {ANNUAL_MONTH_KEYS.map((month) => (
              <TableCell key={month}>
                <Input className="w-24" type="number" value={row.monthly?.[month] ?? ""} onChange={(e) => onMonthChange(row, month, toNumber(e.target.value))} />
              </TableCell>
            ))}
            <TableCell className="whitespace-nowrap font-medium">{formatAnnualNumber(monthlyTotal(row.monthly))}</TableCell>
            <TableCell><DataStatusSelect value={row.status} onChange={(status) => onStatusChange(row, status)} /></TableCell>
            <TableCell><Input value={row.observation ?? ""} onChange={(e) => onObservationChange(row, e.target.value)} className="min-w-[180px]" /></TableCell>
            <TableCell><DeleteButton onClick={() => onDelete(row)} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type RecordTabProps = {
  record: AnnualEnvironmentalRecord;
  patch: (data: Partial<AnnualEnvironmentalRecord>) => void;
};

function EditorCard({ title, actionLabel, onAdd, children }: { title: string; actionLabel: string; onAdd: () => void; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{title}</CardTitle>
        {actionLabel && (
          <Button type="button" onClick={onAdd}>
            <Plus className="mr-1 h-4 w-4" /> {actionLabel}
          </Button>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string | number; tone?: "danger" | "ok" }) {
  const color = tone === "danger" ? "border-rose-200 bg-rose-50" : tone === "ok" ? "border-emerald-200 bg-emerald-50" : "border-border bg-card";
  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function EmptyInline({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</div>;
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick}>
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

function UnitSelect({ units, value, onChange }: { units: AnnualEnvironmentalUnit[]; value?: string; onChange: (value: string | undefined) => void }) {
  return (
    <select value={value ?? ""} onChange={(event) => onChange(event.target.value || undefined)} className="h-10 min-w-[150px] rounded-md border bg-background px-3 text-sm">
      <option value="">Geral</option>
      {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
    </select>
  );
}

function DataStatusSelect({ value, onChange }: { value?: AnnualDataStatus; onChange: (value: AnnualDataStatus) => void }) {
  return (
    <select value={value ?? "pendente"} onChange={(event) => onChange(event.target.value as AnnualDataStatus)} className="h-10 min-w-[150px] rounded-md border bg-background px-3 text-sm">
      {DATA_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{ANNUAL_DATA_STATUS_LABELS[status]}</option>)}
    </select>
  );
}

function PendingStatusSelect({ value, onChange }: { value: AnnualPendingStatus; onChange: (value: AnnualPendingStatus) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as AnnualPendingStatus)} className="h-10 min-w-[170px] rounded-md border bg-background px-3 text-sm">
      {PENDING_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{ANNUAL_PENDING_STATUS_LABELS[status]}</option>)}
    </select>
  );
}

function SectionSelect({ value, onChange }: { value?: AnnualRecordSectionKey; onChange: (value: AnnualRecordSectionKey | undefined) => void }) {
  return (
    <select value={value ?? ""} onChange={(event) => onChange((event.target.value || undefined) as AnnualRecordSectionKey | undefined)} className="h-10 min-w-[180px] rounded-md border bg-background px-3 text-sm">
      <option value="">Sem secao</option>
      {SECTION_OPTIONS.map((section) => <option key={section} value={section}>{ANNUAL_SECTION_LABELS[section]}</option>)}
    </select>
  );
}

function MonthRange({
  value,
  onChange,
}: {
  value: { startMonth?: AnnualMonthKey; endMonth?: AnnualMonthKey };
  onChange: (data: { startMonth?: AnnualMonthKey; endMonth?: AnnualMonthKey }) => void;
}) {
  return (
    <div className="flex min-w-[190px] gap-2">
      <select value={value.startMonth ?? ""} onChange={(event) => onChange({ startMonth: (event.target.value || undefined) as AnnualMonthKey | undefined })} className="h-10 rounded-md border bg-background px-2 text-sm">
        <option value="">Inicio</option>
        {ANNUAL_MONTH_KEYS.map((month) => <option key={month} value={month}>{ANNUAL_MONTH_LABELS[month]}</option>)}
      </select>
      <select value={value.endMonth ?? ""} onChange={(event) => onChange({ endMonth: (event.target.value || undefined) as AnnualMonthKey | undefined })} className="h-10 rounded-md border bg-background px-2 text-sm">
        <option value="">Fim</option>
        {ANNUAL_MONTH_KEYS.map((month) => <option key={month} value={month}>{ANNUAL_MONTH_LABELS[month]}</option>)}
      </select>
    </div>
  );
}

function unitName(units: AnnualEnvironmentalUnit[], unitId?: string) {
  return units.find((unit) => unit.id === unitId)?.name ?? "Geral";
}

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}
