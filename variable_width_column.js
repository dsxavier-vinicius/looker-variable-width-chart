looker.plugins.visualizations.add({
  id: 'variable_width_column_chart_v2',
  label: 'Variable Width Column Chart V2',

  _d3_ready: false,
  _elements_ready: false,

  options: {
    bar_color: {
      type: 'string', display: 'color', label: 'Bar Color', section: 'Style',
      default: '#4285F4', order: 1
    },
    bar_spacing: {
      type: 'number', label: 'Space Between Bars (px)', section: 'Style',
      default: 2, order: 2
    },
    show_y_axis: {
      type: 'boolean', label: 'Show Y-Axis', section: 'Axes', default: true, order: 1
    },
    y_axis_format: {
      type: 'string', label: 'Y-Axis Value Format', section: 'Axes', placeholder: 'e.g., "#,##0.0"',
      default: '', order: 2
    },
    show_labels: {
      type: 'boolean', label: 'Show Value Labels', section: 'Labels', default: true, order: 1
    },
    label_font_size: {
      type: 'number', label: 'Label Font Size', section: 'Labels', default: 11, order: 2
    },
    label_light_color: {
      type: 'string', label: 'Label Color (on Dark Bars)', section: 'Labels', display: 'color', default: '#FFFFFF', order: 3
    },
    label_dark_color: {
      type: 'string', label: 'Label Color (on Light Bars)', section: 'Labels', display: 'color', default: '#000000', order: 4
    }
  },

  create: function (element, config) {
    const d3_version = '7';
    if (typeof d3 === 'undefined') {
      const script = document.createElement('script');
      script.src = `https://d3js.org/d3.v${d3_version}.min.js`;
      script.async = true;
      script.onload = () => {
        this._d3_ready = true;
        console.log("D3 loaded");
      };
      document.head.appendChild(script);
    } else {
      this._d3_ready = true;
    }

    element.innerHTML = `
      <style>
        .final-chart-container { width: 100%; height: 100%; font-family: "Google Sans", "Noto Sans", sans-serif; }
        .bar-rect:hover { opacity: 0.8; }
        .chart-axis path, .chart-axis line { fill: none; stroke: #C0C0C0; shape-rendering: crispEdges; }
        .chart-axis text, .x-axis-label { fill: #333; font-size: 12px; }
        .bar-label { pointer-events: none; font-weight: bold; }
        .custom-tooltip {
            background-color: #FFFFFF; border: 1px solid #E0E0E0;
            box-shadow: 0px 2px 4px rgba(0,0,0,0.1); border-radius: 4px;
            padding: 8px 12px; font-size: 12px; color: #333;
        }
        .tooltip-title { font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #E0E0E0; padding-bottom: 4px; }
        .tooltip-metric { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .tooltip-metric-label { color: #616161; margin-right: 16px; }
        .tooltip-metric-value { font-weight: bold; }
      </style>
      <div class="final-chart-container">
        <svg class="final-chart-svg"></svg>
      </div>
    `;
  },

  updateAsync: function (data, element, config, queryResponse, details, doneRendering) {
    console.log("Running updateAsync", { data, config, queryResponse });

    if (!this._d3_ready) {
      console.warn("D3 not ready, retrying...");
      setTimeout(() => this.updateAsync(data, element, config, queryResponse, details, doneRendering), 100);
      return;
    }

    const width = element.clientWidth;
    const height = element.clientHeight;
    if (width === 0 || height === 0) {
      console.warn("Container size is zero, retrying...");
      setTimeout(() => this.updateAsync(data, element, config, queryResponse, details, doneRendering), 100);
      return;
    }

    if (!this._elements_ready) {
      this._svg = d3.select(element).select('.final-chart-svg');
      this._tooltip = d3.select(element).append('div').attr('class', 'looker-tooltip custom-tooltip').style('display', 'none').style('position', 'absolute').style('pointer-events', 'none').style('z-index', 100);
      this._elements_ready = true;
    }

    this.clearErrors();
    this._svg.selectAll('*').remove();
    if (data.length === 0) { doneRendering(); return; }

    const dims = queryResponse.fields.dimension_like;
    const meas = queryResponse.fields.measure_like;
    if (dims.length < 1 || meas.length < 2) {
      this.addError({ title: 'Estrutura de Campos Inválida', message: 'Requer 1 Dimensão (categorias), 1 Medida (altura) e 1 Medida (largura).' });
      return;
    }

    const xDimension = dims[0];
    const yMeasure = meas[0];
    const widthMeasure = meas[1];

    let cumulativeWidthInDataUnits = 0;
    const processedData = data.map((row) => {
      let heightValue = parseFloat(row[yMeasure.name]?.value) || 0;
      let widthValue = parseFloat(row[widthMeasure.name]?.value) || 0;
      const item = {
        xCategory: row[xDimension.name].value,
        yValue: heightValue,
        widthValue: widthValue,
        xStartInDataUnits: cumulativeWidthInDataUnits,
        _cells: { x: row[xDimension.name], y: row[yMeasure.name], width: row[widthMeasure.name] }
      };
      cumulativeWidthInDataUnits += widthValue;
      return item;
    });

    const totalWidthInDataUnits = cumulativeWidthInDataUnits;
    if (totalWidthInDataUnits <= 0) {
      this.addError({ title: 'Dados de Largura Inválidos', message: 'A soma da medida de largura tem de ser maior que zero.' });
      return;
    }

    const yMax = d3.max(processedData, d => d.yValue);
    const margin = { top: 20, right: 20, bottom: 50, left: 60 };
    const chartWidth = Math.max(0, width - margin.left - margin.right);
    const chartHeight = Math.max(0, height - margin.top - margin.bottom);

    this._svg.attr('width', width).attr('height', height);
    const g = this._svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const spacing = parseFloat(config.bar_spacing) || 0;
    const totalSpacing = (data.length - 1) * spacing;
    const drawableBarWidth = Math.max(0, chartWidth - totalSpacing);

    const xScale = d3.scaleLinear().domain([0, totalWidthInDataUnits]).range([0, drawableBarWidth]);
    const yScale = d3.scaleLinear().domain([0, yMax > 0 ? yMax : 1]).range([chartHeight, 0]).nice();

    if (config.show_y_axis) {
      g.append('g').attr('class', 'chart-axis').call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(config.y_axis_format || ',')));
    }

    let currentXPixel = 0;
    g.selectAll('.bar-rect')
      .data(processedData)
      .join('rect')
      .attr('class', 'bar-rect')
      .attr('x', () => {
        const x = currentXPixel;
        currentXPixel += xScale(processedData[0].widthValue) + spacing;
        return x;
      })
      .attr('y', d => yScale(d.yValue))
      .attr('width', d => xScale(d.widthValue))
      .attr('height', d => chartHeight - yScale(d.yValue))
      .attr('fill', config.bar_color)
      .on('mouseover', (event, d) => {
        const tooltipHtml = `
          <div class="tooltip-title">${LookerCharts.Utils.textForCell(d._cells.x)}</div>
          <div class="tooltip-metric">
            <span class="tooltip-metric-label">${yMeasure.label_short || yMeasure.label}</span>
            <span class="tooltip-metric-value">${LookerCharts.Utils.textForCell(d._cells.y)}</span>
          </div>
          <div class="tooltip-metric">
            <span class="tooltip-metric-label">${widthMeasure.label_short || widthMeasure.label}</span>
            <span class="tooltip-metric-value">${LookerCharts.Utils.textForCell(d._cells.width)}</span>
          </div>`;
        this._tooltip.html(tooltipHtml).style('display', 'block');
      })
      .on('mousemove', (event) => {
        this._tooltip.style('left', (event.pageX + 15) + 'px').style('top', (event.pageY + 15) + 'px');
      })
      .on('mouseout', () => {
        this._tooltip.style('display', 'none');
      })
      .on('click', (event, d) => {
        LookerCharts.Utils.openDrillMenu({ links: d._cells.x.links, event: event });
      });

    if (config.show_labels) {
      currentXPixel = 0;
      g.selectAll('.bar-label')
        .data(processedData)
        .join('text')
        .attr('class', 'bar-label')
        .text(d => LookerCharts.Utils.textForCell(d._cells.y))
        .attr('font-size', `${config.label_font_size}px`)
        .attr('fill', () => {
          const luminance = this.getLuminance(config.bar_color);
          return luminance > 0.5 ? config.label_dark_color : config.label_light_color;
        })
        .attr('x', (d) => {
          const x = currentXPixel + (xScale(d.widthValue) / 2);
          currentXPixel += xScale(d.widthValue) + spacing;
          return x;
        })
        .attr('y', d => yScale(d.yValue) + config.label_font_size * 1.5)
        .style('text-anchor', 'middle')
        .style('display', d => {
          const barPixelHeight = chartHeight - yScale(d.yValue);
          return (barPixelHeight < config.label_font_size * 2) ? 'none' : 'block';
        });
    }

    doneRendering();
  },

  getLuminance: function(hex) {
    if (typeof hex !== 'string' || hex.length < 4) return 0;
    hex = hex.replace("#", "");
    if (hex.length === 3) { hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]; }
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
});
