
d3.json("static/data/max_temp_trend_forecast.json").then(function(data) {
  const observedData = data.observed;

  // Parse the date and convert value to numeric
  observedData.forEach(d => {
    d.date = d3.timeParse("%Y-%m")(d.date);
    d.value = +d.value;
  });

  const margin = { top: 50, right: 50, bottom: 100, left: 60 };
  const width = 1260 - margin.left - margin.right;
  const height = 960 - margin.top - margin.bottom;

  const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime()
    .domain(d3.extent(observedData, d => d.date))
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([d3.min(observedData, d => d.value) - 1, d3.max(observedData, d => d.value) + 1])
    .nice()
    .range([height, 0]);

  svg.append("g")
    .attr("class", "x axis")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(d3.timeMonth.every(3)).tickFormat(d3.timeFormat("%b %Y")))
    .selectAll("text")
    .attr("transform", "rotate(45)")
    .style("text-anchor", "start");

  svg.append("g")
    .attr("class", "y axis")
    .call(d3.axisLeft(y).ticks(6));

  // Observed temperature line
  const line = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.value));

  svg.append("path")
    .datum(observedData)
    .attr("class", "line")
    .attr("d", line)
    .attr("stroke", "blue");

  // Tooltip
  const tooltip = d3.select("body").append("div").attr("class", "tooltip");

  svg.selectAll(".dot")
    .data(observedData)
    .enter()
    .append("circle")
    .attr("class", "dot")
    .attr("cx", d => x(d.date))
    .attr("cy", d => y(d.value))
    .attr("r", 4)
    .attr("fill", "blue")
    .on("mouseover", function(event, d) {
      tooltip.style("display", "inline-block")
        .html(`Date: ${d3.timeFormat("%b %Y")(d.date)}<br>Temp: ${d.value.toFixed(2)}°C`)
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function() {
      tooltip.style("display", "none");
    });

  // --- Trend line calculation ---
  // Convert date to numeric time for regression
  const xSeries = observedData.map(d => d.date.getTime());
  const ySeries = observedData.map(d => d.value);

  const n = xSeries.length;
  const xMean = d3.mean(xSeries);
  const yMean = d3.mean(ySeries);
  const slope = d3.sum(xSeries.map((x, i) => (x - xMean) * (ySeries[i] - yMean))) /
                d3.sum(xSeries.map(x => Math.pow(x - xMean, 2)));
  const intercept = yMean - slope * xMean;

  // Generate start and end points for the regression line
  const xStart = d3.min(observedData, d => d.date);
  const xEnd = d3.max(observedData, d => d.date);
  const trendLineData = [
    { date: xStart, value: slope * xStart.getTime() + intercept },
    { date: xEnd, value: slope * xEnd.getTime() + intercept }
  ];

  const trendLine = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.value));

  svg.append("path")
    .datum(trendLineData)
    .attr("class", "line")
    .attr("stroke", "red")
    .attr("stroke-dasharray", "4,2")
    .attr("d", trendLine);

  // Add a title
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -20)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .text("Observed Maximum Temperature Trend with Linear Regression");
});
