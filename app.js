'use strict';

const app = document.querySelector('#app');
const catalog = window.shapeCatalog;
const shapes = new Map(catalog.map(shape => [shape.id, shape]));
const storageKey = 'docs-shape-detective-v1';
const question = (text = '', yes = null, no = null) => ({ text, yes, no });
const fresh = () => ({ group: '', tree: question(), tests: [], reflection: ['', '', ''], changes: '' });
const copy = value => JSON.parse(JSON.stringify(value));
const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

let state = fresh();
let saveError = '';
try {
  const saved = localStorage.getItem(storageKey);
  if (saved) state = JSON.parse(saved);
} catch {
  saveError = 'Browser storage is unavailable. Export your tree to keep a copy.';
}

let page = 'home';
let selectedPath = '';
let zoom = 100;
let teacherGap = false;
let run = null;
let message = '';

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    saveError = '';
  } catch {
    saveError = 'Progress couldn’t be saved on this device. Export your tree to keep it.';
  }
  const status = document.querySelector('#save-status');
  if (status) status.textContent = saveError || message;
}

function navigate(next) {
  page = next;
  message = '';
  render();
  window.scrollTo(0, 0);
  app.querySelector('h1,h2')?.focus();
}

function nodeAt(tree, path) {
  return [...path].reduce((node, branch) => node?.[branch === 'y' ? 'yes' : 'no'], tree);
}

function replaceNode(path, node) {
  if (!path) state.tree = node;
  else nodeAt(state.tree, path.slice(0, -1))[path.endsWith('y') ? 'yes' : 'no'] = node;
  save();
  render();
}

function validate(tree) {
  const missing = [];
  const endpoints = new Set();
  function visit(node, path, depth) {
    if (depth > 40 || !node || typeof node !== 'object') {
      missing.push(path);
      return;
    }
    if ('shape' in node) {
      if (shapes.has(node.shape)) endpoints.add(node.shape);
      else missing.push(path);
      return;
    }
    if (!node.text?.trim()) missing.push(path);
    visit(node.yes, path + 'y', depth + 1);
    visit(node.no, path + 'n', depth + 1);
  }
  visit(tree, '', 0);
  return { missing, endpoints };
}

function importNode(node, depth = 0) {
  if (node === null) return null;
  if (depth > 40 || !node || typeof node !== 'object' || Array.isArray(node)) throw Error('Invalid branch.');
  if (Object.prototype.hasOwnProperty.call(node, 'shape') && Object.keys(node).length === 1 &&
      (node.shape === '' || shapes.has(node.shape))) return { shape: node.shape };
  if (Object.keys(node).length !== 3 || typeof node.text !== 'string' || node.text.length > 240 ||
      !Object.prototype.hasOwnProperty.call(node, 'yes') || !Object.prototype.hasOwnProperty.call(node, 'no')) throw Error('Invalid question or branch.');
  return question(node.text, importNode(node.yes, depth + 1), importNode(node.no, depth + 1));
}

const btn = (label, action, classes = '', attrs = '') =>
  `<button type="button" class="${classes}" data-action="${action}" ${attrs}>${label}</button>`;
const heading = (label, tag = 'h2') => `<${tag} tabindex="-1">${label}</${tag}>`;
const pathName = path => path ? [...path].map(branch => branch === 'y' ? 'Yes' : 'No').join(' → ') : 'Start';
const shapeName = id => shapes.get(id)?.name ?? 'Choose a shape';

function drawing(shape) {
  return shape ? `<span class="shape"><svg aria-hidden="true" viewBox="0 0 120 100" fill="#e3dafd" stroke="currentColor" stroke-width="3" stroke-linejoin="round">${shape.svg}</svg></span>` : '';
}

function diagram(tree, editing = false, activeRun = null, print = false) {
  const traveled = new Set(activeRun?.steps.map(step => step.next) ?? []);
  if (activeRun?.steps.length) traveled.add('');
  function branch(node, path) {
    const end = node && 'shape' in node;
    const label = escape(end ? shapeName(node.shape) : node?.text || (node ? 'Untitled question' : 'Add branch'));
    const classes = ['node', end ? 'endpoint' : '', !node ? 'missing' : '',
      path === activeRun?.path || (editing && path === selectedPath) ? 'active' : traveled.has(path) ? 'visited' : ''].join(' ');
    const box = editing ? btn(label, 'select', classes, `data-path="${path}" aria-label="${escape(pathName(path) + ': ' + (end ? shapeName(node.shape) : node?.text || 'Add branch'))}"`) :
      `<span class="${classes}">${label}</span>`;
    const children = node && !end ? `<div class="children">${['y', 'n'].map(key =>
      `<div class="child"><span class="edge ${traveled.has(path + key) ? 'visited' : ''}">${key === 'y' ? 'YES' : 'NO'}</span>${branch(node[key === 'y' ? 'yes' : 'no'], path + key)}</div>`).join('')}</div>` : '';
    return `<div>${box}${children}</div>`;
  }
  if (print) return printDiagram(tree);
  return `<div class="row">${btn('Zoom out', 'zoom-out')}${btn('Zoom in', 'zoom-in')} <span id="zoom-label">${zoom}%</span></div>
    <div class="scroll" tabindex="0" aria-label="Scrollable decision tree"><div class="tree" style="font-size:${zoom}%">${branch(tree, '')}</div></div>`;
}

function printDiagram(tree) {
  const nodes = [];
  const edges = [];
  let leaves = 0;
  let depth = 0;
  function layout(node, level) {
    depth = Math.max(depth, level);
    const y = level * 100 + 36;
    const end = node && 'shape' in node;
    const label = end ? shapeName(node.shape) : node?.text || 'Missing branch';
    let x;
    if (node && !end) {
      const yes = layout(node.yes,level+1);
      const no = layout(node.no,level+1);
      x = (yes.x + no.x) / 2;
      for (const [child,name] of [[yes,'YES'],[no,'NO']]) {
        const mid = y+50;
        edges.push(`<path d="M${x},${y+25} V${mid} H${child.x} V${child.y-25}" fill="none" stroke="#333"/>
        <text x="${(x+child.x)/2}" y="${mid-4}" font-size="10">${name}</text>`);
      }
    } else {
      x = leaves++ * 164 + 82;
    }
    const short = label.length > 66 ? label.slice(0,63) + '…' : label;
    const lines = short.match(/.{1,22}(?:\s|$)|.{1,22}/g) ?? [''];
    nodes.push(`<rect x="${x-76}" y="${y-25}" width="152" height="50" rx="7" fill="white" stroke="#222"/>
      <text font-size="11">${lines.map((line,index) =>
        `<tspan x="${x}" y="${y-(lines.length-1)*6+4+index*12}">${escape(line.trim())}</tspan>`).join('')}</text>`);
    return { x,y };
  }
  layout(tree,0);
  return `<svg class="print-diagram" role="img" aria-label="Decision tree diagram" text-anchor="middle" viewBox="0 0 ${leaves*164} ${depth*100+72}">${edges.join('')}${nodes.join('')}</svg>`;
}

const clues = [
  { key: 'sides', label: 'How many straight sides?', options: [[0,'0'],[3,'3'],[4,'4'],[5,'5'],[6,'6'],[8,'8'],[-1,'Another number']] },
  { key: 'right', label: 'How many right angles?', options: [[0,'0'],[1,'1'],[2,'2'],[4,'4'],[-1,'Another number']] },
  { key: 'equal', label: 'Are all straight sides the same length?', options: [[1,'Yes'],[0,'No']] },
  { key: 'parallel', label: 'Does it have exactly one pair of parallel sides?', options: [[1,'Yes'],[0,'No']] }
];

// Properties describe the specific classroom figures.
const profiles = {
  a: { sides: 6, right: 0, equal: 1, parallel: 0 },
  b: { sides: 0, right: 0, parallel: 0 },
  c: { sides: 6, right: 0, equal: 0, parallel: 0 },
  d: { sides: 5, right: 2, equal: 0, parallel: 1 },
  e: { sides: 4, right: 2, equal: 0, parallel: 1 },
  f: { sides: 8, right: 0, equal: 1, parallel: 0 },
  g: { sides: 4, right: 0, equal: 0, parallel: 0 },
  h: { sides: 4, right: 4, equal: 1, parallel: 0 },
  i: { sides: 3, right: 1, equal: 0, parallel: 0 },
  j: { sides: 3, right: 0, equal: 1, parallel: 0 },
  k: { sides: 4, right: 4, equal: 0, parallel: 0 },
  l: { sides: 5, right: 0, equal: 1, parallel: 0 }
};

function matchShapes(answers) {
  return catalog.filter(shape => Object.entries(answers).every(([key, value]) => profiles[shape.id][key] === value));
}

function cluesPage() {
  return `<section class="hero">${heading("DOC’S AI SHAPE DETECTIVE", 'h1')}<p>Can you describe a shape well enough for the machine to predict it?</p></section>
    <section class="panel"><div class="predict-layout"><div>
    <h2>Describe your mystery shape</h2><p>Look at your shape card. Enter the features you can observe. Leave uncertain clues blank.</p>
    <form id="shape-predictor">${clues.map(({key,label,options}) => `<label>${label}<select name="${key}">
      <option value="">Not sure</option>${options.map(([value,text]) => `<option value="${value}">${text}</option>`).join('')}</select></label>`).join('')}
      <div class="row"><button class="primary" type="submit">Predict my shape</button><button type="reset">Clear clues</button></div>
    </form></div><section id="prediction-result" aria-live="polite">
    <h2>Machine prediction</h2><p>Enter a clue to see which classroom figures fit.</p></section></div></section>
    <div class="row">${btn('Teacher demonstration','teacher')}${btn('Decision-tree lab','build')}${btn('Teacher guide','guide')}</div>
    <p>This classifier compares your clues with the features of the 12 classroom figures.</p>`;
}

function showPrediction(form) {
  const answers = Object.fromEntries([...new FormData(form)].filter(([,value]) => value !== '').map(([key,value]) => [key,Number(value)]));
  const entered = clues.filter(clue => clue.key in answers);
  const result = document.querySelector('#prediction-result');
  if (!entered.length) {
    result.innerHTML = '<h2>Machine prediction</h2><p>Enter at least one clue, then try again.</p>';
    return;
  }
  const matches = matchShapes(answers);
  const next = clues.filter(clue => !(clue.key in answers)).find(clue =>
    new Set(matches.map(shape => profiles[shape.id][clue.key])).size > 1);
  const evidence = `<h3>Clues used</h3><ul>${entered.map(clue =>
    `<li>${clue.label} <strong>${clue.options.find(([value]) => value === answers[clue.key])[1]}</strong></li>`).join('')}</ul>`;
  let summary;
  if (matches.length === 1) {
    const [shape] = matches;
    summary = `<h2>Machine prediction</h2>${drawing(shape)}<h3>${shape.name}</h3><p>${shape.features}</p>`;
  } else if (matches.length > 1) {
    summary = `<h2>${matches.length} shapes fit your clues</h2><p>${matches.map(shape => shape.name).join(', ')}.</p>
      ${next ? `<p><strong>Try this clue next.</strong> ${next.label}</p>` : ''}`;
  } else {
    summary = '<h2>No classroom shape matches</h2><p>Check your clues against the shape card. Change a clue or leave it blank if you’re unsure.</p>';
  }
  result.innerHTML = summary + evidence;
}

app.addEventListener('submit', event => {
  if (event.target.id !== 'shape-predictor') return;
  event.preventDefault();
  showPrediction(event.target);
});
app.addEventListener('reset', event => {
  if (event.target.id === 'shape-predictor') {
    document.querySelector('#prediction-result').innerHTML = '<h2>Machine prediction</h2><p>Enter a clue to see which classroom figures fit.</p>';
  }
});

function labNav() {
  return `<nav class="row no-print" aria-label="Student lab">${[['build','Build'],['test','Test'],['history','History'],['library','Shape library'],['report','Report']].map(([key,label]) =>
    btn(label,key,page === key ? 'selected' : '',page === key ? 'aria-current="page"' : '')).join('')}</nav>`;
}

function builder() {
  const node = nodeAt(state.tree, selectedPath);
  const end = node && 'shape' in node;
  const { missing, endpoints } = validate(state.tree);
  const options = catalog.map(shape => `<option value="${escape(shape.id)}" ${shape.id === node?.shape ? 'selected' : ''}>${escape(shape.name)}</option>`).join('');
  const controls = !node ? btn('Add a question','question') + btn('Set a prediction','endpoint') : end ?
    `<label>Predicted shape<select id="prediction"><option value="">Choose a shape</option>${options}</select></label>${btn('Add a question here','question')}` :
    `<label>Write a complete Yes/No question<textarea id="question" maxlength="240" rows="3" placeholder="Does this shape have …?">${escape(node.text)}</textarea></label>
    <div class="row">${btn(node.yes ? 'Edit Yes branch' : 'Build Yes branch','select','',`data-path="${selectedPath}y"`)}${btn(node.no ? 'Edit No branch' : 'Build No branch','select','',`data-path="${selectedPath}n"`)}</div>
    <div class="row">${btn('Swap Yes and No branches','swap')}${selectedPath ? btn('Replace with prediction','endpoint') : ''}</div>`;
  return `${heading('Build your decision tree')}<p>Use your paper tree. Select any box to edit its question or endpoint.</p>
    <label>Group name or number <small>Use a group label without personal names.</small><input id="group" maxlength="60" value="${escape(state.group)}"></label>
    <div class="split"><section class="panel"><h3>${pathName(selectedPath)}</h3>${controls}
    ${selectedPath && node ? btn('Delete this branch','delete') : ''}</section>
    <section class="panel"><h3>Decision tree</h3>${diagram(state.tree,true)}</section></div>
    <p class="notice" id="validation">${validationText(missing,endpoints)}</p>
    <div class="row">${btn('Save My Tree','save','primary')}${btn('Export My Tree','export')}${btn('Import My Tree','import')}${btn('Start New Tree','new')}<input hidden type="file" id="file" accept=".json,application/json"></div>
    <p><small>Work saves in this browser on this device. Browser data can be cleared. Export a copy to continue on another device.</small></p>
    <p id="save-status" role="status">${escape(saveError || message)}</p>`;
}

function validationText(missing, endpoints) {
  const uncovered = catalog.filter(shape => !endpoints.has(shape.id)).map(shape => shape.name);
  return `${missing.length ? escape('Incomplete locations: ' + missing.map(pathName).join(' · ')) : 'Each branch reaches a prediction.'}
  ${uncovered.length ? '<br>' + escape('No endpoint for: ' + uncovered.join(', ')) : ''}
  ${!catalog.length ? '<br>Shape testing awaits the current classroom shape set.' : ''}`;
}

function library() {
  return `${heading('Shape library')}<div class="grid">${catalog.map(shape =>
    `<article class="panel choice">${drawing(shape)}<h3>${escape(shape.name)}</h3><p>${escape(shape.features)}</p></article>`).join('') || '<p>The current classroom cards are needed to fill this library.</p>'}</div>`;
}

function testing(teacher = false) {
  const tree = teacher ? (teacherGap ? window.teacherGapExample : window.teacherExample) : state.tree;
  const toolbar = teacher ? `<div class="row">${btn('Full screen','fullscreen')}${btn('Complete example','teacher-complete',teacherGap ? '' : 'selected')}${btn('Missing feature example','teacher-gap',teacherGap ? 'selected' : '')}${btn('Reset Demonstration','teacher-reset')}</div>` : '';
  if (!tree || !catalog.length) return toolbar + '<p class="notice">Testing awaits the current classroom shape set.</p>';
  const { missing } = validate(tree);
  if (missing.length) return `<p class="notice">Complete each question and both branches before testing.</p>${btn('Edit My Decision Tree','build','primary')}`;
  if (!run) return `${toolbar}<section class="panel"><h3>Choose a mystery figure</h3><p>Look at the figure and answer each question about its features.</p>
    ${btn('Draw a random figure','random','primary')}
    <div class="grid">${catalog.map((shape,index) => btn(drawing(shape) + 'Figure ' + (index + 1), 'start-test', 'choice', `data-index="${index}"`)).join('')}</div></section>
    ${teacher ? '<section class="panel"><h3>Sample tree</h3>' + diagram(tree) + '</section>' : ''}`;
  const node = nodeAt(run.tree,run.path);
  if ('shape' in node) return toolbar + result(teacher);
  return `${toolbar}<div class="split"><section class="panel choice"><h3>Mystery figure</h3>${drawing(shapes.get(run.actual))}
  <p>Question ${run.steps.length + 1}</p><h2 tabindex="-1" id="current-question">${escape(node.text)}</h2>
  <div class="row" style="justify-content:center">${btn('Yes','answer','answer','data-branch="y"')}${btn('No','answer','answer no','data-branch="n"')}</div></section>
  <section class="panel"><h3>Follow the branches</h3>${diagram(run.tree,false,run)}</section></div>`;
}

function startTest(index) {
  const teacher = page === 'teacher';
  const tree = teacher ? (teacherGap ? window.teacherGapExample : window.teacherExample) : state.tree;
  if (!catalog[index] || !tree || validate(tree).missing.length) return;
  run = { tree: copy(tree), actual: catalog[index].id, path: '', steps: [], revealed: !teacher };
  render();
  document.querySelector('#current-question')?.focus();
}

function answer(branch) {
  const node = nodeAt(run.tree,run.path);
  if (!node || 'shape' in node || !['y','n'].includes(branch)) return;
  const next = run.path + branch;
  run.steps.push({ text: node.text, branch, next });
  run.path = next;
  const destination = nodeAt(run.tree,next);
  if ('shape' in destination && page !== 'teacher') {
    state.tests.push({ actual: run.actual, prediction: destination.shape, steps: copy(run.steps), note: '' });
    save();
  }
  render();
  document.querySelector('#current-question,#result-heading')?.focus();
}

function stepsList(steps) {
  return `<ol>${steps.map(step => `<li>${escape(step.text)} <strong>→ ${step.branch === 'y' ? 'Yes' : 'No'}</strong></li>`).join('')}</ol>`;
}

function result(teacher) {
  const node = nodeAt(run.tree,run.path);
  const correct = node.shape === run.actual;
  return `<section class="panel result"><h2 tabindex="-1" id="result-heading">Prediction complete</h2>
    <div class="grid"><div class="choice"><h3>Machine prediction</h3>${drawing(shapes.get(node.shape))}<strong>${escape(shapeName(node.shape))}</strong></div>
    <div class="choice"><h3>Actual shape</h3>${run.revealed ? drawing(shapes.get(run.actual)) + '<strong>' + escape(shapeName(run.actual)) + '</strong>' : btn('Reveal actual shape','reveal','primary')}</div></div>
    ${run.revealed ? `<h3 class="${correct ? 'good' : 'error'}">Result · ${correct ? 'Correct' : 'Incorrect'}</h3>
    ${correct ? '' : '<p>Review the questions and branches below. Which feature would distinguish these two figures?</p>'}` : ''}
    <details ${teacher ? 'open' : ''}><summary>Review My Decision Path</summary>${stepsList(run.steps)}
    <p>Endpoint at ${pathName(run.path)} → ${escape(shapeName(node.shape))}</p>${diagram(run.tree,false,run)}</details>
    <div class="row">${btn('Test Another Shape','another','primary')}${teacher ? '' : btn('Edit My Decision Tree','build') + btn('View Testing History','history')}</div></section>`;
}

function historyTable(report = false) {
  if (!state.tests.length) return '<p>No completed tests yet.</p>';
  const correct = state.tests.filter(test => test.actual === test.prediction).length;
  return `<p><strong>${(correct/state.tests.length*100).toFixed(1)}% accuracy</strong> · ${correct} of ${state.tests.length} correct across completed tests.</p>
    <div class="table"><table><thead><tr><th>Test</th><th>Actual shape</th><th>Prediction</th><th>Result</th></tr></thead>
    <tbody>${state.tests.map((test,index) => `<tr><td>${index+1}</td><td>${escape(shapeName(test.actual))}</td><td>${escape(shapeName(test.prediction))}</td>
      <td>${test.actual === test.prediction ? 'Correct' : 'Incorrect'}</td></tr>`).join('')}</tbody></table></div>
    ${state.tests.map((test,index) => report ? (test.note ? `<p>Test ${index+1} revision note · ${escape(test.note)}</p>` : '') :
      `<details class="panel"><summary>Review test ${index+1}</summary>${stepsList(test.steps)}
      <label>Question or branch to review<textarea data-note="${index}" rows="2">${escape(test.note)}</textarea></label></details>`).join('')}`;
}

const prompts = [
  'What did your decision tree classify correctly?',
  'Which question or branch needed improvement?',
  'How does this activity demonstrate the way a classification system makes decisions?'
];

function report() {
  const date = new Intl.DateTimeFormat('en-US',{dateStyle:'long',timeZone:'America/Chicago'}).format();
  function outline(node,path = '') {
    if (!node || 'shape' in node) return `<li>${pathName(path)} · ${node ? escape(shapeName(node.shape)) : 'Missing branch'}</li>`;
    return `<li>${pathName(path)} · ${escape(node.text || 'Untitled question')}</li>${outline(node.yes,path+'y')}${outline(node.no,path+'n')}`;
  }
  return `${heading('Shape Detective · Group report')}<p>Group ${escape(state.group || '—')} · ${date}</p>
  <section class="panel"><h3>Decision tree</h3><div class="no-print">${diagram(state.tree)}</div><div class="print-only" id="print-tree">${diagram(state.tree,false,null,true)}</div>
  <h3>Questions and branches</h3><ul>${outline(state.tree)}</ul></section>
  <section class="panel"><h3>Testing results</h3>${historyTable(true)}</section>
  <section class="panel"><h3>Revision and reflection</h3>
  ${[['Changes made after testing','changes',state.changes],...prompts.map((prompt,index) => [prompt,'reflection-'+index,state.reflection[index]])].map(([label,id,value]) =>
    `<label>${label}<textarea class="no-print" id="${id}" rows="2" maxlength="3000">${escape(value)}</textarea><span class="print-only" data-print="${id}">${escape(value)}</span></label>`).join('')}</section>
  ${btn('Print or Save as PDF','print','primary')}`;
}

function guide() {
  return `${heading('Teacher guide')}<div class="panel"><ol>
  <li>Project Teacher Demonstration in Chrome and select Full screen. Choose a mystery figure and have the class vote Yes or No before you select an answer.</li>
  <li>Reveal the actual shape after the prediction. Use the missing-feature example to discuss why a valid path can still reach the wrong prediction.</li>
  <li>Have groups describe their figures and build their trees on paper. On the iPads, each group enters its own questions, both branches, and endpoint labels.</li>
  <li>Ask groups to test multiple figures, review a missed path, revise a question, and retest. Use the report for their reflection.</li>
  </ol><p>The browser saves a group’s work on its device. Export the tree when a group needs to move it to another device.</p></div>`;
}

function render() {
  const teacher = page === 'teacher';
  app.classList.toggle('board', teacher);
  const pages = {
    home: () => window.shapeLearning.view() + `<nav class="row" aria-label="Other activities">
      ${btn('Decision-tree lab','build')}${btn('Teacher demonstration','teacher')}${btn('Try preset clues','clues')}${btn('Teacher guide','guide')}</nav>`,
    clues: cluesPage, guide, build: builder, library, report,
    test: () => heading('Test your decision tree') + testing(),
    teacher: () => heading('Teacher demonstration') + testing(true),
    history: () => heading('Testing history') + historyTable() +
      '<div class="row">' + btn('Retest After Changes','test','primary') + btn('Reset Testing Results','clear-tests') + '</div>'
  };
  app.innerHTML = (['home','clues','guide','teacher'].includes(page) ? '' : labNav()) + pages[page]();
  if (page === 'home') window.shapeLearning.mount(app);
}

document.querySelector('#home').addEventListener('click', () => { run = null; navigate('home'); });

app.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, path, branch, index } = button.dataset;
  const node = nodeAt(state.tree,selectedPath);
  switch (action) {
    case 'build': case 'test': case 'history': case 'library': case 'report': case 'teacher': case 'guide': case 'clues':
      run = null;
      navigate(action);
      break;
    case 'select':
      selectedPath = path;
      render();
      (document.querySelector('#question,#prediction') || app.querySelector('.split h3'))?.scrollIntoView({block:'nearest'});
      break;
    case 'question':
      if (selectedPath.length < 40) replaceNode(selectedPath,question());
      break;
    case 'endpoint':
      if ((!node?.yes && !node?.no) || confirm('Replace this question and its branches with a prediction?')) replaceNode(selectedPath,{shape:''});
      break;
    case 'swap': replaceNode(selectedPath,question(node.text,node.no,node.yes)); break;
    case 'delete':
      if (confirm('Delete this branch and everything below it?')) replaceNode(selectedPath,null);
      break;
    case 'save': message = 'Tree saved on this device.'; save(); break;
    case 'export': {
      const url = URL.createObjectURL(new Blob([JSON.stringify({version:1,group:state.group,tree:state.tree},null,2)],{type:'application/json'}));
      const link = Object.assign(document.createElement('a'),{href:url,download:'shape-detective-tree.json'});
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url),30000);
      break;
    }
    case 'import': document.querySelector('#file').click(); break;
    case 'new':
      if (confirm('Start a new tree and clear the current group’s work and test history?')) {
        state = fresh(); selectedPath = ''; save(); navigate('build');
      }
      break;
    case 'clear-tests':
      if (confirm('Clear all completed tests for this group?')) { state.tests = []; save(); render(); }
      break;
    case 'teacher-complete': case 'teacher-gap': case 'teacher-reset':
      if (action !== 'teacher-reset') teacherGap = action === 'teacher-gap';
      run = null; render(); break;
    case 'another': run = null; render(); break;
    case 'start-test': startTest(Number(index)); break;
    case 'random': startTest(Math.floor(Math.random()*catalog.length)); break;
    case 'answer': answer(branch); break;
    case 'reveal': run.revealed = true; render(); break;
    case 'zoom-in': case 'zoom-out':
      zoom = Math.min(175,Math.max(50,zoom+(action === 'zoom-in' ? 15 : -15)));
      app.querySelectorAll('.tree:not(.print-only .tree)').forEach(tree => tree.style.fontSize = zoom+'%');
      app.querySelector('#zoom-label').textContent = zoom+'%';
      break;
    case 'fullscreen':
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => alert('Use your browser’s full-screen control.'));
      else alert('Use your browser’s full-screen control.');
      break;
    case 'print': window.print(); break;
  }
});

app.addEventListener('input', event => {
  const field = event.target;
  if (field.id === 'group') state.group = field.value;
  else if (field.id === 'question') {
    nodeAt(state.tree,selectedPath).text = field.value;
    app.querySelector('.node.active').textContent = field.value || 'Untitled question';
    const {missing,endpoints} = validate(state.tree);
    app.querySelector('#validation').innerHTML = validationText(missing,endpoints);
  } else if (field.id === 'changes') state.changes = field.value;
  else if (field.id.startsWith('reflection-')) state.reflection[Number(field.id.split('-')[1])] = field.value;
  else if (field.dataset.note !== undefined) state.tests[Number(field.dataset.note)].note = field.value;
  else return;
  const printField = app.querySelector(`[data-print="${field.id}"]`);
  if (printField) printField.textContent = field.value;
  message = '';
  save();
});

app.addEventListener('change', async event => {
  if (event.target.id === 'prediction') replaceNode(selectedPath,{shape:event.target.value});
  if (event.target.id !== 'file' || !event.target.files.length) return;
  try {
    const file = event.target.files[0];
    if (file.size > 1024*1024) throw Error('File is too large.');
    const data = JSON.parse(await file.text());
    if (data.version !== 1 || typeof data.group !== 'string' || data.group.length > 60) throw Error('Invalid tree export.');
    const tree = importNode(data.tree);
    if (!tree || 'shape' in tree) throw Error('The tree needs a starting question.');
    if (!confirm('Replace this group’s tree and clear its testing and reflection records?')) return;
    state = { ...fresh(), group:data.group, tree };
    selectedPath = '';
    message = 'Tree imported.';
    save();
    render();
  } catch (error) {
    message = 'Could not import this tree. ' + error.message;
    render();
  }
});
render();
