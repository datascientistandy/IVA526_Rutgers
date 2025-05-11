
// Load the JSON data
d3.json("static/data/max_temp_trend_forecast.json").then(function(data) {
    console.log("Loaded data:", data);

    // Extract the observed data
    const observedData = data.observed;

    // Parse the date and value fields
    observedData.forEach(d => {
        d.date = d3.timeParse("%Y-%m")(d.date);  // Convert the date to a Date object
        d.value = +d.value;  // Convert value to a number
    });

    // Set up chart dimensions
    const margin = { top: 50, right: 50, bottom: 100, left: 60 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Set up x and y scales
    const x = d3.scaleBand()
        .range([0, width])
        .domain(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])
        .padding(0.1);

    const y = d3.scaleLinear()
        .nice()
        .range([height, 0]);

    // Add x and y axes
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("class", "y axis")
        .call(d3.axisLeft(y).ticks(5));

    // Function to update the chart based on selected year
    function updateChart(year) {
        let filteredData;

        if (year === "All") {
            // If "All" is selected, use all data
            filteredData = observedData;
        } else {
            // Otherwise, filter by selected year
            filteredData = observedData.filter(d => d.date.getFullYear() === year);
        }

        // Update the x and y domains
        y.domain([d3.min(filteredData, d => d.value) - 1, d3.max(filteredData, d => d.value) + 1]);

        // Update the axes
        svg.select(".y.axis")
            .transition()
            .duration(1000)
            .call(d3.axisLeft(y).ticks(5));

        // Create a line for each year
        const line = d3.line()
            .x(d => x(d3.timeFormat("%b")(d.date)))  // Map month names to x scale
            .y(d => y(d.value));

        // Remove previous lines (if any) before appending new ones
        svg.selectAll(".line").remove();

        // Group the data by year and plot each year as a separate line
        const yearsData = d3.groups(filteredData, d => d.date.getFullYear());

        yearsData.forEach(function(group) {
            svg.append("path")
                .data([group[1]])  // Get the data for this year
                .attr("class", "line")
                .attr("d", line)
                .attr("stroke", d3.schemeCategory10[group[0] % 10])  // Use a color scale for each year
                .attr("stroke-width", 2)
                .attr("fill", "none");
        });

        // Remove previous dots (if any) before appending new ones
        svg.selectAll(".dot").remove();

        // Add the new dots for data points
        svg.selectAll(".dot")
            .data(filteredData)
            .enter()
            .append("circle")
            .attr("class", "dot")
            .attr("cx", d => x(d3.timeFormat("%b")(d.date)))
            .attr("cy", d => y(d.value))
            .attr("r", 5)
            .attr("fill", "blue")
            .on("mouseover", function(event, d) {
                tooltip.style("display", "inline-block")
                    .html(`Date: ${d3.timeFormat("%b %Y")(d.date)}<br>Temp: ${d.value.toFixed(2)}°C`)
                    .style("left", `${event.pageX + 5}px`)
                    .style("top", `${event.pageY - 28}px`);
            })
            .on("mouseout", function() {
                tooltip.style("display", "none");
            });
    }

    // Set up the dropdown for selecting year
    const years = [...new Set(observedData.map(d => d.date.getFullYear()))];  // Get unique years
    const yearSelect = d3.select("#yearSelect");

    // Add the "All" option to the dropdown
    yearSelect.append("option")
        .attr("value", "All")
        .text("All");

    // Add the other year options
    yearSelect.selectAll("option")
        .data(years)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d);

    // Set default year selection
    yearSelect.property("value", "All");

    // Add a tooltip for hover interaction
    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    // Initial chart load with "All" years
    updateChart("All");

    // Update chart when a new year is selected
    yearSelect.on("change", function() {
        const selectedYear = this.value;
        updateChart(selectedYear);
    });
}).catch(function(error) {
    console.error("Error loading the data:", error);
});

