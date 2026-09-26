# Fragrance Layering Algorithm — A Perfumer's Framework

Sep 22, 2026 · prepared for @Saud

## Why layering isn't just similarity-matching

A naive algorithm would recommend pairing scents that share the most notes. That produces boring, redundant combos — two vanilla-heavy orientals stacked on each other just make one loud, undifferentiated blob. Real layering, the kind perfumers and enthusiasts actually do, works because fragrances play **different roles** at once:

- **The anchor** — a base-heavy scent (woods, amber, musk) that provides depth and lasts on skin for hours.
- **The modifier** — a lighter, top- or heart-heavy scent (citrus, florals, spice) that adds character to the anchor's opening and dries down underneath it.
- **The bridge** — an accord the two share faintly, so the combination doesn't feel like two separate things fighting for attention.

Tom Ford's Tobacco Vanille worn under Jo Malone's Lime Basil & Mandarin is the textbook example: the mandarin brightens the vanilla's opening, the basil adds a green facet the tobacco lacks, and by hour three the citrus has faded, leaving the tobacco-vanilla base to finish the job. Neither scent is diminished — each fills a gap the other has.

So the algorithm's job isn't "find similar fragrances." It's **find fragrances that are structurally different enough to complete each other, but chemically compatible enough not to clash.** Everything below is built around that principle.

## The six-axis fragrance profile

Before any combo can be scored, every bottle in the collection needs a profile built from **how it actually smells and behaves**, not from the marketing copy on the box. Note pyramids are often written by a brand's marketing team months after the juice was finalized — half those "notes" aren't detectable in the formula at all. Profile from smelling strips, worn tests, and community consensus on true character, not the listed pyramid.

**1. Accord vector** — 15 axes scored 0–1 for how strongly each is present:

| Axis | Axis | Axis |
| --- | --- | --- |
| Citrus | White floral | Warm spice |
| Green | Rose | Fresh spice |
| Aromatic | Powdery / iris | Dry woods |
| Aquatic | Fruity | Creamy woods |
| — | Gourmand | Amber / resin, Musk, Leather / animalic, Smoke / oud |

**2. Time profile** — estimated intensity at 0h, 1h, 4h, and 8h. This is the single most important field. It tells you whether a scent is top-heavy (bright, fades fast — most citrus colognes) or base-heavy (quiet opening, still going at hour eight — most amber and oud compositions). Two top-heavy scents layered together vanish by lunch; two base-heavy scents turn into an undifferentiated fog.

**3. Strength** — projection and longevity, each 1–5. A powerhouse like Aventus needs a much smaller ratio than a skin-scent like Molecule 01.

**4. Sweetness (0–1) and temperature (−1 fresh to +1 warm)** — the two axes that most determine whether a pairing reads as balanced or as "too much."

**5. Loud-molecule flags** — heavy synthetic use of ambroxan, Iso E Super, ethyl maltol (cotton candy sweetness), calone (aquatic), cashmerene, or aldehydes. These are modern perfumery's most overused materials, and doubling one up between two scents is the single most common way an amateur layer goes from "interesting" to "headache."

**6. Context tags** — season, occasion, time of day, so the recommender can filter before it even scores.

## Harmony: the affinity matrix

This is where actual perfumery knowledge gets encoded into math. Define a 15×15 matrix **M**, one row/column per accord axis, where each cell holds how well two accords traditionally play together — a value from −1 (they fight) to +1 (they're a classic pairing). Harmony between two fragrance vectors A and B is:

```latex
Harmony(A, B) = A^T M B
```

The matrix isn't guesswork — it's decades of perfumery convention written down as numbers:

| Pairing | Value | Why |
| --- | --- | --- |
| Citrus × dry woods | +0.8 | Classic cologne structure since the 1800s — bergamot over vetiver or cedar never fails |
| Amber/resin × gourmand | +0.9 | Vanilla and amber share molecules; they blend almost seamlessly |
| Rose × smoke/oud | +0.8 | The Middle Eastern rose-oud pairing is centuries old for a reason — the smoke gives rose weight it lacks alone |
| Aromatic (lavender) × gourmand | +0.7 | Lavender-vanilla is the backbone of the fougère-gourmand crossover trend |
| Aquatic × gourmand | −0.6 | Marine calone and sugary gourmand notes read as chemically confused together — one wants to smell like the ocean, one like dessert |
| Fruity × leather/animalic | −0.5 | Sweet fruit over animalic skank usually just smells off, not intentional |
| Green × powdery/iris | +0.6 | Both are cool, restrained families that support rather than compete |

This matrix is genuinely the most valuable asset the whole system produces — it's the difference between an app that gives generic suggestions and one that gives suggestions a trained nose would actually agree with. It should start from perfumer-verified values like these and then adjust per-user from feedback (covered in the personalization section).

## Structure: anchor + modifier logic

Harmony alone isn't enough — two scents can share great accord chemistry and still layer badly if they have the same *shape* over time. This score rewards pairs where one fragrance is base-heavy (an anchor) and the other is top- or heart-heavy (a modifier).

Define lateWeight(X) as the share of a fragrance's total intensity that falls in the 4h–8h window (from its time profile). Structure score is:

```latex
Structure(A, B) = |\,lateWeight(A) - lateWeight(B)\,|
```

A high value means one scent is clearly the anchor and the other is clearly the modifier — good. A low value means either:

- **Both base-heavy** → they'll muddy each other into an undifferentiated warm blur by hour four, since both are trying to dominate the same time window.
- **Both top-heavy** → the combo is vivid for twenty minutes and then there's nothing left. You paid for two bottles to get one hour of scent.

This is exactly why a citrus cologne over an amber base works, and two amber bases layered together doesn't: the citrus has already handed off before the ambers would collide.

## Interest: the Goldilocks curve

Distance between two accord vectors, measured as cosine distance d, tells you how different two scents are. Naively you might think "more different = more interesting," but that's wrong at both ends:

- **d near 0** (near-identical scents) → redundant. Layering two similar amber woods just makes one slightly-louder amber wood. No new character is added.
- **d near 1** (near-opposite scents) → clash. A heavy gourmand and a sharp aquatic rarely resolve into something coherent; they just sit next to each other unpleasantly.
- **d around 0.4–0.5** → the sweet spot, where the two scents are different enough to each contribute something, but close enough in character that the blend reads as intentional rather than accidental.

Model this as a bell curve centered on that sweet spot:

```latex
Interest(A, B) = \exp\left(-\frac{(d - 0.45)^2}{2 \times 0.02}\right)
```

This is the axis that keeps the algorithm from just recommending "safe" pairs of nearly-identical scents forever — it actively rewards combinations that add a new facet, the way a green, herbal Jo Malone brightens a heavy oriental instead of just reinforcing it.

## Context matching and penalties

**Context** is the simplest term — a 0–1 match score against whatever filter the user has active (season, occasion, time of day) using each fragrance's context tags. No perfumery subtlety needed here, just filtering.

**Penalties** are where the algorithm encodes the mistakes that actually ruin layers in practice, subtracted from the total score:

| Rule | Trigger | Why it matters |
| --- | --- | --- |
| Sweetness cap | Combined sweetness > 1.2 | Past this point blends read as cloying or candy-like rather than balanced |
| Molecule clash | Both scents flagged for the same loud synthetic (ambroxan, Iso E Super, ethyl maltol, calone) | Doubling these specific materials is the #1 cause of headache-inducing, synthetic-smelling combos — they're already overdosed in modern perfumery individually |
| Clash list | Pair appears on a curated list of known-bad combinations | Some clashes are idiosyncratic rather than formulaic (e.g. two "clean" musks that were built to smell similar but slightly off-key together) and are easier to hand-enter than model |
| Strength mismatch | Difference in strength rating > 2 | A powerhouse and a skin-scent layered 1:1 just means the skin-scent disappears entirely — not really a "layer" at all, just a waste of the weaker bottle |

Penalties should be subtracted hard enough to push a pair out of the top recommendations, but not so hard they make the pair impossible to suggest — sometimes a user genuinely wants a strength-mismatched pair because they intend to spray more of the weaker one (which the recipe step below solves properly).

## The full formula

```latex
score(A,B) = 0.35 \cdot Harmony + 0.25 \cdot Structure + 0.20 \cdot Interest + 0.20 \cdot Context - Penalties
```

The weights aren't arbitrary — they follow the order a perfumer actually checks things in:

- **Harmony gets the largest weight (0.35)** because it's the foundation. If two accord families genuinely clash, nothing else about the pair matters — a perfectly-timed, perfectly-novel combination of two scents that smell bad together is still a bad combination.
- **Structure is second (0.25)** because even harmonious accords need the right time-based roles, or the blend collapses into mud or thin air. This is the step most amateur layering guides skip entirely, and it's the one that separates "smells fine" from "smells intentional."
- **Interest and Context share the remaining weight (0.20 each)** because they're refinement, not foundation — a combo can be harmonious and well-structured but still boring (low interest) or wrong for the moment (low context), and either flaw should nudge the ranking down without overriding real compatibility.

Run this over every pair in the collection, sort descending, and the top results are the recommendations. For a collection of even 200 bottles that's under 20,000 pairs — trivial to compute in full rather than sampling.

## From score to recipe

A score tells you two fragrances *could* layer well. A recipe tells the user how to actually do it, which is what makes the output usable rather than academic.

**Spray ratio** — scale inversely to strength, so the weaker scent doesn't get drowned out. A strength-5 powerhouse next to a strength-2 skin-scent might come out as 1 spray of the powerhouse to 3 of the delicate one.

**Application order and placement** — the anchor goes on skin first, closest to the body, since it needs skin warmth to develop over hours. The modifier goes on top of it, or onto clothing/hair if it's especially delicate and would otherwise get overpowered by direct skin contact with the anchor.

**Predicted blend description** — take a spray-weighted sum of the two accord vectors and translate the dominant axes into plain language, the way a perfumer would describe a blend rather than just listing its notes: *"smoky vanilla with a lime-basil opening that settles into warm tobacco by the afternoon."* This matters because most users can't read a note list and imagine the result — they need the sentence a perfumer would say after actually smelling it.

## Extending to triples, and personalizing over time

**Triples** — don't score every three-way combination from scratch; that's combinatorially wasteful and most triples fail anyway. Instead, only extend pairs that already scored well. The third scent must have low strength (it's a whisper, not a third anchor) and should add an accord axis the pair is missing entirely, rather than reinforcing one that's already there. Apply stricter penalty thresholds here — three-way layering fails far more often than two, because there are three pairwise relationships that all need to work, not just one.

**Personalization** — the affinity matrix M and the four weights should start from perfumer-verified defaults, then adjust per user. A simple approach: whenever a user rates a suggested combo, nudge the relevant cell(s) of their personal copy of M slightly toward or away from that rating using an exponential moving average, so recent feedback matters more than old feedback but nothing swings wildly on a single data point. If someone consistently rates iris-leather combos highly, that specific cell rises for them specifically — the system gets more personal and more accurate the more it's used, without ever needing to touch the shared, perfumer-vetted baseline other users see.

## Practical notes and honest caveats

**The real risk isn't the math, it's the data.** Every formula above is only as good as the accord vectors and time profiles behind it. Bad input data — accord scores lifted uncritically from marketing note pyramids instead of how things actually smell — will produce confidently wrong recommendations no matter how sound the scoring logic is. Budget real time (or real perfumer input) for building the initial profile set, and don't scrape Fragrantica or similar community sites for this — it's both a legal problem and a quality problem, since crowd-sourced notes inherit all the same marketing-copy bias.

**Skin chemistry isn't modeled here, and it shouldn't be ignored.** The same combo can read differently on dry versus oily skin, or in humid versus dry climates. Treat every recommendation as a strong starting hypothesis to test, not a guarantee — the algorithm should always tell the user to do a skin test before committing to a combo for a big occasion.

**This is a discovery tool, not a replacement for a trained nose.** It will surface combinations a user might never have tried, and it will correctly rule out combinations that are almost always bad. But perfumery has genuine outliers — pairings that shouldn't work on paper and do, because of how two specific formulas' actual synthetic bases interact. No accord-level model catches those; only testing does.

## Customizable parameters

Every number introduced above is a knob, not a constant. Here's the full set, and what each one actually does to the output when turned:

| Parameter | Default | Turning it up | Turning it down |
| --- | --- | --- | --- |
| Harmony weight | 0.35 | Safer, more conventionally "correct" pairings; fewer surprises | More experimental suggestions, higher risk of genuine clashes |
| Structure weight | 0.25 | Stronger preference for clear anchor/modifier pairs over same-shape pairs | More same-shape pairs slip through (both light, or both heavy) |
| Interest weight | 0.20 | Pushes toward bolder, more distinct combos | Pushes toward closer, more textural/reinforcing combos |
| Context weight | 0.20 | Suggestions stay tightly inside season/occasion filters | Suggestions ignore filters more, prioritizing pure scent chemistry |
| Interest curve center (default 0.45) | 0.45 | Raising it (e.g. 0.6) favors bolder, more contrasting pairings | Lowering it (e.g. 0.3) favors closer, more harmonious-leaning pairings |
| Interest curve width (default 0.02) | 0.02 | Widening it broadens what counts as "interesting," more variety in results | Narrowing it makes the sweet spot stricter, fewer results pass |
| Sweetness cap | 1.2 | Raising it allows sweeter, more gourmand-leaning combos through | Lowering it filters out anything that risks reading as cloying |
| Strength mismatch threshold | 2 (on a 1–5 scale) | Raising it allows powerhouse + skin-scent pairs (relying on the spray-ratio fix) | Lowering it enforces closer-matched projection between the two scents |
| Loud-molecule flag list | ambroxan, Iso E Super, ethyl maltol, calone, cashmeran, aldehydes | Adding materials makes the penalty stricter and catches more modern-synthetic clashes | Trimming it loosens the filter — useful for vintage-heavy collections where these materials are rare |
| Clash list | curated, hand-entered | Growing it (from user reports) catches more idiosyncratic bad pairs over time | N/A — this list only grows |
| Minimum score threshold | app-defined | Raising it shows only the most confident suggestions, fewer results | Lowering it surfaces more combos, including riskier ones |
| Triples extension threshold | top-N pair score | Raising it means only the very best pairs get a third scent suggested | Lowering it offers triples more liberally, with more risk of failure |

The two most impactful for a user-facing "vibe" setting are the **Interest curve center** and the **Harmony weight** — together they're effectively a single "safe ↔ adventurous" slider, which is a natural one to expose directly in an app rather than making users understand the underlying math.

## The full data schema per fragrance

Everything a single fragrance record needs, grouped by category. The scoring engine only touches the middle three groups (Accord, Time, Character); the rest exists for filtering, display, and the personal-collection features an app needs beyond pure scoring.

**Identity**

- Name, house/brand
- Concentration (EDC / EDT / EDP / Parfum / Extrait)
- Release year, and flanker/original relationship if relevant
- Price tier (budget / mid-range / luxury / niche) and approximate cost-per-ml, for dupe-and-alternative logic
- Formulation note — reformulation year if known (IFRA restrictions have measurably changed many classics; a 2005 bottle and a 2024 bottle of the same name can smell different)

**Accord vector** (0–1 each) citrus, green, aromatic, aquatic, white floral, rose, powdery/iris, fruity, gourmand, warm spice, fresh spice, dry woods, creamy woods, amber/resin, musk, leather/animalic, smoke/oud

**Time profile**

- Intensity at 0h, 1h, 4h, 8h (add 12h for known powerhouses/orientals where it matters)
- Derived: lateWeight (used directly by the Structure score)

**Character**

- Projection (1–5), Longevity (1–5)
- Sweetness (0–1), Temperature (−1 to +1)
- Loud-molecule flags: ambroxan, Iso E Super, ethyl maltol, calone, cashmeran, aldehydes (boolean or 0–1 intensity each)

**Context tags**

- Season(s): spring, summer, fall, winter (can hold more than one)
- Occasion: office, casual, date night, formal/event, sport/gym
- Time of day: day, night, versatile
- Formality level (0–1)

**Personal / collection data** (per user, not per fragrance globally)

- Owned bottle size and fill level
- Purchase or open date (juice degrades — a bottle opened three years ago performs differently than a fresh one)
- User's own rating of the fragrance solo
- Times worn, last worn date
- Free-text personal notes ("runs sweeter on me than reviews suggest," etc.) — valuable signal, covered in the feedback section next

Of all of these, **accord vector and time profile are the two fields worth spending the most effort getting right** — they drive Harmony, Structure, and Interest, which is three-quarters of the score. Everything else is comparatively cheap to source and mostly affects filtering rather than the core match quality.

## How feedback improves future suggestions

When a user tries a suggested combo, capture two things: a simple rating (thumbs up/down or 1–5), and — this matters more than the rating alone — a short set of reason tags: too sweet, faded fast, overpowering, smelled muddled, loved it, wrong for the occasion. The tags tell the system *which term in the formula* was wrong, not just that something was wrong.

That feedback should update **two separate layers**, because a bad rating can mean two different things:

**Layer 1 — the user's personal preference layer.** This is the personalized copy of the affinity matrix M and the four weights described earlier. A rating nudges the specific matrix cell(s) involved using an exponential moving average, so recent feedback counts more but no single rating swings things wildly:

- "Loved it" on a high-Interest, lower-Harmony pair → nudge that user's Interest weight up slightly, since it signals they like bold contrast more than the default assumes.
- "Too sweet" → tighten that user's personal sweetness cap below the 1.2 default.
- "Overpowering" → lower that user's strength-mismatch tolerance.
- Consistent low ratings on a specific accord-pair cell, regardless of context → treat it as a personal hard-avoid, skip scoring it at all rather than just penalizing it.

Require a minimum sample (roughly 3–5 relevant ratings) before moving a user's parameters meaningfully — a single bad experience shouldn't overfit the whole model, since a bad result can come from an off day, wrong dose, or a bottle problem rather than the pairing itself.

**Layer 2 — the shared fragrance-profile correction layer.** Sometimes negative feedback means the *fragrance's own profile data was wrong*, not that the matching logic failed. If many different users independently report a fragrance runs sweeter, weaker, or woodier than its stored profile suggests, that's a signal to revise the accord vector or time profile itself — the same kind of correction a perfumer would make after re-testing a scent on different skin. This layer improves the dataset for every user, not just the one who reported it, and is what keeps the whole system from drifting away from reality as it scales past its original hand-built profiles.

Between the two: personal-layer updates should happen fast and per-user; shared-profile updates should require a higher bar (multiple independent reports agreeing) before touching data everyone relies on.

## Handling combos of three or more scents

The Harmony/Structure/Interest math above is defined pairwise, but it generalizes once the anchor/modifier idea is generalized into full **roles**.

**Assign roles instead of adding more of the same.** A five-scent combo isn't five anchors or five modifiers — real multi-layer wear breaks down into one anchor, one primary modifier, and one or more accents. An accent is a single-facet, low-strength scent worn only to add or brighten one accord the anchor+modifier pair doesn't already cover — a single spray of a green herbal cologne to lift a heavy amber-vanilla pairing, for instance. Enforcing this role structure, rather than scoring every member against every other member with no hierarchy, is what keeps larger combos from turning into noise.

**Generalize Harmony as an average, not a sum.** For a set S, average the pairwise Harmony across every pair in the set:

```latex
Harmony(S) = \frac{1}{|pairs|}\sum_{(i,j) \in S,\ i<j} A_i^T M A_j
```

Averaging keeps the score on the same scale regardless of set size, so a triple isn't automatically penalized just for having more pairwise relationships to satisfy.

**Generalize Structure as a role check, not a difference.** Instead of measuring the gap between two lateWeight values, require exactly one member above a "base-heavy" threshold (the anchor) and every other member below a "not-competing" threshold (modifier and accents). Two members both qualifying as anchors should hard-fail Structure for the whole set — the multi-scent version of "two ambers layered together turn to mud."

**Tighten penalties cumulatively.** Sweetness, molecule flags, and strength don't stay capped at the pairwise thresholds once more scents join. Combined sweetness across all N members should tighten as N grows — roughly 1.2 + 0.3 × (N − 2) rather than a flat 1.2 — since sweetness stacks additively in a way Harmony doesn't.

**Extend greedily, never search exhaustively.** For a 200-bottle collection, scoring every pair (\~20,000) is trivial, but scoring every possible foursome (in the billions) isn't. The only practical approach is greedy extension: take the best-scoring pairs, test candidate accents against the pair's combined accord vector one at a time, and only accept an additional member if the resulting set already clears a bar — and raise that bar with each addition (a pair might need score > 0.6 to extend, a triple > 0.75 to extend again). Failure risk compounds with every scent added, so the acceptance bar should too.

**Be honest about the practical ceiling.** Working perfumers who layer rarely stack more than two or three scents at once, for exactly the reason this algorithm gets stricter as N grows — every added scent multiplies the pairwise relationships that all have to work simultaneously, while the marginal interest gained from a fourth or fifth scent is usually small. I'd default an app to capping suggested combos at three, with four available only as an advanced or experimental mode rather than a default recommendation.

**The recipe step generalizes cleanly.** Application order is just role order: anchor on skin first, primary modifier next, then each accent as a single light spray — usually on clothing or hair rather than skin — applied last so its brightness sits on top instead of competing with the anchor's base notes for skin real estate.
