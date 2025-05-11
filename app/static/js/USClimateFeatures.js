const canvas = document.getElementById("heat-index");
const ctx = canvas.getContext("2d");
const width = canvas.width = 300;
const height = canvas.height = 20;
const gradient = ctx.createLinearGradient(0, 0, width, 0);
const heatScale = d3.scaleSequential(d3.interpolateCool).domain([0, 1]);

for (let i = 0; i <= 1; i += 0.01) {
  gradient.addColorStop(i, heatScale(i));
}
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, width, height);

const svg = d3.select("svg"),
      margin = { top: 20, right: 50, bottom: 10, left: 80 },
      chartWidth = window.innerWidth - margin.left - margin.right,
      chartHeight = window.innerHeight - 180 - margin.top - margin.bottom;

const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
const tooltip = d3.select(".tooltip");

d3.csv("static/data/climateData.csv").then(data => {
  const dimensions = ["STATE", "YEAR", "TEMP", "DEWP", "PRCP", "MXSPD", "ELEVATION", "FRSHTT_DETAIL"];

  data.forEach(d => {
    dimensions.forEach(key => {
      if (!isNaN(+d[key])) d[key] = +d[key];
    });
  });

  const states = [...new Set(data.map(d => d.STATE))].sort();
  const years = [...new Set(data.map(d => d.YEAR))].sort();

  d3.select("#state-select").selectAll("option")
    .data(states).enter()
    .append("option")
    .attr("value", d => d).text(d => d);

  d3.select("#year-select").selectAll("option")
    .data(years).enter()
    .append("option")
    .attr("value", d => d).text(d => d);

  const y = {};
  dimensions.forEach(dim => {
    if (["STATE", "YEAR", "FRSHTT_DETAIL"].includes(dim)) {
      y[dim] = d3.scalePoint()
        .domain([...new Set(data.map(d => d[dim]))].sort())
        .range([chartHeight, 0]);
    } else {
      y[dim] = d3.scaleLinear()
        .domain(d3.extent(data, d => d[dim])).nice()
        .range([chartHeight, 0]);
    }
  });

  const x = d3.scalePoint()
    .range([0, chartWidth])
    .padding(1)
    .domain(dimensions);

  const linesGroup = g.append("g").attr("class", "lines");

  function path(d) {
    return d3.line()(dimensions.map(p => [x(p), y[p](d[p])]));
  }

  function generateTooltipContent(d) {
    return Object.entries(d)
      .map(([key, val]) => `<strong>${key}:</strong> ${val}`)
      .join("<br>");
  }

  function updateColorEncoding(filtered, colorBy) {
    let colorScale;
    if (typeof filtered[0][colorBy] === "number") {
      colorScale = d3.scaleSequential()
        .domain(d3.extent(filtered, d => +d[colorBy]))
        .interpolator(d3.interpolateCool);
    } else {
      colorScale = d3.scaleOrdinal()
        .domain([...new Set(filtered.map(d => d[colorBy]))])
        .range(d3.schemeTableau10);
    }
    return colorScale;
  }

  function brushed() {
    const actives = [];
    g.selectAll(".brush")
      .filter(function () { return d3.brushSelection(this); })
      .each(function (d) {
        actives.push({ dimension: d, extent: d3.brushSelection(this) });
      });

    linesGroup.selectAll("path.line")
      .style("display", function (d) {
        return actives.every(active => {
          const dim = active.dimension;
          const val = y[dim](d[dim]);
          return active.extent[0] <= val && val <= active.extent[1];
        }) ? null : "none";
      });
  }

  function updatePlot() {
    const selectedState = d3.select("#state-select").property("value");
    const selectedYear = d3.select("#year-select").property("value");
    const colorBy = d3.select("#color-select").property("value");

    const filtered = data.filter(d =>
      (!selectedState || d.STATE === selectedState) &&
      (!selectedYear || d.YEAR == selectedYear)
    );

    const colorScale = updateColorEncoding(filtered, colorBy);

    const lines = linesGroup.selectAll("path").data(filtered, d => d.STATE + d.YEAR);

    lines.exit().remove();

    lines.enter()
      .append("path")
      .attr("class", "line")
      .merge(lines)
      .attr("d", path)
      .style("stroke", d => colorScale(d[colorBy]))
      .on("mouseover", function (event, d) {
        d3.select(this).style("stroke-width", 4).style("opacity", 1);
        tooltip.style("opacity", 1)
          .html(generateTooltipContent(d))
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function () {
        d3.select(this).style("stroke-width", 2).style("opacity", 0.7);
        tooltip.style("opacity", 0);
      });

    g.selectAll(".dimension").remove();
    const dimensionGroup = g.selectAll(".dimension")
      .data(dimensions)
      .enter().append("g")
      .attr("class", "dimension")
      .attr("transform", d => `translate(${x(d)})`);

    dimensionGroup.append("g")
      .attr("class", "axis")
      .each(function (d) {
        d3.select(this).call(d3.axisLeft(y[d]));
      });

    dimensionGroup.append("text")
      .style("text-anchor", "middle")
      .attr("y", -10)
      .attr("x", 0)
      .attr("fill", "black")
      .text(d => d);

    const brush = d3.brushY()
      .extent([[-8, 0], [8, chartHeight]])
      .on("brush", brushed);

    g.selectAll(".brush").remove();
    g.selectAll(".brush")
      .data(dimensions)
      .enter().append("g")
      .attr("class", "brush")
      .attr("transform", d => `translate(${x(d)})`)
      .each(function (d) {
        d3.select(this).call(brush);
      })
      .selectAll("rect")
      .attr("x", -8)
      .attr("width", 16);
  }

  d3.selectAll("#state-select, #year-select, #color-select").on("change", updatePlot);
  updatePlot();
});
