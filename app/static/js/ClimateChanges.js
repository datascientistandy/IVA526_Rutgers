let usTopo = null;
let usGeo = null;
let eventCountByYear = {};
let allData = [];
let filteredData = [];

const tooltip = d3.select('body').append('div').attr('class', 'tooltip');

document.addEventListener("DOMContentLoaded", () => {
  Promise.all([
    d3.csv("static/data/weather-anomalies-1964-2013.csv"),
    fetch("static/data/states-10m.json").then(res => res.json())
  ])
  .then(([csvData, topoData]) => {
    usTopo = topoData;

    if (!usTopo.objects || !usTopo.objects.states) {
      console.error("Missing 'states' object in TopoJSON.");
      return;
    }

    usGeo = topojson.feature(usTopo, usTopo.objects.states);

    csvData.forEach(d => {
      d.Date = new Date(d.date_str);
      d.Lat = +d.latitude;
      d.Long = +d.longitude;
      d.Degrees_From_Mean = +d.degrees_from_mean;
      d.Year = d.Date.getFullYear();

      if (d.Degrees_From_Mean >= 55) {
        d.Event_Type = 'Extreme Heat';
      } else if (d.Degrees_From_Mean <= -55) {
        d.Event_Type = 'Extreme Cold';
      } else {
        d.Event_Type = 'Normal';
      }
    });

    allData = csvData;
    filteredData = allData.filter(d => d.Event_Type !== 'Normal' && !isNaN(d.Lat) && !isNaN(d.Long));

    const joinedData = filteredData.map(d => {
      const coords = [d.Long, d.Lat];
      const match = usGeo.features.find(state => d3.geoContains(state, coords));
      return {
        ...d,
        state: match ? match.properties.name : null
      };
    }).filter(d => d.state);

    eventCountByYear = {};
    joinedData.forEach(d => {
      const year = d.Year;
      if (!eventCountByYear[year]) {
        eventCountByYear[year] = { heat: 0, cold: 0 };
      }
      if (d.Event_Type === 'Extreme Heat') {
        eventCountByYear[year].heat++;
      } else if (d.Event_Type === 'Extreme Cold') {
        eventCountByYear[year].cold++;
      }
    });

    renderMap(joinedData);
    renderHistogram(joinedData);
    renderEventTable(joinedData);
  })
  .catch(err => console.error("Error loading data:", err));
});


function renderMap(data) {
const svg = d3.select("#map");
const width = 975, height = 610;

const projection = d3.geoAlbersUsa().scale(1300).translate([width / 2, height / 2]);
const path = d3.geoPath().projection(projection);

svg.selectAll("*").remove(); // Clear previous content

svg.append("g")
    .selectAll("path")
    .data(usGeo.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("fill", "#eee")
    .attr("stroke", "#333");

// Create a radius scale with an appropriate domain
const radius = d3.scaleSqrt()
    .domain([0, d3.max(data, d => Math.abs(d.Degrees_From_Mean))]) // Use Math.abs() instead of d3.abs()
    .range([0, 20]);  // Set the maximum radius size (adjust as necessary)

svg.append("g")
    .attr("class", "bubbles")
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
        .attr("transform", d => `translate(${projection([d.Long, d.Lat])})`)
        .attr("r", d => {
            const radiusValue = radius(Math.abs(d.Degrees_From_Mean));  // Use Math.abs() here as well
            return radiusValue > 0 ? radiusValue : 0;  // Ensure radius is never negative
        })
        .attr("fill", d => d.Event_Type === 'Extreme Heat' ? "red" : "blue")
        .attr("opacity", 0.6)
        .append("title")
        .text(d => `${d.Event_Type} in ${d.state}\n${d.Degrees_From_Mean.toFixed(1)}° deviation`);
}


function renderHistogram(filteredData) {
// Group the filtered data by year (using d3.group)
const eventCountByYear = d3.group(filteredData, d => d.Year);

// Get years and event counts for the bars
const years = Array.from(eventCountByYear.keys());  // Get the years from the Map
const eventCounts = years.map(year => eventCountByYear.get(year).length); // Count events per year

const maxCount = d3.max(eventCounts);
const barWidth = 20;
const barMargin = 2;

const svg = d3.select("#histogram");
const width = 1350, height = 100;

svg.attr("width", width).attr("height", height);

// Create bars
const bars = svg.selectAll(".bar")
.data(years)
.enter()
.append("g")
.attr("class", "bar")
.attr("transform", (d, i) => `translate(${i * (barWidth + barMargin)}, 0)`);

bars.append("rect")
.attr("width", barWidth)
.attr("height", d => (eventCountByYear.get(d).length / maxCount) * height)
.attr("y", d => height - (eventCountByYear.get(d).length / maxCount) * height)
.style("fill", "steelblue")
.style("cursor", "pointer")
.on("click", function (event, d) {
  const selectedYear = d;
  const filteredYearData = filteredData.filter(data => data.Year === selectedYear);

  console.log("Filtered data after bar click:", filteredYearData);
  renderEventTable(filteredYearData); // Assuming you have a function to render the table
  renderMap(filteredYearData); // Assuming you have a function to render the map
});

// Add year labels with smaller font size
bars.append("text")
.attr("x", barWidth / 2) // Center the text horizontally
.attr("y", height - 5)  // Position the text just below the bar
.attr("dy", "-5")       // Adjust vertical position to avoid overlap with the bars
.attr("text-anchor", "middle")
.style("font-size", "10px")  // Decrease font size for the year text
.text(d => d);  // Display the year as the text

// Add the X axis at the bottom
const xScale = d3.scaleBand()
.domain(years)
.range([0, width])
.padding(0.1); // Adjust the padding for better spacing

const xAxis = d3.axisBottom(xScale).ticks(years.length); // Add axis ticks
svg.append("g")
.attr("transform", `translate(0, ${height})`) // Move axis to the bottom
.call(xAxis);

// Implement the brushing tool
const brush = d3.brushX()
.extent([[0, 0], [width, height]])
.on("end", function (event) {
  const selectedRange = event.selection;
  if (!selectedRange) return;

  const [x0, x1] = selectedRange;
  const selectedYears = years.filter((year, i) => {
    const barX = xScale(year);
    return barX >= x0 && barX <= x1;
  });

  console.log("Selected years by brushing:", selectedYears);

  // Filter the data based on the selected years and update the map and table
  const filteredBrushedData = filteredData.filter(d => selectedYears.includes(d.Year));
  renderEventTable(filteredBrushedData); // Update the event table
  renderMap(filteredBrushedData); // Update the map
});

svg.append("g")
.attr("class", "brush")
.call(brush);
}





function renderEventTable(filteredData) {
// Calculate the count of extreme heat and extreme cold events
const extremeHeatCount = filteredData.filter(d => d.Event_Type === 'Extreme Heat').length;
const extremeColdCount = filteredData.filter(d => d.Event_Type === 'Extreme Cold').length;

// Display the counts in the table (ensure you have HTML elements with these ids)
document.getElementById('extreme-heat-count').textContent = extremeHeatCount;
document.getElementById('extreme-cold-count').textContent = extremeColdCount;

// Calculate the min and max years from the data
const minYear = d3.min(filteredData, d => d.Year);
const maxYear = d3.max(filteredData, d => d.Year);
document.getElementById('year-range').textContent = `${minYear} - ${maxYear}`;

// Calculate the number of extreme weather events by state using d3.group() (for D3 v6+)
const eventsByState = d3.group(filteredData, d => d.state);

const stateCounts = {};
eventsByState.forEach((events, state) => {
stateCounts[state] = {
  extremeHeat: events.filter(d => d.Event_Type === 'Extreme Heat').length,
  extremeCold: events.filter(d => d.Event_Type === 'Extreme Cold').length
};
});

// Render the table with event counts by state
const tableBody = d3.select("#state-events-table tbody");
tableBody.html(''); // Clear existing table rows

Object.keys(stateCounts).forEach(state => {
const stateData = stateCounts[state];
tableBody.append("tr")
  .html(`
    <td>${state}</td>
    <td>${stateData.extremeHeat}</td>
    <td>${stateData.extremeCold}</td>
  `);
});
}




