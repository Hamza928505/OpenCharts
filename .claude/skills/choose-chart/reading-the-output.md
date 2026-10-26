# Reading what the script prints

The rules see a table, not what a chart makes of it, so the script also prints
what each chart actually holds. Act on every line below before handing anything
over. With `--json` the `!` lines are `warnings` and the `Note` lines are `notes`,
per chart.

## The table

**Check the `Header row` and `Columns` lines, and act on every `Note (bad)`
before choosing.**

- Columns came out as `Label, Series 1, …` while the first row holds names or
  years (`label,2023,2024`): rerun with `--header`.
- The user's rows are the things and the columns are periods, and they want a
  line per thing: rerun with `--swap`.
- A `Note` says years, quarters or months run across and each row is a thing:
  that is the line above, so `--swap` (or `{"transpose": true}` in a recipe),
  after keeping only the rows to compare if there are more than a dozen.
- A `Note (warn)` says a column holds several values in one cell (`Action; Comedy`):
  add the `{"split": "<column>", "sep": ";"}` step it prints before grouping or
  counting it. A total of any other column then counts a row once per value.
- A `Note (warn)` says a measure is the same on every row sharing another column,
  and a view carries a `!` or a `warning` saying its total or average repeats it:
  group by that column and take the average first, then total. Do not report the
  repeated total as the answer.
- Only one row and the input is JSON: the rows sit inside another object (the
  World Bank API answers `[metadata, rows]`). Save just the array of rows and run
  again.
- A note says the first rows hold no numbers: look at them. A title, a unit, a
  source and a release date are notes (an ONS download opens with eight), so
  rerun with the `--skip` it suggests. Data rows with blanks are not notes; try
  `--header` instead.

## Each suggestion's `holds:` line

It is the table the chart holds once it has read the data, in the chart's own
column names (`label`, `group, x, y`), with its first row. Compare it with the
`why` above it. Then act on every `!` line:

- `the reason is about "x"…`: the chart took other columns. Rerun
  `--chart <id> --columns …` with the columns in the order that chart's `Reads:`
  line lists them. A grouped scatter reads `group, x, y`, so use
  `--columns species,petal_length,petal_width`.
- `labels repeat`: one mark per row. Right for steps in time, such as months in
  order. For many observations of a few groups (150 flowers, 3 species), choose a
  chart made for raw rows instead: a grouped scatter, a box plot or a violin. Or
  total them with a `group` step, and say what it folded. Do not compute totals
  or averages yourself.
- `every row is its own group` or `the groups are numbers`: a distribution chart
  misread the table. Where a column of whole numbers names the groups (a weekday
  1–7, a score 3–8), the line prints a `roles` recipe. Otherwise use `--columns`
  to keep the measure, plus at most one column of a few groups. If the warning
  stays, say that chart cannot take this table.
- `the dates run backwards` or `dates repeat`, and the `a long table` note: the
  rows hold several series one after another (a long table of symbol, date,
  price). The note prints three recipes: a line each (a pivot), a panel each (a
  facet) and one series (a filter); in `--json` they are `table.longTable.fixes`.
  Choose by the user's question. A pivot leaves a cell blank where a series has
  no value for a date, so read the `!` lines it brings. Several kinds of period
  (years, then quarters, then months) need a filter that keeps one kind.
- `too small to see`: measures far apart share one axis, such as a price and its
  trading volume. Keep one side with `--columns`, or use `mixed-bar-line`, which
  gives the second measure an axis of its own.
- `blank cells … drawn as 0`: tell the user, since the chart shows a value nobody
  measured. If those rows should not be drawn, add the `filled` step the line
  prints and say how many rows went (the `Step` line says). Never fill them in.
- `cells that are not numbers` (a `Note`): NASA's `***` for a year not over yet,
  an `N/A`. A chart reads them as 0, or will not read the column at all. Add the
  `not` step the note prints, one per value, for each column you chart.
- `groups and 8 colours`: there are more groups than colours, so they cannot be
  told apart. Keep a column of a few groups, or none.

## What the profile hides, and what the rules do not reach

- **A word column marked `id, ignored` may be the label you need.** The profile
  drops any word column with a different value in every row. When those are
  names (countries, people, products), the table is one row per thing. Use a
  ranked `bar-horizontal`, or a `choropleth` map for countries, with
  `--columns name,value`. (A country column beside several other columns is
  refused by the map as it stands: it reads exactly two columns.)
- **Some shapes have a chart the rules do not reach.** Latitude and longitude go
  on `proportional-symbol-map`, with `--columns name,longitude,latitude,value`,
  longitude first. Open, high, low and close go on `candlestick`, which ignores a
  date column and draws the candles in row order, so check the rows are in date
  order. A list of routes reads as a sankey or a chord, but with hundreds of names
  either is a tangle. Keep the biggest rows (the Shape tab sorts and limits) and
  say how many.

## What goes in the answer

- The chart you settled on, why, and its `watch` line. If it is not the script's
  top pick, say what was wrong with the top pick.
- One or two alternatives, saying what each would show instead.
- Every `Note` line, as written. Those are problems in the data, such as a column
  that will read as zeros or duplicate rows.
- The link, but only one whose `holds:` line has no unresolved `!` (in `--json`:
  `verify.clean` is true). The `Reset from the example:` line (`adjustments`)
  lists what was taken off the example: its units (a `$` prefix, a `K` suffix),
  its axis titles (now the user's column names, or blank where it could not tell
  which) and an axis sized for its own numbers. The script cannot know the user's
  units, so tell them to add theirs (`$`, `ppm`, `%`) in the studio's axis
  controls. `Still the example's:` lists wording it left alone, such as a series
  called "Product". Say which of it does not fit, so the user can rename it in the
  studio.
- Past about 2,000 characters, say some apps may cut the link. Past 8,192 the
  server refuses it, so the script prints a link to the chart's example instead
  (`link.tooLong`). Rerun with `--html <file>.html` and give the user that page,
  which holds the chart and its data. Or rerun with `--save <file>.csv`, give them
  that file to upload in the chart's data editor, and list the `Reset from the
  example:` settings for them to make by hand.
