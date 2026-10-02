import type { AssessmentIdentity } from '../domain/exportAssessment';
export interface ExportAssessmentPort {
  assess(sources: readonly string[]): Promise<{
    readonly identity: AssessmentIdentity;
    readonly layout: readonly (string | null)[];
  }>;
}
