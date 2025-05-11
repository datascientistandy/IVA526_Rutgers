
const svg = d3.select("#map").append("svg");
const projection = d3.geoAlbersUsa().scale(1000).translate([480, 300]);
const path = d3.geoPath().projection(projection);
const colorScale = d3.scaleQuantize().range(d3.schemeReds[9]);

const tooltip = d3.select("#tooltip");
const summaryBox = d3.select("#state-summary");

const stateAbbrToName = {
  "AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California",
  "CO":"Colorado","CT":"Connecticut","DE":"Delaware","FL":"Florida","GA":"Georgia",
  "HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas",
  "KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts",
  "MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana",
  "NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico",
  "NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma",
  "OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota",
  "TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington",
  "WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming","DC":"District of Columbia",
  "PR": "Puerto Rico", "VI": "Virgin Islands"
};

const regionToStates = {
  "SE US": ["Florida", "Georgia", "Alabama", "Mississippi", "South Carolina"],
  "Eastern US": ["Maine", "New Hampshire", "Vermont", "Massachusetts", "Rhode Island", "Connecticut", "New York", "New Jersey", "Delaware", "Maryland", "Virginia", "West Virginia", "North Carolina", "South Carolina", "Georgia", "Florida", "Pennsylvania", "Ohio"],
  "Central US": ["Illinois", "Indiana", "Iowa", "Kansas", "Michigan", "Minnesota", "Missouri", "Nebraska", "North Dakota", "Ohio", "Oklahoma", "South Dakota", "Wisconsin"],
  "NE US": ["Maine", "New Hampshire", "Vermont", "Massachusetts", "Rhode Island", "Connecticut", "New York", "New Jersey", "Pennsylvania"],
  "US": Object.values(stateAbbrToName)
};

Promise.all([
  d3.csv("static/data/deadliestUSWeather.csv"),
  d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
]).then(([data, us]) => {
  data.forEach(d => {
    d.Deaths = +d.Deaths;
    const states = d.State.split(",").map(s => s.trim());
    d.StateNames = [];

    states.forEach(s => {
      if (stateAbbrToName[s]) {
        d.StateNames.push(stateAbbrToName[s]);
      } else if (regionToStates[s]) {
        d.StateNames.push(...regionToStates[s]);
      } else if (s.includes(",")) {
        const abbr = s.split(",").pop().trim();
        if (stateAbbrToName[abbr]) {
          d.StateNames.push(stateAbbrToName[abbr]);
        }
      }
    });

    d.StateNames = [...new Set(d.StateNames)];
  });

  const stateDeaths = {};
  data.forEach(d => {
    d.StateNames.forEach(state => {
      if (!stateDeaths[state]) stateDeaths[state] = 0;
      stateDeaths[state] += d.Deaths;
    });
  });

  colorScale.domain([0, d3.max(Object.values(stateDeaths))]);

  const states = topojson.feature(us, us.objects.states).features;

  // Color legend
  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient").attr("id", "legend-gradient");
  gradient.selectAll("stop")
    .data(colorScale.range().map((color, i, nodes) => ({
      offset: `${(100 * i) / (nodes.length - 1)}%`,
      color
    })))
    .enter().append("stop")
    .attr("offset", d => d.offset)
    .attr("stop-color", d => d.color);

  svg.append("rect")
    .attr("x", 50).attr("y", 20)
    .attr("width", 300).attr("height", 10)
    .style("fill", "url(#legend-gradient)")
    .attr("stroke", "#ccc");

  const legendScale = d3.scaleLinear().domain(colorScale.domain()).range([0, 300]);
  const legendAxis = d3.axisBottom(legendScale).ticks(6).tickFormat(d3.format("~s"));
  svg.append("g").attr("transform", `translate(50, 30)`).call(legendAxis);

  // Draw map
  svg.selectAll("path")
    .data(states)
    .join("path")
    .attr("d", path)
    .attr("fill", d => {
      const name = d.properties.name;
      return stateDeaths[name] ? colorScale(stateDeaths[name]) : "#ddd";
    })
    .attr("stroke", "#fff")
    .on("mouseover", function (event, d) {
      const name = d.properties.name;
      const events = data.filter(e => e.StateNames.includes(name));
      if (events.length) {
        tooltip.style("display", "block")
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 20 + "px")
          .html(`<strong>${name}</strong><br>` +
            events.map(e => `${e.Event} (${e.Year}): ${e.Deaths} deaths<br><em>${e.State}</em>`).join("<br>"));
      }
    })
    .on("mouseout", () => tooltip.style("display", "none"))
    .on("click", function (event, d) {
      const name = d.properties.name;
      const events = data.filter(e => e.StateNames.includes(name));
      if (!events.length) return;

      const counts = d3.rollup(events, v => v.length, e => e.Event_type || e.Event.split(" ")[0]);
      let html = `<strong>${name}</strong><br><table>`;
      html += `<tr><th>Event Type</th><th>Count</th></tr>`;
      for (const [type, count] of counts) {
        html += `<tr><td>${type}</td><td>${count}</td></tr>`;
      }
      html += `</table>`;

      summaryBox.html(html).style("display", "block");
    });
});

