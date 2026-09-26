// Ranks affinity-matrix cells by how much they actually matter: across every
// pair of the given fragrances, how much accord mass lands in each cell.
// Bench-test the top of this list first; the long tail can stay near-neutral
// until real wear feedback fills it in.
//
//   npm run affinity:usage                 # every stored fragrance with accords
//   npm run affinity:usage -- 1 4 6 10     # just these ids (e.g. a collection)
//   npm run affinity:usage -- --top 40     # show more rows

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const args = process.argv.slice(2);
  const topIdx = args.indexOf("--top");
  const top = topIdx >= 0 ? Number(args[topIdx + 1]) : 25;
  const ids = args.filter((a, i) => i !== topIdx && i !== topIdx + 1).map(Number).filter(Number.isInteger);

  const repo = await import("../lib/fragranceRepository");
  const { deriveProfile } = await import("../lib/intelliscent/derive/deriveProfile");
  const { harmonyPair } = await import("../lib/intelliscent/engine/terms");
  const { AFFINITY_TIER, DEFAULT_AFFINITY } = await import("../lib/intelliscent/affinity");

  const fragrances = (ids.length ? await repo.getByIds(ids) : await repo.listAll()).filter(
    (f): f is typeof f & { id: number } => f.id != null && f.accords.length > 0
  );
  const profiles = fragrances.map((f) => deriveProfile(f));

  const usage = new Map<string, number>();
  let pairs = 0;
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      pairs++;
      for (const [key, share] of harmonyPair(profiles[i], profiles[j], DEFAULT_AFFINITY).cellWeights) {
        usage.set(key, (usage.get(key) ?? 0) + share);
      }
    }
  }
  if (pairs === 0) {
    console.log("Need at least 2 fragrances with accord data.");
    process.exit(0);
  }

  const ranked = [...usage.entries()].sort((a, b) => b[1] - a[1]);
  let cumulative = 0;
  console.log(`${fragrances.length} fragrances, ${pairs} pairs. Share = average fraction of a pair's accord mass in that cell.\n`);
  console.log("rank  cell                               share   cum.   value  tier");
  ranked.slice(0, top).forEach(([key, total], i) => {
    const share = total / pairs;
    cumulative += share;
    console.log(
      `${String(i + 1).padStart(4)}  ${key.padEnd(34)} ${(share * 100).toFixed(1).padStart(5)}% ${(cumulative * 100).toFixed(0).padStart(5)}%  ${(DEFAULT_AFFINITY[key] ?? 0).toFixed(2).padStart(5)}  ${AFFINITY_TIER[key] ?? "unset"}`
    );
  });
  const drafts = ranked.slice(0, top).filter(([key]) => (AFFINITY_TIER[key] ?? "unset") === "draft" || !(key in AFFINITY_TIER));
  console.log(`\n${drafts.length} of the top ${top} are unverified drafts or unset - bench-test those first.`);
  process.exit(0);
}

main();
