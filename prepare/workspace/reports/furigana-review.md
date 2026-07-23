# Output furigana review

This review is based on the generated JSON in `web/public/data/`, not on the dictionary or the raw subtitle source. The reviewed output was checked as the reader will render it: visible Japanese text paired with each generated ruby segment.

## Corrections recorded

- `wolf-01-0012`: `下[か]` → `下[した]`
- `wolf-01-0017`: `20代[だい]` → `20代[にじゅうだい]`, `方[ほう]` → `方[かた]`
- `wolf-03-0016`: `４人[にん]` → `４人[よにん]`
- `wolf-03-0017`: `４人[にん]` → `４人[よにん]`
- `wolf-03-0024`: `２人[にん]` → `２人[ふたり]`
- `wolf-03-0030`: `皿[さら] 好[す]き` → `皿好き[さらずき]`

These corrections are stored in `manual-overrides/furigana.json` and are applied after generation. Further output review should continue episode by episode, especially around counters, names, compounds, and rendaku.
