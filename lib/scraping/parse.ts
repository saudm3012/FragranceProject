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
//   - Rating / Longevity / Sillage vote widgets are frequently EMPTY for
//     fragrances with too few community votes (confirmed on the low-vote
//     sample) - treat all of those fields as legitimately optional, not a
//     parsing bug when they come back null.
//   - Fragrantica uses no stable "rating value" class we could confirm live;
//     that extraction is regex-based best-effort over whatever text is
//     present and may need revisiting against a page with an actual rating.

import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { Accord, Fragrance } from "@/lib/schemas";

function textOf(el: cheerio.Cheerio<AnyNode>): string | null {
  const t = el.first().text().trim();
  return t.length > 0 ? t : null;
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

function parseRatingCard($: cheerio.CheerioAPI, labelText: RegExp): string | null {
  const label = $(".tw-rating-card-label").filter((_, el) => labelText.test($(el).text()));
  const card = label.first().closest(".tw-rating-card");
  const bodyText = card.find(".p-2").first().text().trim();
  return bodyText.length > 0 ? bodyText : null;
}

function parseRating($: cheerio.CheerioAPI): { rating: number | null; ratingCount: number | null } {
  const raw = parseRatingCard($, /^rating$/i);
  if (!raw) return { rating: null, ratingCount: null };
  const ratingMatch = raw.match(/(\d(?:\.\d+)?)/);
  const countMatch = raw.match(/([\d,]+)\s*(votes|ratings)/i);
  return {
    rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
    ratingCount: countMatch ? parseInt(countMatch[1].replace(/,/g, ""), 10) : null,
  };
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
  const longevity = parseRatingCard($, /^longevity$/i);
  const sillage = parseRatingCard($, /^sillage$/i);
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
    longevity,
    sillage,
    perfumer,
    description,
    imageUrl,
    scrapedAt: new Date().toISOString(),
  };
}
