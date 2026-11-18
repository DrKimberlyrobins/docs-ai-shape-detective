'use strict';

(() => {
  const figures = window.shapeCatalog.slice(0, 8);
  const key = 'docs-shape-training-v1';
  const columnCount = 7;
  const empty = () => ({
    questions: Array(columnCount).fill(''),
    rows: Object.fromEntries(figures.map(({ id }) => [id, Array(columnCount).fill('')]))
  });
  const html = text => String(text).replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const letter = id => id.toUpperCase();
  let data = empty();
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved?.questions?.length === columnCount &&
        figures.every(({ id }) => saved.rows?.[id]?.length === columnCount)) data = saved;
  } catch {
    // The training activity can still run if browser storage is unavailable.
  }

  function entropy(rows) {
    const counts = new Map();
    for (const row of rows) counts.set(row.id, (counts.get(row.id) || 0) + 1);
    return [...counts.values()].reduce((total, count) => {
      const probability = count / rows.length;
      return total - probability * Math.log2(probability);
    }, 0);
  }

  function train(rows, columns) {
    const labels = [...new Set(rows.map(row => row.id))];
    if (labels.length < 2 || !columns.length) return { labels };

    let best = null;
    const parentEntropy = entropy(rows);
    for (const column of columns) {
      const yes = rows.filter(row => row.values[column] === '1');
      const no = rows.filter(row => row.values[column] === '0');
      if (!yes.length || !no.length) continue;
      const gain = parentEntropy - (yes.length * entropy(yes) + no.length * entropy(no)) / rows.length;
      if (!best || gain > best.gain + 1e-9) best = { column, yes, no, gain };
    }
    if (!best) return { labels };
    const remaining = columns.filter(column => column !== best.column);
    return {
      column: best.column,
      yes: train(best.yes, remaining),
      no: train(best.no, remaining)
    };
  }

  function classify(tree, values) {
    const path = [];
    let node = tree;
    while (!node.labels) {
      const value = values[node.column];
      path.push({ column: node.column, value });
      node = value === '1' ? node.yes : node.no;
    }
    return { labels: node.labels, path };
  }

  const drawing = shape => `<span class="shape"><svg aria-hidden="true" viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round">${shape.svg}</svg></span>`;
  function cards(candidates = figures.map(shape => shape.id)) {
    return figures.map(shape => {
      const remains = candidates.includes(shape.id);
      return `<li class="figure-card ${remains ? '' : 'ruled-out'}">${drawing(shape)}
        <strong>Figure ${letter(shape.id)}</strong>${remains ? '' : '<span>Ruled out</span>'}</li>`;
    }).join('');
  }

  function bitInput(name, label, value = '', required = false) {
    return `<select name="${name}" aria-label="${html(label)}" ${required ? 'required' : ''}>
      <option value="">—</option><option value="1" ${value === '1' ? 'selected' : ''}>1</option>
      <option value="0" ${value === '0' ? 'selected' : ''}>0</option></select>`;
  }

  function treeView(node) {
    if (node.labels) {
      const labels = node.labels.map(id => 'Figure ' + letter(id)).join(' or ');
      return `<strong class="trained-endpoint">${labels}</strong>`;
    }
    return `<strong class="trained-question">${html(data.questions[node.column].trim())}</strong>
      <ul class="trained-branches">
        <li><span class="trained-yes">1 · Yes</span> ${treeView(node.yes)}</li>
        <li><span class="trained-no">0 · No</span> ${treeView(node.no)}</li>
      </ul>`;
  }

  function questionSummary(tree, columns, rows) {
    const used = new Set();
    function visit(node) {
      if (node.labels) return;
      used.add(node.column);
      visit(node.yes);
      visit(node.no);
    }
    visit(tree);

    return `<section class="no-print" aria-labelledby="training-questions-heading">
      <h3 id="training-questions-heading">Questions and what the tree used</h3>
      <ul>${columns.map(column => {
        const status = used.has(column) ? 'Used in the tree'
          : new Set(rows.map(row => row.values[column])).size === 1
            ? 'Left out. All eight figures had the same answer.'
            : 'Left out. The other questions already made the useful splits.';
        return `<li><strong>Question ${column + 1}.</strong> ${html(data.questions[column].trim())}
          <br><small>${status}</small></li>`;
      }).join('')}</ul>
    </section>`;
  }

  function mount(root) {
    const form = root.querySelector('#training-form');
    const output = root.querySelector('#training-output');
    const status = root.querySelector('#training-status');
    const board = root.querySelector('#figure-board');
    let model;

    function saveTable() {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        status.textContent += ' This browser couldn’t save the feature table.';
      }
    }

    function clearTree() {
      if (!model) return;
      model = undefined;
      output.innerHTML = '';
      board.innerHTML = cards();
    }

    function tableState() {
      const columns = data.questions.flatMap((text, column) => text.trim() ? [column] : []);
      const rows = figures.map(({ id }) => ({ id, values: data.rows[id] }));
      const unnamed = data.questions.findIndex((text, column) =>
        !text.trim() && rows.some(row => row.values[column] !== ''));
      const pending = rows.flatMap(({ id, values }) => columns
        .filter(column => !['0', '1'].includes(values[column]))
        .map(column => ({ id, column })));
      return { columns, rows, unnamed, pending };
    }

    function checkTable({ columns, unnamed, pending }, focusMissing = false) {
      let field;
      if (unnamed !== -1) {
        status.textContent = `Write Question ${unnamed + 1} or clear its answers.`;
        field = `q-${unnamed}`;
      } else if (!columns.length) {
        status.textContent = focusMissing ? 'Enter at least one question from your worksheet.' : '';
        field = 'q-0';
      } else if (pending.length) {
        const [first] = pending;
        status.textContent = focusMissing
          ? `Enter a 0 or 1 for Figure ${letter(first.id)}, Question ${first.column + 1}.`
          : `${pending.length} answer${pending.length === 1 ? '' : 's'} left in your question columns.`;
        field = `bit-${first.id}-${first.column}`;
      } else {
        status.textContent = 'All eight figures are accounted for. Select Train and show the tree when your group is ready.';
        return true;
      }
      if (focusMissing) form.elements[field].focus();
      return false;
    }

    function tableChanged() {
      clearTree();
      checkTable(tableState());
      saveTable();
    }

    form.addEventListener('input', event => {
      const { column } = event.target.dataset;
      if (column === undefined) return;
      data.questions[Number(column)] = event.target.value;
      tableChanged();
    });

    form.addEventListener('change', event => {
      const target = event.target;
      if (!target.dataset.figure) return;
      data.rows[target.dataset.figure][Number(target.dataset.feature)] = target.value;
      tableChanged();
    });

    form.addEventListener('submit', event => event.preventDefault());
    form.querySelector('#train-tree').addEventListener('click', showTree);

    function showTree() {
      const table = tableState();
      if (!checkTable(table, true)) return;
      const { columns, rows } = table;
      model = train(rows, columns);
      board.innerHTML = cards();
      const groups = new Map();
      for (const row of rows) {
        const vector = columns.map(column => row.values[column]).join('');
        groups.set(vector, [...(groups.get(vector) ?? []), letter(row.id)]);
      }
      const duplicates = [...groups.values()].filter(group => group.length > 1);
      status.textContent = duplicates.length
        ? `These figures share the same answers: ${duplicates.map(group => group.join(' and ')).join('; ')}. Add or revise a question to tell them apart.`
        : 'Your training table tells all eight figures apart.';
      const diagram = window.createTreeDiagram(model, data.questions);
      output.innerHTML = `<section class="panel trained-tree" aria-labelledby="trained-tree-heading">
        <h2 id="trained-tree-heading" tabindex="-1">The machine’s decision tree</h2>
        <p>Start at the top. Compare the machine’s questions and Yes/No branches with the tree your group drew.</p>
        <div class="row no-print">
          <button type="button" class="primary" id="print-trained-tree">Print tree</button>
          <button type="button" id="download-trained-tree">Download PDF</button>
          <span id="tree-print-status" role="status"></span>
        </div>
        <p class="training-print-heading print-only">DOC’S AI SHAPE DETECTIVE</p>
        <p class="print-only">Group ____________________________ &nbsp; Date _______________</p>
        <p class="tree-scroll-hint">Swipe sideways if the full tree doesn’t fit.</p>
        <div class="trained-tree-canvas" tabindex="0" aria-label="Scrollable decision tree diagram">
          ${diagram.markup}
        </div>
        <details class="no-print trained-tree-outline">
          <summary>Read the branches as text</summary>
          ${treeView(model)}
        </details>
        ${questionSummary(model, columns, rows)}
      </section>
      <section class="panel">
        <h2>Test a mystery card</h2>
        <p>Use the questions your group wrote. Enter all the mystery card’s answers at once.</p>
        <form id="mystery-form">${columns.map(column => `<label>${html(data.questions[column].trim())}
          ${bitInput('test-' + column, data.questions[column].trim(), '', true)}</label>`).join('')}
          <button type="submit" class="primary">Predict the figure</button>
        </form>
        <div id="mystery-result" aria-live="polite"></div>
      </section>`;
      const viewport = output.querySelector('.trained-tree-canvas');
      if (viewport.scrollWidth > viewport.clientWidth) {
        viewport.scrollLeft = diagram.rootX - viewport.clientWidth / 2;
      }
      output.querySelector('#trained-tree-heading').focus();

      output.querySelector('#print-trained-tree').addEventListener('click', () => window.print());
      const download = output.querySelector('#download-trained-tree');
      const printStatus = output.querySelector('#tree-print-status');
      download.addEventListener('click', async () => {
        download.disabled = true;
        printStatus.textContent = '';
        try {
          const bytes = await window.createTrainedTreePdf(diagram);
          const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
          const link = Object.assign(document.createElement('a'), {
            href: url, download: 'shape-detective-trained-tree.pdf'
          });
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 30000);
        } catch {
          printStatus.textContent = 'The PDF couldn’t be created. You can still use Print tree.';
        } finally {
          download.disabled = false;
        }
      });

      output.querySelector('form').addEventListener('submit', testEvent => {
        testEvent.preventDefault();
        const values = [];
        for (const column of columns) values[column] = testEvent.target.elements[`test-${column}`].value;
        const { labels, path } = classify(model, values);
        const matches = rows.filter(row => columns.every(column => row.values[column] === values[column]));
        const candidates = matches.length ? matches.map(row => row.id) : labels;
        board.innerHTML = cards(candidates);
        const names = candidates.map(id => 'Figure ' + letter(id)).join(' or ');
        const result = output.querySelector('#mystery-result');
        const resultHeading = !matches.length ? 'New combination of answers'
          : candidates.length === 1 ? `Prediction · ${names}` : `Multiple matches · ${names}`;
        result.innerHTML = `<h3 tabindex="-1">${resultHeading}</h3>
          ${matches.length ? '' : `<p>No training row matches all these answers. The tree’s closest branch ends at ${names}.</p>`}
          <ul class="figure-board result-cards" aria-label="Candidates after prediction">${cards(candidates)}</ul>
          ${path.length ? `<h4>Path the tree followed</h4><ol>${path.map(step =>
            `<li>${html(data.questions[step.column])} <strong>→ ${step.value === '1' ? '1 · Yes' : '0 · No'}</strong></li>`).join('')}</ol>` : ''}`;
        result.querySelector('h3').focus();
      });
    }

    checkTable(tableState());
  }

  window.shapeLearning = {
    view: () => `<section class="hero training-hero"><h1 tabindex="-1">DOC’S AI Shape Detective</h1>
      <p>Can your group teach a machine to tell eight figures apart?</p></section>
      <section aria-label="Classroom figures"><ul id="figure-board" class="figure-board">${cards()}</ul></section>
      <section class="panel">
        <h2>Teach the machine</h2>
        <p>Write your own feature questions on your worksheet. Copy them here and enter <strong>1 for Yes</strong> or <strong>0 for No</strong>. Answer for all eight figures under each question you wrote. Leave unused columns blank. When your group is ready, select <strong>Train and show the tree</strong>.</p>
        <form id="training-form">
          <div class="table training-table" tabindex="0" aria-label="Scrollable feature table">
            <table><thead><tr><th scope="col">Figure</th>${data.questions.map((text, column) =>
              `<th scope="col"><label>Question ${column + 1}
              <input name="q-${column}" data-column="${column}" maxlength="160" value="${html(text)}"></label></th>`).join('')}</tr></thead>
              <tbody>${figures.map(({ id }) => `<tr><th scope="row">${letter(id)}</th>${data.rows[id].map((value, column) => {
                const input = bitInput(`bit-${id}-${column}`, `Figure ${letter(id)}, Question ${column + 1}`, value);
                return `<td>${input.replace('<select ', `<select data-figure="${id}" data-feature="${column}" `)}</td>`;
              }).join('')}</tr>`).join('')}</tbody>
            </table>
          </div>
          <button type="button" class="primary" id="train-tree">Train and show the tree</button>
          <p id="training-status" role="status"></p>
        </form>
      </section>
      <div id="training-output"></div>`,
    mount
  };
})();
