looker.plugins.visualizations.add({
  // Define as opções que a visualização irá receber do manifest
  options: {
    barColor: {
      type: 'string',
      label: 'Bar Color',
      display: 'color',
      default: '#2756B3'
    },
    show_tooltip: {
      type: 'boolean',
      label: 'Show Tooltip',
      default: true
    },
    y_axis_name: {
      type: 'string',
      label: 'Y-Axis Name',
      placeholder: 'Enter Y-Axis Name'
    },
    label_font_size: {
      type: 'number',
      label: 'Label Font Size',
      default: 12
    }
  },

  // 'Create' é executado uma vez para configurar os elementos iniciais
  create: function(element, config) {
    this.container = d3.select(element);
    this.svg = this.container.append("svg");
    this.chart = this.svg.append("g");
    this.xAxisGroup = this.chart.append("g").attr("class", "x-axis");
    this.yAxisGroup = this.chart.append("g").attr("class", "y-axis");

    // Cria a tooltip, mas mantém-na escondida
    this.tooltip = this.container.append("div")
      .attr("class", "looker-tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("background-color", "#333")
      .style("color", "#FFF")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("font-size", "12px");
  },

  // 'UpdateAsync' é executado sempre que os dados ou a configuração mudam
  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    // 1. VALIDAÇÃO: Garante que a estrutura de dados está correta
    if (queryResponse.fields.dimension_like.length !== 1 || queryResponse.fields.measure_like.length !== 2) {
      this.addError({
        title: "Invalid Configuration",
        message: "This chart requires exactly 1 dimension and 2 measures.",
      });
      return;
    }

    if (data.length === 0) {
      this.addError({ title: "No Data", message: "Query returned no results." });
      return;
    }

    // 2. SETUP: Define dimensões, margens e campos
    const dimension = queryResponse.fields.dimension_like[0];
    const heightMeasure = queryResponse.fields.measure_like[0];
    const widthMeasure = queryResponse.fields.measure_like[1];
    
    const margin = { top: 20, right: 20, bottom: 50, left: 60 };
    const width = element.clientWidth - margin.left - margin.right;
    const height = element.clientHeight - margin.top - margin.bottom;

    this.svg
      .attr("width", element.clientWidth)
      .attr("height", element.clientHeight);
    this.chart.attr("transform", `translate(${margin.left}, ${margin.top})`);

    // 3. PROCESSAMENTO DE DADOS: Calcula a largura e posição das barras
    const totalWidthValue = d3.sum(data, d => d[widthMeasure.name].value);

    if (totalWidthValue <= 0) {
      this.addError({ title: "Invalid Width Data", message: "The total of the width measure must be greater than zero." });
      return;
    }

    let currentXPosition = 0;
    const processedData = data.map(d => {
      const hValue = d[heightMeasure.name].value;
      const wValue = d[widthMeasure.name].value;
      const pixelWidth = (wValue / totalWidthValue) * width;

      const barData = {
        category: d[dimension.name].value,
        heightValue: hValue,
        pixelWidth: pixelWidth,
        xPosition: currentXPosition,
        links: d[dimension.name].links,
        heightFormatted: d[heightMeasure.name].rendered || d[heightMeasure.name].value,
        widthFormatted: d[widthMeasure.name].rendered || d[widthMeasure.name].value,
      };
      currentXPosition += pixelWidth;
      return barData;
    });

    // 4. ESCALAS: Mapeia os valores dos dados para posições em pixels
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(processedData, d => d.heightValue) * 1.1])
      .range([height, 0]);

    // 5. DESENHAR BARRAS
    const bars = this.chart.selectAll(".bar").data(processedData);
    bars.exit().remove();

    bars.enter().append("rect")
      .attr("class", "bar")
      .merge(bars)
      .attr("x", d => d.xPosition)
      .attr("width", d => d.pixelWidth)
      .attr("y", d => yScale(d.heightValue))
      .attr("height", d => height - yScale(d.heightValue))
      .attr("fill", config.barColor) // Usa a cor da configuração
      .on("click", (d) => LookerCharts.Utils.openDrillMenu({ links: d.links, event: d3.event }))
      .on("mouseover", (d) => {
        if (!config.show_tooltip) return;
        this.tooltip.transition().duration(200).style("opacity", .9);
        this.tooltip.html(
            `<b>${d.category}</b><br/>` +
            `${heightMeasure.label}: ${d.heightFormatted}<br/>` +
            `${widthMeasure.label}: ${d.widthFormatted}`
          )
          .style("left", (d3.event.pageX + 10) + "px")
          .style("top", (d3.event.pageY - 28) + "px");
      })
      .on("mouseout", () => this.tooltip.transition().duration(500).style("opacity", 0));

    // 6. DESENHAR EIXOS
    this.yAxisGroup
      .attr("class", "y-axis")
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(",.0f")));

    this.chart.selectAll(".y-axis-label").remove();
    this.chart.append("text")
      .attr("class", "y-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .text(config.y_axis_name || heightMeasure.label);
      
    this.xAxisGroup
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(d3.scaleLinear().range([0,width])).tickValues([]));

    const xLabels = this.chart.selectAll(".x-label").data(processedData);
    xLabels.exit().remove();
    xLabels.enter().append("text")
      .attr("class", "x-label")
      .merge(xLabels)
      .attr("text-anchor", "middle")
      .attr("x", d => d.xPosition + d.pixelWidth / 2)
      .attr("y", height + 20)
      .text(d => d.category)
      .style("font-size", `${config.label_font_size}px`);

    done();
  }
});
