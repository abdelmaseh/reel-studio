import { z } from "zod";
import { copy } from "../fields.ts";

export const INPUT_LABEL_MAX = 28;
export const CONDITION_LABEL_MAX = 24;
export const OUTCOME_MAX = 30;
export const VALUE_BOUND = 1_000_000_000;

const suppliedNumber = z.number().finite().min(-VALUE_BOUND).max(VALUE_BOUND);
const condition = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("boolean-equals"), label: copy(CONDITION_LABEL_MAX), equals: z.boolean() }),
  z.strictObject({ kind: z.literal("number-at-least"), label: copy(CONDITION_LABEL_MAX), threshold: suppliedNumber }),
]);

/** The two authored outcomes have no selected/result override: supplied data decides. */
export const conditionalBranchingSchema = z.strictObject({
  input: z.strictObject({ id: copy(24), label: copy(INPUT_LABEL_MAX), value: z.union([z.boolean(), suppliedNumber]) }),
  condition,
  branches: z.strictObject({ whenTrue: copy(OUTCOME_MAX), whenFalse: copy(OUTCOME_MAX) }),
}).superRefine((data, context) => {
  const expected = data.condition.kind === "boolean-equals" ? "boolean" : "number";
  if (typeof data.input.value !== expected) {
    context.addIssue({ code: "custom", path: ["input", "value"], message: `The ${data.condition.kind} condition requires a ${expected} input value` });
  }
});

export type ConditionalBranchingData = z.infer<typeof conditionalBranchingSchema>;

export const conditionalBranchingDemo: ConditionalBranchingData = {
  input: { id: "sample-042", label: "طلب تجريبي SAMPLE", value: 82 },
  condition: { kind: "number-at-least", label: "الدرجة", threshold: 75 },
  branches: { whenTrue: "تجهيز العرض", whenFalse: "مراجعة الطلب" },
};
