// Engine behaviour checked against the claims the layering framework makes
// (Docs/Fragrance Layering Algorithm). Profiles here are hand-built, the
// way the framework recommends, so these test the math - not estimation.

import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyVector, type AccordVector } from "@/lib/intelliscent/axes";
import { buildEngineContext, buildRecipe, scoreCombo, suggest } from "@/lib/intelliscent/engine";
import { buildPersonalModel, applyPersonalModel, type FeedbackEvent } from "@/lib/intelliscent/personalization";
import { applyOverride, lateWeight, type FragranceProfile } from "@/lib/intelliscent/profile";
import { DEFAULT_SETTINGS, normalizeSettings, vibeOf, withVibe } from "@/lib/intelliscent/settings";
import { deriveProfile } from "@/lib/intelliscent/derive/deriveProfile";
import type { Fragrance } from "@/lib/schemas";

let nextId = 1;
function profile(p: {
  accords: Partial<AccordVector>;
  time: [number, number, number, number];
  projection?: number;
  longevity?: number;
  sweetness?: number;
  molecules?: Partial<FragranceProfile["molecules"]>;
}): FragranceProfile {
  const [h0, h1, h4, h8] = p.time;
  return {
    fragranceId: nextId++,
    accords: { ...emptyVector(), ...p.accords },
    time: { h0, h1, h4, h8 },
    projection: p.projection ?? 3,
    longevity: p.longevity ?? 3,
    sweetness: p.sweetness ?? 0.2,
    temperature: 0,
    molecules: { ambroxan: 0, isoESuper: 0, ethylMaltol: 0, calone: 0, cashmeran: 0, aldehydes: 0, ...p.molecules },
    context: {
      seasons: { spring: 0.5, summer: 0.5, fall: 0.5, winter: 0.5 },
      timeOfDay: { day: 0.5, night: 0.5 },
      occasions: { office: 0.5, casual: 0.5, dateNight: 0.5, formal: 0.5, sport: 0.5 },
      formality: 0.5,
    },
    sources: {
      accords: "manual", time: "manual", projection: "manual", longevity: "manual", sweetness: "manual",
      temperature: "manual", molecules: "manual", seasons: "manual", timeOfDay: "manual", occasions: "manual", formality: "manual",
    },
    unmappedAccords: [],
  };
}

const ctx = (settings = DEFAULT_SETTINGS) => buildEngineContext({ settings });

// The framework's textbook example.
const tobaccoVanille = () =>
  profile({ accords: { gourmand: 0.9, warmSpice: 0.6, smokeOud: 0.6, amberResin: 0.5, citrus: 0.1 }, time: [1, 0.95, 0.8, 0.6], projection: 4, longevity: 4.5, sweetness: 0.6 });
const limeBasil = () =>
  profile({ accords: { citrus: 0.9, aromatic: 0.6, green: 0.5, gourmand: 0.1 }, time: [1, 0.5, 0.05, 0], projection: 2.5, longevity: 2, sweetness: 0.1 });
const amberA = () =>
  profile({ accords: { amberResin: 0.9, gourmand: 0.6, warmSpice: 0.4 }, time: [1, 0.95, 0.8, 0.6], projection: 4, longevity: 4.5, sweetness: 0.6 });
const amberB = () =>
  profile({ accords: { amberResin: 0.85, gourmand: 0.65, warmSpice: 0.35, musk: 0.1 }, time: [1, 0.95, 0.8, 0.65], projection: 4, longevity: 4.5, sweetness: 0.65 });

test("Tobacco Vanille + Lime Basil: complementary roles beat two stacked ambers", () => {
  const good = scoreCombo([tobaccoVanille(), limeBasil()], ctx());
  const mud = scoreCombo([amberA(), amberB()], ctx());
  assert.ok(good.score > mud.score, `expected ${good.score} > ${mud.score}`);
  assert.ok(good.terms.structure > 0.7, "one clear anchor, one clear modifier");
  assert.ok(mud.terms.structure < 0.1, "two base-heavy scents share a shape");
  assert.ok(mud.terms.interest < good.terms.interest, "near-identical scents are redundant");
  assert.deepEqual(good.roles, ["anchor", "modifier"]);
});

test("the tobacco-vanille base is the anchor and goes on first; blend description names both sides", () => {
  const tv = tobaccoVanille();
  const lb = limeBasil();
  const combo = scoreCombo([lb, tv], ctx());
  assert.equal(combo.fragranceIds[0], tv.fragranceId);
  const recipe = buildRecipe(combo, new Map([[tv.fragranceId, tv], [lb.fragranceId, lb]]));
  assert.equal(recipe.steps[0].role, "anchor");
  assert.ok(recipe.steps[1].sprays >= recipe.steps[0].sprays, "weaker modifier gets at least as many sprays");
  assert.match(recipe.description, /citrus/, recipe.description);
  assert.match(recipe.description, /vanilla|amber|oud/, recipe.description);
});

test("aquatic x gourmand harmony is low (framework: -0.6)", () => {
  const aquatic = profile({ accords: { aquatic: 1 }, time: [1, 0.5, 0.1, 0] });
  const gourmand = profile({ accords: { gourmand: 1 }, time: [1, 0.9, 0.7, 0.5] });
  const r = scoreCombo([aquatic, gourmand], ctx());
  assert.ok(Math.abs(r.terms.harmony - 0.2) < 1e-9, `(−0.6 + 1) / 2 = 0.2, got ${r.terms.harmony}`);
});

test("interest peaks at the sweet spot and falls off on both sides", () => {
  const a = profile({ accords: { citrus: 1 }, time: [1, 0.5, 0.1, 0] });
  const same = profile({ accords: { citrus: 1 }, time: [1, 0.9, 0.7, 0.5] });
  const opposite = profile({ accords: { smokeOud: 1 }, time: [1, 0.9, 0.7, 0.5] });
  const mid = profile({ accords: { citrus: 0.72, dryWoods: 0.7 }, time: [1, 0.9, 0.7, 0.5] }); // cosine distance ~0.3
  const iSame = scoreCombo([a, same], ctx()).terms.interest;
  const iOpp = scoreCombo([a, opposite], ctx()).terms.interest;
  const iMid = scoreCombo([a, mid], ctx()).terms.interest;
  assert.ok(iMid > iSame && iMid > iOpp, `${iMid} should beat ${iSame} and ${iOpp}`);
});

test("penalties: combined sweetness over cap, doubled loud molecule, strength mismatch", () => {
  const sweetA = profile({ accords: { gourmand: 1 }, time: [1, 0.9, 0.7, 0.5], sweetness: 0.7, molecules: { ethylMaltol: 1 } });
  const sweetB = profile({ accords: { gourmand: 0.8, fruity: 0.5 }, time: [1, 0.6, 0.1, 0], sweetness: 0.7, molecules: { ethylMaltol: 0.8 } });
  const r = scoreCombo([sweetA, sweetB], ctx());
  const rules = r.penalties.map((p) => p.rule).sort();
  assert.deepEqual(rules, ["molecule", "sweetness"]);

  const powerhouse = profile({ accords: { smokeOud: 1 }, time: [1, 0.9, 0.8, 0.7], projection: 5, longevity: 5 });
  const skin = profile({ accords: { musk: 1 }, time: [1, 0.6, 0.2, 0.05], projection: 1, longevity: 2 });
  assert.ok(scoreCombo([powerhouse, skin], ctx()).penalties.some((p) => p.rule === "strength"));
});

test("molecule clash respects the configured molecule list", () => {
  const a = profile({ accords: { aquatic: 1 }, time: [1, 0.5, 0.1, 0], molecules: { calone: 1 } });
  const b = profile({ accords: { citrus: 1 }, time: [1, 0.4, 0, 0], molecules: { calone: 1 } });
  assert.ok(scoreCombo([a, b], ctx()).penalties.some((p) => p.rule === "molecule"));
  const trimmed = normalizeSettings({ ...DEFAULT_SETTINGS, moleculeFlags: ["ambroxan"] });
  assert.ok(!scoreCombo([a, b], ctx(trimmed)).penalties.some((p) => p.rule === "molecule"));
});

test("3 scents: two anchors hard-fail Structure; anchor + modifier + light accent passes", () => {
  const settings = DEFAULT_SETTINGS;
  const twoAnchors = scoreCombo([amberA(), amberB(), limeBasil()], ctx(settings));
  assert.equal(twoAnchors.terms.structure, 0);
  assert.match(twoAnchors.structureNote ?? "", /both anchors/);

  const accent = profile({ accords: { green: 0.9, aromatic: 0.3 }, time: [1, 0.3, 0, 0], projection: 1.5, longevity: 1.5 });
  const good = scoreCombo([tobaccoVanille(), limeBasil(), accent], ctx(settings));
  assert.ok(good.terms.structure > 0.5, `structure ${good.terms.structure}`);
  assert.deepEqual(good.roles, ["anchor", "modifier", "accent"]);
  assert.ok(!good.penalties.some((p) => p.rule === "accent"));
});

test("sweetness cap loosens per extra scent: 1.2 + 0.3 x (N - 2)", () => {
  const s = (sweet: number, lw: [number, number, number, number]) => profile({ accords: { gourmand: 1 }, time: lw, sweetness: sweet });
  const trio = [s(0.5, [1, 0.95, 0.8, 0.6]), s(0.45, [1, 0.5, 0.1, 0]), s(0.45, [1, 0.4, 0.05, 0])]; // total 1.4
  assert.ok(!scoreCombo(trio, ctx()).penalties.some((p) => p.rule === "sweetness"), "1.4 < 1.5 cap for three");
  assert.ok(scoreCombo(trio.slice(0, 2).map((p) => ({ ...p, sweetness: 0.7 })), ctx()).penalties.some((p) => p.rule === "sweetness"));
});

test("context: no filter drops the term; a filter scores it", () => {
  const a = tobaccoVanille();
  const b = limeBasil();
  assert.equal(scoreCombo([a, b], ctx()).terms.context, null);
  const withFilter = normalizeSettings({ ...DEFAULT_SETTINGS, context: { seasons: ["winter"], occasions: [], timeOfDay: [] } });
  assert.equal(scoreCombo([a, b], ctx(withFilter)).terms.context, 0.5);
});

test("greedy extension: only good pairs get a third scent, and only a weak accent adding a missing axis", () => {
  const tv = tobaccoVanille();
  const lb = limeBasil();
  const accent = profile({ accords: { rose: 0.9 }, time: [1, 0.5, 0.1, 0], projection: 1.5, longevity: 1.5 });
  const strongRose = profile({ accords: { rose: 0.9 }, time: [1, 0.5, 0.1, 0], projection: 5, longevity: 5 });
  const results = suggest({ base: tv, pool: [lb, accent, strongRose], ctx: ctx(), limit: 20 });
  const triples = results.filter((r) => r.fragranceIds.length === 3);
  assert.ok(triples.every((t) => !t.fragranceIds.includes(strongRose.fragranceId)), "a strong scent is never an accent");
  assert.ok(results.every((r) => r.fragranceIds.includes(tv.fragranceId)), "base mode always includes the base");
  assert.ok(results.every((r) => r.fragranceIds.length <= 3), "capped at 3 by default");
});

test("vibe slider round-trips and hits the framework defaults at its midpoint", () => {
  const mid = withVibe(DEFAULT_SETTINGS, 0.5);
  assert.equal(mid.interestCenter, 0.45);
  assert.equal(mid.weights.harmony, 0.35);
  assert.equal(vibeOf(withVibe(DEFAULT_SETTINGS, 0.8)), 0.8);
});

test("personalization: nothing moves before 3 ratings; 3 consistent lows make a hard-avoid", () => {
  const event = (rating: FeedbackEvent["rating"], i: number, tags: FeedbackEvent["tags"] = []): FeedbackEvent => ({
    id: `e${i}`,
    at: `2026-09-2${i}T00:00:00Z`,
    rating,
    tags,
    snapshot: { terms: { harmony: 0.6, structure: 0.5, interest: 0.5, context: null }, cells: [{ key: "fruity|leatherAnimalic", share: 0.4, affinity: -0.5 }], size: 2 },
  });
  const two = buildPersonalModel([event(1, 1, ["too-sweet"]), event(1, 2, ["too-sweet"])]);
  assert.deepEqual(two.hardAvoid, []);
  assert.equal(two.sweetnessCapDelta, 0);

  const three = buildPersonalModel([event(1, 1, ["too-sweet"]), event(1, 2, ["too-sweet"]), event(2, 3, ["too-sweet"])]);
  assert.deepEqual(three.hardAvoid, ["fruity|leatherAnimalic"]);
  assert.ok(three.sweetnessCapDelta < 0);
  assert.ok(applyPersonalModel(DEFAULT_SETTINGS, three).sweetnessCap < DEFAULT_SETTINGS.sweetnessCap);

  // A hard-avoided pairing is never suggested.
  const fruity = profile({ accords: { fruity: 1 }, time: [1, 0.5, 0.1, 0] });
  const leather = profile({ accords: { leatherAnimalic: 1 }, time: [1, 0.9, 0.7, 0.5] });
  const avoidCtx = buildEngineContext({ settings: DEFAULT_SETTINGS, personal: three });
  assert.equal(suggest({ base: leather, pool: [fruity], ctx: avoidCtx, limit: 5 }).length, 0);
});

test("personalization works with realistic, thinly-spread profiles (not just single-cell toys)", () => {
  // Ten-accord profiles like real ones: no single Harmony cell holds more than a few percent.
  const rich = (accords: Partial<AccordVector>) => profile({ accords, time: [1, 0.8, 0.5, 0.3] });
  const a = rich({ fruity: 1, dryWoods: 0.8, gourmand: 0.7, citrus: 0.7, leatherAnimalic: 0.6, smokeOud: 0.6, musk: 0.55, aquatic: 0.5, green: 0.45, creamyWoods: 0.4 });
  const b = rich({ rose: 1, musk: 0.9, fruity: 0.8, powderyIris: 0.7, citrus: 0.7, whiteFloral: 0.6, gourmand: 0.5, amberResin: 0.5, green: 0.4, aromatic: 0.3 });
  const combo = scoreCombo([a, b], ctx());
  assert.ok(combo.cells[0].share < 0.1, `top cell share is small in absolute terms (${combo.cells[0].share})`);

  const events: FeedbackEvent[] = [1, 2, 3].map((i) => ({
    id: `r${i}`,
    at: `2026-09-2${i}T00:00:00Z`,
    rating: 1,
    tags: [],
    snapshot: { terms: combo.terms, cells: combo.cells, size: 2 },
  }));
  const model = buildPersonalModel(events);
  assert.ok(Object.keys(model.matrixOverrides).length > 0, "consistent ratings tune the pairings the combo leaned on");
  assert.ok(model.hardAvoid.length > 0, "consistent 1-star ratings create hard-avoids");

  const avoidCtx = buildEngineContext({ settings: DEFAULT_SETTINGS, personal: model });
  assert.equal(suggest({ base: a, pool: [b], ctx: avoidCtx, limit: 5 }).length, 0, "the disliked combo is no longer suggested");
});

test("hand overrides win over estimates and are marked manual", () => {
  const p = profile({ accords: { citrus: 1 }, time: [1, 0.5, 0.1, 0] });
  const o = applyOverride(p, { longevity: 5, accords: { musk: 0.4 }, time: { h8: 0.3 } });
  assert.equal(o.longevity, 5);
  assert.equal(o.accords.musk, 0.4);
  assert.equal(o.accords.citrus, 1);
  assert.equal(o.sources.longevity, "manual");
  assert.ok(lateWeight(o) > lateWeight(p));
});

test("deriveProfile uses community votes when present and estimates otherwise", () => {
  const base: Fragrance & { id: number } = {
    id: 99, name: "Test", brand: "Test", url: "https://www.fragrantica.com/perfume/x/Test-99.html",
    notesTop: ["Bergamot"], notesMiddle: ["Lavender"], notesBase: ["Ambroxan", "Cedar"],
    accords: [{ name: "fresh spicy", strength: 100 }, { name: "amber", strength: 70 }, { name: "citrus", strength: 69 }, { name: "woody", strength: 50 }],
    rating: null, ratingCount: null, perfumer: null, description: null, imageUrl: null, scrapedAt: "2026-09-25T00:00:00Z",
    votes: {
      longevity: { "very weak": 534, weak: 939, moderate: 6700, "long lasting": 10500, eternal: 1800 },
      sillage: { intimate: 1300, moderate: 8300, strong: 9000, enormous: 1700 },
      seasons: { winter: 10300, spring: 15200, summer: 14100, fall: 14000 },
      timeOfDay: { day: 15000, night: 13700 },
    },
  };
  const voted = deriveProfile(base);
  assert.equal(voted.sources.longevity, "fragrantica-votes");
  assert.ok(voted.longevity > 3.5 && voted.longevity < 4, `longevity ${voted.longevity}`);
  assert.equal(voted.context.seasons.spring, 1);
  assert.equal(voted.molecules.ambroxan, 1);
  assert.ok(voted.accords.dryWoods > voted.accords.creamyWoods, "cedar note tips 'woody' toward dry");

  const estimated = deriveProfile({ ...base, votes: null });
  assert.equal(estimated.sources.longevity, "estimated");
  assert.equal(estimated.sources.seasons, "estimated");
});
