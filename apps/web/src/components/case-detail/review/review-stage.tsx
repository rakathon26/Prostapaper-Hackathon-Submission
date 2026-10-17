import type { Case } from "@prostapaper/contracts";

import { FinalStage } from "#components/case-detail/final/final-stage";
import { CaseMapping } from "#components/case-detail/review/case-mapping";
import { ReviewActions } from "#components/case-detail/review/review-actions";
import { CaseDocuments } from "#components/case-detail/shared/case-documents";

export interface ReviewStageProps {
  case: Case;
}

export function ReviewStage({ case: item }: ReviewStageProps) {
  const finalCheck = ["approved", "exporting", "exported"].includes(item.status);

  return (
    <div className="flex flex-col gap-4">
      {finalCheck && <FinalStage case={item} />}
      {!finalCheck && item.status === "ready_for_review" && <ReviewActions case={item} />}
      <CaseMapping
        caseId={item.id}
        finalCheck={finalCheck}
        sidebar={
          !finalCheck && (
            <>
              {item.status !== "ready_for_review" && <ReviewActions case={item} />}
              <CaseDocuments case={item} />
            </>
          )
        }
      />
    </div>
  );
}
