const svg = d3.select("svg");
const width = +svg.attr("width");
const height = +svg.attr("height");
const tooltip = d3.select("#tooltip");

const projection = d3.geoAlbersUsa().scale(1000).translate([width / 2, height / 2]);
const path = d3.geoPath().projection(projection);
const colorScale = d3.scaleSequential(d3.interpolateOrRd).domain([0, 20]);

const g = svg.append("g"); // Group for zoomable content

const zoom = d3.zoom()
  .scaleExtent([1, 8])
  .on("zoom", (event) => {
    g.attr("transform", event.transform);
  });

svg.call(zoom);

Promise.all([
  d3.json("static/data/states-10m.json"),
  d3.csv("static/data/weather-anomalies-1964-2013.csv", d => ({
    date: new Date(d.date_str),
    year: +d.date_str.split("-")[0],
    latitude: +d.latitude,
    longitude: +d.longitude,
    station: d.station_name,
    state: d.state || "Unknown",
    degrees_from_mean: +d.degrees_from_mean,
    max_temp: +d.max_temp,
    min_temp: +d.min_temp,
    mean_temp: (+d.max_temp + +d.min_temp) / 2,
    type: d.type // ✅ Add this line
  }))
]).then(([us, data]) => {
  // Draw US states
  g.append("g")
    .selectAll("path")
    .data(topojson.feature(us, us.objects.states).features)
    .enter().append("path")
    .attr("d", path)
    .attr("fill", "#ddd")
    .attr("stroke", "#999");

  const circlesGroup = g.append("g");
  const yearSet = Array.from(new Set(data.map(d => d.year))).sort();
  const slider = d3.select("#slider");
  const yearLabel = d3.select("#year-label");

  function updateMap(year) {
    yearLabel.text(year);
    const yearData = data.filter(d => d.year === +year);

    const circles = circlesGroup.selectAll("circle")
      .data(yearData, d => d.station + d.date);

    circles.exit().remove();

    const newCircles = circles.enter().append("circle")
      .attr("r", 0)
      .attr("opacity", 0.7)
      .on("mouseover", function(event, d) {
        tooltip.style("visibility", "visible")
          .html(`<strong>${d.station}</strong><br>
                 ${d.date.toDateString()}<br>
                 State: ${d.state}<br>
                 Type: ${d.type}<br>
                 Max: ${d.max_temp}°C<br>
                 Min: ${d.min_temp}°C<br>
                 Mean: ${d.mean_temp.toFixed(1)}°C`)
          .style("top", `${event.pageY + 5}px`)
          .style("left", `${event.pageX + 10}px`);
      })
      .on("mousemove", function(event) {
        tooltip.style("top", `${event.pageY + 5}px`)
          .style("left", `${event.pageX + 10}px`);
      })
      .on("mouseout", () => tooltip.style("visibility", "hidden"));

    newCircles.merge(circles)
      .transition().duration(750)
      .attr("r", 5)
      .attr("fill", d => colorScale(d.degrees_from_mean))
      .attr("cx", d => {
        const coords = projection([d.longitude, d.latitude]);
        return coords ? coords[0] : null;
      })
      .attr("cy", d => {
        const coords = projection([d.longitude, d.latitude]);
        return coords ? coords[1] : null;
      });
  }

  slider
    .attr("min", d3.min(yearSet))
    .attr("max", d3.max(yearSet))
    .on("input", function () {
      updateMap(this.value);
    });

  updateMap(slider.property("value"));
});

