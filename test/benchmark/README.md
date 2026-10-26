# Recommender benchmark

`node test/benchmark.mjs` scores what the recommender offers for sixteen real
public tables against graded labels, and fails if it gets worse than
`baseline.json`. `--update` rewrites the baseline; say why in the commit.

## What it is, and what it is not

It is a **regression guard with a conscience**. It tells you whether a change to
the rules, the weights or the profile made the offered charts better or worse
by one reader's judgement, and it prints the tables where the answer is "no
chart anywhere in the list".

It is **not a validation**. Three limits, in order of how much they matter:

1. **The labels are unreviewed.** `labels.json` says `"reviewed": false` and the
   run prints that on its first line. They were proposed by the assistant that
   was also building the recommender. Someone who draws charts for a living
   should read them and change the ones they disagree with; set `reviewed` to
   `true` only then.
2. **Sixteen tables.** Enough to notice that a change broke something, nowhere
   near enough to quote an accuracy. A difference of one table is 6 points.
3. **The held-out split is held out from tuning, not from the labeller.** The
   four `heldout` files (`stocks`, `weather`, `penguins`, `flights`) were
   fetched and labelled in a commit (`008d6d6`) before the recommender was run
   on them, and nothing may be tuned against them. A dev result that does not
   show up there is the finding. They are still labelled by the same person.

The `dev` files were seen while the recommender was built and may be tuned
against. Do not move a file between splits after seeing how it scores.

## How a table is scored

Each file is read the way `choose.mjs` reads one (comment lines and `read.skip`
notes dropped, header settled by `read.header` or guessed), then three lists are
made, the same ones the skill prints:

- **suggestions** — `recommendCharts` on the whole table: at most six.
- **views** — the analysis panel's aggregated views, as the charts their recipes
  name: at most five.
- **offered** — suggestions, then views, without repeats.

Against the labels (3 = the chart I would draw, 2 = a good alternative,
1 = defensible):

| measure | meaning |
|---|---|
| P@1, P@3 | share of the first 1 or 3 graded 2 or better. Divides by K even for a shorter list |
| NDCG@5 | graded, position-weighted, against the best possible five |
| first is the best | the first chart is graded 3 |
| best offered anywhere | a grade-3 chart is somewhere in the list. What an assistant that reads the whole output can act on |
| a good one offered | a chart graded 2 or better is somewhere in the list |
| invalid | share of offered charts the registry lacks, or (for suggestions) that cannot read the table. Must be 0 |
| distinct top picks | distinct first suggestions over tables. The "always the same chart" complaint, as a number |
| distinct offered | distinct charts offered across all tables |
| diversity | how many of the top three come from different chart families, 1 = always |

Nothing is random, so two runs give the same numbers; the run checks that.

## First run (2026-10-26, after the intent and diversity work)

All sixteen: first suggestion graded good 62%, is the best chart 19%; the best
chart is somewhere in the offered list for 56%, a good one for 94%. Held-out
agrees with dev in direction (first suggestion good 4 of 4, best chart offered 2
of 4).

Where it falls down, none of it acted on yet:

- **A country table with other columns never gets a map.** `choropleth` is
  refused with "reads exactly 2 columns" for `drinks` (5) and `wbpop` (71), so
  the `geographic` rule has no chart to offer on any real file. The profile
  already knows which column is the country.
- **A long table of one measure per date and group leads with one line.** `iowa`,
  `stocks` and `globtemp` want one line per group (a pivot), and all three open
  with `line-basic`; `iowa` and `stocks` can read `line-multi` only as a partial
  table. The `time-series` rule counts measures, not groups.
- **Calendar parts are measures beside a year.** `births` has `month`,
  `date_of_month` and `day_of_week` as whole numbers, and with a `year` column
  present the scale exception keeps them as measures, so the first suggestion is
  a multi-line chart of month, day and weekday against the year.
- **The views barely vary.** `bar-horizontal` is the first view on 16 of 16
  tables, and the first three are the same on 14.
- **Few distinct top picks.** Four different charts lead sixteen tables.

## Files

| path | what |
|---|---|
| `labels.json` | the grades, the split, how to read each file, and the review status |
| `baseline.json` | what the last accepted run scored, per split |
| `data/*.csv` | the tables, at most 150 rows each |
| `../../tools/make-benchmark-fixtures.mjs` | fetches and cuts them; kept for provenance, the suite never touches the network |

## The data

A file longer than 150 rows keeps every k-th row rather than the first 150, so a
file sorted by group keeps every group. Lines above the header are kept. These
are samples of someone else's data, kept for testing, with the licences their
publishers state; check them before redistributing the files outside this
repository.

| file | source | licence as stated by the source |
|---|---|---|
| drinks, births | [FiveThirtyEight data](https://github.com/fivethirtyeight/data) | CC BY 4.0 |
| sealevel | [datasets/sea-level-rise](https://github.com/datasets/sea-level-rise) (EPA, CSIRO) | ODC-PDDL 1.0 |
| globtemp | [datasets/global-temp](https://github.com/datasets/global-temp) (NASA GISTEMP, Met Office HadCRUT5) | CC BY 4.0 |
| gold | [datasets/gold-prices](https://github.com/datasets/gold-prices) (World Bank, National Mining Association) | ODC-PDDL 1.0 |
| wine | [UCI Wine Quality, red](https://archive.ics.uci.edu/ml/datasets/wine+quality) (Cortez et al.) | CC BY 4.0 on the UCI page; confirm |
| iowa, disasters, stocks, weather | [vega-datasets](https://github.com/vega/vega-datasets) | the repository is BSD-3-Clause; each file has its own upstream (EIA, Our World in Data, NOAA, financial data) that this has not confirmed |
| healthexp, planets, penguins, flights | [seaborn-data](https://github.com/mwaskom/seaborn-data) | the repository states none; upstreams are OECD, NASA Exoplanet Archive, Palmer Station LTER, Box and Jenkins. Not confirmed |
| gistemp | [NASA GISS GISTEMP v4](https://data.giss.nasa.gov/gistemp/) | NASA data, freely available |
| wbpop | [World Bank, SP.POP.TOTL](https://data.worldbank.org/indicator/SP.POP.TOTL) | CC BY 4.0 |

Where this table says "not confirmed", nobody has checked.
