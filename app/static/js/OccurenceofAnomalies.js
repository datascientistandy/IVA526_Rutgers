
// Set dimensions and margins for the plot
const margin = { top: 40, right: 30, bottom: 50, left: 60 };
const width = 800 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// Append the SVG element to the body
const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// Add a title to the plot
svg.append("text")
    .attr("x", width / 2)
    .attr("y", -20)
    .attr("class", "title")
    .text("Monthly Temperature Anomalies by Season (1977-2013)");

// Add a data source note
svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("class", "source")
    .text("Source: Weather Data (1964-2013)");

// Load the CSV file
d3.csv("static/data/monthly_temperature_by_year.csv").then(function(data) {

    // Parse the date and temperature data
    data.forEach(d => {
        d.date = new Date(d.year, d.month - 1);  // Create a date object from year and month
        d.average_temp = +d.average_temp; // Convert to numeric
        // Assign season based on the month
        if (d.month >= 12 || d.month <= 2) {
            d.season = "Winter";
        } else if (d.month >= 3 && d.month <= 5) {
            d.season = "Spring";
        } else if (d.month >= 6 && d.month <= 8) {
            d.season = "Summer";
        } else {
            d.season = "Fall";
        }
    });

    // Create a set of unique seasons
    const seasons = ["Winter", "Spring", "Summer", "Fall"];

    // Create scales for the X and Y axes
    const xScale = d3.scaleTime()
        .domain([d3.min(data, d => d.date), d3.max(data, d => d.date)])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([d3.min(data, d => d.average_temp), d3.max(data, d => d.average_temp)])
        .nice()
        .range([height, 0]);

    // Add X and Y axes
    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat("%b %Y")))
        .selectAll("text")
        .style("text-anchor", "middle")
        .attr("class", "axis-label");

    svg.append("g")
        .call(d3.axisLeft(yScale).ticks(6))
        .selectAll("text")
        .style("text-anchor", "middle")
        .attr("class", "axis-label");

    // Define colors for each season
    const color = d3.scaleOrdinal()
        .domain(seasons)
        .range(["#1f77b4", "#2ca02c", "#ff7f0e", "#d62728"]);  // Blue, Green, Orange, Red

    // Create a line generator
    const line = d3.line()
        .x(d => xScale(d.date))
        .y(d => yScale(d.average_temp));

    // Group data by season and create a line for each season
    const seasonLines = {};
    seasons.forEach(season => {
        const seasonData = data.filter(d => d.season === season);
        
        seasonLines[season] = svg.append("path")
            .data([seasonData])
            .attr("class", "line")
            .attr("d", line)
            .attr("stroke", color(season))
            .attr("stroke-width", 2)
            .attr("fill", "none")
            .attr("id", `line-${season}`)
            .style("display", "inline");

        // Add legend for each season
        svg.append("rect")
            .attr("x", width - 100)
            .attr("y", 20 + seasons.indexOf(season) * 20)
            .attr("width", 10)
            .attr("height", 10)
            .style("fill", color(season));

        svg.append("text")
            .attr("x", width - 85)
            .attr("y", 20 + seasons.indexOf(season) * 20 + 8)
            .text(season)
            .attr("class", "legend");
    });

    // Add mean line (horizontal line for average anomaly)
    const meanTemp = d3.mean(data, d => d.average_temp);
    svg.append("line")
        .attr("x1", 0)
        .attr("y1", yScale(meanTemp))
        .attr("x2", width)
        .attr("y2", yScale(meanTemp))
        .attr("stroke", "black")
        .attr("stroke-dasharray", "4")
        .attr("stroke-width", 2);

    svg.append("text")
        .attr("x", width - 120)
        .attr("y", yScale(meanTemp) - 10)
        .text("Mean Temp: " + meanTemp.toFixed(2))
        .attr("class", "axis-label");

    // Tooltip for interaction
    const tooltip = d3.select(".tooltip");

    svg.selectAll(".line")
        .on("mouseover", function(event, d) {
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html("Season: " + d[0].season + "<br/>Month: " + d[0].month_name + "<br/>Temp: " + d3.mean(d, dd => dd.average_temp).toFixed(2))
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            tooltip.transition().duration(500).style("opacity", 0);
        });

    // Add interactivity to the checkboxes
    d3.selectAll('input[type="checkbox"]').on("change", function() {
        const showAll = document.getElementById("showAll").checked;
        seasons.forEach(season => {
            const seasonCheckbox = document.getElementById(`show${season}`);
            const seasonLine = seasonLines[season];
            if (seasonCheckbox.checked || showAll) {
                seasonLine.style("display", "inline");
            } else {
                seasonLine.style("display", "none");
            }
        });
    });
});

