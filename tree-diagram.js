'use strict';

window.createTreeDiagram = (model, questions) => {
  const boxWidth = 148;
  const padding = 12;
  const lineHeight = 18;
  const levels = [];
  const nodes = [];
  const edges = [];
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = '600 14px Arial, sans-serif';
  const escape = value => value.replace(/[&<>]/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);
  let leaves = 0;

  function wrap(text) {
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const joined = line ? line + ' ' + word : word;
      if (measure.measureText(joined).width <= boxWidth - 20) {
        line = joined;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const char of word) {
        if (measure.measureText(line + char).width > boxWidth - 20) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
    return [...lines, line];
  }

  function visit(node, level) {
    const endpoint = Boolean(node.labels);
    const label = endpoint
      ? node.labels.map(id => 'Figure ' + id.toUpperCase()).join(' or ')
      : questions[node.column].trim();
    const lines = wrap(label);
    const height = lines.length * lineHeight + 20;
    const box = { endpoint, lines, height, level };
    nodes.push(box);
    levels[level] = Math.max(levels[level] || 0, height);
    if (endpoint) {
      box.x = padding + boxWidth / 2 + leaves++ * (boxWidth + 18);
    } else {
      const yes = visit(node.yes, level + 1);
      const no = visit(node.no, level + 1);
      box.x = (yes.x + no.x) / 2;
      edges.push({ from: box, to: yes, yes: true }, { from: box, to: no, yes: false });
    }
    return box;
  }

  const root = visit(model, 0);
  let bottom = padding;
  const layerTop = levels.map((height, index) => {
    const y = bottom;
    bottom += height + (index < levels.length - 1 ? 62 : padding);
    return y;
  });
  const width = padding * 2 + leaves * boxWidth + (leaves - 1) * 18;
  const height = bottom;

  function connector({ from, to, yes }) {
    const y = layerTop[from.level] + from.height;
    const target = layerTop[to.level];
    const elbow = y + 17;
    const labelY = target - 17;
    const ink = yes ? '#17614a' : '#8c294e';
    return `<path d="M${from.x} ${y} V${elbow} H${to.x} V${target}" fill="none" stroke="${ink}" stroke-width="1.8"/>
      <rect x="${to.x - 29}" y="${labelY - 10}" width="58" height="20" rx="8" fill="#fff" stroke="${ink}"/>
      <text x="${to.x}" y="${labelY + 4}" fill="${ink}" font-size="12" font-weight="700">${yes ? '1 · Yes' : '0 · No'}</text>`;
  }

  function boxView(box) {
    const y = layerTop[box.level];
    return `<rect x="${box.x - boxWidth / 2}" y="${y}" width="${boxWidth}" height="${box.height}" rx="9"
      fill="${box.endpoint ? '#f0ebfb' : '#fff'}" stroke="#403361" stroke-width="1.5"/>
      <text x="${box.x}" y="${y + 23}" fill="#181638" font-size="14" font-weight="${box.endpoint ? 700 : 600}">
        ${box.lines.map((line, index) => `<tspan x="${box.x}" dy="${index ? lineHeight : 0}">${escape(line)}</tspan>`).join('')}
      </text>`;
  }

  return {
    width, height, rootX: root.x,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"
      width="${width}" height="${height}" role="img" aria-label="Learned decision tree with Yes and No branches"
      text-anchor="middle" font-family="Arial, sans-serif">${edges.map(connector).join('')}${nodes.map(boxView).join('')}</svg>`
  };
};
