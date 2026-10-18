import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// The studio ships .claude/settings.json so its own commands run without a permission prompt. The rules are a convenience, not a
// sandbox: none of them may approve a command that writes an arbitrary file, installs, updates or deletes.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const settings = () => JSON.parse(readFileSync(path.join(root, '.claude', 'settings.json'), 'utf8')).permissions;
const parse = (list) => (list ?? []).map((rule) => {
  const match = /^([A-Za-z]+)\((.+)\)$/s.exec(rule);
  assert.ok(match, `"${rule}" is not written as Tool(pattern)`);
  return {rule, tool: match[1], text: match[2]};
});
const allow = () => parse(settings().allow);
const shells = (entries) => entries.filter((entry) => entry.tool === 'Bash' || entry.tool === 'PowerShell');
const commandsOf = (entries, tool) => entries.filter((entry) => entry.tool === tool).map((entry) => entry.text);
// A permission pattern as a regular expression: * matches anything, and a trailing :* is the older "and any arguments" spelling.
const escape = (text) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
const approves = (pattern, command) => new RegExp(`^${pattern.replace(/:\*$/, ' *').split('*').map(escape).join('.*')}$`).test(command);

test('the permission file parses and has allow and deny lists', () => {
  const {allow: allowed, deny} = settings();
  assert.ok(Array.isArray(allowed) && allowed.length > 0, 'allow rules');
  assert.ok(Array.isArray(deny) && deny.length > 0, 'deny rules');
  parse(allowed);
  parse(deny);
});

test('every Bash allow rule has a PowerShell twin and every PowerShell rule has a Bash twin', () => {
  const bash = commandsOf(allow(), 'Bash'), powershell = commandsOf(allow(), 'PowerShell');
  assert.ok(bash.length > 0, 'Bash rules');
  assert.deepEqual(bash.filter((text) => !powershell.includes(text)), [], 'Bash rules without a PowerShell twin');
  assert.deepEqual(powershell.filter((text) => !bash.includes(text)), [], 'PowerShell rules without a Bash twin');
});

test('the everyday library and production commands are allowed in both shells', () => {
  const rules = allow().map((entry) => entry.rule);
  for (const tool of ['Bash', 'PowerShell']) {
    for (const script of ['library', 'production', 'production-accept', 'text-check', 'agent-eval']) {
      for (const form of [`node scripts/${script}.mjs`, `node scripts/${script}.mjs *`]) assert.ok(rules.includes(`${tool}(${form})`), `${tool}(${form})`);
    }
  }
});

test('no allow rule lets git log, git diff or git show take arguments', () => {
  // git log --output=<file> and its siblings overwrite any file without a prompt.
  const samples = ['log', 'diff', 'show'].flatMap((subcommand) => ['--output=out.txt', '--output out.txt', '-p', 'HEAD'].map((argument) => `git ${subcommand} ${argument}`));
  for (const {rule, text} of shells(allow())) {
    for (const sample of samples) assert.equal(approves(text, sample), false, `${rule} would approve "${sample}"`);
  }
});

test('the deny list blocks edits to Raw and .claude and git --output in both shells', () => {
  const {deny} = settings();
  for (const rule of ['Edit(/Raw/**)', 'Edit(/.claude/**)', 'Bash(git * --output*)', 'PowerShell(git * --output*)']) assert.ok(deny.includes(rule), `${rule} is denied`);
  for (const {rule, text} of shells(parse(deny))) {
    for (const sample of ['git log --output=out.txt', 'git diff --output out.txt', 'git show HEAD --output=out.txt']) assert.ok(approves(text, sample), `${rule} catches "${sample}"`);
  }
  for (const {rule, tool, text} of allow()) {
    if (tool === 'Edit') assert.doesNotMatch(text, /^\/(?:Raw|\.claude)(?:\/|$)/i, `${rule} reopens a denied folder`);
  }
});

test('no allow rule mentions update, setup, install, rm, Remove-Item or del', () => {
  const forbidden = /(?<![A-Za-z0-9])(?:update|setup|install|rm|Remove-Item|del)(?![A-Za-z0-9])/i;
  for (const {rule} of allow()) assert.doesNotMatch(rule, forbidden, `${rule} approves an install, update or delete`);
});
