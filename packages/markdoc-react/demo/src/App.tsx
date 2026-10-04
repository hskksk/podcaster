import cytoscape from 'cytoscape'
import * as echarts from 'echarts'
import vegaEmbed from 'vega-embed'
import {
  MarkdocView,
  createChartRenderer,
  createCytoscapeGraphHandler,
  createEChartsChartHandler,
  createGraphRenderer,
  createVegaLiteChartHandler,
} from '@hskksk/markdoc-react'

const chartRenderer = createChartRenderer({
  echarts: createEChartsChartHandler(echarts),
  'vega-lite': createVegaLiteChartHandler(vegaEmbed),
})

const graphRenderer = createGraphRenderer({
  cytoscape: createCytoscapeGraphHandler(cytoscape),
})

const source = `
# Chart & graph demo

Sample data rendered with **echarts**, **vega-lite**, and **cytoscape**.

## ECharts (monthly signups)

{% chart engine="echarts" height="340" %}
\`\`\`json
{
  "tooltip": { "trigger": "axis" },
  "xAxis": {
    "type": "category",
    "data": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
  },
  "yAxis": { "type": "value" },
  "series": [
    {
      "name": "Signups",
      "type": "line",
      "smooth": true,
      "areaStyle": { "opacity": 0.15 },
      "data": [820, 932, 901, 934, 1290, 1330]
    }
  ]
}
\`\`\`
{% /chart %}

## Vega-Lite (category totals)

{% chart engine="vega-lite" height="320" %}
\`\`\`json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "Sample bar chart",
  "data": {
    "values": [
      { "category": "Docs", "hours": 28 },
      { "category": "API", "hours": 55 },
      { "category": "SDK", "hours": 43 },
      { "category": "Support", "hours": 91 }
    ]
  },
  "mark": { "type": "bar", "cornerRadiusEnd": 4 },
  "encoding": {
    "x": { "field": "category", "type": "nominal", "title": "Team" },
    "y": { "field": "hours", "type": "quantitative", "title": "Hours" },
    "color": { "field": "category", "type": "nominal", "legend": null }
  }
}
\`\`\`
{% /chart %}

## Cytoscape (service graph)

{% graph engine="cytoscape" height="380" %}
\`\`\`json
{
  "elements": [
    { "data": { "id": "web", "label": "Web" } },
    { "data": { "id": "api", "label": "API" } },
    { "data": { "id": "worker", "label": "Worker" } },
    { "data": { "id": "db", "label": "DB" } },
    { "data": { "id": "cache", "label": "Cache" } },
    { "data": { "source": "web", "target": "api" } },
    { "data": { "source": "api", "target": "worker" } },
    { "data": { "source": "api", "target": "cache" } },
    { "data": { "source": "worker", "target": "db" } }
  ],
  "layout": { "name": "cose", "animate": false },
  "style": [
    {
      "selector": "node",
      "style": {
        "label": "data(label)",
        "text-valign": "center",
        "color": "#e7ecf3",
        "background-color": "#3b82f6",
        "width": 56,
        "height": 56,
        "font-size": 11
      }
    },
    {
      "selector": "edge",
      "style": {
        "width": 2,
        "line-color": "#64748b",
        "target-arrow-color": "#64748b",
        "target-arrow-shape": "triangle",
        "curve-style": "bezier"
      }
    }
  ]
}
\`\`\`
{% /graph %}
`

export function App() {
  return (
    <div className="demo-page">
      <h1>@hskksk/markdoc-react — viz demo</h1>
      <p className="demo-lede">Interactive samples from Markdoc tags (hover charts, pan/zoom the graph).</p>
      <MarkdocView source={source} chartRenderer={chartRenderer} graphRenderer={graphRenderer} theme="dark" />
    </div>
  )
}
