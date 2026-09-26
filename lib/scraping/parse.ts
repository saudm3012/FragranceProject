// Parses a Fragrantica perfume page's rendered HTML (as returned by
// fetchPage()) into a structured Fragrance record.
//
// Selectors below were reverse-engineered from two real fetched pages (a
// low-vote 2026 release and Creed Aventus, a long-established bestseller)
// rather than guessed - see lib/schemas.ts for the target shape. Things
// worth knowing for anyone touching this file:
//   - The page is Vue-driven; several widgets hydrate client-side after
//     initial load. On the simpler page the notes pyramid rendered fine; on
//     the much larger Aventus page (lots of related articles/comments) it
//     never appeared at all in the captured HTML - looks lazy-loaded or
//     just slow under page weight, not something a longer fixed wait
//     reliably fixes. Notes are extracted primarily from the description's
//     templated "Top notes are X; middle notes are Y; base notes are Z"
//     sentence instead, which was present and consistent on both pages;
//     the DOM pyramid is kept only as a fallback when that regex fails.
//   - The perfumer credit sentence has (at least) two templates: "The nose
//     behind this fragrance is X." (single perfumer) and "X was created by
//     A and B." (multiple perfumers) - both are tried.
//   - The community vote widgets (longevity, sillage, when-to-wear) only
//     exist after the page's own JS renders them - the server HTML has just
//     placeholders like <seasons-rating-new>. fetchPage() waits for them;
//     parseVotes() reads them. Low-vote fragrances may still come back with
//     no votes - those fields are legitimately null, not a parsing bug.
//   - The rating comes from schema.org microdata (itemprop ratingValue /
//     ratingCount), not from the visible "Rating" card - see parseRating().

import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { Accord, CommunityVotes, Fragrance, VoteCounts } from "@/lib/schemas";

function textOf(el: cheerio.Cheerio<AnyNode>): string | null {
  // Collapse internal whitespace too - some names render across lines
  // ("Rose 01 Swiss Arabian\n    for women and men").
  const t = el.first().text().replace(/\s+/g, " ").trim();
  return t.length > 0 ? t : null;
}

// --- Community votes -------------------------------------------------------
// Each widget is a label (e.g. "LONGEVITY") followed by option rows, each an
// option label span next to a count span ("534", "6.7k"). Options are
// matched by exact text, so "weak" never matches "very weak".

export const VOTE_OPTIONS = {
  longevity: ["very weak", "weak", "moderate", "long lasting", "eternal"],
  sillage: ["intimate", "moderate", "strong", "enormous"],
  seasons: ["winter", "spring", "summer", "fall"],
  timeOfDay: ["day", "night"],
} as const;

function parseCount(text: string): number | null {
  const m = text.trim().toLowerCase().match(/^([\d.,]+)\s*([km]?)$/);
  if (!m) return null;
  const base = parseFloat(m[1].replace(/,/g, ""));
  const scale = m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1;
  return Number.isFinite(base) ? Math.round(base * scale) : null;
}

function spansWithText($: cheerio.CheerioAPI, scope: cheerio.Cheerio<AnyNode>, text: string) {
  return scope.find("span").filter((_, el) => $(el).text().trim().toLowerCase() === text);
}

/** The vote count displayed next to an option label: the first count-looking span in its nearest enclosing row. */
function countNear($: cheerio.CheerioAPI, optionSpan: cheerio.Cheerio<AnyNode>): number | null {
  let scope = optionSpan.parent();
  for (let depth = 0; depth < 3 && scope.length; depth++) {
    for (const el of scope.find("span").toArray()) {
      if (el === optionSpan.get(0)) continue;
      const n = parseCount($(el).text());
      if (n !== null) return n;
    }
    scope = scope.parent();
  }
  return null;
}

function parseVoteGroup(
  $: cheerio.CheerioAPI,
  label: string,
  options: readonly string[]
): VoteCounts | null {
  const labelSpan = $("span").filter((_, el) => $(el).text().trim().toLowerCase() === label).first();
  if (!labelSpan.length) return null;

  // Climb to the smallest ancestor holding every option for this widget.
  let scope = labelSpan.parent();
  while (scope.length && !options.every((o) => spansWithText($, scope, o).length > 0)) {
    scope = scope.parent();
  }
  if (!scope.length) return null;

  const counts: VoteCounts = {};
  for (const option of options) {
    const count = countNear($, spansWithText($, scope, option).first());
    if (count === null) return null;
    counts[option] = count;
  }
  return Object.values(counts).some((n) => n > 0) ? counts : null;
}

function parseVotes($: cheerio.CheerioAPI): CommunityVotes | null {
  const votes: CommunityVotes = {
    longevity: parseVoteGroup($, "longevity", VOTE_OPTIONS.longevity),
    sillage: parseVoteGroup($, "sillage", VOTE_OPTIONS.sillage),
    seasons: parseVoteGroup($, "when to wear", VOTE_OPTIONS.seasons),
    timeOfDay: parseVoteGroup($, "when to wear", VOTE_OPTIONS.timeOfDay),
  };
  return Object.values(votes).some((v) => v !== null) ? votes : null;
}

function parseAccords($: cheerio.CheerioAPI): Accord[] {
  const accords: Accord[] = [];
  const heading = $("h6").filter((_, el) => /main accords/i.test($(el).text()));
  const container = heading.first().next();
  container.find("span.truncate").each((_, span) => {
    const name = $(span).text().trim();
    const bar = $(span).closest("div[style]");
    const style = bar.attr("style") ?? "";
    const match = style.match(/width:\s*([\d.]+)%/);
    const strength = match ? parseFloat(match[1]) : 0;
    if (name) accords.push({ name, strength });
  });
  return accords;
}

function parseNotesPyramid($: cheerio.CheerioAPI): {
  notesTop: string[];
  notesMiddle: string[];
  notesBase: string[];
} {
  const headings = $("h4").filter((_, el) => /^(top|middle|base)\s+notes$/i.test($(el).text().trim()));
  const containers = $(".pyramid-level-container");

  const byLevel: Record<"top" | "middle" | "base", string[]> = {
    top: [],
    middle: [],
    base: [],
  };

  headings.each((i, headingEl) => {
    const label = $(headingEl).text().trim().toLowerCase();
    const level = label.startsWith("top") ? "top" : label.startsWith("middle") ? "middle" : "base";
    const container = containers.eq(i); // headings and containers appear in the same top->middle->base order
    container.find(".pyramid-note-label").each((_, labelEl) => {
      const noteName = $(labelEl).text().trim();
      if (noteName) byLevel[level].push(noteName);
    });
  });

  return { notesTop: byLevel.top, notesMiddle: byLevel.middle, notesBase: byLevel.base };
}

function parseDescription($: cheerio.CheerioAPI): string | null {
  // The description block's first <p> is the factual summary; a following
  // .fragrantica-blockquote (brand/region lore) is not part of it.
  const p = $("[itemprop=description]").first().find("> p").first();
  return textOf(p);
}

/** Splits a Fragrantica-style note list ("A, B, C and D") into ["A","B","C","D"]. */
function splitNoteList(text: string): string[] {
  return text
    .split(/,| and /i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseNotesFromDescription(description: string | null): {
  notesTop: string[];
  notesMiddle: string[];
  notesBase: string[];
} | null {
  if (!description) return null;
  const match = description.match(
    /top notes are ([\s\S]+?);\s*middle notes are ([\s\S]+?);\s*base notes are ([\s\S]+?)\./i
  );
  if (!match) return null;
  return {
    notesTop: splitNoteList(match[1]),
    notesMiddle: splitNoteList(match[2]),
    notesBase: splitNoteList(match[3]),
  };
}

function parsePerfumer(description: string | null): string | null {
  if (!description) return null;
  // Perfumer names can contain periods themselves (e.g. middle-initial
  // abbreviations like "Renier R. Mendez"), so a plain "up to the next
  // period" match cuts names short. Anchor on the "Top/Middle/Base notes
  // are" sentence that reliably follows the perfumer credit instead.
  const noteAnchor = /\.\s+(?:Top notes|Middle notes|Base notes|Notes) are/i;

  const singleNose = description.match(new RegExp(`nose behind this fragrance is ([\\s\\S]+?)${noteAnchor.source}`, "i"));
  if (singleNose) return singleNose[1].trim();

  // "{name} was created by A and B." (one or more perfumers)
  const createdBy = description.match(new RegExp(`was created by ([\\s\\S]+?)${noteAnchor.source}`, "i"));
  if (createdBy) return createdBy[1].trim();

  const fallback = description.match(/nose behind this fragrance is ([^.]+)\./i);
  return fallback ? fallback[1].trim() : null;
}

/**
 * Rating from the page's schema.org microdata (itemprop ratingValue /
 * ratingCount, e.g. "3.85" from "34,333" votes). Not the "Rating" card -
 * that's a love/like/ok/dislike/hate vote breakdown, and reading digits out
 * of it produced nonsense like 1.00 (the "1" of "13.2k").
 */
function parseRating($: cheerio.CheerioAPI): { rating: number | null; ratingCount: number | null } {
  const read = (prop: string) => {
    const el = $(`[itemprop=${prop}]`).first();
    const raw = (el.attr("content") ?? el.text()).replace(/,/g, "").trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  };
  const count = read("ratingCount");
  return { rating: read("ratingValue"), ratingCount: count === null ? null : Math.round(count) };
}

export function parseFragrancePage(html: string, url: string): Omit<Fragrance, "id"> {
  const $ = cheerio.load(html);

  const name = textOf($("h1[itemprop=name]")) ?? "";
  const brand = textOf($("[itemprop=brand] [itemprop=name]")) ?? "";
  const imageUrl = $("img[itemprop=image]").first().attr("src") ?? null;
  const description = parseDescription($);
  const { notesTop, notesMiddle, notesBase } = parseNotesFromDescription(description) ?? parseNotesPyramid($);
  const accords = parseAccords($);
  const { rating, ratingCount } = parseRating($);
  const votes = parseVotes($);
  const perfumer = parsePerfumer(description);

  return {
    name,
    brand,
    url,
    notesTop,
    notesMiddle,
    notesBase,
    accords,
    rating,
    ratingCount,
    votes,
    perfumer,
    description,
    imageUrl,
    scrapedAt: new Date().toISOString(),
  };
}
