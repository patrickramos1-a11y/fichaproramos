import type { Client, Empreendimento, Project, Survey } from "./types";

export function getSurveyProject(survey: Survey, projects: Project[]): Project | undefined {
  return survey.projectId ? projects.find((project) => project.id === survey.projectId) : undefined;
}

export function getSurveyClientId(survey: Survey, projects: Project[]): string | undefined {
  return survey.clientId || getSurveyProject(survey, projects)?.clientId;
}

export function getSurveyClient(survey: Survey, clients: Client[], projects: Project[]): Client | undefined {
  const clientId = getSurveyClientId(survey, projects);
  return clientId ? clients.find((client) => client.id === clientId) : undefined;
}

export function getSurveyEmpreendimento(
  survey: Survey,
  empreendimentos: Empreendimento[],
  projects: Project[],
): Empreendimento | undefined {
  const empreendimentoId = survey.empreendimentoId || getSurveyProject(survey, projects)?.empreendimentoId;
  return empreendimentoId
    ? empreendimentos.find((empreendimento) => empreendimento.id === empreendimentoId)
    : undefined;
}

export function getSurveysForClient(surveys: Survey[], clientId: string, projects: Project[]): Survey[] {
  return surveys.filter((survey) => getSurveyClientId(survey, projects) === clientId);
}

export function getSurveysForProject(surveys: Survey[], projectId: string): Survey[] {
  return surveys.filter((survey) => survey.projectId === projectId);
}
