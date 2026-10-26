# Recipes: what the table should become

Seven of twelve public files needed a reshape: rows dropped, a column per
series, a column of numbers named as the groups. **Never write a reshaped copy of
the user's data yourself.** Write a recipe. The script does the arithmetic with
the studio's own Shape-tab steps (`transform.js`, through `js/studio/recipe.js`)
and prints a `Step` line for each, saying what it did and how many rows went in
and out:

```bash
choose.mjs --recipe '{"chart":"line-multi","steps":[{"pivot":"source","rows":"year","value":"mean"}]}' data.csv
```

With the MCP tool `build_chart` the recipe is an object, so there is nothing to
quote.

A recipe is one JSON object, or a file holding one. Every key is optional except
`chart` for `build_chart`:

- `chart`: the chart to draw, as `--chart`.
- `skip`, `header`, `swap`: as the flags.
- `steps`: run in order, each naming the columns as they stand at that point.
  - `{"filter": "Source", "is": "GCAG"}`, or `not`, `contains`, `gt`, `lt`,
    `"between": [1950, 2000]`, `"filled": true` (not blank).
  - `{"group": "region", "agg": "sum"}`: one row per region. `agg` is `sum`,
    `mean`, `median`, `min`, `max` or `count`; `"values": [...]` names the
    columns to fold.
  - `{"split": "genres", "sep": ";"}`: one row per value in a cell that lists
    several. The other columns are copied, so a total of one counts a row once
    per value; `sep` is required.
  - `{"bin": "age", "bins": 10}`, `{"sort": "year", "dir": "desc"}`,
    `{"limit": 10}`, `{"transpose": true}`.
  - `{"pivot": "source", "rows": "year", "value": "mean"}`: one column per
    source, one row per year. Where a year and a source meet in two rows it
    fails. Add `"agg"` only if the user wants them combined, and say so.
- `columns`: keep these, in this order, after the steps.
- `roles`: `{"group": "day_of_week", "value": "births"}` names the groups for
  a distribution chart (box plot, violin, …) whose groups are numbers.
- `facet`: one panel per value of this column (small multiples).

The `Note` and `!` lines print a recipe to run, or a step to add to a recipe's
`steps`. Run it as printed, then read the new `holds:` line. A recipe that names
a missing column fails, naming the columns there are.
