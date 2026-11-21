/* Lantern Lane — panel renderer.
   One job: turn a scene's element list into an inline SVG string.
   buildPanelSvg(scene, 'left') draws the scene as written; 'right'
   applies the scene's ten differences first, so the two pictures are
   near-identical by construction. Markers are drawn by game.js on top
   of the returned SVG, never baked into the art. */

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function elementToSvg(el) {
  const a = (attrs) =>
    Object.entries(attrs)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => k + '="' + escapeAttr(v) + '"')
      .join(' ');
  switch (el.type) {
    case 'rect':
      return '<rect ' + a({ x: el.x, y: el.y, width: el.w, height: el.h, rx: el.rx, fill: el.fill, opacity: el.opacity }) + '/>';
    case 'circle':
      return '<circle ' + a({ cx: el.cx, cy: el.cy, r: el.r, fill: el.fill, stroke: el.stroke, 'stroke-width': el['stroke-width'], opacity: el.opacity }) + '/>';
    case 'ellipse':
      return '<ellipse ' + a({ cx: el.cx, cy: el.cy, rx: el.rx, ry: el.ry, fill: el.fill, opacity: el.opacity }) + '/>';
    case 'poly':
      return '<polygon ' + a({ points: el.points, fill: el.fill, stroke: el.stroke, 'stroke-width': el['stroke-width'], opacity: el.opacity }) + '/>';
    case 'path':
      return '<path ' + a({ d: el.d, fill: el.fill, stroke: el.stroke, 'stroke-width': el['stroke-width'], 'stroke-linecap': el['stroke-linecap'], opacity: el.opacity }) + '/>';
    case 'line':
      return '<line ' + a({ x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2, stroke: el.stroke, 'stroke-width': el['stroke-width'], 'stroke-linecap': el['stroke-linecap'], opacity: el.opacity }) + '/>';
    case 'text':
      return '<text ' + a({ x: el.x, y: el.y, fill: el.fill, 'font-size': el.size, 'text-anchor': el.anchor || 'start', 'font-weight': 'bold', 'font-family': 'Trebuchet MS, Verdana, sans-serif' }) + '>' + escapeAttr(el.str) + '</text>';
    default:
      return '';
  }
}

/* Apply one difference to a cloned element list (right panel only). */
function applyDifference(elements, diff) {
  if (diff.kind === 'add') {
    elements.push(Object.assign({}, diff.element));
    return;
  }
  const el = elements.find((e) => e.id === diff.id);
  if (!el) return;
  if (diff.kind === 'remove') {
    el._hidden = true;
  } else if (diff.kind === 'recolor') {
    el.fill = diff.fill;
  } else if (diff.kind === 'retext') {
    el.str = diff.str;
  } else if (diff.kind === 'move') {
    for (const key of ['x', 'cx']) if (el[key] !== undefined) el[key] += diff.dx || 0;
    for (const key of ['y', 'cy']) if (el[key] !== undefined) el[key] += diff.dy || 0;
    if (el.type === 'path' || el.type === 'poly') {
      // Moved shapes are rebuilt by the caller from their anchor point;
      // path/poly diffs in this game only shift via a translate wrapper.
      el._translate = 'translate(' + (diff.dx || 0) + ' ' + (diff.dy || 0) + ')';
    }
  }
}

function buildPanelSvg(scene, side) {
  let elements = scene.elements.map((el) => Object.assign({}, el));
  if (side === 'right') {
    for (const diff of scene.differences) applyDifference(elements, diff);
  }
  const parts = elements
    .filter((el) => !el._hidden)
    .map((el) => {
      const body = elementToSvg(el);
      return el._translate ? '<g transform="' + el._translate + '">' + body + '</g>' : body;
    });
  return (
    '<svg viewBox="0 0 640 420" xmlns="http://www.w3.org/2000/svg" role="img" ' +
    'aria-label="' + escapeAttr(scene.name) + ' — ' + side + ' picture">' +
    parts.join('') +
    '</svg>'
  );
}
