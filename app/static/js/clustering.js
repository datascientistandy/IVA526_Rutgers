d3.json("static/json/climate_clustered.json").then(function(data) {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Set up Tree
  const treeSvg = d3.select("#tree")
    .attr("width", width / 2)
    .attr("height", height);

  const root = d3.hierarchy(data);
  d3.cluster().size([height - 100, width / 2 - 100])(root);

  treeSvg.selectAll(".link")
    .data(root.links())
    .join("line")
    .attr("class", "link")
    .attr("x1", d => d.source.y)
    .attr("y1", d => d.source.x)
    .attr("x2", d => d.target.y)
    .attr("y2", d => d.target.x);

  const treeNode = treeSvg.selectAll(".node")
    .data(root.descendants())
    .join("g")
    .attr("class", "node")
    .attr("transform", d => `translate(${d.y},${d.x})`);

  treeNode.append("circle")
    .attr("r", 5)
    .on("click", (event, d) => {
      const records = d.leaves().filter(n => n.data.data).map(n => ({
        ...n.data.data,
        name: n.data.name
      }));
      updateGraph(records);
    });

  treeNode.append("text")
    .attr("x", d => d.children ? -10 : 10)
    .attr("dy", 4)
    .attr("text-anchor", d => d.children ? "end" : "start")
    .text(d => d.data.name);

  // Set up Zoomable Graph
  const graphSvg = d3.select("#graph")
    .attr("width", width / 2)
    .attr("height", height);

  const graphGroup = graphSvg.append("g");

  const zoom = d3.zoom()
    .scaleExtent([0.1, 3])
    .on("zoom", (event) => graphGroup.attr("transform", event.transform));

  graphSvg.call(zoom).call(zoom.transform, d3.zoomIdentity.translate(200, 200).scale(0.5));

  function updateGraph(data) {
    graphGroup.selectAll("*").remove();

    const nodes = data.map((d, i) => ({ id: i, ...d }));

    const links = [];
    const threshold = 2;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].PCA1 - nodes[j].PCA1;
        const dy = nodes[i].PCA2 - nodes[j].PCA2;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          links.push({ source: i, target: j });
        }
      }
    }

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).distance(30).strength(0.7))
      .force("charge", d3.forceManyBody().strength(-80))
      .force("center", d3.forceCenter(width / 4, height / 2));

    const link = graphGroup.append("g")
      .attr("stroke", "#ccc")
      .attr("stroke-opacity", 0.7)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1);

    const node = graphGroup.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 5)
      .attr("fill", d => d.TEMP > 90 ? "red" : "steelblue")
      .call(drag(sim));

    node.append("title")
      .text(d => `${d.name}\nTEMP: ${d.TEMP}, PRCP: ${d.PRCP}`);

    // Label interesting nodes
    graphGroup.selectAll(".label")
      .data(nodes.filter(d => d.TEMP > 90 || d.PRCP > 2))
      .join("text")
      .attr("class", "label")
      .text(d => d.name)
      .attr("x", d => d.x)
      .attr("y", d => d.y);

    sim.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

      graphGroup.selectAll(".label")
        .attr("x", d => d.x + 6)
        .attr("y", d => d.y - 6);
    });

    function drag(sim) {
      return d3.drag()
        .on("start", (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x; d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) sim.alphaTarget(0);
          d.fx = null; d.fy = null;
        });
    }
  }
});
