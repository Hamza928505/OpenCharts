## `line-basic`

1. **Hourly grid electricity load** — Plot metered electricity demand for a single balancing region at hourly resolution to expose daily peaks, weekday versus weekend differences, and seasonal shifts. A line suits one continuous series where the shape of the trajectory is the insight.
2. **Global mean temperature anomaly** — Chart annual deviations from a fixed baseline period to show long-term warming and year-to-year variability. The unbroken line makes trend direction and inflection points easy to read.
3. **Daily website sessions** — Track daily sessions for one site over several months to reveal growth, weekly rhythm, and sudden anomalies after releases or outages. A single line keeps attention on temporal change rather than comparison.
4. **Patient heart rate during monitoring** — Display one patient's sampled heart rate across a hospital stay to detect sustained elevation or abrupt drops. A line preserves the ordering and density of time-stamped samples.
5. **River discharge at a gauging station** — Plot daily streamflow to identify flood peaks, recession periods, and drought lows. The continuous line reflects a physically continuous quantity.
6. **Closing value of a stock index** — Show daily closing levels to assess long-run trend, drawdowns, and recoveries. A line summarizes a long price history without the clutter of intraday detail.
7. **Reservoir storage level** — Chart water storage over multiple years to see seasonal refill and drawdown cycles and whether multi-year decline is occurring. A line makes the cyclical and trend components visible together.
8. **API endpoint response latency** — Plot median latency of a single endpoint over time to detect regressions introduced by deployments. A line exposes step changes and gradual drift in one service.
9. **Atmospheric CO2 concentration** — Show monthly measurements to reveal the seasonal oscillation superimposed on a long-term rise. A line displays both the cycle and the trend in one continuous form.
10. **Vehicle speed trace** — Plot sampled speed from a single trip's telemetry to analyze acceleration, stops, and congestion events. A line keeps the sequence of sampled values intact.

## `line-multi`

1. **Regional unemployment rates** — Plot monthly unemployment for several regions over a decade to compare levels and recovery timing after economic downturns. Multiple lines on a shared axis allow direct comparison of trajectories.
2. **Currency performance rebased to a common date** — Index several exchange rates to 100 at a start date to compare relative appreciation and depreciation. Shared rebasing lets differently scaled series be read on one axis.
3. **Seasonal temperature across cities** — Plot monthly mean temperature for several cities to compare seasonal amplitude and timing. Overlaid lines make offsets and range differences immediately visible.
4. **Host resource utilization** — Show CPU, memory, and network utilization of one server as percentages on the same axis to correlate resource pressure. Multiple lines reveal which resource saturates first.
5. **Life expectancy by country** — Compare long-run life expectancy trajectories for selected countries to see convergence, divergence, and interruptions. Separate lines show each country's path against the same timeline.
6. **A/B test daily conversion** — Plot daily conversion rate for control and variant groups across the experiment window to judge whether the difference is sustained or transient. Parallel lines make separation and overlap evident.
7. **Student scores by subject** — Track average assessment scores for several subjects across school years to identify subject-specific trends. Multiple lines distinguish improvement in one subject from broad change.
8. **Wholesale energy prices by fuel** — Plot monthly prices for natural gas, coal, and electricity to examine co-movement and lag between markets. Overlaid series expose shared shocks and divergences.
9. **Race pace per lap by competitor** — Show lap-by-lap pace for several runners to compare pacing strategies and late-race fade. Each line represents one competitor's pattern across the same lap sequence.
10. **Hospital admissions by age group** — Plot weekly admissions for several age bands over a respiratory season to compare the timing and relative size of peaks. Multiple lines reveal which groups are affected first.

## `line-stepped`

1. **Central bank policy rate** — Show the policy rate as a level held constant between scheduled decisions. A stepped line correctly represents a value that does not interpolate between changes.
2. **Statutory minimum wage** — Plot a jurisdiction's minimum wage over decades, changing only on legislated dates. Steps make the timing and size of each adjustment explicit.
3. **Autoscaling instance count** — Display the number of running instances in a service group, which changes only at scaling events. A stepped line shows how long each capacity level persisted.
4. **Thermostat setpoint schedule** — Chart a building's scheduled temperature setpoint over 24 hours to verify the occupied and unoccupied programs. The value jumps at programmed times and stays fixed otherwise.
5. **Postage price by parcel weight** — Plot price as a function of weight, where cost is constant within each band. Steps show band boundaries and price jumps, which a sloped line would misrepresent.
6. **Warehouse pallet count after receipts and dispatches** — Show stock levels that change only when goods are received or shipped. The stepped form displays exactly how long each inventory level was held.
7. **Feature rollout percentage** — Track the share of users exposed to a feature as product teams raise exposure in discrete stages. Steps map directly onto rollout decisions.
8. **Variable mortgage rate resets** — Plot the applied interest rate on a loan that resets on fixed dates to show the rate actually charged in each period. A stepped line avoids implying gradual change.
9. **Posted speed limit along a route** — Show the speed limit as a function of distance along a road, changing at signage points. Steps represent a regulation that changes abruptly at a location.
10. **Marginal tax rate by taxable income** — Plot the marginal rate as a function of income, which is constant within each bracket. Steps convey bracket boundaries and rate changes precisely.

## `line-stepped-multi`

1. **Time-of-use tariffs across electricity plans** — Compare hourly price schedules of several plans across a day to determine which suits a given load profile. Overlaid stepped lines show when each plan switches price tier.
2. **Minimum wage by state** — Plot stepped minimum wage histories for several jurisdictions to compare the timing and size of increases. Shared axes reveal which jurisdictions lead or lag.
3. **Volume discount schedules from suppliers** — Show unit price by order quantity for several suppliers to find the cheapest source at each purchase volume. Steps mark the quantity thresholds where prices drop.
4. **Open security lanes through the day** — Plot the number of staffed lanes at several checkpoints against time to check staffing alignment with passenger arrivals. Counts change only when lanes open or close.
5. **Zone setpoint schedules in a building** — Compare the programmed temperature setpoints of several zones across a day to spot inconsistent schedules. Steps correspond to control system programming events.
6. **Statutory retirement age by birth cohort** — Plot pension eligibility age against birth year for several countries to compare reform pathways. The age is constant within cohorts and changes at reform boundaries.
7. **Carbon price by jurisdiction** — Show administered carbon prices that change at policy review dates across several jurisdictions. Stepped lines make policy timing comparable across regions.
8. **Replica counts across microservices** — Overlay scaling histories for several services to see which ones scale together during a traffic event. Steps show each service's discrete capacity changes.
9. **Speed profile of alternative routes** — Compare posted speed limits along several candidate routes between the same endpoints. Steps expose where each route slows down and for how long.
10. **Transit fare schedules over time** — Plot fare levels for several transit modes that change on scheduled policy dates. Overlaid steps show which modes were adjusted and when.

## `area-basic`

1. **Daily solar generation profile** — Plot power output of a photovoltaic plant across a day; the filled region under the curve represents energy produced. An area chart emphasizes volume rather than just level.
2. **Cumulative seasonal rainfall** — Show accumulated precipitation over a wet season to assess whether totals are ahead of or behind schedule. The filled area conveys accumulation as a growing quantity.
3. **Network throughput** — Display inbound traffic volume on a link over a week to highlight sustained load versus bursts. The shaded area emphasizes total traffic magnitude.
4. **Reservoir volume over a year** — Plot stored volume to show the amount of water available and its seasonal swing. Filling the area makes stored quantity, not just height, prominent.
5. **Concurrent users during an event** — Chart simultaneous active sessions during a live broadcast to see ramp-up, peak, and drop-off. The area emphasizes the size of the audience at each moment.
6. **Account cash balance** — Show a business's cash position over time to spot when liquidity is thin. The filled region makes the available cushion visible.
7. **Fine particulate exposure over a day** — Plot pollutant concentration hourly so the area under the curve communicates cumulative exposure burden. An area better supports reading the total than a bare line.
8. **Program enrollment totals** — Show the number of people enrolled in a public program over years to convey scale and growth. The area emphasizes the size of the cohort being served.
9. **Glacier cumulative mass change** — Plot accumulated mass change relative to a baseline to show sustained net loss. A filled area communicates accumulated deficit magnitude.
10. **Order backlog** — Chart the volume of unfulfilled orders over a quarter to reveal when capacity lagged demand. The shaded region conveys how much work was waiting.

## `area-stacked`

1. **Electricity generation by source** — Stack annual generation from coal, gas, nuclear, hydro, wind, and solar to show how the mix composes a changing total. Stacked areas reveal both total demand and the contribution of each source.
2. **Web traffic by acquisition channel** — Break daily sessions into organic, paid, referral, and direct to see which channels drive growth. The stack shows channel contribution against the overall trend.
3. **Government spending by function** — Show budget outlays divided into health, education, defense, and other functions across years. Stacking conveys how components add up to total expenditure.
4. **Cloud cost by service** — Stack monthly infrastructure spend by service to identify which component drives cost growth. The total shows overall spend, while layers show attribution.
5. **Population by age band** — Plot population counts stacked by age group to reveal aging and cohort growth. The total population and its composition appear in the same view.
6. **Greenhouse gas emissions by sector** — Stack national emissions by sector to show which contribute most to the total and how they evolve. Layer thickness tracks each sector's share of a changing quantity.
7. **Ticket backlog by severity** — Show open support tickets stacked by severity over time to monitor whether critical items are accumulating. The stack combines total workload and severity mix.
8. **Port cargo by commodity** — Stack monthly tonnage by cargo type to see seasonal commodity patterns within total throughput. Layers show which commodities drive variation in the total.
9. **Mobile data traffic by application category** — Break network traffic into streaming, browsing, messaging, and other categories to plan capacity. The stack shows how categories combine into load.
10. **Household energy use by end use** — Stack consumption by heating, cooling, lighting, and appliances over a year to find the dominant loads. Stacked areas show seasonal total and composition together.

## `area-band`

1. **Daily temperature envelope** — Shade the range between daily minimum and maximum temperature across a year to show the seasonal envelope and diurnal spread. A band represents a continuous range rather than a single value.
2. **Forecast prediction interval** — Plot a point forecast of demand with its lower and upper prediction bounds to communicate uncertainty. The band conveys the plausible range around the central estimate.
3. **Sensor operating range with live readings** — Overlay a measured signal on the acceptable operating band to spot excursions. The shaded range defines normal behavior against which readings are judged.
4. **River flow against historical percentile range** — Compare the current year's flow to a band spanning the historical 10th to 90th percentile. A band shows whether flow is unusually high or low for the season.
5. **Latency percentile range** — Shade the span between median and high-percentile latency to show tail behavior over time. The band highlights how spread widens during incidents.
6. **Target glucose range monitoring** — Show continuous glucose readings against a clinical target band to see time spent inside and outside range. The band defines the therapeutic window.
7. **Process control limits** — Plot a manufactured dimension with upper and lower control limits to detect drift. The band marks acceptable variation around the process mean.
8. **Bollinger-style volatility band** — Shade a price's moving average plus or minus a multiple of its standard deviation to gauge volatility regimes. The band expands and contracts with variability.
9. **Salary band by years of experience** — Show the minimum-to-maximum pay range for a role as experience increases. A band displays spread as a continuous function of the x variable.
10. **Weather ensemble spread** — Display the min-to-max envelope across ensemble model runs to communicate forecast uncertainty growing with lead time. The band summarizes many trajectories compactly.

## `area-100stacked`

1. **Electricity mix shares** — Show each generation source's percentage of total supply over decades to reveal the transition in composition. Normalizing to 100% isolates mix change from total growth.
2. **Operating system share of visits** — Plot the proportion of site visits by operating system across years to see platform shifts. Percentage stacking removes the effect of changing traffic volume.
3. **Budget allocation shares** — Show how a municipality's budget is split among categories over time to reveal shifting priorities. Proportions matter more than absolute totals here.
4. **Workforce by education level** — Plot the share of workers by highest qualification across years to show changing skill composition. The 100% stack emphasizes relative composition.
5. **Commuting mode share** — Show the proportion of trips made by car, transit, cycling, and walking over time to evaluate mobility policy. Shares make modal shift visible regardless of total trips.
6. **Revenue mix by segment** — Display each business segment's share of total revenue across quarters to assess diversification. Normalization highlights mix rather than growth.
7. **Land use composition** — Plot the share of land area in cropland, forest, urban, and other categories over decades. Proportional stacking tracks conversion between categories.
8. **Survey response distribution across waves** — Show the percentage of respondents selecting each answer across repeated survey waves to track opinion shifts. The constant total makes category changes easy to compare.
9. **Device mix of app users** — Plot the proportion of sessions from phones, tablets, and desktops over time to guide design priorities. Shares show relative importance independent of user growth.
10. **Emergency triage category mix** — Show the percentage of arrivals in each triage level over time to detect a shift in case severity. The normalized stack reveals composition changes.

## `step-area`

1. **Staff on duty per shift** — Plot the number of staff scheduled across a day so the filled area represents total staffing hours. A step area shows both discrete levels and accumulated coverage.
2. **Stock on hand between movements** — Show warehouse quantity that changes only on receipts and shipments, with the shaded area representing inventory carried over time. The fill supports holding-cost reasoning.
3. **Open incident count** — Chart the number of unresolved incidents, changing at open and close events, to see workload persisting over time. The area conveys accumulated exposure.
4. **Time-of-use price bands** — Shade electricity price tiers across a day so cost exposure for a constant load is visible as area. Steps reflect tariff boundaries, while the fill represents cost accumulation.
5. **Loan outstanding balance** — Show the principal remaining after each payment to see how long the balance stays at each level. The area under the steps relates to interest accrued over time.
6. **Active software licenses** — Plot the count of licenses in use, which changes at assignment events, to right-size contracts. The area shows license-time consumed.
7. **Regulatory capital requirement** — Display a requirement that changes at rule updates, with the area showing capital held over time. Steps represent rule changes that are discrete by nature.
8. **Parking lot occupancy** — Chart vehicle count as cars enter and leave to see utilization across the day. The filled steps emphasize the quantity of capacity in use.
9. **Room bookings across a day** — Show the number of rooms booked over time as reservations start and end. Step area represents discrete booking events with cumulative occupancy.
10. **Machine operating mode hours** — Plot a machine's power draw level in each mode, such as idle, run, and peak, so area equals energy used. Steps correspond to mode changes.

## `fan-chart`

1. **Inflation projection** — Present a central projection of inflation with widening probability bands to communicate policy uncertainty. A fan chart shows how confidence decreases with horizon.
2. **Sales forecast** — Display expected revenue with nested prediction intervals for planning best and worst cases. The fan makes the range of outcomes explicit.
3. **Retirement portfolio value** — Project portfolio value under simulated returns, showing percentile bands across the horizon. The fan summarizes many simulated paths.
4. **Epidemic scenario projection** — Show projected case counts with uncertainty intervals to support capacity planning. Widening bands convey rising uncertainty over time.
5. **Electricity demand forecast** — Plot forecast load with probability bands, guiding reserve margin decisions. The fan expresses risk to supply adequacy.
6. **Sea level rise projections** — Show a central estimate and likely ranges across emissions scenarios through the century. The fan conveys both trajectory and uncertainty.
7. **Population projection** — Display a national population forecast with uncertainty from fertility and migration assumptions. The bands indicate the plausible range for planners.
8. **Crop yield forecast** — Show an in-season yield forecast with intervals that narrow as harvest approaches. A fan shows uncertainty shrinking with new information.
9. **Cash-flow projection** — Plot projected cash position with percentile bands to assess the probability of shortfall. The fan highlights downside risk.
10. **Traffic volume forecast for infrastructure planning** — Show projected traffic with bands for growth assumptions to evaluate capacity investments. The fan captures uncertainty in long-range planning.

## `horizon-chart`

1. **Server fleet CPU anomalies** — Stack many servers' CPU deviations as thin banded rows to locate unusual hosts quickly. A horizon chart packs many time series into little vertical space.
2. **Stock return panel** — Display daily return deviations for a large set of equities to spot synchronized shocks. Horizon layering shows magnitude and sign compactly.
3. **Station temperature anomalies** — Show deviation from normal for many weather stations to reveal regional heat events. The banded rows enable scanning across stations.
4. **ICU vital sign monitoring** — Present standardized vitals across many beds to identify deteriorating patients. Horizon charts support dense multi-patient surveillance.
5. **Router traffic across a network** — Plot traffic deviations for dozens of routers to identify correlated surges. Compact rows make cross-device patterns visible.
6. **Regional unemployment deviation** — Show each region's deviation from the national rate over years. The banded view makes persistent over- and under-performance easy to see.
7. **Building energy deviations** — Display energy use relative to expectation for each building in a portfolio. Rows highlight which buildings consistently run high.
8. **Plant sensor arrays** — Show normalized readings from many sensors on a production line to detect drifting instruments. The compact form accommodates large sensor counts.
9. **Page-level error rates** — Show error rate deviations for many pages across a release window. Horizon rows localize which pages degraded.
10. **Vibration monitoring across machines** — Plot amplitude deviations across machines to identify equipment with abnormal vibration. Horizons show positive and negative excursions in the same space.

## `spiral-plot`

1. **Monthly temperature across years** — Wind monthly temperature onto a spiral so each turn is a year and seasonal patterns align radially. The form shows both the cycle and any long-term drift.
2. **Sleep-wake cycles** — Plot daily sleep timing wrapped by 24 hours across weeks to reveal drifting rhythms. The spiral makes circadian regularity and disruption visible.
3. **Weekly web traffic rhythm** — Wrap daily traffic on seven-day turns to reveal weekday-weekend patterns and trend. Alignment by day of week highlights periodicity.
4. **Influenza seasonality** — Show weekly case counts across many years with yearly turns to compare season timing and severity. The spiral aligns seasons for direct comparison.
5. **Daily electricity demand over months** — Arrange hourly load on 24-hour turns to show how the daily shape changes over seasons. The layout reveals gradual transitions.
6. **Bike share ridership** — Wind hourly rides by day to expose commuting peaks and weekend patterns. The spiral shows cyclical usage with slow trends.
7. **Air pollution daily cycle** — Plot hourly pollutant levels on daily turns to spot recurring rush-hour peaks and episodic events. Radial alignment exposes recurring timing.
8. **Emergency call volume** — Wrap call counts by hour and day to identify recurring surge periods for staffing. The spiral reveals time-of-day structure across weeks.
9. **Tidal cycles** — Plot water level wrapped by the tidal period to show phase drift between lunar and solar cycles. The spiral handles periodic phenomena with non-24-hour periods.
10. **Retail footfall** — Display store visitors on daily turns to see opening-hours patterns and seasonal changes. The form compresses long records while preserving cyclic structure.

## `sparkline`

1. **KPI card trend** — Embed a small trend beside a headline metric on a dashboard to convey direction at a glance. A sparkline adds context without consuming space.
2. **Watchlist price history** — Show recent price movement for each row in a securities table. Inline sparklines allow scanning many instruments quickly.
3. **Server health table** — Place a short history of latency in each row of a service status table to see which services are trending worse. Compact trends support triage.
4. **Lab result history** — Display a patient's previous values for a lab measure beside the latest result. The mini trend gives clinical context without opening a chart.
5. **Product sales in a catalog table** — Show weekly sales next to each product to highlight rising and falling items. Inline charts support comparison across many rows.
6. **Embedded in narrative reports** — Insert sparklines within sentences or table cells in a report to illustrate a cited trend. Word-sized graphics preserve reading flow.
7. **Step count widget** — Show the last two weeks of steps in a mobile health summary tile. A sparkline conveys consistency in minimal space.
8. **Sprint burndown overview** — Display remaining work per team in a portfolio view to see who is on track. Tiny trends make many teams comparable.
9. **Sensor fleet table** — Show recent temperature history for each device in a fleet inventory. Sparklines help identify unstable devices at a glance.
10. **Player form indicator** — Place recent match ratings next to a player's name in a squad table to convey form. A compact trend fits rows of many players.

## `surplus-deficit-line`

1. **National trade balance** — Plot exports minus imports with positive areas shaded as surplus and negative as deficit. The fill colors make the sign and magnitude of the balance immediately legible.
2. **Government fiscal balance** — Show revenue minus spending across years with shaded surplus and deficit periods. The chart highlights how long and how deep deficits run.
3. **Energy production versus consumption** — Compare a region's generation and demand through the year, shading when it is a net exporter or importer. The filled gap shows the size of the imbalance.
4. **Actual versus budget spend** — Display the difference between actual and planned spending over months. Shading identifies overruns and underspends in context.
5. **Temperature relative to baseline** — Plot temperature with shading above and below a climatological baseline to convey anomalies. Positive and negative deviations are distinguished at a glance.
6. **Rainfall against the long-term normal** — Show how monthly rainfall differs from its historical average to identify wet and dry spells. The fill conveys cumulative deviation.
7. **Net cash flow** — Plot inflows less outflows per period for a business, shading positive and negative cash. The chart reveals recurring shortfalls.
8. **Telecom capacity versus demand** — Compare available network capacity with traffic demand to spot periods of shortfall. The shaded gap indicates the headroom or deficit.
9. **Hospital capacity versus demand** — Show available beds against patient demand over time to determine when capacity was exceeded. Shading quantifies the shortage.
10. **Sprint velocity versus commitment** — Plot completed points against committed points across sprints to show consistent over- or under-delivery. The fill indicates the gap by sprint.

## `bar-diverging-stacked`

1. **Employee engagement survey** — Show Likert responses from strongly disagree to strongly agree for each statement, centered on the neutral midpoint. Diverging stacks reveal at a glance which statements skew positive or negative.
2. **Customer satisfaction by product feature** — Compare rating distributions for each feature of a product to find the ones that polarize users. The shared midpoint enables ranking by net sentiment.
3. **Course evaluation by question** — Display student agreement levels across evaluation items for a course. The layout separates favorable from unfavorable responses around a neutral center.
4. **Public opinion on policy statements** — Plot respondents' agreement with several policy statements from a household survey. A diverging stack shows the balance of support and opposition per statement.
5. **Patient experience by ward** — Show responses ranging from poor to excellent for care quality items across hospital wards. Centering on neutral highlights wards with disproportionate negative experience.
6. **Usability questionnaire results** — Display agreement with usability statements from test participants to locate friction points. Ranked diverging bars show where disagreement concentrates.
7. **Training session feedback** — Compare attendee ratings for content, pacing, and relevance across sessions. Diverging stacks reveal sessions with mixed reception.
8. **Community survey on local services** — Show satisfaction with services such as waste collection, libraries, and transit across neighborhoods. The chart communicates net satisfaction while retaining the neutral share.
9. **Developer survey on tooling** — Plot agreement with statements about build tools and workflows among engineers. Diverging stacks identify tools that frustrate the largest share.
10. **Student attitudes toward a subject** — Compare attitudes before and after an instructional intervention using agreement scales. The diverging layout highlights the shift in favorable and unfavorable groups.

## `spine-chart`

1. **Exam pass and fail by subject** — Split each subject's results into pass and fail around a central spine. The layout compares the balance of outcomes while bar thickness can reflect the number of candidates.
2. **Urban and rural population by country** — Show each country's urban and rural shares on opposite sides of a spine to compare urbanization. Shares emphasize composition, not absolute population.
3. **Mobile and desktop traffic by page** — Display the device split for each page, sized by total visits. The spine shows where mobile dominates, and width indicates where it matters most.
4. **Loan applications approved and declined by region** — Compare approval ratios across regions, with width showing the volume of applications. The chart reveals both rate disparities and their practical weight.
5. **Gender composition by occupation** — Show the share of women and men in each occupation around a spine. The format highlights imbalance while retaining occupation size.
6. **Contract renewal and churn by plan type** — Display the share of renewed and cancelled contracts for each plan. The spine form focuses on the retention balance between two outcomes.
7. **Budget spent and remaining by project** — Split each project's allocation into spent and remaining to see delivery progress. The width can represent the project's total budget.
8. **Domestic and imported supply by product** — Show how consumption of each product divides between domestic production and imports. The balance supports discussions on supply dependence.
9. **Course completion and dropout by program** — Compare completion and non-completion shares across programs with widths by enrollment. The chart identifies programs with both high attrition and high volume.
10. **Votes in favor and against by district** — Show a referendum result split by district, with width by number of votes cast. The spine makes the margin visible alongside the district's weight.

## `bar-vertical`

1. **Monthly rainfall totals** — Plot total rainfall for each month at a station to compare wet and dry months. Vertical bars suit discrete monthly totals on a short ordered axis.
2. **Defects reported per software release** — Show bug counts for each release to see whether quality improved. Bars compare discrete release categories.
3. **Orders by day of week** — Display order counts for each weekday to determine staffing needs. The fixed set of seven categories fits vertical bars.
4. **App downloads by quarter** — Compare quarterly installs to assess campaign effects. Bars treat each quarter as a separate total.
5. **School enrollment by grade** — Show the number of students in each grade to detect cohort size changes moving through the system. Vertical bars compare counts across ordered categories.
6. **Road collisions per year** — Chart annual collision counts to evaluate the effect of safety measures. Bars emphasize each year's total.
7. **Annual production by crop** — Compare harvested output across crop types for a region. Bars provide an easy magnitude comparison for a small set of categories.
8. **Clinic visits per month** — Display monthly outpatient visits to plan capacity. Bars show discrete monthly counts without implying continuity.
9. **Vaccination doses administered per week** — Show weekly administered doses to monitor campaign pace. Bars convey counts in each reporting period.
10. **Customer complaints per quarter** — Plot complaint counts by quarter to check whether service changes reduce complaints. Bars highlight the magnitude per period.

## `bar-stacked`

1. **Departmental expenses by category** — Stack each department's spending on personnel, equipment, travel, and services to compare totals and composition. The stack shows both overall spend and category contribution.
2. **Test outcomes per build** — Show passed, failed, and skipped tests for each software build. Stacks reveal whether growing failures or skips drive instability.
3. **Hospital discharges by destination** — Break discharges into home, rehabilitation, and other facilities each quarter to see pathway changes. Stacked bars show total discharges and their composition.
4. **Emissions by fuel for each country** — Stack national emissions by coal, oil, and gas to compare both totals and fuel dependence. Categories add up to a meaningful total.
5. **Shipments by carrier per month** — Show shipment volumes split across carriers for each month to see reliance on each. Stacks show overall volume and carrier allocation.
6. **Signups by source per week** — Break weekly signups into organic, referral, and paid sources to assess which channels drive growth. The stack tracks total and channel contribution.
7. **Enrollment by study level per faculty** — Compare undergraduate, master's, and doctoral counts within each faculty. Stacked bars show faculty size and level mix.
8. **Reported crime by type per district** — Stack incident types within each district to compare both volume and profile. Totals are meaningful, and component contributions differ by district.
9. **Time allocation by activity per employee** — Show how each person's hours divide across projects, meetings, and support. The stack reveals workload composition against capacity.
10. **Incidents by root cause per quarter** — Break operational incidents into causes across quarters to see which drive the total. Stacked bars retain the total for trend reading.

## `bar-horizontal`

1. **Top search queries** — Rank the most frequent search phrases on a site, which are often long text labels. Horizontal bars give labels room and support ranking.
2. **Countries by renewable electricity share** — Rank countries by the share of renewables in their power mix. Horizontal orientation accommodates many country names.
3. **Product categories by return rate** — Compare return rates across many product categories to prioritize quality investigation. Sorted horizontal bars make outliers clear.
4. **Programming languages in a developer survey** — Rank languages by the share of respondents using them. Horizontal bars fit names of varying length.
5. **Leading causes of hospital admission** — Order diagnosis groups by admissions to focus resource planning. Long category names read well on a horizontal axis.
6. **Airports by annual passengers** — Rank airports by traffic to compare scale across a national system. A sorted horizontal bar chart handles dozens of entries.
7. **Open-source packages by download count** — Compare usage of packages in an ecosystem to identify the most depended-upon components. Horizontal bars keep package names legible.
8. **Reasons for switching providers** — Rank stated reasons from an exit survey to understand drivers of churn. Horizontal bars suit verbose response labels.
9. **Cities by average commute time** — Compare commute durations across metropolitan areas. Ranked horizontal bars highlight extremes.
10. **Occupations by median wage** — Order occupations by median pay to show the spread of earnings across the labor market. Long occupation titles fit on a horizontal axis.

## `bar-100stacked`

1. **Budget composition by department** — Compare how each department splits its spending across categories, independent of total size. Normalized bars isolate mix differences.
2. **Survey responses by age group** — Show the distribution of answers within each age group to compare attitudes without group size effects. Percent stacking makes proportions comparable.
3. **Device mix by region** — Compare the share of phone, tablet, and desktop traffic across regions. Normalization reveals regional behavior differences.
4. **Energy mix by country** — Show each country's electricity sources as shares of total generation. The chart compares mix structure rather than scale.
5. **Order status by warehouse** — Display the proportion of shipped, delayed, and cancelled orders per warehouse to locate operational problems. Percent bars ignore volume differences.
6. **Grade distribution by course** — Compare the share of each grade awarded across courses to spot outlier grading patterns. Normalized stacks standardize for class size.
7. **Payment method by market** — Show the share of payment methods used in each market to tailor checkout options. Shares matter more than transaction counts.
8. **Bug severity by component** — Compare severity mix across software components to find where critical defects concentrate. Normalization removes the effect of component size.
9. **Workforce by contract type** — Show the share of permanent, temporary, and contractor staff per business unit. Percentages highlight reliance on flexible labor.
10. **Vehicle fuel type by city** — Compare the composition of registered vehicles by fuel across cities to monitor electrification. Shares expose differences in adoption regardless of fleet size.

## `bar-diverging`

1. **Profit and loss by business unit** — Plot each unit's net result, with gains extending right and losses left of zero. Diverging bars make the sign and magnitude of performance obvious.
2. **Year-over-year change in enrollment** — Show the growth or decline per institution relative to the prior year. A zero baseline separates increases from decreases.
3. **Net migration by region** — Display net inflow and outflow of people for regions. Bars on either side of zero distinguish gaining and losing regions.
4. **Monthly temperature anomaly** — Plot each month's departure from the long-term average. The baseline at zero shows warm and cool months directly.
5. **Budget variance by department** — Show the overrun or underspend for each department against plan. Direction and size are readable from the diverging layout.
6. **Sector returns** — Compare period returns of market sectors, with gains and losses on opposite sides. The chart clarifies which sectors led and lagged.
7. **Population change by city** — Show percentage growth or shrinkage across cities to identify urban decline. The diverging layout highlights contraction as clearly as growth.
8. **Net Promoter Score by region** — Display net score, which can be positive or negative, for each region. Bars relative to zero show where detractors outnumber promoters.
9. **Trade balance by product category** — Plot exports minus imports for each category to identify surplus and deficit products. A zero baseline separates net exporters from net importers.
10. **Score change versus prior year by school** — Show the change in average performance per school relative to its previous result. The chart identifies improvement and decline together.

## `bar-floating`

1. **Salary range by job grade** — Display the minimum-to-maximum pay for each grade as a floating bar. Floating bars show the spread and overlap between grades.
2. **Monthly temperature range for a city** — Show the span from average low to average high for each month. Floating bars represent ranges rather than a single value.
3. **Commodity price range per quarter** — Plot the low-to-high price for each quarter to show volatility. The bar extent conveys range in one mark.
4. **Delivery time range by carrier** — Compare the fastest to slowest typical delivery duration per carrier. Floating bars expose both speed and consistency.
5. **Elevation range of hiking trails** — Show the lowest and highest elevation along each trail. Bars display the vertical span hikers will encounter.
6. **Recommended nutrient intake ranges** — Display acceptable intake ranges by age group. Floating bars show bounded guidance windows.
7. **Sensor calibration limits by device** — Show the minimum and maximum measurement range supported by each instrument. Bars help select instruments that cover a required range.
8. **Hotel room rates by season** — Plot the lowest to highest nightly rate per season to understand pricing flexibility. Bars depict the span for each category.
9. **Air quality range by monitoring site** — Show the minimum-to-maximum index values recorded at each site over a month. Floating bars distinguish stable sites from highly variable ones.
10. **Reference ranges of laboratory tests** — Display the normal range of several analytes to compare against patient measurements. Floating bars define bounded normal intervals.

## `bar-waterfall`

1. **Cash balance bridge** — Show opening cash, inflows, outflows, and closing cash as sequential increments. A waterfall explains how each item moves the balance.
2. **Revenue change drivers** — Break the change in revenue between two periods into price, volume, mix, and currency effects. The cascade attributes the total change to its components.
3. **Headcount movement** — Show opening headcount, hires, transfers, and departures to reach closing headcount. Waterfall bars trace the personnel roll-forward.
4. **Budget variance by cause** — Decompose the gap between planned and actual spend into contributing causes. The chart shows which drivers added or reduced the variance.
5. **Inventory reconciliation** — Track stock from book balance through adjustments, damages, and recounts to physical balance. Sequential bars explain discrepancies.
6. **Profit walk from gross to net** — Display revenue less costs, depreciation, interest, and taxes to reach net profit. A waterfall follows the income statement logic.
7. **Project cost overrun by cause** — Show baseline cost plus each cause of overrun to reach the final cost. Incremental bars identify the largest contributors.
8. **Customer base movement** — Display starting customers, new signups, upgrades, and churn to reach ending customers. The waterfall reconciles the customer count.
9. **Emissions reduction by measure** — Show baseline emissions followed by reductions from each measure to reach a target. Bars quantify each measure's contribution.
10. **Page load time by phase** — Decompose total load time into DNS, connection, server response, and rendering contributions. Cumulative bars show where time accumulates.

## `bar-butterfly`

1. **Population pyramid** — Show population counts by age group for women and men on opposite sides of a central axis. Mirrored bars expose age structure and sex balance.
2. **Imports versus exports by product** — Display both flows per product category to compare trade directions. The mirrored layout shows imbalance clearly.
3. **Two cohorts' satisfaction by question** — Compare survey scores from two groups on the same questions. Mirroring enables direct comparison of each item.
4. **Before and after scores by module** — Show pre-training and post-training results per module. Opposing bars highlight improvement for each topic.
5. **Male and female median wage by occupation** — Compare pay for the two groups within each occupation. The butterfly layout displays gaps per occupation.
6. **Weekday and weekend ridership by station** — Plot average boardings on weekdays versus weekends for stations. Mirrored bars reveal stations with distinct commuter or leisure profiles.
7. **Two products' feature ratings** — Compare user ratings for the same feature list across two products. Each feature row allows paired comparison.
8. **Skill supply and demand** — Display the number of job postings requiring a skill against the number of qualified candidates. Mirroring highlights shortages and surpluses.
9. **Urban and rural access to services** — Compare access rates to services like broadband and clean water for urban versus rural populations. The chart highlights gaps by service.
10. **Order book bids and asks** — Show cumulative buy and sell volumes by price level. The butterfly layout displays depth on each side of the market.

## `bar-lollipop`

1. **Top code contributors** — Show commit counts per contributor in a repository with minimal ink. Lollipops emphasize value position across many entries.
2. **Air quality by country** — Compare average pollutant concentration for many countries. The dot ending makes exact values easy to compare without heavy bars.
3. **Return rate by product** — Display rates for dozens of products, where bar mass would overwhelm. Lollipops keep the focus on the endpoint.
4. **Average response time per support agent** — Compare agents' response times in a compact layout. The light marks suit dense rankings.
5. **Survey item scores** — Show mean scores for many questionnaire items. Lollipops reduce visual clutter relative to filled bars.
6. **Test coverage by module** — Display coverage percentages for each software module to locate weak areas. Dots facilitate comparison against a threshold line.
7. **Vaccination coverage by region** — Plot regional coverage rates in sorted order to see gaps. The minimalist style handles many regions.
8. **Feature usage counts** — Compare how often each product feature is used. Lollipops support long ranked lists.
9. **Average tenure by team** — Show mean employee tenure for each team. The marks highlight differences without the visual weight of bars.
10. **Energy use intensity by building** — Compare energy use per floor area across a building portfolio. Lollipops ease comparison against a benchmark.

## `pie`

1. **Household budget split** — Show the proportion of a monthly budget spent on housing, food, transport, and other categories. A pie works for a handful of parts summing to a whole.
2. **Revenue by region for a small set of regions** — Display each region's share of total revenue when only a few regions exist. The pie conveys share at a glance.
3. **Vote share in a three-way contest** — Show each candidate's proportion of votes in a single election. Few categories make angle comparison feasible.
4. **Operating system share of users** — Plot the current distribution of platforms among app users. A pie conveys composition in one snapshot.
5. **Workday time allocation** — Show how a typical day is split across meetings, focused work, and communication. A pie communicates the parts-of-a-whole concept simply.
6. **Investment asset allocation** — Display a portfolio's weights in equities, bonds, cash, and other assets. Few categories and a fixed total suit a pie.
7. **Ticket types sold for an event** — Show the proportion of general, student, and premium tickets sold. The chart summarizes sales mix.
8. **Survey yes, no, and undecided** — Display the split of responses to a single question. A pie communicates majority and minority shares.
9. **Support requests by channel** — Show what share of requests arrive by phone, email, chat, and social media. A simple share view helps resource allocation.
10. **Municipal waste composition** — Show the share of waste by material type for a city. A pie displays a one-time composition breakdown.

## `doughnut`

1. **Project budget with total at center** — Show how a project's budget divides among work packages, with the total displayed in the hole. The doughnut conveys shares while the center carries the summary figure.
2. **Storage usage by file type** — Break used storage into documents, media, and backups, with total capacity in the center. The ring shows composition and the center anchors the whole.
3. **Customer segments with customer count** — Display the share of customers in each segment, labeling the center with the total base. The form supports a quick composition read.
4. **Appliance energy shares** — Show how household consumption divides among appliances, with total consumption at the center. The hole provides space for the aggregate measure.
5. **Issue status breakdown** — Plot open, in-progress, and closed issues with the total count in the middle. The ring gives a compact status summary for a dashboard tile.
6. **Survey response composition** — Display answer categories with the respondent count in the center to keep sample size visible. The ring balances proportion and context.
7. **Donation sources** — Show the share of funds raised from individuals, corporations, and grants, with the total in the center. A doughnut communicates mix while highlighting the headline figure.
8. **Macronutrient split** — Show the proportions of protein, carbohydrate, and fat with total energy in the middle. The ring form suits a single meal's composition.
9. **Network traffic by protocol** — Display protocol shares of observed traffic, with total volume at the center. The chart gives a compact view for monitoring panels.
10. **Enrollment by faculty** — Plot each faculty's share of student enrollment with total students at the center. The doughnut supports composition reading for a small number of groups.

## `doughnut-gauge`

1. **Sales quota attainment** — Show a representative's progress toward quota as a filled arc. A gauge displays a single value relative to a target.
2. **Disk utilization** — Display the percentage of storage in use on a monitoring panel. The gauge conveys how close a resource is to capacity.
3. **SLA compliance** — Show the share of requests meeting a service objective versus a target. The filled ring communicates attainment of a bounded metric.
4. **Project completion** — Present percentage of tasks completed in a project status view. A gauge gives quick progress context.
5. **Battery state of charge** — Display remaining charge for an electric vehicle or device. The ring maps to a finite range of 0 to 100 percent.
6. **Fundraising progress** — Show the amount raised as a proportion of the goal. A gauge emphasizes distance to target.
7. **Bed occupancy** — Display the proportion of hospital beds occupied for operational monitoring. The gauge flags approach to capacity.
8. **Course completion progress** — Show how much of a course a learner has finished. The ring communicates progress on a bounded scale.
9. **Test coverage versus goal** — Display code coverage against a required threshold. The gauge shows if the target is met.
10. **Customer satisfaction score** — Show a satisfaction index on a fixed scale. A single gauge summarizes a KPI for an executive dashboard.

## `polar-area`

1. **Customer complaints by category** — Display the number of complaints in each category as sector radius. Polar area encodes magnitude by both radius and area across a small set of categories.
2. **Sales by product category** — Show revenue per category with equal angular sectors. The circular layout supports quick magnitude comparison in a compact display.
3. **Appliance energy consumption** — Plot energy used by each appliance in a home as a sector. Radial magnitude highlights dominant loads.
4. **Monthly demand seasonality** — Show monthly demand arranged around a circle so the year's cycle is visible. Equal angular sectors reflect the calendar.
5. **Survey agreement by topic** — Display mean agreement scores for several topics as sector radius. The radial layout highlights which topics stand out.
6. **Web traffic by hour on a clock face** — Arrange hourly visit counts around a 24-hour dial to see the daily rhythm. The polar form mirrors the clock.
7. **Incidents by type** — Show counts of security incident types as sectors. The layout supports comparison of several categories in a small space.
8. **Publications by research field** — Display the number of papers per discipline for an institution. Radial sectors provide a distinctive view of output distribution.
9. **Library loans by genre** — Plot loan counts across genres to see demand. The circular format is suitable for a small number of categories.
10. **Emissions by sector** — Show emissions contributed by each sector as sector radius. The chart emphasizes large contributors.

## `nightingale-rose`

1. **Monthly hospital admissions by cause** — Stack causes of admission within each month's wedge to show seasonal patterns. The rose combines cyclical time with category composition.
2. **Monthly energy use by source** — Show how each month's consumption divides between electricity, gas, and other fuels. Stacked wedges track seasonal variation across the year.
3. **Seasonal tourist arrivals by origin** — Plot monthly arrivals stacked by source region. The rose reveals seasonality and origin mix together.
4. **Monthly road accidents by severity** — Stack severity categories for each month to show when serious events cluster. The circular layout matches the annual cycle.
5. **Hourly traffic by vehicle type** — Arrange traffic by hour around a 24-hour circle with stacked vehicle classes. The rose shows the daily rhythm and composition.
6. **Monthly crime by type** — Show seasonal variation in incident types using stacked wedges. The circular form emphasizes annual recurrence.
7. **Wind speed classes by direction** — Stack speed categories within each compass sector to summarize a site's wind regime. The rose is well suited to directional data with magnitude classes.
8. **Monthly complaints by channel** — Show the volume of complaints stacked by channel across a year. The layout communicates both cycle and channel mix.
9. **Monthly sales by region** — Stack regional revenue in each month's wedge to reveal seasonality in regional contribution. The rose enables cyclical composition reading.
10. **Monthly food waste by supply stage** — Plot waste amounts stacked by stage of the supply chain for each month. Stacked wedges indicate where and when losses peak.

## `waffle`

1. **Household internet access** — Show the share of households with internet as filled squares in a 100-square grid. A waffle makes a percentage tangible as a count out of 100.
2. **Vaccination coverage** — Display the fraction of a population vaccinated. The grid communicates proportion to a general audience.
3. **Budget per 100 currency units** — Show how each 100 units of public spending is distributed. Squares translate proportions into intuitive unit counts.
4. **Workforce gender split** — Display the share of staff by gender category in a company. The grid provides a readable part-to-whole view.
5. **Survey result framing** — Present a result as "X out of 100 respondents" to simplify communication. The waffle supports public-facing narratives.
6. **Renewable electricity share** — Show the proportion of generation from renewable sources. A square grid emphasizes the remaining non-renewable portion.
7. **Task completion** — Display completed versus remaining work items in a project. The grid gives a tactile progress view.
8. **Literacy rate** — Show the literate share of the adult population. A waffle makes a rate understandable at a glance.
9. **Funding sources for a program** — Display the share of a program's funding coming from each source. Each square gives a countable unit of the whole.
10. **Conservation status of assessed species** — Show the proportions of species in each threat category. The grid conveys composition with discrete units.

## `radar-single`

1. **Athlete skill profile** — Plot one player's ratings for speed, strength, endurance, and technique. A radar shows the profile's shape across several dimensions at once.
2. **Product evaluation** — Display one product's scores against criteria such as price, quality, and support. The chart shows strengths and weaknesses.
3. **Candidate competency profile** — Show a candidate's rated competencies in an interview scorecard. The polygon indicates balance versus specialization.
4. **City livability profile** — Plot a city's scores for housing, safety, transport, and environment. The radar summarizes a multidimensional index.
5. **Sustainability scorecard** — Display a company's performance across environmental, social, and governance dimensions. The shape reveals uneven performance.
6. **Sensory profile** — Show a food or beverage's rated attributes such as sweetness, acidity, and aroma. Radar is a standard format for sensory analysis.
7. **Team practice maturity** — Plot a team's maturity across engineering practices such as testing, deployment, and monitoring. The profile highlights gaps for improvement.
8. **Student competency profile** — Show a learner's proficiency across subjects or skill areas. The shape conveys balance between strengths.
9. **Server health profile** — Display normalized metrics such as CPU, memory, latency, and error rate for a server. The radar gives a compact snapshot of condition.
10. **Supplier performance** — Plot a supplier's rating on cost, quality, delivery, and responsiveness. The polygon allows quick assessment against criteria.

## `radar-multi`

1. **Product feature comparison** — Overlay several products' scores across the same feature set to compare profiles. Multiple outlines show relative strengths on shared axes.
2. **Candidate comparison** — Compare finalists across competencies in a hiring decision. Overlaid polygons highlight distinct profile shapes.
3. **City comparison** — Plot several cities on livability indicators to identify trade-offs. Shapes reveal which dimensions each city excels in.
4. **Athlete comparison** — Overlay skill ratings for several players to compare roles. Multiple outlines help scouts compare profiles.
5. **Vendor selection** — Compare vendors' scores on criteria such as cost, support, and integration. The overlay makes trade-offs visible.
6. **Before and after training** — Show skill ratings before and after a training program. Two outlines highlight areas of improvement.
7. **Department maturity** — Compare departments' maturity scores across capability domains. Overlaid shapes identify leaders and laggards per domain.
8. **Smartphone specification comparison** — Plot normalized scores for camera, battery, display, and performance across models. Multiple shapes summarize trade-offs.
9. **Fund profile comparison** — Compare funds across normalized risk, return, cost, and liquidity dimensions. The overlay reveals contrasting profiles.
10. **Regional development indicators** — Overlay regions' normalized scores for education, health, income, and infrastructure. The chart allows multidimensional comparison.

## `radar-filled`

1. **Overall skill coverage** — Fill the area of a team's combined competency scores to show how much of the skill space is covered. The filled footprint emphasizes overall capability.
2. **Nutritional profile** — Display a food's nutrient levels as a filled polygon against recommended values. The area gives an impression of nutritional completeness.
3. **Brand perception** — Show survey ratings of a brand on attributes such as trust, value, and innovation. The filled shape communicates the brand's image at a glance.
4. **Game character attributes** — Plot attributes like strength, agility, and intelligence for a character. The filled region conveys the character's overall power and balance.
5. **Balanced scorecard** — Display an organization's performance across financial, customer, process, and learning perspectives. The filled polygon shows the balance of performance.
6. **Aptitude assessment** — Show an individual's results across aptitude domains. The area communicates breadth of ability.
7. **Water quality parameters** — Plot normalized parameters against a guideline polygon to identify exceedances. Area highlights deviation from the acceptable shape.
8. **Product strengths in a sales deck** — Show a product's scores across buyer criteria. The filled area emphasizes overall strength to a non-technical audience.
9. **Regional development profile** — Display a region's composite profile in filled form. The shape communicates uneven development across domains.
10. **Project risk profile** — Show the rated severity across risk categories for a project. The filled polygon highlights exposure across dimensions.

## `scatter-basic`

1. **Advertising spend versus revenue** — Plot spend and resulting revenue for campaigns to assess correlation and diminishing returns. A scatter shows the relationship between two quantitative variables.
2. **Study hours versus exam score** — Show each student's study time and score to examine association and outliers. Points reveal the spread around any trend.
3. **House size versus sale price** — Plot area and price for sold homes to examine the relationship and identify unusual sales. The scatter exposes heteroscedasticity and outliers.
4. **Temperature versus electricity demand** — Show daily temperature against demand to reveal heating and cooling responses. The shape indicates nonlinear sensitivity.
5. **Page load time versus bounce rate** — Plot each page's load time against its bounce rate to evaluate performance impact. A scatter helps identify problem pages.
6. **Engine displacement versus fuel consumption** — Show vehicle specifications to examine efficiency trends. Points allow identification of unusually efficient models.
7. **Height versus weight** — Plot measurements from a health survey to examine body composition relationships. A scatter displays spread and outliers.
8. **Rainfall versus crop yield** — Show seasonal rainfall and resulting yield per field. The scatter reveals whether more rain improves output.
9. **Sensor versus reference instrument** — Plot low-cost sensor readings against reference readings to assess calibration. Points near the diagonal indicate agreement.
10. **Age versus income** — Show individuals' age and earnings from a household survey to explore life-cycle patterns. The scatter reveals the spread at each age.

## `scatter-clusters`

1. **Customer segmentation** — Plot customers by two behavioral features and color by cluster assignment to validate segments. Colored groups show separation of segments.
2. **Plant morphology groups** — Show measurements of specimens colored by species to check separability. Clusters highlight which features discriminate groups.
3. **Document topic embeddings** — Display two-dimensional projections of text embeddings colored by topic. Clusters reveal thematic structure.
4. **Fraud versus legitimate transactions** — Plot transaction features colored by label to see how distinct fraudulent behavior is. The scatter shows overlap between classes.
5. **Incident location clusters** — Show the coordinates of incidents colored by detected hotspot. Clusters locate areas of concentrated events.
6. **Gene expression groups** — Plot samples in reduced dimensions colored by cluster to reveal subtypes. Color groups support biological interpretation.
7. **Stock behavior groups** — Display stocks using risk and return features colored by cluster to identify similar instruments. The scatter supports portfolio diversification.
8. **Image embedding classes** — Plot embeddings of images colored by class label to check how well a model separates categories. Clusters show confusion between classes.
9. **Driver behavior profiles** — Show drivers by braking and acceleration metrics colored by profile. Clusters reveal distinct driving styles.
10. **Hospital performance groups** — Plot hospitals by quality and efficiency measures colored by cluster. The scatter identifies peer groups for benchmarking.

## `bubble`

1. **Countries by income, life expectancy, and population** — Plot income per person against life expectancy with bubble size showing population. Three variables appear in one view, revealing how demographics interact with wealth and health.
2. **Marketing campaigns** — Show spend against conversions with bubble size as audience reach. The chart reveals campaigns that combine efficiency with scale.
3. **Products by price, rating, and units sold** — Plot price against rating, sizing by sales volume. Bubbles identify high-volume products in each price-quality region.
4. **Companies by revenue, margin, and headcount** — Display revenue and margin with bubble size as employees to evaluate productivity. The chart highlights outliers.
5. **Cities by population, housing cost, and wages** — Plot wages against housing cost with bubble size as population. The view shows affordability across large and small cities.
6. **Features by usage, satisfaction, and effort** — Show usage against satisfaction with bubble size as development effort to prioritize roadmap work. Large, poorly rated bubbles are obvious problems.
7. **Hospitals by wait time, rating, and beds** — Plot wait time against patient rating with bubble size as capacity. The chart identifies facilities with poor experience and high impact.
8. **Funds by risk, return, and assets under management** — Show risk against return with size as fund size. The chart reveals where most capital is concentrated.
9. **Articles by reading time, shares, and views** — Plot reading time against shares with views as bubble size to see what engages readers. Bubbles compare content performance across three measures.
10. **Schools by class size, results, and enrollment** — Show class size against average results with bubble size for enrollment. The view evaluates whether smaller classes correspond to better outcomes.

## `hexbin`

1. **Ride pickup density** — Aggregate millions of pickup coordinates into hexagonal bins to reveal demand hotspots. Hex bins avoid overplotting and offer equal-distance neighbors.
2. **GPS trace density** — Show where recorded positions concentrate along a road network. Binned counts expose popular routes.
3. **Shot locations in sports** — Plot shot positions on a pitch to see where attempts originate. Hex bins summarize many events with consistent cell shapes.
4. **Transaction amount versus time of day** — Bin large transaction data to reveal typical purchase patterns. The density view replaces an unreadable scatter.
5. **Flight delay versus distance** — Show the joint distribution across many flights. Hex bins reveal dense regions and unusual long delays.
6. **Click positions on a page** — Aggregate click coordinates to identify attention hotspots. Hex bins provide smooth spatial aggregation.
7. **House price versus size in dense markets** — Bin thousands of listings to show price-size relationships without overplotting. Color indicates counts per hexagon.
8. **Paired sensor readings** — Display the joint distribution of two high-frequency sensor variables. The hexbin shows operating regimes.
9. **Incident density across a region** — Aggregate incident coordinates to locate concentrations for resource allocation. Hexagonal tiling reduces shape bias in aggregation.
10. **Customer age versus spend** — Bin large customer datasets to reveal segments with common age and spending. Density patterns emerge despite overlapping points.

## `splom`

1. **Plant measurement relationships** — Show pairwise scatterplots of several morphological measurements to see which variables separate groups. A matrix exposes all pairwise relationships at once.
2. **Financial ratio screening** — Plot pairs among leverage, liquidity, and profitability ratios to detect correlations. The matrix supports exploratory analysis before modeling.
3. **Vehicle specifications** — Compare weight, power, and efficiency pairwise to identify trade-offs. A scatterplot matrix reveals multivariate structure.
4. **Clinical biomarker exploration** — Display relationships among several biomarkers in a patient cohort. Pairwise plots help spot correlated markers and outliers.
5. **Sensor variable interdependence** — Plot pairs among temperature, pressure, and vibration readings to understand process dynamics. The matrix highlights redundant variables.
6. **Survey index correlations** — Show the relationships among composite indices such as satisfaction and trust. Pairwise plots reveal nonlinearities that correlation coefficients hide.
7. **Player statistics** — Compare pairwise relationships among performance metrics. The matrix supports identifying complementary skills.
8. **Water chemistry parameters** — Plot pairs among pH, conductivity, and dissolved oxygen. Pairwise views reveal correlated measurements.
9. **Feature screening for machine learning** — Examine how candidate predictors relate to each other and to the target before training. The matrix highlights multicollinearity.
10. **Housing characteristics** — Plot pairs among area, rooms, age, and price to see how features relate. A single matrix provides an overview of the dataset.

## `density-contour`

1. **Eruption duration and waiting interval** — Plot the joint distribution of duration and the wait before the next event for a recurring natural phenomenon. Contours reveal distinct modes that a scatter of overlapping points would hide.
2. **Height and weight distribution** — Show the bivariate density of body measurements in a health survey to identify the typical range and outliers. Contour lines summarize where observations concentrate.
3. **Incident hotspots** — Estimate the density of incident coordinates across a district to locate areas of concentration. Contours delineate hotspots without the noise of individual points.
4. **Joint returns of two assets** — Display the bivariate distribution of daily returns to assess tail dependence. Contours show the shape of co-movement.
5. **Player position density** — Show where a player spends time on a field during a match. Contour levels convey areas of high occupancy.
6. **Customer age and spend** — Plot the joint density to find age-spend segments. Contours reveal concentrations without overplotting.
7. **Operating regimes of a machine** — Show the joint density of two process variables, such as speed and temperature, to identify normal operating regions. Contours make regime boundaries visible.
8. **Wind speed and turbine power output** — Display the density of paired observations to see the typical power curve and deviations. Contours summarize dense operational data.
9. **Two-group comparison** — Overlay density contours for two groups on the same two variables to see where their distributions overlap. Shared axes highlight separation.
10. **Vehicle speed and fuel consumption** — Show the joint density from telemetry to understand efficient driving regions. Contours emphasize common operating conditions.

## `histogram`

1. **Exam score distribution** — Bin student scores to see central tendency, spread, and skewness. A histogram shows the shape of a continuous distribution.
2. **API response times** — Plot the distribution of latencies to reveal long tails. Bins highlight whether a service has occasional slow responses.
3. **Order values** — Show how order amounts are distributed in an online store to inform pricing and free-shipping thresholds. The histogram reveals clustering.
4. **Daily asset returns** — Bin returns to check for fat tails and skew. The shape guides risk modeling.
5. **Delivery durations** — Display how long deliveries take to set customer expectations. The histogram reveals whether times are consistent.
6. **Household income** — Bin household incomes to show distribution shape and skewness. A histogram communicates inequality patterns.
7. **Package weights on a line** — Plot measured weights to see if they center on the nominal value and stay within tolerance. The histogram supports process capability review.
8. **Session durations** — Show how long users stay on a site to identify short bounces versus engaged visits. Bins reveal multiple usage modes.
9. **Birth weights** — Bin recorded weights to examine the distribution in a clinical cohort. The histogram highlights unusual groups.
10. **Commute distances** — Display the distribution of distances traveled to work to inform transport planning. The shape indicates typical and long-distance commuters.

## `box-plot`

1. **Salaries by department** — Compare median pay and spread across departments, identifying outliers. Box plots summarize distributions side by side.
2. **Delivery times by carrier** — Show the median, quartiles, and extremes of delivery time per carrier to evaluate reliability. The box highlights consistency as well as speed.
3. **Recovery times by treatment** — Compare distributions of recovery duration across treatment groups. The plot shows differences in median and variability.
4. **House prices by neighborhood** — Display median price and spread for each neighborhood. Outliers identify atypical sales.
5. **Crop yield by fertilizer type** — Compare yield distributions across plots using different fertilizers. The box plot shows both effect and variability.
6. **Manufacturing measurements by shift** — Show a part dimension distribution by shift to detect process differences. Boxes reveal systematic shifts and spread.
7. **Response times by region** — Compare latency distributions across data center regions. The plot highlights which regions have higher variability.
8. **Test scores by class** — Show the distribution of results within each class for equitable comparison. Quartiles and whiskers convey spread.
9. **Battery life by model** — Compare measured battery lifetimes across device models. Box plots reveal variability within each model.
10. **Pollutant levels by season** — Display air pollutant measurements grouped by season to see seasonal shifts and extreme events. The outlier markers flag pollution episodes.

## `violin`

1. **Bimodal response times** — Show the distribution of latency where some requests hit a cache and others do not. The violin reveals two modes that a box plot would miss.
2. **Gene expression by condition** — Compare expression level distributions across experimental conditions. The shape shows distribution features beyond median and quartiles.
3. **Salary distribution by role** — Display the density of salaries per role to reveal skew and clustering. Violins show full distribution shapes.
4. **Test scores by school** — Compare distribution shapes across schools, including ceilings and floors. The density outline shows where students concentrate.
5. **Customer spend by segment** — Show whether spending is unimodal or has subgroups within a segment. Violins expose structure in the data.
6. **Patient wait times by department** — Compare the full distribution of waits, including long tails. The shape reveals service consistency.
7. **Temperature by season** — Display the distribution of daily temperatures in each season. Violins show spread and skew.
8. **Model error distributions** — Compare prediction errors across algorithms to identify those with heavy tails. The density shapes highlight bias and variance.
9. **Session duration by device** — Show how engagement differs across device types, including the tails of long sessions. The violin adds distribution shape to group comparison.
10. **Athlete performance by position** — Compare the distribution of a performance metric across positions. The shapes indicate specialization and variability.

## `heatmap`

1. **Website activity by weekday and hour** — Show visit counts in a matrix of weekday by hour to identify peak times. Color intensity reveals temporal patterns in a compact grid.
2. **Feature correlation matrix** — Display pairwise correlations among variables to find related features. The heatmap highlights strong positive and negative associations.
3. **Sales by product and region** — Plot revenue across product and region combinations to find strong and weak cells. Color highlights gaps and concentrations.
4. **Cohort retention** — Show the share of users retained by signup cohort and months since signup. The matrix reveals whether retention improves for newer cohorts.
5. **Gene expression across samples** — Display expression levels for genes across samples, often with clustering. Color intensity reveals co-expression patterns.
6. **Error rates by service and hour** — Plot error rates for each service across hours to localize incidents. The grid reveals recurring failure windows.
7. **Classifier confusion matrix** — Show counts of predicted versus actual classes to identify frequently confused labels. The heatmap highlights where the model errs.
8. **Student grades by assignment** — Display each student's results across assignments to spot struggling students and difficult tasks. The matrix allows scanning patterns in both dimensions.
9. **Staffing coverage by day and hour** — Show the number of staff on duty against demand in a day-hour grid to locate gaps. Color makes shortages obvious.
10. **Monthly temperature by city** — Plot mean temperatures by month and city to compare climates. A matrix summarizes many series at once.

## `density-plot`

1. **Smooth exam score distribution** — Estimate the density of scores to show the overall shape without binning artifacts. A density curve provides a continuous summary.
2. **Response times for two versions** — Overlay the latency densities of the old and new versions to see whether the distribution shifted. Smooth curves make overlaps clear.
3. **Income distribution between groups** — Compare the density of incomes for two demographic groups to examine differences in distribution. Overlays reveal shifts and differing spreads.
4. **Predicted probability by class** — Plot a classifier's scores for positives and negatives to judge separation. The densities show the overlap region.
5. **Commute times** — Show the distribution of commute durations in a city. A smooth curve identifies typical and long commutes.
6. **A/B test metric distributions** — Compare the density of a metric between control and treatment to see effects beyond the mean. Overlaid curves show variance changes.
7. **Measurement error** — Display the density of differences between instrument readings and reference values to judge bias and precision. The curve shows how centered and narrow the errors are.
8. **Daily rainfall on wet days** — Estimate the density of nonzero rainfall amounts to describe intensity. The smooth curve shows skewness.
9. **Customer age by segment** — Overlay age densities for customer segments to reveal demographic differences. Smooth curves support multiple-group comparison.
10. **House prices by city** — Compare the density of prices across cities to show cost levels and spread. Overlaid densities highlight market differences.

## `ridgeline`

1. **Monthly temperature distributions** — Stack the temperature density of each month to reveal seasonal shifts in distribution. Ridgelines show how shape and location move across ordered categories.
2. **Income distribution across years** — Display yearly income densities to show how inequality evolves. The stacked curves allow comparing many time points.
3. **Test scores across schools** — Plot score distributions for many schools in one view. Ridgelines compare numerous distributions compactly.
4. **Service latency distributions** — Show latency densities for dozens of services to find slow or erratic ones. Stacking makes many distributions comparable.
5. **Track duration by genre** — Compare the distribution of song lengths across genres. Ridgelines make differences in modality and spread clear.
6. **Price distribution by product category** — Display density of prices within each category to understand market segmentation. Overlapping curves save space.
7. **Intraday traffic profiles** — Plot the distribution of events over the hours of the day for each day of the week. Ridgelines reveal changes in daily shape.
8. **Age distribution across countries** — Compare population age densities for many countries. Stacked curves show demographic transitions.
9. **Ratings across restaurants** — Show the distribution of review scores for many venues to find polarizing ones. Ridgelines make bimodality visible.
10. **Sensor readings across machines** — Display the distribution of readings for each machine to identify those with shifted or noisy output. Stacked densities simplify fleet-wide comparison.

## `ecdf`

1. **Page load times** — Plot the proportion of page views completed within each time to read percentiles directly. An ECDF makes service-level thresholds easy to evaluate.
2. **Model error comparison** — Compare the cumulative distribution of absolute errors across models without binning. The curve shows which model is better at every quantile.
3. **Delivery within a time window** — Show the share of orders delivered within a given number of days. The curve answers promise-date questions directly.
4. **Cumulative income distribution** — Plot the share of households earning less than each level. The ECDF summarizes inequality without smoothing choices.
5. **Latency of two databases** — Overlay ECDFs for two systems to see where one dominates. Crossing curves reveal trade-offs at different percentiles.
6. **Test score percentiles** — Show what fraction of students score below each mark. The curve converts scores into percentile ranks.
7. **Customer spend thresholds** — Plot the share of customers spending below each amount to set loyalty tiers. The ECDF supports threshold selection.
8. **File size distribution** — Show the fraction of files below a size to plan storage tiers. The ECDF handles heavy-tailed data well.
9. **Wait time guarantees** — Display the cumulative proportion of patients seen within a time to check against a target. A single curve reports compliance at all thresholds.
10. **Battery lifetime reliability** — Plot the fraction of devices failing before a given runtime to evaluate reliability. The ECDF estimates the failure distribution directly.

## `beeswarm`

1. **Individual salaries by department** — Show every employee's salary, grouped by department, to see distribution and outliers. A beeswarm preserves each observation while avoiding overlap.
2. **Student scores by class** — Plot each student's score within classes to reveal clusters and extremes. Individual points are retained for small groups.
3. **Athlete results by event** — Display each athlete's result per event to show the spread of performance. The swarm shows both density and individual values.
4. **Clinical outcome by trial arm** — Show each participant's outcome in each arm for transparent reporting. The plot displays raw data rather than only summaries.
5. **Delivery times by courier** — Plot each delivery duration to compare couriers. The swarm reveals consistent versus erratic performance.
6. **Ratings per dish** — Show individual tasting scores for each dish in a sensory panel. Points reveal disagreement among tasters.
7. **Gene expression by condition** — Display individual measurements in each condition to convey sample size and variance. The beeswarm provides raw data view for small experiments.
8. **House sale prices by neighborhood** — Plot every sale in several neighborhoods to see clusters and outliers. Individual points maintain detail.
9. **Response times by server** — Show individual request times per server in a modest sample. The swarm reveals modes and outliers.
10. **Weekly hours by occupation** — Display individual reported hours from a survey grouped by occupation. The swarm shows the real distribution shape.

## `barcode-plot`

1. **Event times along a timeline** — Draw a tick for each event time to reveal bursts and gaps on a single axis. A barcode plot shows the distribution of discrete occurrences compactly.
2. **Gene locations on a chromosome** — Mark positions of genes or variants along a sequence. Ticks show clustering across the coordinate axis.
3. **Customer purchase dates** — Show each purchase as a tick for one customer or several to visualize purchase cadence. Regularity and gaps are immediately visible.
4. **Earthquake occurrences** — Plot the timing of events along a time axis to show clustering and quiet periods. The barcode suits sparse event data.
5. **Word positions in a text** — Mark where a term appears in a document to see how its usage is distributed. Ticks reveal concentration in sections.
6. **Incident times across servers** — Display incident times for each server in rows to see correlated failures. Stacked barcodes facilitate comparison.
7. **Seizure timing** — Show when seizures occurred relative to time of day for a patient diary. The plot highlights temporal patterns.
8. **Release dates for a product line** — Mark each release on a timeline to assess cadence. The barcode makes irregular intervals visible.
9. **Measurement values on a number line** — Place each observation as a tick along a value axis to show distribution in small samples. The plot retains individual values in minimal space.
10. **Bus arrival times** — Show observed arrival times at a stop against the schedule to evaluate punctuality. Ticks reveal bunching.

## `radial-histogram`

1. **Wind direction frequency** — Bin wind bearings to show how often wind blows from each direction. A radial histogram suits directional data, where 0 and 360 degrees connect.
2. **Activity by hour of day** — Count events in each hour around a 24-hour dial. The circular layout respects the wraparound of time.
3. **Birth month distribution** — Bin births by month around a circle to show seasonality. The radial form emphasizes the annual cycle.
4. **Accident occurrence by time of day** — Plot the number of incidents per hour to find risky periods. The clock layout is intuitive.
5. **Ship headings** — Show the distribution of vessel bearings in a shipping lane. The circular bins represent compass directions.
6. **Purchases by hour** — Count purchases in each hour to schedule promotions. A radial histogram shows the daily pattern on a clock.
7. **Animal movement bearings** — Plot the distribution of movement directions from tracking data to detect migration orientation. The radial layout reflects angular data.
8. **Joint angle distribution** — Display the frequency of angles in a biomechanics study. The circular form captures periodic angle values.
9. **Support requests by weekday** — Show counts per weekday around a circle to identify demand cycles. The cyclic layout expresses the weekly period.
10. **Signal phase angles** — Bin phase values of a periodic signal to test phase locking. The circular axis is the natural domain.

## `word-cloud`

1. **Customer review themes** — Display the most frequent terms across product reviews. A word cloud gives a quick impression of dominant topics.
2. **Open-ended survey answers** — Summarize free-text responses by word frequency to surface recurring ideas. Size encodes frequency for a first-pass exploration.
3. **Speech transcript emphasis** — Show the most used words in a public address or lecture. The cloud highlights key themes.
4. **Trending hashtags** — Display hashtags sized by post volume during an event. The cloud conveys what is prominent at a glance.
5. **Research abstract keywords** — Show frequent keywords across a set of papers to sketch the research landscape. Size reflects prevalence.
6. **Support ticket themes** — Summarize words in ticket titles to see common issues. The cloud provides a fast overview before detailed analysis.
7. **Blog tag frequency** — Display tags by number of posts to show editorial focus. Size represents usage.
8. **Popular search terms** — Show queries entered in a site's search box to identify user needs. The cloud gives an intuitive summary.
9. **Skills in job postings** — Display the most requested skills across postings for a role. The cloud communicates demand at a glance.
10. **Employee feedback themes** — Summarize recurring words in engagement survey comments. The cloud is a simple way to share qualitative themes.

## `dot-matrix`

1. **Bug counts by severity** — Show one dot per reported bug grouped by severity category. Dot matrices make counts tangible and support small-number comparisons.
2. **Deliveries per zone** — Display one dot per delivery in each service zone to compare workload. The grid preserves the countable nature of events.
3. **Attendance by session** — Show one dot per attendee for each conference session. The matrix allows quick comparison across sessions.
4. **Survey responses by choice** — Plot one dot per respondent under each response option. The layout shows sample size alongside the distribution.
5. **Patients by triage level** — Display one dot per patient for each triage category in an emergency department snapshot. The dots show both volume and mix.
6. **Units sold by product** — Show each unit sold as a dot under its product for a small shop. The matrix communicates discrete quantities.
7. **Tree species in a survey plot** — Display each counted tree as a dot grouped by species. The matrix provides an inventory view.
8. **Calls by hour** — Place a dot for each call received in every hour of a shift. The grid reveals peaks in a countable manner.
9. **Defects by production line** — Show each defect as a dot grouped by line to compare quality. Dots convey the number of defects directly.
10. **Species sightings by habitat** — Plot one dot per sighting for each habitat type in a wildlife survey. The matrix illustrates sampling effort and diversity.

## `tally-chart`

1. **Classroom election votes** — Record votes using grouped tally marks so students can see counts accumulate. Tallies are intuitive for small counts.
2. **Store entries** — Count customers entering during each interval. Tally marks suit manual counts.
3. **Defects in quality inspection** — Mark each defect found by type on a checksheet. Tallies provide a simple record that can be totaled.
4. **Bird species in a field survey** — Tally sightings by species during an observation session. The format suits fieldwork without devices.
5. **Vehicles at a checkpoint** — Count vehicles by type passing a point. Tally marks work for traffic studies.
6. **Product returns by reason** — Record the reason for each return on a simple sheet. Tallies reveal dominant reasons.
7. **Goals scored by player** — Keep a running count of goals during a season. The tally displays incremental change.
8. **Questions asked in a workshop** — Count questions by topic to adjust content. Tallies are quick to record live.
9. **Support calls by issue** — Mark the issue type for each call during a shift. The sheet provides a base for Pareto analysis.
10. **Pedestrian counts at a crossing** — Record pedestrians per time interval for a safety assessment. Tallies are a practical field method.

## `stem-leaf`

1. **Exam scores** — Show each student's score with tens as stems and units as leaves to see shape and preserve values. A stem-and-leaf plot works well for small samples.
2. **Participant ages** — Display ages of a small study cohort while retaining exact values. The plot shows the distribution and lets readers recover data.
3. **Delivery times in minutes** — Organize a small batch of delivery durations into stems and leaves. The display reveals clusters and gaps.
4. **Student heights** — Show classroom heights with stems as the tens of centimeters. The plot preserves the data while showing its shape.
5. **Salaries in a small team** — Display each salary by stem and leaf to see spread in a team. The format is useful when privacy is not a concern and n is small.
6. **Daily temperatures over a month** — Show each day's temperature to see the distribution of values. Stems group values, and leaves show the exact digits.
7. **Task completion times** — Plot times from a usability test, preserving individual values. The display highlights outliers.
8. **Shipment weights** — Show weights of a small batch of shipments. The plot exposes skew and gaps.
9. **Reaction times** — Display results from a small psychology experiment with stems and leaves. The plot reveals distribution shape and each measurement.
10. **Commute times for a small sample** — Show self-reported commute durations from a survey of a few dozen people. The format makes the distribution and raw values visible together.

## `treemap`

1. **Disk usage by folder** — Show storage consumed by nested directories to find the folders responsible for most space. A treemap encodes size as area and hierarchy as nesting, so large consumers stand out.
2. **Public budget by function and program** — Display spending divided into functions and then programs to show where money goes. Area makes relative allocation easy to compare across many items.
3. **Portfolio holdings by sector and security** — Plot holdings sized by market value and grouped by sector to reveal concentration risk. The nested layout shows both sector weight and individual positions.
4. **Website traffic by section and page** — Show page views nested within site sections to identify which content drives traffic. The treemap supports scanning many pages at once.
5. **Software bundle size by package** — Size rectangles by the bytes each dependency contributes to a build. The layout helps identify which packages to replace or remove.
6. **Population by continent and country** — Display populations nested by region to convey global distribution. Area conveys relative size across hundreds of small units.
7. **Support tickets by product and issue type** — Show ticket volume grouped by product and then issue category to direct engineering effort. The nesting reveals both where and why tickets arise.
8. **Energy consumption by building and system** — Plot consumption by building, subdivided into heating, cooling, and lighting. The treemap highlights the largest energy users in a portfolio.
9. **Revenue by category and product** — Display sales sized by revenue within product categories to see concentration. Large tiles identify best sellers, while small tiles show the long tail.
10. **Hospital spending by department and cost type** — Show expenditure divided by department and cost category to locate cost drivers. The hierarchy supports drill-down across organizational levels.

## `sunburst`

1. **File system hierarchy** — Display nested directories as concentric rings to explore how storage divides at each level. A sunburst keeps the path from root to leaf visible.
2. **Budget breakdown across levels** — Show a multi-level budget from agency to program to line item. Rings communicate hierarchy, and angles communicate share at each level.
3. **Organizational headcount** — Plot staff counts across divisions, departments, and teams. The radial layout displays the structure and relative size of branches.
4. **Species taxonomy** — Show observed species counts nested by class, order, and family. A sunburst reveals the composition of a biodiversity survey.
5. **Customer journey steps** — Display the sequence of first, second, and third actions in a product to see common paths. Rings correspond to step numbers, so branching flows are readable.
6. **Expenses by category, subcategory, and vendor** — Drill from category totals to vendors with angular width showing spend. The plot shows where a few vendors dominate a category.
7. **Codebase composition** — Show lines of code by package, module, and file. The radial hierarchy highlights where complexity is concentrated.
8. **Survey responses by demographic layers** — Show responses nested by region, age group, and answer. Rings let viewers follow how a demographic path divides into choices.
9. **Disease classification cases** — Display case counts across a classification hierarchy from category to specific diagnosis. The chart supports exploring burden at multiple levels of detail.
10. **Product catalog taxonomy** — Show the number of items in each department, category, and subcategory. A sunburst reveals unbalanced areas of a catalog.

## `bubble-pack`

1. **Repository sizes across an organization** — Pack circles sized by code volume and grouped by team to see where the codebase is concentrated. Circle packing shows nested groups and relative size in a compact form.
2. **Support topics and subtopics** — Show ticket volume by topic, with subtopics nested inside. The layout presents both the big themes and the detail.
3. **Cities grouped by country** — Size circles by population within enclosing circles for countries. The packing allows comparison across many cities.
4. **Blog articles by tag** — Display the number of articles per tag with grouping by category. Circles provide an overview of editorial coverage.
5. **Products grouped by category** — Plot circles sized by sales inside category groups to show mix. The layout gives a sense of category dominance.
6. **Time spent by team and project** — Show hours allocated to projects within teams. Nested circles reveal how effort is distributed.
7. **Social media topic volume** — Display discussion volume for topics and subtopics during a campaign. The packed layout suits exploratory views.
8. **Code module size** — Size circles by module within packages to locate large components. The hierarchy mirrors the project structure.
9. **Donations by campaign and donor group** — Show funds raised per campaign, with donor groups nested inside. The bubbles highlight major contributors within each campaign.
10. **Species abundance by genus** — Display counts per species nested within genera from a field survey. Circle packing gives a compact view of abundance and taxonomy.

## `icicle`

1. **Profiler call stack time** — Show how execution time divides across nested function calls as stacked rectangles. An icicle layout preserves hierarchy along one axis, making call depth readable.
2. **Organization headcount** — Display staff counts from company to division to team in aligned rows. The layout shows each level's composition and supports label reading.
3. **Bill of materials cost** — Show product cost breakdown by assembly, subassembly, and part. Rectangles reveal the parts that drive cost.
4. **Website content hierarchy** — Plot pages nested in sections and subsections, sized by content count. The layout reveals the site's structure and depth.
5. **Catalog taxonomy counts** — Show item counts at every level of a product hierarchy. Aligned levels make comparisons across branches easy.
6. **Revenue by region, country, and city** — Display revenue through geographic levels to find strong and weak areas. The icicle layout keeps text horizontal and readable.
7. **Decision process outcomes** — Show how a population divides at each decision step in a process, such as loan review. The layout reveals where most cases end up.
8. **Document clustering hierarchy** — Plot a hierarchy of document clusters with cluster size. Rectangles show nested topical structure.
9. **Job classification structure** — Display the number of positions in occupational groups, subgroups, and titles. The hierarchy allows scanning categories with long labels.
10. **Library holdings by classification** — Show holdings by subject class and subclass. Icicles offer a readable view of deep hierarchies.

## `dendrogram`

1. **Customer hierarchical clustering** — Show how customers merge into clusters by behavioral similarity. The dendrogram reveals cluster structure and the distance at which groups join.
2. **Phylogenetic relationships** — Display the evolutionary relationships among species from genetic distance. Branch structure communicates common ancestry.
3. **Document similarity grouping** — Cluster documents by text similarity and display the merge tree. The tree helps decide how many topics exist.
4. **Gene expression clustering** — Show hierarchical clustering of genes or samples beside an expression matrix. The dendrogram orders rows by similarity.
5. **Product similarity** — Group products by attribute similarity to inform assortment planning. The tree displays nested families of similar items.
6. **Country similarity by indicators** — Cluster countries according to development indicators. The dendrogram shows which countries resemble each other most.
7. **Organizational reporting structure** — Display management hierarchy as a tree from executives to teams. The structure is inherently hierarchical.
8. **Classification decision structure** — Show a decision tree's splits and leaves for a model. The tree makes the decision logic readable.
9. **Sensor behavior grouping** — Cluster sensors by similarity of their time series to identify redundant or faulty units. Merge heights indicate how closely sensors behave.
10. **Survey respondent clustering** — Group respondents by answer patterns to find attitude segments. The dendrogram displays the hierarchy of groupings.

## `voronoi`

1. **Store service areas** — Partition a city so each location is assigned to its nearest store. Voronoi cells show catchment zones defined by proximity.
2. **Nearest airport regions** — Map which airport is closest for each point in a country. Cells reveal gaps in access.
3. **Cell tower coverage zones** — Display the nearest tower for each location to plan coverage. The partition shows where handoffs occur.
4. **Weather station influence areas** — Assign each location to its nearest station to interpolate observations. Cells show the region each station represents.
5. **Fire station response zones** — Partition a city by nearest fire station to evaluate response coverage. The cells reveal areas far from any station.
6. **School catchment zones** — Assign residential locations to the nearest school for enrollment planning. The diagram highlights boundaries and overlaps.
7. **Charging station accessibility** — Show which charging station is nearest for each area to find underserved zones. Cell size indicates relative access.
8. **Environmental sampling cells** — Partition a study area by nearest sampling point to show representativeness. The cells reveal areas with sparse sampling.
9. **Delivery hub territories** — Divide a region among delivery hubs by proximity for routing decisions. The partition clarifies territory boundaries.
10. **Nearest-neighbor decision regions** — Show the regions a k-nearest-neighbor classifier assigns to each class for a two-feature dataset. Voronoi cells explain the classifier's decision boundaries.

## `proportional-area`

1. **Country populations** — Draw a shape for each country sized by population to compare scale. Area encoding gives a quick impression of relative magnitude.
2. **Company market sizes** — Show competing firms as shapes sized by revenue. The layout communicates dominance and the long tail.
3. **Department budgets** — Display each department as a shape sized by allocation. The visual shows proportionality for public communication.
4. **Oil reserves by country** — Size shapes by reserves to convey the concentration of resources. The plot helps audiences grasp scale differences.
5. **Users by social network** — Compare the active user counts of platforms as areas. Area conveys relative audience size.
6. **Export volumes by category** — Show each export category's value as an area. The display makes the main categories clear at a glance.
7. **Disaster costs** — Compare the economic damages of several events with shapes sized by cost. Area highlights the most costly events.
8. **Species counts by group** — Display the number of known species in taxonomic groups as areas. The plot communicates relative diversity.
9. **Campaign donations** — Show amounts raised per campaign as shapes. Areas provide an intuitive representation for a public report.
10. **Energy source capacity** — Size shapes by installed capacity of each energy source. The visual compares scale in an accessible format.

## `radial-line`

1. **Daily energy load cycle** — Plot hourly electricity demand around a 24-hour dial to show the daily shape. A radial line emphasizes the periodic nature of the data.
2. **Monthly temperature cycle** — Show average temperature for each month around a circle. The closed curve shows the annual cycle.
3. **Seasonal sales pattern** — Display monthly sales across a year on a circular axis to reveal seasonality. The shape shows peaks and troughs in the cycle.
4. **Web traffic daily rhythm** — Plot requests per hour as a closed curve to show diurnal patterns. Overlaying days shows regularity.
5. **River flow annual pattern** — Show mean discharge for each calendar month to convey the hydrological regime. The radial layout highlights the snowmelt or monsoon peak.
6. **Circadian body temperature** — Display measured body temperature over 24 hours to look at rhythm. The circular layout fits the daily cycle.
7. **Monthly rainfall across years** — Overlay several years of rainfall on a single circular axis to compare patterns. Multiple radial lines reveal year-to-year variation.
8. **App usage by hour** — Show the typical distribution of sessions around the clock. The curve reveals morning and evening peaks.
9. **Airline passengers by month** — Plot monthly passenger counts around a circle to show the travel season. The curve compares shape across years.
10. **Tidal level over a lunar cycle** — Show water level around a circular time axis. The radial line emphasizes cyclical variation.

## `radial-column`

1. **Monthly sales in a circular layout** — Show sales per month as columns radiating from a center to emphasize the annual cycle. Radial columns present categories in a compact, distinctive format.
2. **Visitors by hour** — Display visit counts per hour around a clock face. The layout maps to familiar time representation.
3. **Monthly rainfall** — Plot rainfall totals in columns around a circle to show the wet season. The radial arrangement highlights cyclical patterns.
4. **Incidents by time of day** — Show counts of incidents per hour to find risky times. Columns around the clock convey the daily distribution.
5. **Energy production by month** — Display generation per month to show seasonal variation in output. Columns facilitate magnitude comparison.
6. **Weekly order volume** — Show orders per weekday around a circle. The layout suits a small, cyclic category set.
7. **Country ranking on an index** — Display index scores as radial columns for a compact ranking of many countries. The format fits a large number of categories into a small area.
8. **Survey categories** — Show scores across themes in a circular arrangement. The layout is engaging for infographic use.
9. **Wildlife sightings by month** — Plot counts for each month to show seasonality of a species. Columns give an intuitive magnitude.
10. **Calls by weekday** — Show call volume for each day around a circle. The layout supports staffing discussions.

## `nested-area`

1. **Budget with nested categories** — Show overall budget as an area that contains categories, which contain line items. Nested areas convey part-to-whole relationships across levels.
2. **Population by country and subnational units** — Display regions inside countries with area proportional to population. The nesting reveals internal distribution.
3. **Market share inside segments** — Show companies within market segments, with both levels sized by revenue. The chart communicates concentration at each level.
4. **Revenue by product and variant** — Display each product's revenue with variant shares nested inside. The layout shows which variants matter within products.
5. **Memory allocation by process and thread** — Show memory consumed by processes with threads nested inside. The chart diagnoses where memory pressure originates.
6. **Customers by region and tier** — Show the number of customers per region divided into subscription tiers. Nesting reveals tier mix within regions.
7. **Energy by building and equipment** — Show consumption by building and its major equipment categories. The plot identifies dominant loads in each building.
8. **Website content composition** — Display content sections with page types nested within them. The layout communicates structure and weight.
9. **Asset breakdown** — Show a company's assets by class and subclass as nested areas. Part-to-whole at two levels is visible together.
10. **Species within taxonomic groups** — Display populations of species nested within genus and family. Nested areas show hierarchical composition.

## `dendrogram-radial`

1. **Large phylogenetic tree** — Arrange hundreds of species around a circle with branches converging to the center. A radial layout fits a large tree into a compact space while keeping lineage relationships visible.
2. **Gene clustering across many samples** — Show hierarchical clustering of thousands of genes in a circular layout with outer annotation rings. The compact form accommodates many leaves that a linear tree could not display legibly.
3. **Large organization structure** — Display an enterprise's reporting hierarchy from the top executive to individual teams. The circular layout keeps a deep and wide tree on one page.
4. **Class hierarchy of a software library** — Plot inheritance relationships among classes to understand library structure. The radial tree shows depth and breadth at a glance.
5. **Product catalog taxonomy** — Show the tree of departments, categories, and products for a large retailer. The layout helps identify unbalanced branches.
6. **Biological process ontology** — Display terms of an ontology organized by parent-child relations. A radial tree supports exploring many nested terms.
7. **Knowledge base category tree** — Show the hierarchy of help articles to evaluate navigation design. The circular layout makes deep branches easier to scan.
8. **Repository folder structure** — Plot a large code repository's directories as a tree. The radial form highlights areas with many subfolders.
9. **Industry classification** — Display sectors, industries, and sub-industries as a circular tree. The layout communicates taxonomy structure compactly.
10. **Microbial community taxonomy** — Show taxa observed in a sample arranged by lineage, with outer rings for abundance. The circular layout combines tree structure and annotation.

## `network`

1. **Social network structure** — Plot people as nodes and relationships as edges to reveal communities and hubs. A network diagram shows connectivity that tabular data obscures.
2. **Server infrastructure topology** — Show servers, load balancers, and databases connected by links to understand dependencies. The diagram helps reason about failure propagation.
3. **Web page link graph** — Display pages and hyperlinks to find central or isolated content. Edges reveal navigation structure.
4. **Research collaboration network** — Show authors connected by co-authored papers. The layout reveals research groups and bridge researchers.
5. **Protein interaction network** — Plot proteins as nodes and known interactions as edges. The network reveals functional modules.
6. **Character co-appearance network** — Show characters linked when they appear in the same scene. The graph highlights central figures and subgroups.
7. **Transaction network for fraud detection** — Display accounts connected by transfers to find rings of suspicious activity. Network structure exposes patterns that single records do not.
8. **Software dependency graph** — Show packages connected by dependency relationships to assess impact of changes. The diagram highlights critical shared components.
9. **Airline route network** — Plot airports as nodes and routes as edges to identify hubs and connectivity gaps. The network view shows structure of the system.
10. **Supply chain relationships** — Show suppliers, manufacturers, and distributors and their links. The network exposes single points of failure.

## `arc-diagram`

1. **Character interactions along a story** — Order characters by first appearance and draw arcs for interactions. The linear layout preserves narrative order while showing connections.
2. **Module call dependencies** — Arrange source modules along a line and draw arcs for calls between them. Arc spans reveal long-distance dependencies.
3. **Gene interaction along a sequence** — Place genes in genomic order and link interacting pairs. The arcs show whether interactions are local or distant.
4. **Word co-occurrence in a text** — Order words by position or frequency and link those that co-occur. Arcs convey relationships in a compact linear form.
5. **Linked events along a timeline** — Draw arcs between events that are causally related across time. The arcs show the span between cause and effect.
6. **Legal citation ordering** — Order cases by date and connect those that cite earlier decisions. Arcs show how precedent builds over time.
7. **Repeated patterns in music** — Link segments of a piece that repeat to show structure. Arc size reveals the distance between repetitions.
8. **Stations along a transit line** — Draw arcs between stations connected by transfers or shared service. The linear order mirrors the geography.
9. **Email exchange between ordered individuals** — Order people by role or seniority and link those who correspond. Arcs reveal communication across levels.
10. **RNA base pairing** — Arrange nucleotides along a sequence and draw arcs for base pairs to show secondary structure. The form displays nested and crossing pairs.

## `adjacency-matrix`

1. **Dense social network** — Represent connections among many people as a grid where filled cells mark ties. A matrix avoids the tangled edges of node-link diagrams in dense graphs.
2. **Software component dependencies** — Show which components depend on which with rows and columns ordered by module. The matrix exposes clusters and cyclic dependencies.
3. **Co-authorship matrix** — Plot researchers on both axes and shade cells for joint papers. Reordering reveals research communities.
4. **Inter-team communication** — Show message volume between teams with cell intensity. The matrix identifies silos and heavy interfaces.
5. **Protein interactions** — Display interaction presence among many proteins. The matrix handles large, dense networks legibly.
6. **Trade flows between countries** — Show the value exported from each country to each partner with cell color. The matrix accommodates many pairs with clear lookup.
7. **Character co-occurrence** — Plot how often pairs of characters appear together in scenes. Sorting reveals groups of characters that interact.
8. **Web page links** — Display links among pages of a site to audit navigation. The matrix highlights orphan pages and heavy hubs.
9. **Scheduling conflicts** — Show pairs of tasks or events that conflict using filled cells. The grid supports checking constraint satisfaction.
10. **State transitions in a process** — Display the frequency of transitions between states from logs. The matrix exposes common and rare transitions.

## `parallel-sets`

1. **Passenger class, sex, and outcome** — Show how passengers divide across categorical attributes, with ribbons linking categories. Parallel sets display relationships among several categorical variables.
2. **Education, occupation, and income bracket** — Follow how people with each education level move into occupations and income groups. The ribbons show the association across three dimensions.
3. **Diagnosis, treatment, and outcome** — Display how patients flow from diagnosis groups to treatments to outcomes. The chart reveals common pathways.
4. **Plan, device, and region** — Show the joint distribution of subscription plan, device type, and region. Ribbons help identify notable combinations.
5. **Category, channel, and customer type** — Plot how purchases divide across product category, sales channel, and customer type. The form shows multidimensional categorical composition.
6. **Applicant stage and decision** — Display application sources, review stages, and final decisions. Ribbons show where candidates drop out.
7. **Survey categorical questions** — Show respondents' answers across several categorical questions to find response patterns. Parallel sets reveal associations without modeling.
8. **Incident type, severity, and resolution** — Follow incidents from type through severity to resolution method. The chart highlights which combinations are common.
9. **Major, employment status, and sector** — Display how graduates of each major distribute across employment outcomes and sectors. Ribbons reveal links between study and career.
10. **Crop, soil, and irrigation method** — Show how farms combine crop, soil type, and irrigation approach. The plot exposes typical combinations.

## `venn`

1. **Overlap of customer groups** — Show how many customers belong to multiple segments. A Venn diagram expresses set intersection directly.
2. **Shared skills across teams** — Display which skills are common or unique among several teams. The overlap highlights shared capabilities.
3. **User sets across two products** — Show users of each product and those using both. The diagram quantifies cross-product adoption.
4. **Keywords shared between documents** — Display terms appearing in one, two, or all documents. The overlap illustrates common vocabulary.
5. **Overlapping gene sets** — Show genes identified by different experiments and their intersections. A Venn diagram is a standard summary for small numbers of sets.
6. **Feature sets across competing products** — Compare the features each product supports and those they share. The diagram reveals unique differentiators.
7. **Audience overlap across campaigns** — Show how many people were reached by multiple campaigns. The view informs frequency and reach planning.
8. **Search result overlap** — Display which results appear in multiple search systems. The overlap shows agreement and divergence.
9. **Survey respondents by interest** — Show respondents interested in one, two, or three topics. The chart summarizes membership in multiple categories.
10. **Shared suppliers across business units** — Display suppliers used by several units to find consolidation opportunities. The overlap identifies suppliers common to multiple groups.

## `sankey`

1. **Energy flows from sources to end uses** — Trace energy from primary sources through conversion to sectors of consumption. A Sankey diagram shows quantity at each step and where losses occur.
2. **Public budget from revenue to spending** — Show how revenue streams divide into spending categories. Flow widths make the allocation of each source visible.
3. **User navigation flows** — Display how visitors move from landing pages to subsequent pages and exits. The diagram highlights dominant paths and drop-offs.
4. **Material flows through processing** — Follow raw material through production stages to products, waste, and recycling. Flow widths show the balance of inputs and outputs.
5. **Water from sources to sectors** — Show abstraction from rivers and aquifers to agriculture, industry, and households. The chart reveals which sources serve which uses.
6. **Student progression** — Display how cohorts move across years, transfers, and graduation or dropout. The flows quantify retention and exits.
7. **Household income and expenditure** — Show income sources splitting into spending categories and savings. The diagram communicates how money moves through a budget.
8. **Lead flow through sales stages** — Trace leads from source channel to qualification to closed outcomes. Flow widths show which channels produce wins.
9. **Nonprofit funds to programs** — Show donations from different sources to programs and overhead. The diagram supports transparency in fund allocation.
10. **Order fulfillment flows** — Follow orders from warehouses through carriers to delivery outcomes. The chart identifies paths with frequent delays or returns.

## `chord`

1. **Trade flows between regions** — Show bilateral exports and imports among trading blocs as ribbons around a circle. A chord diagram conveys pairwise flow magnitude and direction among a small number of entities.
2. **Migration between regions** — Display the number of people moving between regions. Ribbon widths reveal the dominant corridors.
3. **Call volumes between departments** — Plot the volume of internal calls between departments. The chord layout highlights collaboration patterns.
4. **Interbank transfers** — Show transfer volume between institutions to reveal concentration and dependency. Ribbons quantify each relationship.
5. **Topic co-occurrence in documents** — Display how often topics appear together in a corpus. The diagram shows strong pairings among a limited set of topics.
6. **Traffic between network subnets** — Show data volume exchanged among subnets for capacity and security review. Ribbons reveal unexpected communication.
7. **Regulatory interactions among gene families** — Display counts of regulatory links between families. The chord shows interaction structure at an aggregate level.
8. **Passenger flows between cities** — Show travelers moving among several cities. The diagram highlights symmetrical and asymmetrical flows.
9. **Collaboration among institutions** — Display joint publications between institutions. Ribbons show the strength of each partnership.
10. **Student transfers between majors** — Show how students switch among majors. The chord makes inflows and outflows for each major visible.

## `funnel`

1. **Checkout conversion** — Show the number of users at each step from cart to payment to confirmation. A funnel shows drop-off between sequential stages.
2. **Sales pipeline** — Display opportunities remaining at each stage from lead to closed-won. The shape shows where deals are lost.
3. **Recruitment process** — Plot candidates from application through screening, interview, and offer. The funnel highlights selectivity at each step.
4. **Onboarding drop-off** — Show users completing each onboarding step of an app. The narrowing identifies the steps that cause abandonment.
5. **Marketing funnel** — Display impressions, clicks, signups, and purchases. The funnel shows conversion rates between stages.
6. **Support escalation** — Show tickets resolved at each tier and those escalated. The shape reveals how many issues require senior support.
7. **Clinical trial enrollment** — Plot the number of people screened, eligible, enrolled, and completed. The funnel communicates attrition at each stage.
8. **Loan approval process** — Show applications through verification, underwriting, and funding. The plot highlights bottlenecks in the process.
9. **Email campaign engagement** — Display emails sent, delivered, opened, and clicked. The funnel conveys engagement decay.
10. **Donor conversion** — Show visitors, donors starting a gift, and completed donations. The funnel helps optimize the donation form.

## `marimekko`

1. **Market share by segment and company** — Use column width for segment size and segment heights for company shares. A Marimekko shows two levels of proportion at once.
2. **Revenue by region and product line** — Set column width to regional revenue and stack product shares within. The chart shows which regions matter and what they buy.
3. **Customers by segment and plan** — Display segment size by width and plan mix within each. The layout reveals how plan adoption differs by segment.
4. **Budget by department and expense type** — Show department size by width and expense categories as heights. The chart communicates relative size and composition.
5. **Workforce by department and seniority** — Set width to department headcount and stack seniority levels. The chart highlights departments with unusual structure.
6. **Survey results by demographic and response** — Use width for group size and stacks for response categories. Readers see both group weight and response mix.
7. **Energy consumption by sector and source** — Show sector consumption by width with fuel shares in each. The layout communicates how different sectors rely on fuels.
8. **Portfolio by asset class and region** — Display allocation to asset classes by width and regional mix inside each. The chart summarizes diversification.
9. **Sales by channel and customer type** — Set width to channel revenue and stacks to customer type. The chart reveals the contribution of each combination.
10. **Land use by region and category** — Show region size by width and land use categories as heights. The Marimekko displays composition and scale simultaneously.

## `stream-graph`

1. **Music genre popularity** — Show how the listening share of genres rises and falls over years. A stream graph displays flowing composition with a smooth baseline.
2. **News topic coverage** — Plot the volume of articles by topic over months to see the rise of emerging themes. The organic shape conveys shifts in attention.
3. **Website traffic by source** — Show the flow of visits from various sources over time. The layered streams reveal changes in mix and volume.
4. **Programming language usage** — Display the share of repositories by language across years. Streams reveal adoption and decline.
5. **Forum discussion topics** — Show how discussion volume shifts among topics during events. The graph highlights bursts.
6. **Seasonal species abundance** — Plot counts of species across months in an ecological survey. Streams show seasonal turnover.
7. **Keywords in research papers** — Display the number of papers mentioning keywords over years. The layers highlight emerging and fading research themes.
8. **Repository activity by team** — Show commit volume per team over time. The stream graph emphasizes relative activity and total effort.
9. **Seasonal product popularity** — Plot sales of product lines across the year. Streams reveal seasonal peaks.
10. **Emergency dispatch categories** — Show incident categories over time to see when demand types rise. The flowing layers reveal changing composition.

## `alluvial`

1. **Voter switching between elections** — Show how voters who chose each party in one election voted in the next. An alluvial diagram displays changes in membership across time points.
2. **Customer segment migration** — Display customers moving among segments between periods. The ribbons quantify upgrades, downgrades, and churn.
3. **Student progression between majors** — Show how students move among majors across years. The diagram highlights popular transitions.
4. **Cluster membership over time** — Display how items are assigned to clusters across successive analyses. The ribbons expose stability and change.
5. **Employee movement between departments** — Show internal mobility year over year. The diagram reveals which departments feed others.
6. **Patient stage transitions** — Plot patients moving among disease stages across visits. Alluvial flows convey progression and regression.
7. **Topic group evolution** — Show how topic clusters in a corpus merge and split across time windows. The diagram visualizes evolution.
8. **Brand switching** — Display shifts in the brand purchased between survey waves. Ribbons show the flow of loyalty and defection.
9. **Subscription tier movement** — Show users changing plans between quarters. The diagram quantifies movement among tiers.
10. **Land cover change** — Plot area moving between land cover classes across two surveys. The ribbons indicate conversion, such as forest to cropland.

## `chord-nonribbon`

1. **Package dependencies bundled by module** — Draw edges between packages arranged around a circle according to their module hierarchy. The lines reveal dependency structure without ribbon thickness.
2. **Relationships among departments** — Show which departments interact with each other as curved lines. The simple connections suit binary relationships.
3. **Treaty memberships** — Connect countries that belong to the same agreements. The chord layout displays overlapping membership.
4. **Gene-disease associations** — Link genes to diseases around a circle. The diagram presents links without volume data.
5. **Social account interactions** — Show which accounts mention or follow one another. Lines convey the presence of ties.
6. **Airport connections** — Connect airports with direct flights. The circular arrangement shows network structure compactly.
7. **Tag co-usage** — Draw lines between tags that appear on the same item. The layout reveals clusters of related tags.
8. **Co-authorship in a small group** — Connect researchers who have co-authored papers. The chart is simple and readable for modest sizes.
9. **State transitions** — Connect states in a system between which transitions are possible. The chord layout conveys reachability.
10. **Class import relationships** — Show which classes import others in a code base. Lines indicate existence of dependencies.

## `slope-chart`

1. **Sales change between two periods** — Connect each product's sales in two years with a line. A slope chart shows change direction and magnitude across many items.
2. **Rank change between years** — Show the rank of each country in two years. The slopes highlight risers and fallers.
3. **Before and after experiment** — Plot measurements for each subject before and after an intervention. The slope conveys individual change.
4. **Test score change** — Display each school's results on two tests. Lines show improvement or decline.
5. **Survey waves** — Show the percentage agreeing with statements in two waves. The chart communicates opinion shifts.
6. **Market share shift** — Plot each company's share in two years. Slopes indicate winners and losers.
7. **Life expectancy change** — Show country values at two dates. The chart emphasizes progress.
8. **Price changes between years** — Display item prices in two years to highlight inflation differences. Steeper lines show larger changes.
9. **Department budget change** — Show allocations in consecutive years. The slope reveals priority shifts.
10. **Team satisfaction change** — Plot engagement scores by team across two surveys. The chart spotlights teams improving or declining.

## `candlestick`

1. **Daily stock price movement** — Show open, high, low, and close for each trading day. A candlestick shows direction and range in one glyph.
2. **Cryptocurrency price action** — Display price movement at hourly intervals for volatile assets. Candles convey range and sentiment.
3. **Foreign exchange movement** — Plot a currency pair's session ranges to analyze volatility. The glyph highlights direction and extremes.
4. **Commodity prices** — Show daily ranges of oil or metal futures. Candlesticks reveal trend and reversal patterns.
5. **Index movement** — Display a market index's weekly open-high-low-close. The chart summarizes broad market behavior.
6. **Intraday price behavior** — Plot short-interval candles to study price action around announcements. The compact glyph captures movement within each interval.
7. **Energy price range** — Show daily open, high, low, and close of power contract prices. Candles reveal volatility in energy markets.
8. **Bond yield movement** — Display weekly yield ranges for a benchmark bond. The chart shows direction and volatility.
9. **Earnings window behavior** — Plot candles before and after an earnings release to see reaction. The glyphs show gap moves and ranges.
10. **Housing price index** — Show periodic ranges of a property index in financial analysis. Candles summarize movement within each period.

## `parallel-coords`

1. **Vehicle specifications** — Plot each car as a line across axes for weight, power, efficiency, and price. Parallel coordinates show multivariate profiles and trade-offs.
2. **Student profiles** — Show students across subject scores to identify patterns. Lines reveal typical and unusual profiles.
3. **Product attributes** — Display products across specifications to filter candidates. Brushing axes narrows down options.
4. **Patient group health indicators** — Plot patients on several biomarkers to see differences among groups. Lines colored by group reveal patterns.
5. **Customer cluster features** — Show customers across behavioral features, colored by cluster. The chart explains cluster characteristics.
6. **Model performance metrics** — Compare machine learning models across accuracy, precision, recall, and latency. Lines expose trade-offs.
7. **Sensor variables** — Display readings across many variables to find unusual operating states. Parallel axes show high-dimensional relationships.
8. **Country indicators** — Plot countries across economic and social indicators. The chart identifies groups with similar profiles.
9. **Job candidates** — Show candidates' ratings across criteria. Lines facilitate comparing multiple profiles.
10. **Material selection** — Display materials across properties such as density, strength, and cost. The plot supports engineering trade-off decisions.

## `bump-chart`

1. **Sports team ranking over a season** — Plot each team's league position by week. A bump chart focuses on rank changes rather than values.
2. **Country ranking on an index** — Show rank of countries across years. Crossing lines highlight overtakes.
3. **Top songs on a chart** — Display chart positions over weeks. The chart shows entries, climbs, and falls.
4. **Product sales rank** — Show products' rank by sales each month. The chart reveals changing leaders.
5. **Programming language rank** — Plot popularity rankings across years. Lines show which languages rise and decline.
6. **Search ranking of websites** — Display each site's position for a query over time. The chart tracks visibility changes.
7. **University ranking** — Show institutions' positions over years. Crossing lines indicate relative change.
8. **City livability rank** — Plot rank of cities across survey editions. The chart highlights shifts in standing.
9. **Poll ranking of candidates** — Show the rank of candidates across successive polls. The plot displays changes in competitive positions.
10. **Brand satisfaction ranking** — Display rank by customer satisfaction across quarters. The chart shows the persistent leaders and movers.

## `mixed-bar-line`

1. **Revenue and profit margin** — Plot revenue as bars and margin as a line on a secondary axis. The combination shows volume and efficiency together.
2. **Rainfall and temperature** — Show monthly rainfall bars with temperature as a line to describe a climate. The chart communicates two variables with different units.
3. **Monthly sales and growth rate** — Display sales bars and year-over-year growth as a line. Viewers see both magnitude and momentum.
4. **Visits and conversion rate** — Plot visits as bars and conversion as a line. The chart reveals whether traffic growth carries conversion.
5. **Production volume and defect rate** — Show output with quality as a line to detect when volume harms quality. The combination highlights trade-offs.
6. **Orders and average order value** — Display order counts as bars and average value as a line. The chart separates volume effects from value effects.
7. **Ad spend and return on ad spend** — Plot spending bars and return line to assess efficiency. The mixed chart shows diminishing returns.
8. **Patient volume and wait time** — Show daily patients as bars and average wait as a line. The chart reveals how demand relates to delay.
9. **Energy consumption and outdoor temperature** — Display usage bars with temperature as a line to explain load. The combination shows weather sensitivity.
10. **Ticket volume and resolution time** — Plot tickets as bars and resolution time as a line. The chart highlights when high volume slows service.

## `mixed-stacked-line`

1. **Revenue by product with target line** — Stack revenue by product for each quarter and overlay the target as a line. The chart shows composition of the total and whether the total meets the goal.
2. **Generation by source with demand line** — Stack electricity supply by source and overlay demand to assess adequacy. The line marks the requirement the stacked supply must cover.
3. **Costs by type with budget cap** — Show stacked monthly costs for labor, materials, and overhead against a budget limit line. The chart shows which cost component pushes spending over the cap.
4. **Traffic by channel with goal line** — Stack visits by channel and overlay the traffic goal. The display shows composition and progress toward the target.
5. **Inventory by warehouse with reorder level** — Stack stock held across warehouses with a line for the reorder threshold. The chart reveals when total stock approaches replenishment needs.
6. **Headcount by department with hiring plan** — Show staff by department stacked over quarters with the planned total as a line. The chart compares actual growth and plan.
7. **Tickets by category with resolution time** — Stack ticket volumes by category and plot average resolution time as a line on a secondary axis. The view relates workload mix to service speed.
8. **Sales by region with moving average** — Stack sales by region and overlay a moving average of the total. The line smooths noise while the stack gives composition.
9. **Expenses by category with cumulative total** — Stack monthly expenses and plot the year-to-date total as a line. The chart shows both monthly mix and accumulation.
10. **Appliance load with grid capacity limit** — Stack household appliance power over a day against a capacity limit line. The chart shows when combined loads approach the limit.

## `dumbbell`

1. **Gender pay gap by occupation** — Plot median pay for two groups per occupation and connect them. A dumbbell emphasizes the size of the gap across categories.
2. **Planned versus actual delivery date** — Show both dates for each shipment to see slippage. The connecting line measures the delay.
3. **Urban and rural access by region** — Compare access rates to a service between two populations for each region. The gap highlights inequity.
4. **Target versus actual sales by representative** — Plot quota and attainment per person. The distance conveys over- and underperformance.
5. **Asking and selling price by neighborhood** — Show the listing price and final price for each area. The dumbbell reveals negotiation margins.
6. **Measured value versus reference limit** — Compare laboratory measurements to regulatory limits across samples. The gap shows headroom or exceedance.
7. **Predicted versus observed by category** — Plot forecast and actual values per product category. The chart reveals where forecasts are biased.
8. **Price comparison between two retailers** — Show the price of each item at two retailers. The connecting line indicates the price difference.
9. **Self-reported versus measured activity** — Compare survey responses with sensor data for each participant group. The gap shows reporting bias.
10. **Treatment and control outcome by site** — Display outcomes for intervention and control at each site. The dumbbell shows consistency of the effect.

## `pareto`

1. **Manufacturing defect types** — Rank defect categories by frequency with a cumulative percentage line. A Pareto chart shows which few categories account for most defects.
2. **Customer complaint categories** — Order complaints by count and show the cumulative share. The chart directs attention to the vital few issues.
3. **Machine downtime causes** — Rank causes of downtime by lost hours. The cumulative line indicates where fixes yield most benefit.
4. **Medication error types** — Order categories of medication errors in a hospital by frequency. The chart supports prioritizing safety initiatives.
5. **Security alerts by rule** — Rank detection rules by number of alerts to find noisy ones. The cumulative line shows how many rules drive most alerts.
6. **Modules generating most bugs** — Order software modules by defects. The Pareto highlights where refactoring has greatest impact.
7. **Product returns by reason** — Rank return reasons by count. The cumulative percentage identifies top drivers.
8. **Expense categories** — Order categories of spending by amount to find cost-saving opportunities. The curve shows concentration of spend.
9. **Reasons for late deliveries** — Rank causes of delays in logistics. The chart identifies the main operational bottlenecks.
10. **Contributing factors in road accidents** — Order factors by frequency to target safety interventions. The cumulative line shows the factors with greatest combined share.

## `span-chart`

1. **Project task schedule** — Draw each task as a bar from start to end across a calendar. A span chart shows overlap, sequencing, and duration.
2. **Lifespans of historical figures** — Plot birth to death intervals for people in a period. The chart reveals overlaps between lives.
3. **Employee tenure** — Show the start and end dates of each employee's service. The spans reveal turnover patterns.
4. **Store opening hours** — Plot opening and closing times for each day of the week. The chart highlights differences in hours.
5. **Contract validity periods** — Show active periods of contracts to manage renewals. Overlaps and gaps are easy to see.
6. **Reigns of rulers** — Display the start and end of rule for successive leaders. The chart shows succession and overlap.
7. **Patient length of stay** — Plot admission to discharge for patients in a ward. Spans show bed occupancy over time.
8. **Maintenance windows** — Show scheduled downtime periods per system. The chart reveals conflicts between windows.
9. **Crop growing seasons** — Plot planting to harvest periods for several crops. The spans support crop calendar planning.
10. **Service outage durations** — Display each outage as a span per system. The chart highlights long and overlapping incidents.

## `error-bars`

1. **Experimental group means with confidence intervals** — Plot group means and their intervals to judge whether differences are distinguishable. Error bars convey uncertainty around estimates.
2. **Average test scores with standard deviation** — Show mean scores by class with variability. The bars reveal consistency within groups.
3. **Survey proportions with margins of error** — Display the share choosing each answer with sampling error. The chart communicates statistical precision.
4. **Mean latency with variability** — Plot average response time per endpoint with spread. The bars show stability of performance.
5. **Crop yield by treatment with standard error** — Compare mean yields for treatments with their precision. The error bars support inference about treatment effects.
6. **Forecast values with uncertainty** — Show point forecasts for future periods with intervals. The bars communicate forecast risk.
7. **A/B test results** — Plot the conversion rate for each variant with intervals. The chart indicates whether intervals overlap.
8. **Instrument measurement uncertainty** — Show readings with stated instrument uncertainty for each calibration point. The bars convey measurement quality.
9. **Cross-validation accuracy** — Display model accuracy averaged over folds with variation. The bars indicate how stable performance is.
10. **Subgroup outcomes in a clinical study** — Plot effect estimates for subgroups with confidence intervals. The display shows whether results are consistent across groups.

## `connected-scatter`

1. **Unemployment and inflation path** — Plot the two variables against each other and connect points in time order. A connected scatter reveals loops and trajectories that separate charts hide.
2. **Income and life expectancy trajectory** — Show a country's path through income and health space over decades. Connected points show how development evolved.
3. **Price and quantity demanded over time** — Plot price against sales volume by period. The path illustrates changes in demand behavior.
4. **Revenue and profit trajectory** — Show a company's positioning across years in revenue and profit. The connection reveals growth patterns.
5. **Athlete metrics through a season** — Plot two performance indicators for each match in order. The path shows how an athlete's profile evolves.
6. **Cases and vaccination coverage** — Display epidemic incidence against vaccine uptake across weeks. The path highlights how they moved together.
7. **Storm track positions** — Plot latitude and longitude of successive positions and connect them. The line shows the path of a moving object.
8. **Price and trading volume** — Show how a stock's price and volume moved together over time. The path reveals regimes.
9. **Temperature and energy use over days** — Plot daily temperature against consumption in sequence. Loops reveal seasonal hysteresis.
10. **Stress-strain loop of a material** — Plot stress against strain through a loading cycle. The connected path shows hysteresis behavior.

## `quadrant-chart`

1. **Feature prioritization by impact and effort** — Place candidate features in quadrants to choose quick wins. A quadrant chart supports prioritization decisions.
2. **Product positioning by price and quality** — Plot products to compare market positions. The quadrants clarify premium, value, and budget segments.
3. **Risk register by likelihood and severity** — Place risks by probability and impact to focus mitigation. The quadrant highlights critical risks.
4. **Performance and potential grid** — Plot employees by current performance and potential for succession planning. The quadrants suggest development actions.
5. **Stakeholder power and interest** — Place stakeholders to decide engagement strategy. Quadrants map to approaches such as manage closely or keep informed.
6. **Customer value and loyalty** — Plot customers by value and loyalty to target retention efforts. The chart reveals at-risk high-value accounts.
7. **Investment risk and return** — Place investment options by risk and expected return. The chart shows efficient and unattractive options.
8. **Technology maturity and adoption** — Plot technologies by maturity and adoption to guide technology choices. Quadrants identify emerging and established options.
9. **Task urgency and importance** — Place tasks in the four-quadrant scheme for time management. The layout supports triage.
10. **Vendor cost and quality** — Plot vendors by cost and quality score in a procurement review. The quadrants show preferred suppliers.

## `timeline`

1. **Project milestones** — Show key milestones along a schedule with dates and labels. A timeline communicates the sequence of events.
2. **Company history** — Display founding, funding, product launches, and acquisitions. The timeline gives a chronological narrative.
3. **Software release history** — Plot versions and major features by date. The chart shows release cadence.
4. **Incident post-mortem** — Show detection, escalation, mitigation, and resolution events in order. The timeline supports analysis of response time.
5. **Historical events** — Display major events of a period with context. The timeline aids understanding of causality and sequence.
6. **Patient treatment history** — Plot diagnoses, procedures, and medications along time. The chart helps clinicians see the course of care.
7. **Product roadmap** — Show planned releases and initiatives by quarter. The timeline communicates priorities and timing.
8. **Legal case stages** — Display filings, hearings, and rulings. The timeline clarifies procedural progress.
9. **Career path** — Show positions, projects, and education over time. The timeline tells a professional story.
10. **Regulatory changes in an industry** — Plot the dates of new rules and amendments. The timeline shows the cadence of change.

## `calendar-heatmap`

1. **Daily code contributions** — Color each day of a year by commits. A calendar heatmap reveals streaks, weekly rhythm, and quiet periods.
2. **Daily website traffic** — Show visits per day over months to identify weekday patterns and campaign spikes. The calendar layout aligns days of the week.
3. **Workout days** — Display exercise frequency across a year. The calendar shows consistency.
4. **Daily sales** — Color each day by revenue to identify seasonal peaks and promotions. The layout facilitates spotting holidays.
5. **Habit tracking** — Mark days a habit was completed. The chart reveals streaks and breaks.
6. **Support tickets per day** — Show volume by calendar day to plan staffing. The heatmap exposes cyclical workload.
7. **Temperature anomalies** — Color each day by deviation from normal. The calendar reveals heat waves and cold snaps.
8. **Server incident days** — Show days with incidents in a year. The heatmap highlights clusters of instability.
9. **Class attendance** — Display attendance rate per day across a term. The calendar reveals patterns around holidays.
10. **Daily energy consumption** — Show electricity use by day to spot seasonal and weekly patterns. The calendar layout helps identify anomalies.

## `cycle-plot`

1. **Monthly sales across years** — Group values by month and show each month's trend across years. A cycle plot separates seasonality from long-term change.
2. **Weekday web traffic over weeks** — Plot each weekday's series across weeks. The chart shows whether a given weekday is trending.
3. **Seasonal electricity use by year** — Show how each month's consumption evolves over time. The plot reveals both seasonality and efficiency improvements.
4. **Airline passengers by month** — Display each month's subseries to show seasonal pattern and growth. Lines per month show trend within season.
5. **Hourly server load across days** — Plot each hour's load across days to reveal the daily cycle and drift. The chart distinguishes periodic and trend components.
6. **Quarterly revenue** — Show each quarter's revenue across years. The chart highlights quarter-specific growth.
7. **Retail seasonal demand** — Plot demand for each month across years for a product. The cycle plot shows seasonal peaks and structural changes.
8. **Monthly rainfall** — Display each calendar month's rainfall across decades. The chart reveals climate trends by season.
9. **Hospital admissions by weekday** — Show admissions for each weekday over weeks. The plot reveals weekly structure.
10. **Seasonal unemployment** — Plot monthly unemployment subseries across years. The cycle plot separates seasonal effects from trend.

## `dot-plot`

1. **Survey scores by category** — Show each category's score as a dot on a shared axis. A dot plot gives precise comparisons using position along a common scale.
2. **Test scores by school** — Display average scores for many schools in sorted order. The dots emphasize differences without heavy bars.
3. **Regional illness rates** — Show rates of a disease across regions. The dot plot supports comparing many regions.
4. **Item prices across stores** — Plot each store's price per item to see variation. Multiple dots per row reveal price dispersion.
5. **Life expectancy by country** — Display values for countries in rank order. Dots make comparison easy.
6. **Team performance across metrics** — Plot multiple metrics per team with dots of different colors. The chart allows comparing teams on several measures.
7. **Average salary by occupation** — Show mean wage for many occupations. Sorted dots provide a clear ranking.
8. **Language popularity** — Display the share of developers using each language. The dot plot fits long label lists.
9. **Model error rates** — Plot error rates for multiple models and datasets. The compact display enables comparison.
10. **Poll support by demographic** — Show the percentage supporting a policy for each demographic group. The dot plot highlights differences across groups.

## `time-table`

1. **Train timetable** — Show departure and arrival times for a route in a grid. A time table conveys schedules with exact times and stops.
2. **Class schedule** — Display classes by weekday and time slot for a school. The grid helps students plan their week.
3. **Employee shift roster** — Show who is scheduled for each shift and day. The table reveals coverage and conflicts.
4. **Conference sessions** — Plot sessions across rooms and time slots. The layout helps attendees choose talks without overlap.
5. **Meeting room availability** — Display booked and free slots for rooms. The grid shows availability at a glance.
6. **Equipment booking** — Show reservations of shared equipment by time. The chart prevents double booking.
7. **Factory machine schedule** — Plot planned production runs for each machine across the day. The grid reveals utilization and idle time.
8. **Flight departures** — Show scheduled departures by gate and time. The table supports operations and passenger information.
9. **Clinic doctor schedule** — Display clinics by doctor and time slot. The layout supports appointment planning.
10. **Bus frequency by hour** — Show departures per hour for a route by day type. The grid conveys service frequency.

## `ohlc`

1. **Long equity price history** — Plot daily open, high, low, and close for a stock across several years. OHLC bars are lighter than candlesticks, so long series remain readable.
2. **Foreign exchange sessions** — Show open, high, low, and close for a currency pair by trading session. The bars reveal range and direction of each session.
3. **Futures settlement analysis** — Display daily bars for a futures contract to examine volatility around delivery dates. The glyph shows the range and closing level.
4. **Weekly index bars** — Plot weekly OHLC values for a market index for trend analysis. The compact marks suit dense multi-year views.
5. **Hourly cryptocurrency price** — Show hourly ranges for a volatile asset during a news event. OHLC bars show each interval's extent and close.
6. **Bond price behavior** — Display daily bars for a bond price to study reaction to rate announcements. The bars convey movement within each day.
7. **Power contract prices** — Plot daily OHLC for electricity contracts across a season. The chart shows volatility in a market with sharp swings.
8. **Sector fund comparison** — Show OHLC bars of several funds stacked vertically for comparison of ranges. The narrow glyph allows small multiples.
9. **Daily inventory level** — Plot opening stock, peak, trough, and closing stock each day in a warehouse. The OHLC structure applies to any series with four summary values per period.
10. **Daily queue depth** — Show the first, highest, lowest, and last queue length of a message system per day. The bars reveal bursts and backlog within each day.

## `renko`

1. **Noise-filtered trend view** — Display a stock's trend using fixed-size price bricks that ignore time. Renko removes small fluctuations so sustained moves stand out.
2. **Reversal confirmation** — Show a currency pair where a new brick in the opposite direction requires a move of two brick sizes. The chart makes reversals unambiguous.
3. **Support and resistance levels** — Plot a commodity's price path to locate levels where bricks repeatedly reverse. The uniform bricks make levels easy to spot.
4. **Volatility-scaled bricks** — Use brick size derived from average true range so the chart adapts to an asset's volatility. The approach keeps detail comparable across instruments.
5. **Multi-asset trend comparison** — Compare the trend structure of several assets independent of their time scales. Renko charts align on price movement, not calendar time.
6. **Strategy signal visualization** — Show entry and exit signals generated from consecutive bricks. The simplified chart communicates rule-based decisions clearly.
7. **Sector fund rotation** — Plot long-term trends of sector funds to identify leadership changes. Bricks smooth short-term noise.
8. **Seasonal commodity movement** — Display an agricultural commodity's price changes without time distortion during quiet periods. The chart focuses on significant moves.
9. **Sensor drift tracking** — Show a slow-moving sensor variable with a brick added only when it changes by a fixed amount. The chart reveals drift without plotting noise.
10. **Breakout detection** — Display sequences of same-direction bricks to highlight breakouts from ranges. Consecutive bricks signal persistent movement.

## `point-figure`

1. **Support and resistance mapping** — Plot X and O columns for a stock to find levels where price reverses repeatedly. Point and figure charts filter time and small moves.
2. **Supply and demand shifts** — Show columns of rising X and falling O to interpret balance between buyers and sellers. The chart emphasizes price action.
3. **Price target counting** — Use the width of a congestion pattern to estimate a potential price target. The method relies on counting columns.
4. **Breakout identification** — Display a currency pair breaking above previous column tops. The chart highlights decisive moves.
5. **Long-term index trend** — Plot an index with large box sizes to view multi-year trends. The chart reduces noise and compresses time.
6. **Cryptocurrency reversals** — Show significant reversals in a volatile asset using a reversal threshold. The format ignores minor swings.
7. **Relative strength of a sector** — Plot the ratio of a sector index to the market index to show leadership. The chart reveals trend in relative performance.
8. **Accumulation and distribution phases** — Examine horizontal consolidations to infer accumulation or distribution. The column patterns are the basis for this interpretation.
9. **Trend lines on futures contracts** — Draw 45-degree trend lines on a futures chart to define trend channels. The grid structure makes such lines meaningful.
10. **Event-driven price changes** — Plot a commodity's meaningful moves regardless of the passage of time. The chart adds marks only when price changes enough.

## `kagi`

1. **Trend reversal detection** — Plot a stock with a line that changes direction only when price reverses by a set amount. Kagi charts highlight significant reversals and ignore noise.
2. **Supply and demand through line thickness** — Show thick lines when price exceeds a prior high and thin lines when it breaks a prior low. The thickness change signals a shift in balance.
3. **Currency pair direction** — Display major swings in an exchange rate across years. The chart focuses on changes in direction.
4. **Index turning points** — Identify turning points in a market index. The line structure marks reversals concisely.
5. **Cryptocurrency swings** — Plot large movements in a volatile asset without time scaling. Kagi emphasizes the magnitude of swings.
6. **Sector fund trend strength** — Examine the trend of a sector fund, noting consecutive thick segments. The chart communicates persistence of a trend.
7. **Breakout confirmation** — Show a price moving beyond the last swing high or low to indicate a breakout. The change in line style confirms the signal.
8. **Bond price direction** — Plot bond price reversals for fixed-income analysis. The chart removes day-to-day noise.
9. **Commodity cycles** — Display long-term swings in a commodity to study cycles. Reversal-based lines highlight major turns.
10. **Long-term share price trend** — Show a company's price history over many years with a coarse reversal threshold. The chart summarizes major moves.

## `choropleth`

1. **Population density by region** — Shade regions by people per area. A choropleth requires normalized values, such as density, so that region size does not distort the message.
2. **Election results by district** — Color districts by the winning party or vote share. The map shows geographic patterns of support.
3. **Unemployment rate by state** — Shade subnational units by unemployment rate to reveal regional disparities. The map highlights clusters of high unemployment.
4. **Median income by county** — Display income levels across counties. The spatial pattern suggests regional inequality.
5. **Disease incidence rate by region** — Plot cases per capita to reveal hotspots. Normalizing by population avoids misleading size effects.
6. **Literacy rate by country** — Shade countries by adult literacy. The map shows global differences in education.
7. **Annual rainfall by area** — Display average precipitation across administrative zones. The chart shows climatic patterns relevant to agriculture.
8. **Crime rate by neighborhood** — Color neighborhoods by incidents per resident. The map supports resource allocation.
9. **Sales per capita by territory** — Show sales normalized by population for each sales territory. The choropleth highlights under-penetrated areas.
10. **Vaccination coverage by province** — Shade provinces by share vaccinated. The map identifies regions with low coverage.

## `globe`

1. **Global flight routes** — Draw great-circle arcs between airports on a rotating globe. A globe preserves the true shape of long-distance routes.
2. **Worldwide earthquake locations** — Plot epicenters across the planet. The globe shows plate boundary patterns without projection distortion.
3. **Company office locations** — Mark offices around the world. The globe gives an intuitive view of global presence.
4. **Internet penetration** — Shade countries by share of people online. The globe supports exploring global disparities.
5. **Shipping routes** — Display major maritime routes as arcs between ports. The globe shows real route geometry.
6. **Data center distribution** — Plot data center sites globally to consider latency and redundancy. The 3D view aids presentation.
7. **Satellite ground tracks** — Show the path of a satellite over the Earth's surface. A globe displays orbits naturally.
8. **Sea surface temperature** — Color the ocean by temperature anomaly to show climate patterns. The globe avoids distortion at high latitudes.
9. **Global campaign reach** — Show the countries reached by an international campaign. The visual is suitable for communication to broad audiences.
10. **International event locations** — Mark sites of conferences and sporting events. The globe provides an engaging overview.

## `city-map`

1. **Store locations within a city** — Plot retail outlets on a street map to assess coverage. A city map provides street-level context.
2. **Ride pickup density** — Show pickup points by neighborhood to analyze demand patterns. The base map reveals links to land use.
3. **Incident locations** — Mark reported incidents on a city map to find clusters. The streets provide spatial reference.
4. **Transit routes** — Display bus and metro lines with stops to evaluate access. The map reveals coverage gaps.
5. **Bike-share stations** — Show station locations and availability for operations. The map supports rebalancing decisions.
6. **Noise levels** — Plot sensor readings across neighborhoods to identify noisy zones. Geographic context aids interpretation.
7. **Charging stations** — Mark EV chargers to locate underserved areas. The map shows distances to users.
8. **Delivery zones** — Display service zones for a delivery operation. The map clarifies boundaries and overlaps.
9. **Green spaces** — Show parks and tree canopy for urban planning. The city map reveals neighborhoods lacking greenery.
10. **Emergency service locations** — Mark hospitals and fire stations to examine response access. The map identifies areas far from services.

## `proportional-symbol-map`

1. **City populations** — Draw circles at city locations sized by population. Symbol size conveys magnitude for point data on a map.
2. **Earthquake magnitudes** — Plot epicenters with circles scaled by magnitude. The map shows both location and severity.
3. **Sales by store** — Show each store's revenue with sized circles. The chart highlights large and small stores geographically.
4. **Case counts by city** — Plot absolute counts of disease cases at city locations. Proportional symbols suit counts tied to points.
5. **Wildfire sizes** — Show burned area at each fire location. Symbols reveal large events.
6. **Visitors at attractions** — Plot symbols sized by annual visitors. The map shows tourism concentration.
7. **Oil field production** — Display output volume at field locations. The map shows the spatial distribution of production.
8. **Office headcount** — Show the number of employees at each office. The circles illustrate where staff are concentrated.
9. **Port cargo volume** — Plot sized symbols at ports to show throughput. The map highlights major gateways.
10. **Rainfall at stations** — Show rainfall totals at gauging stations using sized circles. The chart communicates point measurements.

## `dot-density-map`

1. **Population distribution** — Place one dot per fixed number of residents within areas. A dot density map reveals clustering within administrative boundaries.
2. **Crop locations** — Show dots representing hectares of a crop within regions. The map reveals spatial concentration of agriculture.
3. **Ethnic group distribution** — Use dot colors for groups within neighborhoods. The map shows spatial mixing and segregation.
4. **Tree inventory** — Plot dots for each tree in a park or city. The map shows canopy distribution.
5. **Business density** — Place dots for businesses by type. The map reveals commercial clusters.
6. **Livestock distribution** — Show dots per number of animals by county. The map highlights where farming is concentrated.
7. **Household income levels** — Use color-coded dots for households within income bands. The map shows spatial inequality.
8. **Disease cases by neighborhood** — Place dots for cases within areas. The visualization suggests clusters without revealing exact addresses.
9. **Wildlife sightings** — Plot dots for observations across a reserve. The map shows habitat use.
10. **Customer distribution** — Show customers as dots across a service region. The map guides location planning.

## `flow-map`

1. **Migration flows** — Draw lines between origin and destination regions with width showing volume. A flow map conveys movement with geographic context.
2. **Trade routes** — Show exports from countries to partners. The map reveals dominant corridors.
3. **Commuter flows** — Plot journeys to work between municipalities. Flow lines reveal regional labor markets.
4. **Flight routes** — Display passenger volumes between airports. The map shows hubs and corridors.
5. **Goods movement in supply chains** — Show shipments between facilities. The visual exposes logistics structure.
6. **Shipping lane traffic** — Plot vessel volumes along sea routes. The chart reveals chokepoints.
7. **Data traffic between regions** — Show bandwidth flowing between data centers. The map communicates network load geographically.
8. **Bike-share trips** — Plot trips between stations to balance inventory. Flows show imbalance patterns.
9. **Tourist flows between destinations** — Display visitor movement among destinations. The map reveals travel circuits.
10. **Displacement flows** — Show movement of displaced populations from origin to host areas. The flow map communicates scale and direction.

## `tile-map`

1. **Election results by region** — Represent each region as an equal-sized tile colored by outcome. A tile map prevents large, sparsely populated areas from dominating the view.
2. **Health statistics by region** — Show a health indicator using equal tiles. The layout gives each region equal visual weight.
3. **Unemployment rates** — Color tiles by unemployment level. The grid makes small regions visible.
4. **Hospital counts per region** — Display the count in each tile. The map compares regions without area bias.
5. **Policy adoption** — Show which regions have adopted a policy. The tile layout gives a clear binary view.
6. **Education spending** — Shade tiles by per-student spending. The equal-area design makes differences easy to compare.
7. **Sales performance in a compact layout** — Display sales by region in a dashboard. Tiles fit into tight space with consistent labels.
8. **Crime statistics** — Show crime rates by region with equal representation. The grid highlights outliers without geographic distortion.
9. **Customers by region** — Plot customer counts by tile. The layout allows quick scanning of regional differences.
10. **Broadband access** — Shade tiles by share of households with broadband. The chart suits public communication.

## `cartogram`

1. **Population distortion** — Resize countries by population to compare demographic weight. A cartogram distorts geography to reflect the data.
2. **Election results weighted by population** — Scale regions by voters to show the real distribution of outcomes. The map counters the dominance of large, sparsely populated areas.
3. **GDP by country** — Resize countries by economic output. The cartogram shows global economic concentration.
4. **Disease burden by country** — Scale countries by cases or deaths. The map communicates the geography of health burden.
5. **Carbon emissions by country** — Resize countries by emissions. The distortion highlights the largest emitters.
6. **Internet users by country** — Scale countries by number of users. The map emphasizes populous markets.
7. **Global wealth distribution** — Resize regions by share of total wealth. The cartogram conveys inequality.
8. **Refugees hosted by country** — Scale countries by the number of refugees hosted. The map highlights host countries.
9. **Military spending by country** — Resize countries by expenditure. The cartogram shows disproportionate shares.
10. **Olympic medals by country** — Scale countries by medals won. The map offers an engaging representation of sporting success.

## `bullet-chart`

1. **Sales attainment against quota** — Show a representative's actual sales as a bar against a target marker with qualitative bands for poor, fair, and good. A bullet chart packs value, target, and context into a small space.
2. **Hospital readmission rate against benchmark** — Compare a ward's readmission rate to a benchmark with acceptable ranges. The bands define thresholds for performance.
3. **Graduation rate against institutional goal** — Display the rate for each program against its target. Compact bullets let many programs appear in a single panel.
4. **Budget consumption against plan** — Show spend to date against a planned spend marker with risk bands. The chart supports dashboards with many budget lines.
5. **Service availability against SLA** — Plot measured uptime against the contractual level with warning zones. The bullet chart conveys compliance and margin.
6. **Patch compliance against security policy** — Show the share of systems patched against a policy target for each business unit. Bands highlight units requiring attention.
7. **On-time delivery against target** — Display each carrier's on-time rate against the contractual target. The compact layout compares carriers side by side.
8. **Energy efficiency against building standard** — Plot each building's energy intensity with a standard marker and performance bands. The chart aids portfolio-level review.
9. **Employee engagement against industry norm** — Show engagement scores with a benchmark marker. The bands identify teams below the norm.
10. **Profit margin against target** — Display margin by product line against goals. The chart provides a compact executive scorecard.

## `radial-bar`

1. **Multiple goal progress as rings** — Show completion of several goals as concentric arcs. A radial bar compares bounded values in a compact circular form.
2. **Daily activity rings** — Display movement, exercise, and standing progress for a person. Rings make progress toward daily targets intuitive.
3. **Project completion rates** — Plot completion percentages for several projects in concentric arcs. The chart provides a compact status overview.
4. **Sales quota attainment** — Show each representative's attainment as an arc. The ring layout saves space in team dashboards.
5. **Survey response shares** — Display the percentage of respondents choosing each option. Radial bars convey proportions in an engaging format.
6. **Resource utilization** — Plot CPU, memory, and disk usage as concentric arcs. The layout communicates capacity use.
7. **Skill proficiency** — Show a person's proficiency in several skills. The arcs offer a compact profile.
8. **Market share of leading brands** — Plot shares as arcs for a small set of brands. The chart suits an infographic.
9. **Time allocation in a day** — Show hours spent on activities as arcs. The layout is easy to read at a glance.
10. **Vaccination progress by region** — Display coverage by region as arcs against full coverage. The chart highlights regions that lag.

## `pictogram`

1. **People affected by an issue** — Use rows of person icons with some highlighted to show a proportion, such as one in five. Pictograms make statistics tangible for general audiences.
2. **Units sold by product** — Represent each product's sales with icons, each standing for a set quantity. The chart communicates magnitude in a simple, countable form.
3. **Livestock by type** — Show animal counts using animal icons. The display is intuitive for agricultural summaries.
4. **Students per class** — Represent class sizes using student icons. The pictogram helps stakeholders grasp crowding.
5. **Vehicle ownership by country** — Use car icons to show vehicles per household. The icons reinforce the subject.
6. **Meals served** — Show meals served by a food program with plate icons. The chart supports public reporting.
7. **Trees planted** — Represent planting campaign progress by tree icons. The visual engages donors.
8. **Hospital beds by region** — Show beds per population as bed icons. The pictogram communicates scarcity and abundance.
9. **Household electricity use** — Use bulb icons to show consumption relative to a baseline. The chart makes energy use relatable.
10. **Donations received** — Show the number of donors or gifts using coin or heart icons. The pictogram suits campaign updates.

## `engine-line`

1. **Streaming sensor feed** — Plot a continuously updating sensor signal from a production line. An engine-rendered line chart handles very high point counts with smooth updates.
2. **Tick-level market data** — Show price ticks for an instrument in real time. The high update rate requires efficient rendering.
3. **Server metrics at fine resolution** — Display second-level CPU metrics over weeks. The chart renders millions of points without becoming unresponsive.
4. **Vehicle telemetry** — Plot speed, throttle, and temperature streams from a test drive. High-frequency data stays interactive.
5. **Network throughput monitoring** — Show per-second traffic for critical links. Live updates allow immediate detection of anomalies.
6. **Biosignal waveforms** — Display ECG or EEG traces with dense sampling. The line preserves waveform detail at high sampling rates.
7. **High-resolution climate record** — Plot minute-level readings from long-term station records. The chart supports zooming from decades to hours.
8. **IoT device fleet monitoring** — Overlay readings from many devices at high frequency. The renderer keeps interaction smooth with large series.
9. **Machine vibration waveform** — Show raw accelerometer data to diagnose bearings and imbalance. Dense sampling needs efficient drawing.
10. **Live user activity** — Plot events per second on a live operations dashboard. The chart updates continuously without lag.

## `engine-area`

1. **Live traffic volume** — Show requests per second for a large website as a filled area. An engine-rendered area chart handles frequent updates across long windows.
2. **Real-time grid demand** — Plot electricity load at fine resolution for operations staff. The fill emphasizes magnitude while remaining responsive.
3. **High-volume sensor network** — Display aggregate readings from thousands of sensors over time. The chart renders dense series efficiently.
4. **Launch-day sales accumulation** — Show cumulative orders during a product launch with continuous updates. The area conveys growing totals.
5. **Cluster utilization** — Plot resource usage across a compute cluster at fine granularity. The chart supports long retention windows.
6. **Large temperature record** — Show years of high-frequency temperature observations. The area form emphasizes the magnitude of variation.
7. **Trading volume** — Plot volume by minute across a session. The chart deals with many bars effectively.
8. **Streaming network traffic** — Display inbound bytes per second for security monitoring. The fill highlights sustained surges.
9. **Concurrent users** — Show live concurrent sessions for an event with high-frequency sampling. The chart scales to many points.
10. **Production line monitoring** — Plot continuous throughput from manufacturing equipment. The area clarifies sustained output versus drops.

## `engine-bar`

1. **Live order counts across many categories** — Show order counts updating in real time across hundreds of product categories. An engine-rendered bar chart handles many bars and frequent refreshes.
2. **Real-time competition leaderboard** — Display scores that change constantly for many participants. The chart animates ranking changes smoothly.
3. **Streaming histogram** — Bin incoming values continuously and update the bars as data arrives. The renderer keeps interaction fluid.
4. **Per-minute event counts over long periods** — Plot events per minute across a month, producing thousands of bars. Efficient rendering keeps zoom and pan responsive.
5. **Live vote counts** — Show vote tallies for many options during an event. The chart updates as counts change.
6. **Daily sales across a large retail network** — Display sales for thousands of stores for a single day. The chart manages many categories.
7. **Real-time error counts per service** — Plot errors for each microservice on an operations dashboard. The display updates quickly as incidents develop.
8. **Live response time distribution** — Show counts by latency bucket updating each second. The chart reveals shifts in distribution shape.
9. **Log counts by level** — Display volumes of log messages by severity as they are ingested. The bars update continuously.
10. **Feature usage in real time** — Show how often each product feature is used as events stream in. The chart supports rapid monitoring after a release.

## `engine-pie`

1. **Live traffic source split** — Show the current share of visits by source, updating with streaming events. An engine-rendered pie handles frequent updates from large data volumes.
2. **Live vote share** — Display the proportion of votes per option during a poll. The chart updates smoothly as counts change.
3. **Current order status mix** — Show the share of orders in each state for an operations view. The pie reflects a constantly changing snapshot.
4. **Resource allocation across clusters** — Display the share of compute allocated to each team in real time. Updates reflect scheduler decisions.
5. **Device type composition** — Show the proportion of current sessions by device. The chart updates as users connect.
6. **Error type distribution** — Display the share of error categories during an incident. The pie updates as new errors arrive.
7. **Ticket category mix** — Show the current share of open tickets by category. The chart summarizes queue composition.
8. **Trading portfolio allocation** — Display live allocation by asset as positions change. The pie reflects the current state.
9. **Payment method mix** — Show real-time transactions by payment type. The chart shows shifts during promotions.
10. **Grid energy mix** — Display the current share of generation by source. The pie updates as supply conditions change.

## `engine-scatter`

1. **Millions of observations** — Plot a very large dataset, such as sensor readings against a reference variable, without overplotting delays. An engine-rendered scatter handles massive point counts.
2. **Live vehicle positions** — Show the current positions of a fleet as coordinates updating continuously. The chart maintains performance with frequent refreshes.
3. **Real-time anomaly detection** — Plot streaming feature pairs with anomalies highlighted. The renderer supports continuous additions.
4. **High-dimensional embeddings** — Display a two-dimensional projection of a large embedding set. Dense point clouds remain interactive.
5. **Telemetry relationships** — Show relationships among telemetry variables from long test runs. The chart supports exploration of very large logs.
6. **Large-scale correlation analysis** — Plot pairs of variables across a massive dataset to inspect relationships. Efficient rendering supports zooming into dense regions.
7. **Astronomical catalog** — Display positions and magnitudes of a large set of stars. The chart handles millions of points.
8. **Live user locations** — Plot users as points on a coordinate plane during an event. Updates stay smooth despite scale.
9. **Simulation outputs** — Show results from large Monte Carlo runs. The renderer can display every sample.
10. **Streaming clustering** — Plot incoming points colored by current cluster assignment. The chart updates continuously as clusters evolve.

## `echarts-heatmap`

1. **Room occupancy by day and hour with interactive range filter** — Show utilization for each meeting room across hours and days, letting users filter the color range to isolate heavily used slots. The heatmap supports exploration of dense grids.
2. **Term frequency across documents** — Display how often selected keywords occur in each document of a corpus. The matrix highlights which terms characterize which documents.
3. **Origin-destination mobility matrix** — Plot trip counts between zones with color intensity. The grid shows the dominant movement pairs.
4. **Smart meter consumption by hour** — Show consumption for many meters across hours of the day to find unusual load patterns. The heatmap scales to many rows.
5. **Latency distribution over time** — Plot request latency buckets against time with color showing request counts. The chart reveals shifts in latency distribution.
6. **Spatial grid of pollutant concentration** — Display readings on a regular geographic grid. Color shows hot spots across the study area.
7. **Seat or venue utilization** — Show occupancy by section and event to optimize capacity. The heatmap identifies consistently empty areas.
8. **Model attention weights** — Display attention between tokens in a language model to interpret behavior. The matrix reveals which inputs influence outputs.
9. **Pitch occupancy in sports** — Plot a player's time spent in each cell of a field grid. The heatmap shows positional tendencies.
10. **Sensor fault detection across an array** — Show deviation of each sensor from its neighbors over time. Color reveals failing units.
