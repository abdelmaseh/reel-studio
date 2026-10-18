import type { ConceptDef } from "../types.ts";
import { DEFAULT_FRAMES, MIN_FRAMES } from "./math.ts";
import { ConditionalBranching } from "./scene";
import { conditionalBranchingDemo, conditionalBranchingSchema, type ConditionalBranchingData } from "./schema.ts";

export const concept: ConceptDef<ConditionalBranchingData> = {
  id: "conditional-branching",
  title: "Conditional branching",
  message: "The same input is evaluated against a supplied condition and follows exactly one of two outcomes.",
  family: "flow",
  tags: ["condition", "branching", "decision", "predicate", "routing", "workflow", "شرط", "تفرع", "قرار", "مسار", "اختيار", "سير العمل"],
  schema: conditionalBranchingSchema,
  demo: conditionalBranchingDemo,
  Component: ConditionalBranching,
  minFrames: MIN_FRAMES,
  defaultFrames: DEFAULT_FRAMES,
  loopable: false,
};
