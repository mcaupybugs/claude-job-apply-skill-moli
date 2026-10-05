# Tailored resume + cover letter

One resume and one cover letter **per job**, never a generic one. Save to
`<ws>/applications/<Company>_<RoleShort>/` as `<Name>_Resume_<Company>_<RoleShort>` and
`<Name>_CoverLetter_<Company>`. Produce DOCX with a docx skill if one is available and also export a
PDF for uploading (ATS upload fields accept both; PDF preserves layout). Without a docx skill, write
clean Markdown and convert to PDF with whatever is available (`pandoc`, `soffice`), or ask.

## Resume tailoring

1. Start from the candidate's real resume — keep their phrasing where it's already good.
2. Read the JD: required skills, nice-to-haves, exact phrases, seniority signals, domain.
3. Edit only what improves the match:
   - a 1–2 line summary aimed at this role;
   - reorder bullets so the most relevant work is first in each role;
   - use the JD's exact term when the candidate has that skill under another name ("Kafka" vs "event streaming");
   - surface tools they've used but didn't list, **only if true**.
4. Keyword check (internal, don't show the number): matched JD keywords ÷ total JD keywords ≥ 70%.
   Below that, rework honestly; if it can't reach 70% without inventing, leave it and reflect it in the fit score.
5. Never add a skill, metric, title, or date that isn't real.

### Format by target market

| Market | Format |
|---|---|
| India (default) | 1–2 pages (3 only for 10+ YOE); skills block near the top; degrees with CGPA/%; GATE if any; notice period; CTC only if the candidate wants it; projects section if < 3 YOE |
| US / Canada | 1 page (2 if 10+ YOE); no photo, DOB, or marital status; strong JD-phrase mirroring |
| UK | ≤ 2 pages; "Personal statement"; British spelling |
| Germany | Photo + DOB + nationality are common; mention Blue Card eligibility if relevant |
| Netherlands | No photo; mention 30% ruling eligibility if relevant |
| UAE / Gulf | 2–3 pages; nationality + visa status; photo common |
| Australia | No photo; lead with key achievements |

ATS-safe layout everywhere: single column, standard headings, no tables/text boxes/icons/graphics for
content, real text (not images), standard fonts.

## Cover letter (≤ 250 words)

- Open with something specific to this company (a product, a recent launch/engineering post — quick
  web lookup), not "I am writing to express my interest…".
- Middle: 2–3 of the candidate's real achievements mapped to the JD's top requirements, with numbers they actually have.
- Close: availability (notice period), location/relocation, one line of genuine interest.
- Mirror 3–5 JD terms naturally.

## Sound like a person, not a model

Recruiters skim past text that reads machine-written. Before saving, scan and rewrite:
- Banned: spearheaded, leveraged, utilize, synergy, results-driven, dynamic, passionate about, proven
  track record, seamless(ly), cutting-edge, robust (unless literal), "in today's fast-paced world".
- No stacked adjectives ("scalable, innovative, high-performance platform").
- Vary bullet length and shape — not every line "Verb + metric + impact".
- Plain, concrete verbs: built, shipped, cut, moved, fixed, ran, owned.
- Keep the candidate's own voice and terms from their resume.
