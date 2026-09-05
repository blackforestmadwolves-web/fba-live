import fs from 'node:fs';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';

// Explicit column mappings avoid guessing vendor units, seasons or IDs.
export function parseDelimited(text, delimiter = ',') {
  if (![',', ';', '\t'].includes(delimiter)) throw Error('Unsupported delimiter');
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else cell += ch;
    } else if (ch === delimiter) { row.push(cell); cell = ''; closed = false; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some(x => x !== '')) rows.push(row);
      row = []; cell = ''; closed = false;
    } else if (ch === '"' && !cell && !closed) quoted = true;
    else { if (closed || ch === '"') throw Error('Malformed CSV quoting'); cell += ch; }
  }
  if (quoted) throw Error('Unclosed CSV quote');
  row.push(cell); if (row.some(x => x !== '')) rows.push(row);
  const headers = rows.shift();
  if (!headers?.length || new Set(headers).size !== headers.length) throw Error('Missing or duplicate headers');
  return rows.map((cells, i) => {
    if (cells.length !== headers.length) throw Error(`Wrong column count at record ${i + 2}`);
    return Object.fromEntries(headers.map((h, j) => [h, cells[j]]));
  });
}

export function prepareImport(text, config, metadata, now = new Date().toISOString()) {
  const c = {Date, console}; vm.createContext(c);
  vm.runInContext(fs.readFileSync(new URL('../apps-script/Code.js', import.meta.url), 'utf8'), c);
  const headers = Array.from(c.FBA_CONSENSUS_INPUT_HEADERS_V44);
  const columns = config.columns || {}, constants = config.constants || {};
  for (const key of [...Object.keys(columns), ...Object.keys(constants)]) {
    if (!headers.includes(key)) throw Error(`Unknown target field: ${key}`);
    if (key in columns && key in constants) throw Error(`Conflicting mapping: ${key}`);
  }
  const index = c.consensusIdentityIndexV44_(metadata), errors = [], inputs = [], normalized = [], seen = new Set();
  parseDelimited(text, config.delimiter).forEach((raw, i) => {
    const input = {...constants};
    for (const [target, source] of Object.entries(columns)) {
      if (!(source in raw)) throw Error(`Missing export column: ${source}`);
      input[target] = raw[source];
    }
    const result = c.normalizeConsensusRowV44_(input, index, now);
    if (!result.ok) { errors.push({record: i + 2, reason: result.reason}); return; }
    const key = `${result.row.sourceId}:${result.row.id}`;
    if (seen.has(key)) { errors.push({record: i + 2, reason: 'DUPLICATE_PLAYER_SOURCE'}); return; }
    seen.add(key); input.player_id = result.row.id; input.full_name = result.row.name;
    inputs.push(input); normalized.push(result.row);
  });
  if (!inputs.length && !errors.length) errors.push({reason: 'EMPTY_EXPORT'});
  const escape = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  return {
    report: {accepted: inputs.length, rejected: errors.length, errors,
      completePlayers: c.mergeConsensusV44_(normalized).filter(p => p.complete).length},
    csv: errors.length ? null : [headers.join(','), ...inputs.map(r => headers.map(h => escape(r[h])).join(','))].join('\n') + '\n'
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [input, mapping, metadata, output] = process.argv.slice(2);
    if (!output) throw Error('Usage: node scripts/prepare-projection-import.mjs export.csv mapping.json espn-metadata.json output.csv');
    const result = prepareImport(fs.readFileSync(input, 'utf8'), JSON.parse(fs.readFileSync(mapping, 'utf8')), JSON.parse(fs.readFileSync(metadata, 'utf8')));
    console.log(JSON.stringify(result.report, null, 2));
    if (!result.csv) process.exitCode = 1;
    else fs.writeFileSync(output, result.csv, {flag: 'wx'});
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
