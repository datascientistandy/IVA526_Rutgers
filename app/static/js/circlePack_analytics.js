const svg = d3.select("svg");
const width = document.querySelector('.svg-container').clientWidth;
const height = document.querySelector('.svg-container').clientHeight;
const margin = 20;
const diameter = Math.min(width, height);
const g = svg.append("g").attr("transform", `translate(${diameter / 2},${diameter / 2})`);

const color = d3.scaleLinear()
  .domain([0, 5])
  .range(["hsl(205, 80%, 60%)", "hsl(205, 30%, 30%)"])
  .interpolate(d3.interpolateHcl);

const pack = d3.pack().size([diameter - margin, diameter - margin]).padding(2);

d3.json("static/data/weathering.json").then(data => {
  const root = d3.hierarchy(data).sum(d => d.size).sort((a, b) => b.value - a.value);
  let focus = root;
  const nodes = pack(root).descendants();
  let view;

  const circle = g.selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("class", d => d.parent ? (d.children ? "node" : "node node--leaf") : "node node--root")
    .style("fill", d => d.children ? color(d.depth) : "#999")
    .on("click", (event, d) => {
      event.stopPropagation();
      if (!d.children) {
        const filename = d.data.name.replace(/\s+/g, '').toLowerCase() + ".html";
        const iframe = document.createElement("iframe");
        iframe.src = filename;
        document.querySelector('.main-content').innerHTML = "";
        document.querySelector('.main-content').appendChild(iframe);

        // ✅ Update footer text from JSON node
        const footerText = d.data.footerText || "No additional information available.";
        document.getElementById('footer-text').innerHTML = footerText;
      } else {
        if (focus !== d) zoom(d);
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
    .html(d => d.data.name);

  const node = g.selectAll("circle,foreignObject");
  svg.on("click", () => zoom(root));

  zoomTo([root.x, root.y, root.r * 2 + margin]);

  const firstChild = root.children?.[2];
  if (firstChild) zoom(firstChild);

  function zoom(d) {
    focus = d;
    const transition = svg.transition()
      .duration(750)
      .tween("zoom", () => {
        const i = d3.interpolateZoom(view, [d.x, d.y, d.r * 2 + margin]);
        return t => zoomTo(i(t));
      });

    transition.selectAll("foreignObject")
      .style("opacity", o => o.parent === d ? 1 : 0)
      .on("start", function(o) {
        if (o.parent === d) this.style.display = "block";
      })
      .on("end", function(o) {
        if (o.parent !== d) this.style.display = "none";
      });
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
});