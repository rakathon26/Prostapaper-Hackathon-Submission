import assert from "node:assert/strict";
import test from "node:test";

import { SurgeryRecord } from "@prostapaper/contracts";

import { consensus } from "#consensus";
import { fixture } from "#test-fixtures";

const changed = (record: SurgeryRecord, values: Record<string, unknown>): SurgeryRecord =>
  SurgeryRecord.parse({ ...record, lesions: record.lesions.map((lesion) => ({ ...lesion, ...values })) });

function diagnostic(result: ReturnType<typeof consensus>, path: string) {
  const found = result.fieldDiagnostics.find((field) => field.path === path);
  assert.ok(found, `missing diagnostic for ${path}`);

  return found;
}

void test("lesion fields vote independently while preserving other majority fields", () => {
  const base = fixture();
  const result = consensus([
    changed(base, { lesion_x_mm: 13 }),
    changed(base, { lesion_y_mm: 9 }),
    changed(base, { lesion_x_mm: 13, lesion_y_mm: 9 }),
  ]);
  assert.equal(result.record.lesions[0]?.lesion_x_mm, 13);
  assert.equal(result.record.lesions[0].lesion_y_mm, 9);
  assert.equal(result.source, "majority");
  assert.equal(result.lesionAlignment, "aligned");
});

void test("swapped lesion regions choose a whole closest-pass array", () => {
  const base = fixture();
  const a = base.lesions[0];
  assert.ok(a);
  const b = { ...a, sur_prostate_regions: ["tza_apex_rs"], lesion_x_mm: 20 };
  const first = SurgeryRecord.parse({ ...base, lesions: [a, b] });
  const swapped = SurgeryRecord.parse({ ...base, lesions: [b, a] });
  const result = consensus([first, swapped]);
  assert.equal(result.lesionAlignment, "closest");
  assert.deepEqual(result.record.lesions, first.lesions);
  assert.ok(!result.unstable.some((field) => field.startsWith("lesions.0.")));
});

void test("a losing lesion count contributes no per-lesion votes or closest-pass candidate", () => {
  const base = fixture();
  const minority = SurgeryRecord.parse({ ...base, lesions: [...base.lesions, ...base.lesions] });
  const result = consensus([
    minority,
    changed(base, { lesion_x_mm: 13 }),
    changed(base, { lesion_x_mm: 13 }),
  ]);
  assert.equal(result.record.lesions.length, 1);
  assert.equal(result.record.lesions[0]?.lesion_x_mm, 13);
  assert.notEqual(result.closestIndex, 0);
  assert.ok(!result.unstable.some((field) => field.startsWith("lesions.0.")));
  assert.ok(!result.unstable.some((field) => field.startsWith("lesions.1.")));
});

void test("invalid cross-field majority falls back to the closest valid record", () => {
  const base = fixture();
  const one = changed(base, { gleason_prim_grade: null, gleason_prim_perc: null });
  const two = changed(base, { gleason_prim_grade: "3", gleason_prim_perc: 80 });
  const three = changed(base, { gleason_prim_grade: "4", gleason_prim_perc: 80 });
  const result = consensus([one, two, three]);
  assert.equal(result.source, "closest");
  assert.ok(SurgeryRecord.safeParse(result.record).success);
});

void test("diagnostics cover every returned scalar and array field and count actual selected support", () => {
  const base = fixture();
  const result = consensus([
    changed(base, { lesion_x_mm: 13 }),
    changed(base, { lesion_x_mm: 13 }),
    changed(base, { lesion_x_mm: 17 }),
  ]);
  const x = result.fieldDiagnostics.find(({ path }) => path === "lesions.0.lesion_x_mm");
  assert.deepEqual(x, {
    path: "lesions.0.lesion_x_mm",
    selectedValue: 13,
    selectedSupport: 2,
    comparablePassCount: 3,
    totalPassCount: 3,
    alternatives: [
      { value: 13, count: 2 },
      { value: 17, count: 1 },
    ],
    selectionMethod: "majority",
    reasonCodes: [],
  });
  assert.ok(result.fieldDiagnostics.some(({ path }) => path === "lesions.length"));
  assert.ok(result.fieldDiagnostics.some(({ path }) => path === "lesions.0.sur_prostate_regions"));
  assert.ok(result.fieldDiagnostics.some(({ path }) => path === "surgery.surgery_date"));
  assert.equal(result.fieldDiagnostics.length, new Set(result.fieldDiagnostics.map(({ path }) => path)).size);
});

void test("two-pass ties report both alternatives and one-pass output reports one comparable pass", () => {
  const base = fixture();
  const differentText = SurgeryRecord.parse({
    ...base,
    surgery: { ...base.surgery, surgery_text: "different" },
  });
  const two = consensus([base, differentText]);
  const tie = diagnostic(two, "surgery.surgery_text");
  assert.equal(tie.selectedSupport, 1);
  assert.equal(tie.comparablePassCount, 2);
  assert.equal(tie.alternatives.length, 2);
  const one = diagnostic(consensus([base]), "surgery.surgery_text");
  assert.equal(one.selectedSupport, 1);
  assert.equal(one.comparablePassCount, 1);
});

void test("closest fallback diagnostics measure support for the selected record", () => {
  const base = fixture();
  const one = changed(base, { gleason_prim_grade: null, gleason_prim_perc: null });
  const two = changed(base, { gleason_prim_grade: "3", gleason_prim_perc: 80 });
  const three = changed(base, { gleason_prim_grade: "4", gleason_prim_perc: 80 });
  const result = consensus([one, two, three]);
  const grade = diagnostic(result, "lesions.0.gleason_prim_grade");
  assert.equal(result.source, "closest");
  assert.equal(grade.selectedValue, null);
  assert.equal(grade.selectedSupport, 1);
  assert.equal(grade.selectionMethod, "closest");
  assert.ok(grade.reasonCodes.includes("closest_fallback"));
});

void test("lesion count disagreement uses selected-count support and propagates its reason", () => {
  const base = fixture();
  const withTwo = SurgeryRecord.parse({ ...base, lesions: [...base.lesions, ...base.lesions] });
  const withThree = SurgeryRecord.parse({
    ...base,
    lesions: [...base.lesions, ...base.lesions, ...base.lesions],
  });
  const withFour = SurgeryRecord.parse({
    ...base,
    lesions: [...base.lesions, ...base.lesions, ...base.lesions, ...base.lesions],
  });
  const result = consensus([base, base, base, withTwo, withTwo, withThree, withThree, withFour, withFour]);
  const x = diagnostic(result, "lesions.0.lesion_x_mm");
  assert.equal(x.selectedSupport, 3);
  assert.equal(x.comparablePassCount, 3);
  assert.equal(x.totalPassCount, 9);
  assert.ok(x.reasonCodes.includes("lesion_count_disagreement"));
});

void test("ambiguous or swapped multi-lesion alignment has no field comparables", () => {
  const base = fixture();
  const firstLesion = base.lesions[0];
  assert.ok(firstLesion);
  const secondLesion = { ...firstLesion, sur_prostate_regions: ["tza_apex_rs"], lesion_x_mm: 20 };
  const first = SurgeryRecord.parse({ ...base, lesions: [firstLesion, secondLesion] });
  const swapped = SurgeryRecord.parse({ ...base, lesions: [secondLesion, firstLesion] });
  const result = consensus([first, swapped]);
  const field = diagnostic(result, "lesions.0.lesion_x_mm");
  assert.equal(field.selectedSupport, 0);
  assert.equal(field.comparablePassCount, 0);
  assert.ok(field.reasonCodes.includes("lesion_alignment_uncertain"));
});
