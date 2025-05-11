const svg = d3.select("svg");
    const container = document.querySelector(".svg-container");
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = 20;
    const diameter = Math.min(width, height);

    const g = svg.append("g").attr("transform", `translate(${diameter / 2},${diameter / 2})`);

    const color = d3.scaleLinear()
      .domain([0, 5])
      .range(["hsl(205, 80%, 60%)", "hsl(205, 30%, 30%)"])
      .interpolate(d3.interpolateHcl);

    const pack = d3.pack()
      .size([diameter - margin, diameter - margin])
      .padding(2);
      
    d3.json("static/data/weathering.json").then(data => {
      const root = d3.hierarchy(data)
        .sum(d => d.size)
        .sort((a, b) => b.value - a.value);

      let focus = root;
      let nodes = pack(root).descendants();
      let view;

      const circle = g.selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("class", d => d.parent ? (d.children ? "node" : "node node--leaf") : "node node--root")
        .style("fill", d => d.children ? color(d.depth) : "#999")
        .on("click", (event, d) => {
          console.log('the event is  ' + event + ' the d is ' + d)
          if (!d.children) {
            const leafNodeName = d.data.name;
            console.log('the leafNodeName is ' + leafNodeName)
            const sanitizedLeafName = leafNodeName.replace(/\s+/g, '');
            console.log('the sanitizedLeafName is ' + sanitizedLeafName)
            const newPageURL = `${window.location.origin}/${sanitizedLeafName}`;
            window.location.href = newPageURL;
          } else {
            if (focus !== d) zoom(d);
            event.stopPropagation();
          }
        });

      const foreignLabels = g.selectAll("foreignObject")
        .data(nodes)
        .join("foreignObject")
        .attr("x", d => d.x - d.r * 0.7)
        .attr("y", d => d.y - d.r * 0.4)
        .attr("width", d => d.r * 1.4)
        .attr("height", d => d.r * 0.8)
        .style("pointer-events", "none")
        .style("opacity", d => d.parent === root ? 1 : 0)
        .style("display", d => d.parent === root ? "block" : "none");

      foreignLabels.append("xhtml:div")
        .style("font-size", d => `${Math.max(10, d.r / 4)}px`)
        .style("color", "white")
        .style("text-align", "center")
        .style("line-height", "1.2em")
        .style("word-wrap", "break-word")
        .style("overflow", "hidden")
        .style("max-height", d => `${d.r * 2}px`)
        .html(d => d.data.name);

      const node = g.selectAll("circle,foreignObject");

      svg.on("click", () => zoom(root));

      zoomTo([root.x, root.y, root.r * 2 + margin]);

      function zoom(d) {
        const transition = svg.transition()
          .duration(750)
          .tween("zoom", () => {
            const i = d3.interpolateZoom(view, [d.x, d.y, d.r * 2 + margin]);
            return t => zoomTo(i(t));
          });

        transition.selectAll("foreignObject")
          .style("opacity", d => d.parent === d ? 1 : 0)
          .on("start", function(d) {
            if (d.parent === d) this.style.display = "block";
          })
          .on("end", function(d) {
            if (d.parent !== d) this.style.display = "none";
          });

        focus = d;
      }

      function zoomTo(v) {
        const k = diameter / v[2];
        view = v;
        g.attr("transform", `translate(${diameter / 2},${diameter / 2})`);
        circle.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`)
              .attr("r", d => d.r * k);
        foreignLabels
          .attr("x", d => (d.x - v[0]) * k - d.r * k * 0.7)
          .attr("y", d => (d.y - v[1]) * k - d.r * k * 0.4)
          .attr("width", d => d.r * 2 * 0.7 * k)
          .attr("height", d => d.r * 2 * 0.5 * k);
      }
    }).catch(error => {
      console.error("Error loading data:", error);
    });


    // Your existing circle pack and weather-related logic goes here

    // Weather Today table
    const capitals = {
      "Washington, D.C.": { lat: 38.907, lon: -77.0369 },
      "Denver": { lat: 39.7392, lon: -104.9903 },
      "Austin": { lat: 30.2672, lon: -97.7431 },
      "Sacramento": { lat: 38.5816, lon: -121.4944 },
      "Albany": { lat: 42.6526, lon: -73.7562 },
      "Boston": { lat: 42.3601, lon: -71.0589 },
      "Honolulu": { lat: 21.3069, lon: -157.8583 },
      "Juneau": { lat: 58.3019, lon: -134.4197 },
      "Trenton": { lat: 40.2206, lon: -74.7597 },
      "Indianapolis": { lat: 39.7684, lon: -86.1581 }
    };

    let currentMarker = null;  // Track current marker to avoid duplication

    // Function to parse CSV manually
    function parseCSV(data) {
      const rows = data.split('\n');
      const result = [];
      const headers = rows[0].split(',');  // Assumes first row is header

      // Parse each row
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i].split(',');
        if (row.length === headers.length) {
          const cityData = {};
          for (let j = 0; j < headers.length; j++) {
            cityData[headers[j].trim()] = row[j].trim();
          }
          result.push(cityData);
        }
      }
      return result;
    }

    function getWeatherIconSrc(condition) {
      switch (condition) {
        case 'sunny':
          return 'static/img/icons/sunny.png';
        case 'cloudy':
          return 'static/img/icons/cloudy.png';
        case 'rainy':
          return 'static/img/icons/rainy.png';
        default:
          return 'static/img/icons/default.png';
      }
    }

    // Load weather data from CSV file in the data folder
    fetch('static/data/weather_data.csv')
      .then(response => response.text())
      .then(data => {
        const weatherData = parseCSV(data);  // Parse CSV data

        // Display weather data for selected location
        function displayWeatherData(location) {
          const locationWeather = weatherData.filter(item => item.Location === location);
          if (locationWeather.length > 0) {
            const currentTemperature = locationWeather[0].Temperature_C;
            const title = document.getElementById('title');
            title.textContent = `Current Temperature in ${location}: ${currentTemperature}°C`;

            const weekData = locationWeather.slice(0, 7).map(item => {
              const date = item.Date_Time;
              const day = new Date(date).toLocaleString('en-us', { weekday: 'long' });
              const temperature = parseFloat(item.Temperature_C).toFixed(1);
              return { day, date, temperature };
            });

            const weatherBody = document.getElementById('weather-body');
            weatherBody.innerHTML = ''; // Clear previous rows

            weekData.forEach(item => {
              const row = document.createElement('tr');

              const dayCell = document.createElement('td');
              dayCell.textContent = item.day;

              const dateCell = document.createElement('td');
              dateCell.textContent = item.date;

              const tempCell = document.createElement('td');
              tempCell.textContent = `${item.temperature}°C`;

              // Estimate condition based on temperature
              const tempVal = parseFloat(item.temperature);
              let condition = 'default';
              if (tempVal >= 25) condition = 'sunny';
              else if (tempVal >= 15) condition = 'cloudy';
              else condition = 'rainy';

              // Weather icon cell
              const iconCell = document.createElement('td');
              const iconImg = document.createElement('img');
              iconImg.src = getWeatherIconSrc(condition);
              iconImg.alt = condition;
              iconCell.appendChild(iconImg);

              row.appendChild(dayCell);
              row.appendChild(dateCell);
              row.appendChild(tempCell);
              row.appendChild(iconCell);

              weatherBody.appendChild(row);
            });

            document.getElementById('table-container').style.display = 'block';
          }
        }

        // Populate the dropdown with locations
        const locationDropdown = document.getElementById('location-dropdown');
        const locations = [...new Set(weatherData.map(item => item.Location))];  // Remove duplicates

        locations.forEach(location => {
          const option = document.createElement('option');
          option.value = location;
          option.textContent = location;
          locationDropdown.appendChild(option);
        });

        // Event listener for dropdown selection
        locationDropdown.addEventListener('change', (event) => {
          const selectedLocation = event.target.value;
          if (selectedLocation) {
            // Find the selected location's weather data
            displayWeatherData(selectedLocation);

            // Add marker to the map for the selected location
            const locationCoords = capitals[selectedLocation];
            if (locationCoords) {
              // Zoom in on the selected location
              zoomToLocation(locationCoords.lat, locationCoords.lon);
            }
          } else {
            document.getElementById('table-container').style.display = 'none';
          }
        });
      });
