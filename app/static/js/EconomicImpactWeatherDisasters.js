

  const metrics = {
    'Deaths': 'Deaths',
    'Injuries': 'Injuries',
    'DAMAGE_PROPERTY': 'DAMAGE_PROPERTY',
    'DAMAGE_CROPS': 'DAMAGE_CROPS'
  };

  let selectedMetric = 'Deaths';
  let selectedGroup = 'STATE';
  let selectedYear = null;

  d3.csv("static/data/stormSummaryByStateYear.csv").then(data => {
    data.forEach(d => {
      d.YEAR = +d.YEAR;
      d.Deaths = +d.Deaths;
      d.Injuries = +d.Injuries;
      d.DAMAGE_PROPERTY = +d.DAMAGE_PROPERTY;
      d.DAMAGE_CROPS = +d.DAMAGE_CROPS;
    });

    const groups = Array.from(new Set(data.map(d => d[selectedGroup])));
    const years = Array.from(new Set(data.map(d => d.YEAR))).sort();

    function updateVisuals() {
      const svg = d3.select("#stream-graph");
      svg.selectAll("*").remove();

      const tooltip = d3.select("#tooltip");

      const width = svg.node().getBoundingClientRect().width;
      const height = svg.node().getBoundingClientRect().height;
      const margin = { top: 20, right: 30, bottom: 50, left: 60 };

      const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.YEAR))
        .range([margin.left, width - margin.right]);

      const groups = Array.from(new Set(data.map(d => d[selectedGroup])));
      const grouped = d3.groups(data, d => d.YEAR).map(([year, entries]) => {
        const result = { YEAR: +year };
        groups.forEach(g => {
          result[g] = d3.sum(entries.filter(d => d[selectedGroup] === g), d => d[selectedMetric]);
        });
        return result;
      });

      const stack = d3.stack().keys(groups);
      const series = stack(grouped);

      const y = d3.scaleLinear()
        .domain([
          d3.min(series, s => d3.min(s, d => d[0])),
          d3.max(series, s => d3.max(s, d => d[1]))
        ])
        .nice()
        .range([height - margin.bottom, margin.top]);

      const color = d3.scaleOrdinal().domain(groups).range(d3.schemeCategory10);

      const area = d3.area()
        .x(d => x(d.data.YEAR))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]));

      svg.selectAll("path")
        .data(series)
        .join("path")
        .attr("fill", d => color(d.key))
        .attr("d", area)
        .on("mousemove", function (event, d) {
          const [xPos] = d3.pointer(event);
          const year = Math.round(x.invert(xPos));
          const datum = d.find(pt => pt.data.YEAR === year);
          if (datum) {
            tooltip.style("display", "block")
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 20) + "px")
              .text(`${d.key}: ${d3.format(",")(datum.data[d.key])} in ${year}`);
            d3.select("#year").text(year);

            // Update totals on the right side
            const yearData = data.filter(d => d.YEAR === year);
            const totalDeaths = d3.sum(yearData, d => d.Deaths);
            const totalInjuries = d3.sum(yearData, d => d.Injuries);
            const totalCrops = d3.sum(yearData, d => d.DAMAGE_CROPS);
            d3.select("#total-deaths").text(totalDeaths);
            d3.select("#total-injuries").text(totalInjuries);
            d3.select("#total-crops").text(d3.format(".2s")(totalCrops));
          }
        })
        .on("mouseleave", () => {
          tooltip.style("display", "none");
        });

      svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format("d")));

      svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));

      d3.select("#stream-title").text(`${selectedMetric.replace("DAMAGE_", "").replace("_", " ")} Over Time`);

      // Update bar chart
      const year = 2020; // Static year for now
      const yearData = data.filter(d => d.YEAR === year);
      const groupedBar = d3.rollup(yearData, v => d3.sum(v, d => d.DAMAGE_PROPERTY), d => d[selectedGroup]);
      const sorted = Array.from(groupedBar.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

      const barSvg = d3.select("#bar-property");
      barSvg.selectAll("*").remove();

      const barWidth = 300;
      const barHeight = 400;

      const barX = d3.scaleLinear()
        .domain([0, d3.max(sorted, d => d[1])])
        .range([0, barWidth - 100]);

      const barY = d3.scaleBand()
        .domain(sorted.map(d => d[0]))
        .range([0, barHeight])
        .padding(0.2);

      const barColor = d3.scaleOrdinal().domain(groups).range(d3.schemeCategory10);

      const bars = barSvg.selectAll("g")
        .data(sorted)
        .join("g")
        .attr("transform", d => `translate(100,${barY(d[0])})`);

      bars.append("rect")
        .attr("height", barY.bandwidth())
        .attr("width", d => barX(d[1]))
        .attr("fill", d => barColor(d[0]));

      bars.append("text")
        .attr("x", d => barX(d[1]) - 5)
        .attr("y", barY.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("fill", "black")
        .attr("text-anchor", "end")
        .text(d => d3.format("$.2s")(d[1]));

      bars.append("text")
        .attr("x", -10)
        .attr("y", barY.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .text(d => d[0]);
    }

    // Event listeners for selection boxes
    d3.selectAll("#metric-select div").on("click", function () {
      d3.selectAll("#metric-select div").classed("active", false);
      d3.select(this).classed("active", true);
      selectedMetric = d3.select(this).attr("data-metric");
      updateVisuals();
    });

    d3.selectAll("#group-select div").on("click", function () {
      d3.selectAll("#group-select div").classed("active", false);
      d3.select(this).classed("active", true);
      selectedGroup = d3.select(this).attr("data-group");
      updateVisuals();
    });

    updateVisuals();
  });
