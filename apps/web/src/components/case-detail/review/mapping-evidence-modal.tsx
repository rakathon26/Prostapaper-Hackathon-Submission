import {
  DocumentId,
  type MappingReview as MappingReviewType,
  type ReviewFieldDecision,
  reviewFieldKey,
  type ReviewFieldRef,
  type ReviewFieldRequirement,
  type ReviewWorkflow,
} from "@prostapaper/contracts";

import { MappingAttentionList } from "#components/case-detail/review/mapping-attention";
import { formatMappingValue, formatMarkLabel, formatRegion } from "#lib/mapping-format";
import {
  confidenceReasonText,
  type MappingAttention,
  type MappingAttentionItem,
  type MappingFieldView,
} from "#lib/mapping-review";
import { fieldChanged } from "#lib/review-edit";
import { ButtonLink, Modal } from "#ui";

interface MappingEvidenceProps {
  review: MappingReviewType | null;
  fields: MappingFieldView[];
  originalFields: MappingFieldView[];
  workflow: ReviewWorkflow;
  requirements: ReviewFieldRequirement[];
  currentUserId: string | null;
  lesionIds: readonly string[];
  attention: MappingAttention;
  selected: ReviewFieldRef | null;
  onSelectAttention: (item: MappingAttentionItem) => void;
  markIds: string[];
  onClose: () => void;
}

export function MappingEvidence({
  review,
  fields,
  originalFields,
  workflow,
  requirements,
  currentUserId,
  lesionIds,
  attention,
  selected,
  onSelectAttention,
  markIds,
  onClose,
}: MappingEvidenceProps) {
  let selectedView: MappingFieldView | undefined;
  if (selected !== null)
    selectedView = fields.find((item) => reviewFieldKey(item.reference) === reviewFieldKey(selected));
  const originalView = originalFields.find(
    (item) => selected !== null && reviewFieldKey(item.reference) === reviewFieldKey(selected),
  );
  const decisions = workflow.decisions.filter(
    (entry) => selected !== null && reviewFieldKey(entry.reference) === reviewFieldKey(selected),
  );
  const requirement = requirements.find(
    (entry) => selected !== null && reviewFieldKey(entry.reference) === reviewFieldKey(selected),
  );
  const registryField = selectedView?.definition ?? undefined;
  const valueChanged =
    selectedView !== undefined &&
    originalView !== undefined &&
    fieldChanged(selectedView.fieldName, originalView.value, selectedView.value);

  const currentAssessment = selectedView?.assessment;
  const alternatives =
    currentAssessment?.alternatives.filter(
      (item) => JSON.stringify(item.value) !== JSON.stringify(currentAssessment.selectedValue),
    ) ?? [];
  let fieldEvidence: MappingReviewType["evidence"] = [];
  let transformations: MappingReviewType["transformations"] = [];
  let marks: MappingReviewType["marks"] = [];
  if (review !== null && selectedView !== undefined) {
    fieldEvidence = uniqueEvidence(
      review.evidence.filter((item) => currentAssessment?.evidenceIds.includes(item.id) ?? false),
    );
    transformations = review.transformations.filter(
      (item) => reviewFieldKey(item.reference) === reviewFieldKey(selectedView.reference),
    );
    if (selectedView.reference.scope === "lesion") {
      const selectedLesionId = selectedView.reference.lesionId;
      marks = review.marks.filter(
        (mark) => mark.lesionId === selectedLesionId || mark.candidateLesionIds.includes(selectedLesionId),
      );
    } else if (selectedView.reference.scope === "collection") {
      marks = review.marks;
    }
  }

  return (
    <>
      <MappingAttentionList attention={attention} onSelect={onSelectAttention} />

      {/* Evidence stays available in every lifecycle state; this dialog is read-only and performs no requests. */}
      <Modal
        open={selected !== null}
        onClose={onClose}
        title={evidenceTitle(selectedView, registryField)}
        size="lg"
      >
        {selectedView !== undefined && (
          <div className="max-h-[70vh] overflow-y-auto text-sm">
            <section>
              <h3 className="font-semibold">Aktuální hodnota</h3>
              <p className="mt-1 wrap-anywhere whitespace-pre-wrap">
                {formatMappingValue(selectedView.value, registryField?.metadata.choices)}
              </p>
              {valueChanged && (
                <p className="mt-1 text-base-content/70">
                  Původní návrh modelu:{" "}
                  {formatMappingValue(originalView.value, registryField?.metadata.choices)}
                </p>
              )}
              {selectedView.fieldName === "all_sgm" && selectedView.value === false && (
                <p className="mt-1 text-base-content/70">
                  Neoznačeno (výchozí stav); samo o sobě to nedokládá výslovně uvedené „ne“.
                </p>
              )}
            </section>
            <section className="mt-4">
              <h3 className="font-semibold">Lidská kontrola</h3>
              <p>
                {requirement?.resolved === true
                  ? "Aktuální rozhodnutí je platné."
                  : "Hodnota není samostatně potvrzena."}
              </p>
              {decisions.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {decisions.toReversed().map((entry) => (
                    <li key={entry.id} className="rounded-box border border-base-300 p-2">
                      <p>
                        Revize {entry.atRevision} · {new Date(entry.at).toLocaleString("cs-CZ")} ·{" "}
                        {entry.actorId === currentUserId ? "vy" : "jiný uživatel"}
                      </p>
                      <p>
                        {decisionActionLabel(entry.action)}
                        {entry.invalidatedAtRevision !== null &&
                          ` · znovu otevřeno v revizi ${entry.invalidatedAtRevision}`}
                      </p>
                      {entry.note !== null && <p>{entry.note}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {currentAssessment === undefined && (
              <p className="mt-4 rounded-box bg-warning/10 p-3">
                Původ hodnoty a jistota nejsou k dispozici. Výsledek neobsahuje platné ověřené podklady pro
                tuto hodnotu.
              </p>
            )}
            {currentAssessment !== undefined && (
              <>
                <section className="mt-4">
                  <h3 className="font-semibold">
                    Jistota návrhu: {confidenceLabel(currentAssessment.confidence)}
                  </h3>
                  <p className="mt-1">
                    {currentAssessment.selectedSupport} z {currentAssessment.totalPassCount} průchodů
                    podpořilo vybranou hodnotu; porovnatelných průchodů:{" "}
                    {currentAssessment.comparablePassCount}. Požadováno:{" "}
                    {currentAssessment.requestedPassCount}, dokončeno: {currentAssessment.totalPassCount}.
                  </p>
                  <p className="mt-1">{confidenceReasonText(currentAssessment.reasonCodes)}</p>
                  <p className="mt-1">Výběr: {selectionText(currentAssessment.selectionMethod)}.</p>
                </section>
                {alternatives.length > 0 && (
                  <section className="mt-4">
                    <h3 className="font-semibold">Další varianty</h3>
                    <ul className="mt-1 list-disc pl-5">
                      {alternatives.map((alternative) => (
                        <li key={`${JSON.stringify(alternative.value)}:${alternative.count}`}>
                          {formatMappingValue(alternative.value, registryField?.metadata.choices)} ·{" "}
                          {alternative.count}×
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
            {fieldEvidence.length > 0 && (
              <section className="mt-4">
                <h3 className="font-semibold">Citované podklady</h3>
                <p className="mt-1 text-xs text-base-content/70">
                  Ověření citace potvrzuje přítomnost textu, nikoli správnost klinického výkladu.
                </p>
                <div className="mt-2 grid gap-3">
                  {fieldEvidence.map((item) => {
                    const source = review?.sources.find(
                      (candidate) => candidate.documentId === item.citation.documentId,
                    );
                    const page = source?.pages.find((candidate) => candidate.page === item.citation.page);

                    return (
                      <article key={item.id} className="min-w-0 rounded-box border border-base-300 p-3">
                        <p className="font-medium wrap-anywhere">
                          {source?.filename ?? "Neznámý soubor"} · {documentKindText(source?.kind)} · strana{" "}
                          {item.citation.page}
                        </p>
                        {source !== undefined && (
                          <p className="text-xs text-base-content/70">
                            Verze podkladu: {source.sourceVersion}
                          </p>
                        )}
                        <p className="mt-1">
                          {pageSourceText(page?.source)}; {relationText(item.relation)}.
                        </p>
                        {item.verification.status === "verified" && (
                          <blockquote className="mt-2 border-l-2 border-primary pl-3 wrap-anywhere whitespace-pre-wrap">
                            <span className="block text-base-content/70">{item.verification.context}</span>
                            <span className="mt-1 block font-semibold">{item.verification.quote}</span>
                          </blockquote>
                        )}
                        {item.verification.status !== "verified" && (
                          <p className="mt-2">
                            Citace není ověřena:{" "}
                            {verificationText(
                              item.verification.status,
                              "reason" in item.verification ? item.verification.reason : undefined,
                            )}
                            .
                          </p>
                        )}
                        {source !== undefined && DocumentId.safeParse(source.documentId).success && (
                          <ButtonLink
                            size="sm"
                            variant="outline"
                            className="mt-3"
                            to="/dokumenty/$documentId"
                            params={{ documentId: source.documentId }}
                          >
                            Otevřít původní dokument
                          </ButtonLink>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
            {transformations.length > 0 && (
              <section className="mt-4">
                <h3 className="font-semibold">Úpravy hodnoty</h3>
                <ul className="mt-2 grid gap-2">
                  {transformations.map((item) => (
                    <li key={item.id} className="rounded-box border border-base-300 p-3">
                      <p>
                        {item.ruleId} (pravidlo {item.ruleVersion})
                      </p>
                      <p className="mt-1">
                        Před: <mark>{formatMappingValue(item.before, registryField?.metadata.choices)}</mark>{" "}
                        → po: <mark>{formatMappingValue(item.after, registryField?.metadata.choices)}</mark>
                      </p>
                      {item.sourceMarkIds.length > 0 && (
                        <p>
                          Značky:{" "}
                          {item.sourceMarkIds.map((id) => formatMarkLabel(markIds.indexOf(id))).join(", ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {marks.length > 0 && (
              <section className="mt-4">
                <h3 className="font-semibold">Značky schématu při původním automatickém mapování</h3>
                <ul className="mt-2 grid gap-2">
                  {marks.map((mark) => {
                    const source = review?.sources.find(
                      (candidate) => candidate.documentId === mark.documentId,
                    );
                    let targetIndex = -1;
                    if (mark.lesionId !== null) targetIndex = lesionIds.indexOf(mark.lesionId);
                    const candidateNumbers = mark.candidateLesionIds.map((id) => {
                      const index = lesionIds.indexOf(id);
                      if (index === -1) return "odebrané";

                      return String(index + 1);
                    });

                    return (
                      <li key={mark.id} className="rounded-box border border-base-300 p-3">
                        <p className="font-medium wrap-anywhere">
                          {formatMarkLabel(markIds.indexOf(mark.id))} ·{" "}
                          {markStatusText(mark.status, targetIndex)}
                        </p>
                        <p className="wrap-anywhere">
                          {source?.filename ?? "Schéma"} · {documentKindText(source?.kind)} · strana{" "}
                          {mark.page}; oblasti:{" "}
                          {mark.regions.map(formatRegion).join(", ") || "žádné rozpoznané"}
                        </p>
                        {source !== undefined && (
                          <p className="text-xs text-base-content/70">
                            Verze podkladu: {source.sourceVersion}
                          </p>
                        )}
                        {candidateNumbers.length > 0 && <p>Možná ložiska: {candidateNumbers.join(", ")}</p>}
                        {source !== undefined && DocumentId.safeParse(source.documentId).success && (
                          <ButtonLink
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            to="/dokumenty/$documentId"
                            params={{ documentId: source.documentId }}
                          >
                            Otevřít původní schéma
                          </ButtonLink>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </Modal>
      <div className="sr-only" aria-live="polite">
        {attentionStatus(attention.items.length)}
      </div>
    </>
  );
}

function confidenceLabel(label: string) {
  const labels: Record<string, string> = {
    high: "vysoká",
    medium: "střední",
    low: "nízká",
    unavailable: "nedostupná",
  };
  const icons: Record<string, string> = { high: "✓", medium: "◐", low: "!", unavailable: "?" };

  return `${icons[label] ?? "?"} ${labels[label] ?? "nedostupná"}`;
}

function selectionText(method: string) {
  const labels: Record<string, string> = {
    majority: "většina",
    closest: "nejbližší úplný průchod",
    lesion_fallback: "náhradní výběr ložiska",
    sector: "zpracování značek schématu",
  };

  return labels[method] ?? "nedostupný";
}

function verificationText(status: string, reason?: string) {
  const labels: Record<string, string> = {
    document_missing: "zdrojový dokument chybí",
    page_missing: "strana zdroje chybí",
    source_mismatch: "citace odkazuje na jinou verzi extrakce",
    quote_not_found: "citovaný text nebyl nalezen",
    offset_mismatch: "pozice neodpovídá přesnému textu",
    offset_out_of_bounds: "pozice leží mimo text strany",
  };
  if (status === "ambiguous") return "opakovaný text bez jednoznačné pozice";
  if (status === "unavailable") return labels[reason ?? ""] ?? "zdrojová strana chybí";
  if (status === "invalid") return labels[reason ?? ""] ?? "citace neodpovídá zdrojovému textu";

  return "neznámý stav";
}

function markStatusText(status: string, targetIndex: number) {
  if (status === "assigned") return `přiřazena ložisku ${targetIndex + 1}`;
  if (status === "ambiguous") return "nejednoznačná";

  return "nepřiřazená";
}

function evidenceTitle(
  field: MappingFieldView | undefined,
  definition: MappingFieldView["definition"] | undefined,
) {
  if (field === undefined) return "Původ hodnoty";
  const label = definition?.label ?? "Počet ložisek";
  if (field.lesionIndex === undefined) return label;

  return `${label} · ložisko ${field.lesionIndex + 1}`;
}

function documentKindText(kind: string | undefined) {
  if (kind === "sector_map") return "schéma se značkami";
  if (kind === "text_description") return "popis";

  return "druh souboru nedostupný";
}

function pageSourceText(source: string | undefined) {
  if (source === "ocr" || source === "model") return "Text získaný z dokumentu";
  if (source === "opencv") return "Text/obsah ze zpracování skenu";

  return "Původ textu nedostupný";
}

function relationText(relation: string) {
  if (relation === "supports") return "podporuje vybranou hodnotu";

  return "odporuje vybrané hodnotě";
}

function attentionStatus(count: number) {
  if (count === 0) return "";

  return `${count} položek vyžaduje pozornost`;
}

function uniqueEvidence(evidence: MappingReviewType["evidence"]): MappingReviewType["evidence"] {
  const seen = new Set<string>();

  return evidence.filter((item) => {
    const identity = JSON.stringify([item.citation, item.verification, item.relation]);
    if (seen.has(identity)) return false;
    seen.add(identity);

    return true;
  });
}

function decisionActionLabel(action: ReviewFieldDecision["action"]): string {
  if (action === "accept") return "Přijetí návrhu";
  if (action === "correct") return "Oprava";

  return "Vymazání";
}
