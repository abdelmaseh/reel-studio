import {parseArgs} from 'node:util';
import {promises as fs} from 'node:fs';
import {collectLibraryInventory, filterLibraryInventory, inventoryMarkdown} from './lib/library-inventory.mjs';

const USAGE = 'Usage: library.mjs inventory|gaps|catalog [--format json|markdown] | recommend --context <file.json> | list [--kind kind] | search --query text [--kind kind] [--limit n] | show <qualified-key>';
try {
  const {positionals, values} = parseArgs({allowPositionals: true, strict: true,
    options: {format: {type: 'string'}, kind: {type: 'string'}, query: {type: 'string'}, limit: {type: 'string'}, context: {type:'string'}}});
  const [command, key, ...extra] = positionals;
  const allowed = {inventory: ['format'], gaps: ['format'], catalog: ['format'], recommend: ['context'], list: ['kind'], search: ['query', 'kind', 'limit'], show: []};
  if (!Object.hasOwn(allowed, command) || extra.length || Object.keys(values).some((name) => !allowed[command].includes(name)) ||
    (command === 'show' ? !key || !key.includes(':') : key !== undefined)) throw new Error(USAGE);
  if (['inventory','gaps','catalog'].includes(command) && values.format !== undefined && !['json', 'markdown'].includes(values.format)) throw new Error(USAGE);
  if (command === 'search' && !values.query?.trim()) throw new Error('search needs --query text.');
  if (command === 'recommend' && !values.context?.trim()) throw new Error('recommend needs --context file.json.');
  const inventory = await collectLibraryInventory();
  let editorial;
  if(['catalog','recommend','show','search'].includes(command)){
    const {collectLibraryEditorial}=await import('./lib/library-selection.mjs');
    editorial=await collectLibraryEditorial({inventory});
  }
  let output = inventory;
  let markdown;
  if(command==='gaps'){
    const {analyzeLibraryGaps,gapsMarkdown}=await import('./lib/library-gaps.mjs');
    output=analyzeLibraryGaps(inventory);markdown=gapsMarkdown(output);
  }
  if(command==='catalog'){
    const {editorialCatalogMarkdown}=await import('./lib/library-selection.mjs');
    output=editorial;markdown=editorialCatalogMarkdown(editorial);
  }
  if(command==='recommend'){
    if((await fs.stat(values.context)).size>65536)throw new Error('Selection context must be at most 64 KiB.');
    const context=JSON.parse(await fs.readFile(values.context,'utf8'));
    const {recommendLibrary}=await import('./lib/library-selection.mjs');
    output=recommendLibrary(editorial,context);
  }
  if (command === 'list' || command === 'search') {
    const enriched=editorial?{...inventory,items:inventory.items.map(item=>({...item,editorial:editorial.items.find(candidate=>candidate.key===item.key)?.editorial??null}))}:inventory;
    const items = filterLibraryInventory(enriched, {kind: values.kind, query: values.query,
      ...(values.limit === undefined ? {} : {limit: Number(values.limit)})});
    output = {version: 1, items, ...(items.length ? {} : {hint: 'No source-backed match. Try another Arabic or English term, or list a kind.'})};
  } else if (command === 'show') {
    const item = editorial.items.find((entry) => entry.key === key)??inventory.items.find((entry) => entry.key === key);
    if (!item) throw new Error('Unknown qualified key. Use inventory, list or search to find a key.');
    output = {version: 1, item, sources: inventory.sources.filter((source) => item.sourcePaths.includes(source.path)),
      unresolved: inventory.unresolved.filter((issue) => item.sourcePaths.includes(issue.source))};
  }
  process.stdout.write(values.format === 'markdown' ? markdown??inventoryMarkdown(inventory) : `${JSON.stringify(output, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`library: ${error.message}\n`);
  process.exitCode = 1;
}
