(function (root) {
  'use strict';
  const MAX_BYTES = 500 * 1024;
  function parseCSV(input) {
    let text = String(input);
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let cells = [], value = '', state = 'start', line = 1, column = 1;
    let cellLine = 1, cellColumn = 1, rowLine = 1, active = false;
    function fail(message) {
      const error = new Error(message); error.line = line; error.column = column; throw error;
    }
    function cell() { cells.push({ value, line: cellLine, column: cellColumn }); value = ''; state = 'start'; }
    function row() { cell(); rows.push({ line: rowLine, cells }); cells = []; active = false; }
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const newline = ch === '\r' || ch === '\n';
      if (state === 'quoted') {
        if (ch === '"') {
          if (text[i + 1] === '"') { value += '"'; i++; column += 2; continue; }
          state = 'closed'; column++; continue;
        }
        if (newline) {
          value += '\n'; if (ch === '\r' && text[i + 1] === '\n') i++;
          line++; column = 1; continue;
        }
        value += ch; column++; continue;
      }
      if (ch === ',') {
        cell(); active = true; column++; cellLine = line; cellColumn = column; continue;
      }
      if (newline) {
        row(); if (ch === '\r' && text[i + 1] === '\n') i++;
        line++; column = 1; rowLine = line; cellLine = line; cellColumn = 1; continue;
      }
      if (state === 'closed') fail('闭合引号后只能紧接逗号或换行。');
      if (ch === '"') {
        if (state !== 'start') fail('未加引号的字段中出现了引号。');
        state = 'quoted'; active = true; column++; continue;
      }
      state = 'plain'; active = true; value += ch; column++;
    }
    if (state === 'quoted') fail('引号字段未闭合。');
    if (active || cells.length) row();
    return rows;
  }
  function inspectCSV(input) {
    const bytes = new TextEncoder().encode(String(input)).length;
    const result = { version: 1, bytes, rows: [], issues: [], parsed: false, dataRows: 0, columns: 0 };
    function issue(code, message, row, field, line, column) { result.issues.push({ code, message, row, field, line, column }); }
    if (bytes > MAX_BYTES) { issue('INPUT_LIMIT', '输入超过 500 KiB，请缩小数据范围。', null, null, null, null); return result; }
    try { result.rows = parseCSV(input); }
    catch (error) { issue('PARSE_ERROR', error.message, null, null, error.line, error.column); return result; }
    result.parsed = true;
    if (!result.rows.length) { issue('EMPTY_INPUT', '没有可检查的内容。', null, null, null, null); return result; }
    const headers = result.rows[0].cells;
    result.columns = headers.length; result.dataRows = result.rows.length - 1;
    const seen = new Map();
    headers.forEach((cell, index) => {
      const name = cell.value.trim();
      if (!name) issue('EMPTY_HEADER', '表头为空或仅含空白。', 1, index + 1, cell.line, cell.column);
      else if (seen.has(name)) issue('DUPLICATE_HEADER', '表头重复（去除两端空白后比较，区分大小写）；首次出现在第 ' + seen.get(name) + ' 列。', 1, index + 1, cell.line, cell.column);
      else seen.set(name, index + 1);
    });
    result.rows.forEach((row, rowIndex) => {
      if (rowIndex > 0) {
        if (row.cells.length !== headers.length) issue('COLUMN_COUNT', '本记录有 ' + row.cells.length + ' 列，表头有 ' + headers.length + ' 列。', rowIndex + 1, null, row.line, 1);
        if (row.cells.every(cell => !cell.value.trim())) issue('EMPTY_ROW', '完全空数据记录（所有字段为空或仅含空白），已保留。', rowIndex + 1, null, row.line, 1);
      }
      row.cells.forEach((cell, index) => {
        if (/^[\s]*[=+\-@]/u.test(cell.value)) issue('FORMULA_PREFIX', '可能被电子表格解释为公式的文本前缀；负数等内容可能合法，此提示不判断恶意，也不代表文件已安全。', rowIndex + 1, index + 1, cell.line, cell.column);
      });
    });
    return result;
  }
  const api = { parseCSV, inspectCSV, MAX_BYTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CSVChecker = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
