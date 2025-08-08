(function() {
  // Esta função contém toda a lógica da nossa visualização.
  // Só será executada depois de garantirmos que o D3.js está carregado.
  const registerVisualization = () => {
    console.log("DEBUG: MENSAGEM 1 - A registar a visualização..."); // MENSAGEM 1

    looker.plugins.visualizations.add({
      options: {
        barColor: { type: 'string', label: 'Bar Color', display: 'color', default: '#2756B3' },
        show_tooltip: { type: 'boolean', label: 'Show Tooltip', default: true },
        y_axis_name: { type: 'string', label: 'Y-Axis Name', placeholder: 'Enter Y-Axis Name' },
        label_font_size: { type: 'number', label: 'Label Font Size', default: 12 }
      },

      create: function(element, config) {
        console.log("DEBUG: MENSAGEM 2 - create() foi chamada."); // MENSAGEM 2
        this.container = d3.select(element);
        this.svg = this.container.append("svg");
        this.chart = this.svg.append("g");
      },

      updateAsync: function(data, element, config, queryResponse, details, done) {
        console.log("DEBUG: MENSAGEM 3 - updateAsync() foi chamada."); // MENSAGEM 3
        this.clearErrors();

        if (queryResponse.fields.dimension_like.length !== 1 || queryResponse.fields.measure_like.length !== 2) {
          this.addError({ title: "Invalid Configuration", message: "This chart requires exactly 1 dimension and 2 measures." });
          return;
        }
        console.log("DEBUG: MENSAGEM 4 - Validação dos dados passou."); // MENSAGEM 4

        const margin = { top: 20, right: 20, bottom: 50, left: 60 };
        const width = element.clientWidth - margin.left - margin.right;
        const height = element.clientHeight - margin.top - margin.bottom;

        console.log("DEBUG: MENSAGEM 5 - Dimensões do gráfico calculadas.", { width: width, height: height }); // MENSAGEM 5

        if (width <= 0 || height <= 0) {
            console.log("DEBUG: Renderização parada porque a largura ou altura é zero.");
            return;
        }
        
        this.svg.attr("width", element.clientWidth).attr("height", element.clientHeight);
        this.chart.attr("transform", `translate(${margin.left}, ${margin.top})`);

        const dimension = queryResponse.fields.dimension_like[0];
        const heightMeasure = queryResponse.fields.measure_like[0];
        const widthMeasure = queryResponse.fields.measure_like[1];
        
        const totalWidthValue = d3.sum(data, d => d[widthMeasure.name].value);
        if (totalWidthValue <= 0) {
          this.addError({ title: "Invalid Width Data", message: "The total of the width measure must be greater than zero." });
          return;
        }

        let currentXPosition = 0;
        const processedData = data.map(d => {
          const wValue = d[widthMeasure.name].value;
          const pixelWidth = (wValue / totalWidthValue) * width;
          return {
            category: d[dimension.name].value,
            heightValue: d[heightMeasure.name].value,
            pixelWidth: pixelWidth,
            xPosition: currentXPosition,
            links: d[dimension.name].links,
            heightFormatted: d[heightMeasure.name].rendered || d[heightMeasure.name].value,
            widthFormatted: d[widthMeasure.name].rendered || d[widthMeasure.name].value,
            _xpos: currentXPosition += pixelWidth
          };
        });

        const yScale = d3.scaleLinear().domain([0, d3.max(processedData, d => d.heightValue) * 1.1]).range([height, 0]);

        console.log("DEBUG: MENSAGEM 6 - A desenhar as barras..."); // MENSAGEM 6
        this.chart.selectAll(".bar").data(processedData)
          .enter().append("rect")
          .attr("class", "bar")
          .attr("x", d =>
