// The one place that decides which IntelliScent implementation is live.
// When the real algorithm exists, implement IntelliScentAlgorithm (see
// types.ts) and point `activeAlgorithm` at it - nothing else changes.

import { placeholderAlgorithm } from "@/lib/intelliscent/placeholderAlgorithm";
import type { IntelliScentAlgorithm } from "@/lib/intelliscent/types";

export const activeAlgorithm: IntelliScentAlgorithm = placeholderAlgorithm;
