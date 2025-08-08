# manifest.lkml for the Variable Width Column Chart
visualization: {
  id: "variable_width_column_chart_v2" # ID único para a sua instância Looker
  label: "Variable Width Column Chart V2" # Nome que aparece no menu
  file: "variable_width_column.js" # Aponta para o ficheiro JavaScript
  dependencies: [
    {
      url: "https://d3js.org/d3.v5.min.js"
      integrity: "sha256-gpgaJgC2frL1yqPzO2eHssUjQuc5EwX2IuUjf2KxKmw="
      crossorigin: "anonymous"
    }
  ]
}

# Opção para o utilizador poder escolher a cor das barras
visualization_option: {
  name: "barColor"
  section: "Style"
  type: "string"
  label: "Bar Color"
  display: "color"
  default: "#2756B3"
}

# Opção para mostrar ou esconder a tooltip
visualization_option: {
  name: "show_tooltip"
  section: "Style"
  type: "boolean"
  label: "Show Tooltip"
  default: "true"
}

# Opção para definir o nome do eixo Y
visualization_option: {
  name: "y_axis_name"
  section: "Y-Axis"
  type: "string"
  label: "Y-Axis Name"
  placeholder: "Enter Y-Axis Name"
}

# Opção para definir o tamanho da fonte dos labels do eixo X
visualization_option: {
  name: "label_font_size"
  section: "X-Axis"
  type: "number"
  label: "Label Font Size"
  default: "12"
}
