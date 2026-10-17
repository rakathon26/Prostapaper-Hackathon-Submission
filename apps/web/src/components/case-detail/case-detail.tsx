import type { ComponentType } from "react";

import { type Case, CaseStatus } from "@prostapaper/contracts";

import { CaseLayout } from "#components/case-detail/case-layout";
import { DraftStage } from "#components/case-detail/draft/draft-stage";
import { ProcessingStage } from "#components/case-detail/processing/processing-stage";
import { ReviewStage } from "#components/case-detail/review/review-stage";

// Review and final states share a mounted editor so background refreshes preserve local drafts.
const CASE_STAGES = {
  [CaseStatus.enum.draft]: DraftStage,
  [CaseStatus.enum.queued]: ProcessingStage,
  [CaseStatus.enum.mapping]: ProcessingStage,
  [CaseStatus.enum.ready_for_review]: ReviewStage,
  [CaseStatus.enum.in_review]: ReviewStage,
  [CaseStatus.enum.approved]: ReviewStage,
  [CaseStatus.enum.exporting]: ReviewStage,
  [CaseStatus.enum.exported]: ReviewStage,
} satisfies Record<CaseStatus, ComponentType<CaseDetailProps>>;

export interface CaseDetailProps {
  case: Case;
}

export function CaseDetail({ case: item }: CaseDetailProps) {
  const Stage = CASE_STAGES[item.status];

  return (
    <CaseLayout case={item}>
      <Stage case={item} />
    </CaseLayout>
  );
}
