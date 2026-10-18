(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const input = byId('csv-input');
  let latest = null;
  const good = '名称,数量,备注\n笔记模板,2,"包含清单,示例"\n检查表,1,"他说""已检查"""';
  const bad = '名称,数量,名称,\n示例,-12,重复表头,\n\n缺少一列,2,备注\n公式文本,1,"=HYPERLINK(""https://example.com"",""示例"")",待核实';
  function invalidate() { latest = null; byId('download').disabled = true; byId('results').hidden = true; }
  input.addEventListener('input', invalidate);
  byId('sample-good').addEventListener('click', () => { input.value = good; invalidate(); input.focus(); });
  byId('sample-bad').addEventListener('click', () => { input.value = bad; invalidate(); input.focus(); });
  byId('clear').addEventListener('click', () => { input.value = ''; invalidate(); input.focus(); });
  byId('check').addEventListener('click', () => {
    latest = CSVChecker.inspectCSV(input.value);
    byId('results').hidden = false;
    byId('download').disabled = false;
    byId('summary').textContent = latest.parsed ? latest.dataRows + ' 条数据记录 · ' + latest.columns + ' 列 · ' + latest.issues.length + ' 条提示' : '未完成解析 · ' + latest.issues.length + ' 条提示';
    const list = byId('issues'); list.replaceChildren();
    latest.issues.slice(0, 200).forEach(issue => {
      const li = document.createElement('li'); const location = document.createElement('strong');
      const parts = [];
      if (issue.row !== null) parts.push('记录 ' + issue.row);
      if (issue.field !== null) parts.push('列 ' + issue.field);
      if (issue.line !== null) parts.push('原文行 ' + issue.line + ' / 字符 ' + issue.column);
      location.textContent = parts.length ? parts.join(' · ') : '输入检查';
      const message = document.createElement('span'); message.textContent = issue.message;
      li.append(location, message); list.append(li);
    });
    if (!latest.issues.length) { const li = document.createElement('li'); li.textContent = '未发现本工具列出的检查项；仍需结合交付要求核验内容。'; list.append(li); }
    byId('issue-limit').textContent = latest.issues.length > 200 ? '页面仅展示前 200 条提示；JSON 包含完整检查结果和输入数据，请妥善保管。' : '下载的 JSON 包含完整检查结果和输入数据，请妥善保管。';
    const table = byId('preview'); table.replaceChildren();
    const rows = latest.rows.slice(0, 31);
    rows.forEach((row, index) => {
      const tr = document.createElement('tr');
      const marker = document.createElement(index === 0 ? 'th' : 'td'); marker.textContent = '记录 ' + (index + 1) + ' / 原文行 ' + row.line; tr.append(marker);
      row.cells.slice(0, 30).forEach(cell => { const td = document.createElement(index === 0 ? 'th' : 'td'); td.textContent = cell.value; tr.append(td); });
      table.append(tr);
    });
    byId('preview-note').textContent = latest.parsed && latest.rows.length ? '最多展示表头及前 30 条数据记录、前 30 列；空数据记录保留。检查使用全部输入。' : '没有可预览的解析数据。';
  });
  byId('download').addEventListener('click', () => {
    if (!latest) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(latest, null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'csv-check-result.json'; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();
