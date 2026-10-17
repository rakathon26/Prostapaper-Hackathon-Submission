import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Case } from "@prostapaper/contracts";

import { toast } from "#lib/toast";
import { useTRPC } from "#trpc";
import { Button, ButtonLink, Card } from "#ui";

export interface FinalStageProps {
  case: Case;
}

export function FinalStage({ case: item }: FinalStageProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const settle = async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.case.review.get.queryFilter({ caseId: item.id })),
      queryClient.invalidateQueries(trpc.case.get.queryFilter({ caseId: item.id })),
      queryClient.invalidateQueries(trpc.case.list.pathFilter()),
      queryClient.invalidateQueries(trpc.case.reviewQueue.pathFilter()),
      queryClient.invalidateQueries(trpc.case.exports.pathFilter()),
    ]);
  };
  const reopen = useMutation(
    trpc.case.reopen.mutationOptions({
      retry: false,
      onError: () => toast.error("Kontrolu se nepodařilo znovu otevřít. Obnovte stav případu."),
      onSettled: settle,
    }),
  );
  const send = useMutation(
    trpc.case.sendToRedcap.mutationOptions({
      retry: false,
      onSuccess: () => toast.success("Záznam byl odeslán do REDCap."),
      onError: () => toast.error("Odeslání nebylo potvrzeno. Zkontrolujte aktuální stav případu."),
      onSettled: settle,
    }),
  );
  const busy = send.isPending || reopen.isPending;

  return (
    <div className="flex flex-col gap-4">
      <Card
        heading={item.status === "exported" ? "Ložiska odeslána do REDCap" : "Závěrečná kontrola ložisek"}
      >
        {item.status === "approved" && (
          <>
            <p className="text-sm opacity-70">
              Zkontrolujte schválená ložiska. Odesláním se v REDCap vytvoří nový záznam s automaticky
              přiděleným ID. Opakované formuláře resekovaných ložisek budou označeny jako dokončené.
            </p>
            <div className="flex flex-wrap gap-3">
              {item.accessRole !== "viewer" && (
                <Button
                  variant="outline"
                  disabled={busy}
                  loading={reopen.isPending}
                  onClick={() => reopen.mutate({ caseId: item.id })}
                >
                  Zpět ke kontrole
                </Button>
              )}
              {item.accessRole === "owner" && (
                <Button
                  tone="primary"
                  disabled={busy}
                  loading={send.isPending}
                  onClick={() => send.mutate({ caseId: item.id })}
                >
                  Odeslat do REDCap
                </Button>
              )}
            </div>
            {send.isError && (
              <p role="alert" className="text-sm text-error">
                Odeslání se nepodařilo zahájit. Zkontrolujte připojení a konfiguraci REDCap. Pokud odeslání
                již začalo, aktualizovaný stav zabrání opakování.
              </p>
            )}
          </>
        )}
        {item.status === "exporting" && (
          <p role="status" className="text-sm">
            {item.exportUnconfirmed
              ? "Výsledek odeslání není potvrzen. Před dalším pokusem musí správce ověřit záznam v REDCap. Opakované odeslání a návrat ke kontrole jsou zablokovány."
              : "Probíhá odesílání do REDCap. Vyčkejte na potvrzení; stav se aktualizuje automaticky."}
          </p>
        )}
        {item.status === "exported" && (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="opacity-60">REDCap ID</dt>
                <dd className="font-medium break-all">{item.redcapRecordId}</dd>
              </div>
              {item.exportedAt !== null && (
                <div>
                  <dt className="opacity-60">Odesláno</dt>
                  <dd>
                    <time dateTime={item.exportedAt}>
                      {new Date(item.exportedAt).toLocaleString("cs-CZ", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </dd>
                </div>
              )}
            </dl>
            <p className="text-sm opacity-70">Záznam je uzamčen a nelze jej znovu odeslat ani upravit.</p>
            <ButtonLink to="/exporty" variant="outline" className="self-start">
              Zobrazit exporty
            </ButtonLink>
          </>
        )}
      </Card>
    </div>
  );
}
