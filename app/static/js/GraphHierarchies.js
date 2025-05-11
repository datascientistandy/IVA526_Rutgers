const width = window.innerWidth / 2;
const height = window.innerHeight;

const graphSvg = d3.select("#graph");
const mapSvg = d3.select("#map");
const graphGroup = graphSvg.append("g");
const mapGroup = mapSvg.append("g");
const tooltip = d3.select("#tooltip");

function flatten(data) {
  const flat = [];
  function recurse(node) {
    if (node.children) node.children.forEach(recurse);
    else if (node.data) {
      flat.push({
        id: node.name + Math.random(),
        LOCATION: node.name,
        ...node.data,
        STATE: (node.name.match(/\((\w{2}) US\)/) || [])[1] || "NA"
      });
    }
  }
  recurse(data);
  return flat;
}

d3.json("static/json/climate_clustered.json").then(rawData => {
  const allNodes = flatten(rawData);

  function update(tempThreshold = 0) {
    const nodes = allNodes.filter(d => d.TEMP >= tempThreshold)
      .map(d => ({
        ...d,
        gx: Math.random() * width,
        gy: Math.random() * height,
        mx: d.PCA1,
        my: d.PCA2
      }));

    const xExtent = d3.extent(nodes, d => d.mx);
    const yExtent = d3.extent(nodes, d => d.my);
    const xScale = d3.scaleLinear().domain(xExtent).range([40, width - 40]);
    const yScale = d3.scaleLinear().domain(yExtent).range([40, height - 40]);

    nodes.forEach(d => {
      d.mxScaled = xScale(d.mx);
      d.myScaled = yScale(d.my);
    });

    const links = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].mx - nodes[j].mx;
        const dy = nodes[i].my - nodes[j].my;
        if (Math.sqrt(dx * dx + dy * dy) < 5) {
          links.push({ source: nodes[i], target: nodes[j] });
        }
      }
    }

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).distance(30))
      .force("charge", d3.forceManyBody().strength(-60))
      .force("center", d3.forceCenter(width / 2, height / 2));

    graphGroup.selectAll("line")
      .data(links, d => d.source.id + d.target.id)
      .join("line")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1);

    const graphNodes = graphGroup.selectAll("circle")
      .data(nodes, d => d.id)
      .join("circle")
      .attr("r", 6)
      .attr("fill", d => d.TEMP > 60 ? "red" : "blue")
      .attr("stroke", "white")
      .attr("stroke-width", 1);

    const mapNodes = mapGroup.selectAll("circle")
      .data(nodes, d => d.id)
      .join("circle")
      .attr("r", 6)
      .attr("fill", "green")
      .attr("cx", d => d.mxScaled)
      .attr("cy", d => d.myScaled);

    function showTooltip(event, d) {
      tooltip
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY}px`)
        .style("display", "inline-block")
        .html(`<strong>${d.LOCATION}</strong><br/>Temp: ${d.TEMP}<br/>State: ${d.STATE}`);
    }

    function hideTooltip() {
      tooltip.style("display", "none");
    }

    graphNodes.on("mouseover", showTooltip).on("mouseout", hideTooltip);
    mapNodes.on("mouseover", showTooltip).on("mouseout", hideTooltip);

    sim.on("tick", () => {
      graphGroup.selectAll("line")
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      graphGroup.selectAll("circle")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
    });
  }

  update();

  d3.select("#tempFilter").on("change", function () {
    update(+this.value);
  });

  d3.select("#viewToggle").on("click", () => {
    mapSvg.style("display", "none");
    graphSvg.style("display", "block");
  });
});
