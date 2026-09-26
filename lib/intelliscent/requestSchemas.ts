// Request-body validation shared by the IntelliScent route handlers.
// Deliberately loose about settings/personal/overrides - the service
// normalizes those against the current registries, so changing a setting
// or profile field never needs a change here.

import { z } from "zod";

const Loose = z.record(z.string(), z.unknown());

const EnginePayloadSchema = z.object({
  settings: Loose.default({}),
  personal: Loose.nullable().optional(),
  overrides: z.record(z.string(), Loose).optional(),
  checkins: z.record(z.string(), Loose).optional(),
  clashPairs: z.array(z.tuple([z.number().int(), z.number().int()])).optional(),
});

export const SuggestBodySchema = EnginePayloadSchema.extend({
  baseId: z.number().int().nullable().optional(),
  poolIds: z.array(z.number().int()).optional(),
  limit: z.number().int().optional(),
});

export const RateBodySchema = EnginePayloadSchema.extend({
  fragranceIds: z.array(z.number().int()),
});

export const ProfilesBodySchema = z.object({
  ids: z.array(z.number().int()).max(500),
  overrides: z.record(z.string(), Loose).optional(),
  checkins: z.record(z.string(), Loose).optional(),
});
