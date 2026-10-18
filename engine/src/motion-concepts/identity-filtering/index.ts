import type {ConceptDef} from "../types.ts";
import {DEFAULT_FRAMES, MIN_FRAMES} from "./math.ts";
import {IdentityFiltering} from "./scene.tsx";
import {identityFilteringDemo, identityFilteringSchema, type IdentityFilteringData} from "./schema.ts";

export const concept: ConceptDef<IdentityFilteringData> = {
  id: "identity-filtering",
  title: "Identity filtering",
  message: "The same authored cards pass typed criteria while rejected identities remain visible and the surviving shortlist holds.",
  family: "flow",
  tags: ["filtering", "criteria", "shortlist", "identity", "selection", "تصفية", "معايير", "قائمة مختصرة", "هوية", "اختيار"],
  schema: identityFilteringSchema,
  demo: identityFilteringDemo,
  Component: IdentityFiltering,
  minFrames: MIN_FRAMES,
  defaultFrames: DEFAULT_FRAMES,
  loopable: false,
};
