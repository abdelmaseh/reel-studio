import {z} from "zod";
import {copy} from "../fields.ts";

export const CARD_MIN = 3;
export const CARD_MAX = 6;
export const CRITERIA_MAX = 3;
export const CARD_LABEL_MAX = 22;
export const CRITERION_LABEL_MAX = 24;
export const ATTRIBUTE_LIMIT = 1_000_000;

const safeKey = (max: number) => z.string().min(1).max(max)
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "Use a stable Latin key starting with a letter")
  .refine((key) => !["__proto__", "constructor", "prototype"].includes(key), "Reserved object keys are not allowed");
const boundedNumber = z.number().finite().min(-ATTRIBUTE_LIMIT).max(ATTRIBUTE_LIMIT)
  .refine((value) => Number(value.toFixed(6)) === value, "Use at most 6 decimal places so predicate evidence remains readable and exact");
const attributeValue = z.union([boundedNumber, z.boolean()]);
const cardSchema = z.strictObject({
  id: safeKey(16),
  label: copy(CARD_LABEL_MAX),
  attributes: z.record(safeKey(24), attributeValue).refine((value) => Object.keys(value).length >= 1 && Object.keys(value).length <= 6, "Each card needs 1 to 6 typed attributes"),
});
const criterionSchema = z.strictObject({
  id: safeKey(20),
  label: copy(CRITERION_LABEL_MAX).refine((label) => label.split(/\s+/).every((word) => Array.from(word).length <= 20), "Each criterion word is at most 20 characters so three criteria remain readable"),
  field: safeKey(24),
  op: z.enum(["eq", "gte", "lte"]),
  value: attributeValue,
}).superRefine((criterion, ctx) => {
  if (criterion.op !== "eq" && typeof criterion.value !== "number") ctx.addIssue({code: "custom", path: ["value"], message: "gte/lte require a numeric value"});
});

export const identityFilteringSchema = z.strictObject({
  title: copy(40),
  sourceLabel: copy(20),
  retainedLabel: copy(20),
  rejectedLabel: copy(20),
  cards: z.array(cardSchema).min(CARD_MIN).max(CARD_MAX),
  criteria: z.array(criterionSchema).min(1).max(CRITERIA_MAX),
}).superRefine((data, ctx) => {
  for (const [name, items] of [["cards", data.cards], ["criteria", data.criteria]] as const) {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item.id)) ctx.addIssue({code: "custom", path: [name, index, "id"], message: `Duplicate ${name} ID: ${item.id}`});
      seen.add(item.id);
    });
  }
  data.criteria.forEach((criterion, criterionIndex) => {
    data.cards.forEach((card, cardIndex) => {
      const path = ["cards", cardIndex, "attributes", criterion.field];
      if (!Object.hasOwn(card.attributes, criterion.field)) {
        ctx.addIssue({code: "custom", path, message: `Missing field required by criterion ${criterionIndex + 1}: ${criterion.field}`});
      } else if (typeof card.attributes[criterion.field] !== typeof criterion.value) {
        ctx.addIssue({code: "custom", path, message: `Attribute type must match criterion ${criterionIndex + 1} (${typeof criterion.value})`});
      }
    });
  });
});

export type IdentityFilteringData = z.infer<typeof identityFilteringSchema>;
export type FilteringCard = IdentityFilteringData["cards"][number];
export type FilteringCriterion = IdentityFilteringData["criteria"][number];

export const identityFilteringDemo: IdentityFilteringData = {
  title: "اختيار بنفس الهوية (SAMPLE)",
  sourceLabel: "الاختيارات",
  retainedLabel: "القائمة النهائية",
  rejectedLabel: "مستبعد",
  cards: [
    {id: "A1", label: "اختيار ألف", attributes: {score: 90, verified: true}},
    {id: "B2", label: "اختيار باء", attributes: {score: 82, verified: false}},
    {id: "C3", label: "اختيار جيم", attributes: {score: 60, verified: true}},
    {id: "D4", label: "اختيار دال", attributes: {score: 78, verified: true}},
    {id: "E5", label: "اختيار هاء", attributes: {score: 58, verified: false}},
    {id: "F6", label: "اختيار واو", attributes: {score: 95, verified: false}},
  ],
  criteria: [
    {id: "quality", label: "التقييم ٧٥ أو أكثر", field: "score", op: "gte", value: 75},
    {id: "verified", label: "تم التحقق", field: "verified", op: "eq", value: true},
  ],
};
