// =============================================================================
// render.test.mjs  --  node --test unit tests for the P4 render engine
// =============================================================================
// Run:  node --test scripts/render.test.mjs
// These tests build tiny in-memory template trees in os.tmpdir() (never inside
// the repo) so they are hermetic and do not depend on the shipped templates.
// They cover every clause of RENDER-ENGINE.md the engine implements.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  RenderError,
  render,
  renderText,
  renderJson,
  expandDirectives,
  lookup,
  lookupBool,
  globToRegExp,
  globMatch,
  evalPathSegments,
  evalRenderMap,
  assertPathHygiene,
  computeManifestHash,
  mergeTextManaged,
  mergeJsonManaged,
  planTree,
  renderFile,
  renderTree,
} from './render.mjs';

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function mkTmp(prefix = 'ack-render-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

const BASE_MANAGED = {
  manifest_hash: 'sha256:' + '0'.repeat(64),
  project: {
    name: 'acme-orders-api',
    description: 'Order intake and fulfillment API',
    language: 'python',
    runtime: 'python3.12',
    package_manager: 'uv',
    framework: 'fastapi',
    architecture: 'layered',
  },
  archetype: 'backend-api',
  features: { hooks: true, mcp: false, agent_teams: false, sdd_gate: true },
  persistence: { enabled: true, db: 'postgres', orm: 'sqlalchemy', migrations: { enabled: true, tool: 'alembic', dir: 'migrations/' } },
  contract_gate: {
    mode: 'block',
    glob_dialect: 'fnmatch',
    protected_paths: ['src/**', 'migrations/**', 'openapi/**'],
    scope: ['src/**'],
    exempt: ['**/*.test.*'],
  },
};

// -----------------------------------------------------------------------------
// §2 substitution: scalars, bool/number, unbound, container
// -----------------------------------------------------------------------------

test('render: substitutes scalar string/number/bool', () => {
  const managed = { project: { name: 'svc' }, features: { mcp: true }, count: 7 };
  assert.equal(render('name=${project.name}', managed), 'name=svc');
  assert.equal(render('flag=${features.mcp}', managed), 'flag=true');
  assert.equal(render('n=${count}', managed), 'n=7');
});

test('render: bool false renders lower-case "false"', () => {
  assert.equal(render('${features.mcp}', { features: { mcp: false } }), 'false');
});

test('render: unbound var throws RenderError naming the path, no silent empty', () => {
  let thrown;
  try {
    render('x=${typo.key}', { project: { name: 'a' } });
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown instanceof RenderError, 'should throw RenderError');
  assert.equal(thrown.path, 'typo.key');
  assert.match(thrown.message, /unbound/);
  assert.match(thrown.message, /typo\.key/);
});

test('render: container-valued var (object) throws', () => {
  let thrown;
  try {
    render('${project}', { project: { name: 'a' } });
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown instanceof RenderError);
  assert.match(thrown.message, /container/);
  assert.equal(thrown.path, 'project');
});

test('render: container-valued var (array) throws', () => {
  let thrown;
  try {
    render('${contract_gate.protected_paths}', BASE_MANAGED);
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown instanceof RenderError);
  assert.match(thrown.message, /container/);
});

test('render: ${CLAUDE_PROJECT_DIR} (upper-case) is NEVER matched, survives verbatim', () => {
  const text = '"command": "python3 ${CLAUDE_PROJECT_DIR}/.claude/hooks/contract-gate"';
  assert.equal(render(text, BASE_MANAGED), text);
});

test('render: output is NOT re-scanned (a substituted value containing ${...} is left alone)', () => {
  const managed = { a: '${b}', b: 'XYZ' };
  // ${a} -> literal "${b}"; not re-scanned into "XYZ"
  assert.equal(render('${a}', managed), '${b}');
});

// -----------------------------------------------------------------------------
// §3 directives: #ack:each, #ack:if/#ack:endif
// -----------------------------------------------------------------------------

test('#ack:each: one rendered line per list element with $item', () => {
  const tpl = ['Protected:', '#ack:each contract_gate.protected_paths as "- `$item`"', 'done'].join('\n');
  const out = expandDirectives(tpl, BASE_MANAGED);
  assert.equal(out, ['Protected:', '- `src/**`', '- `migrations/**`', '- `openapi/**`', 'done'].join('\n'));
});

test('#ack:each: preserves leading indentation of the directive line', () => {
  const tpl = '    #ack:each contract_gate.scope as "$item,"';
  const out = expandDirectives(tpl, BASE_MANAGED);
  assert.equal(out, '    src/**,');
});

test('#ack:each: non-array path throws', () => {
  const tpl = '#ack:each project.name as "$item"';
  assert.throws(() => expandDirectives(tpl, BASE_MANAGED), (e) => e instanceof RenderError && e.path === 'project.name');
});

test('#ack:if true: encloses lines; false: drops them', () => {
  const tpl = ['a', '#ack:if features.sdd_gate', 'GATED', '#ack:endif', 'b'].join('\n');
  assert.equal(expandDirectives(tpl, BASE_MANAGED), ['a', 'GATED', 'b'].join('\n'));

  const tpl2 = ['a', '#ack:if features.mcp', 'GATED', '#ack:endif', 'b'].join('\n');
  assert.equal(expandDirectives(tpl2, BASE_MANAGED), ['a', 'b'].join('\n'));
});

test('#ack:if: absent bool path => false => omit', () => {
  const tpl = ['#ack:if design_system.install', 'DS', '#ack:endif', 'tail'].join('\n');
  assert.equal(expandDirectives(tpl, BASE_MANAGED), 'tail');
});

test('#ack:if: nested if is a hard error', () => {
  const tpl = ['#ack:if features.hooks', '#ack:if features.mcp', 'x', '#ack:endif', '#ack:endif'].join('\n');
  assert.throws(() => expandDirectives(tpl, BASE_MANAGED), RenderError);
});

test('#ack:if: unterminated block throws', () => {
  const tpl = ['#ack:if features.hooks', 'x'].join('\n');
  assert.throws(() => expandDirectives(tpl, BASE_MANAGED), /unterminated/);
});

test('#ack:if wraps a JSON fragment (fullstack .mcp.json pattern), processed before parse', () => {
  const managed = { features: { mcp: true }, design_system: { install: true } };
  const tpl = [
    '{',
    '  "mcpServers": {',
    '    "ack-example": { "command": "x" }',
    '    #ack:if design_system.install',
    '    ,',
    '    "shadcn": { "command": "npx" }',
    '    #ack:endif',
    '  }',
    '}',
  ].join('\n');
  const out = renderJson(tpl, managed);
  const parsed = JSON.parse(out);
  assert.ok(parsed.mcpServers.shadcn, 'shadcn present when design_system.install=true');

  const managedOff = { features: { mcp: true }, design_system: { install: false } };
  const outOff = renderJson(tpl, managedOff);
  const parsedOff = JSON.parse(outOff);
  assert.equal(parsedOff.mcpServers.shadcn, undefined, 'shadcn absent when off');
  assert.ok(parsedOff.mcpServers['ack-example']);
});

// -----------------------------------------------------------------------------
// §4.2 path-segment guards
// -----------------------------------------------------------------------------

test('_when.* path-segment: included when truthy, segment stripped', () => {
  const r = evalPathSegments('_when.persistence.enabled/src/infra/db/.gitkeep.tpl', BASE_MANAGED);
  assert.equal(r.included, true);
  assert.equal(r.strippedPath, 'src/infra/db/.gitkeep.tpl');
});

test('_when.* path-segment: omitted when false (short-circuit), still stripped', () => {
  const managed = { ...BASE_MANAGED, persistence: { enabled: false } };
  const r = evalPathSegments('_when.persistence.enabled/src/infra/db/.gitkeep.tpl', managed);
  assert.equal(r.included, false);
  assert.equal(r.strippedPath, 'src/infra/db/.gitkeep.tpl');
});

test('_when.* double guard: ALL must be truthy (AND)', () => {
  // both true
  const both = { ...BASE_MANAGED, persistence: { enabled: true, migrations: { enabled: true } } };
  const r1 = evalPathSegments('_when.persistence.enabled/_when.persistence.migrations.enabled/migrations/.gitkeep.tpl', both);
  assert.equal(r1.included, true);
  assert.equal(r1.strippedPath, 'migrations/.gitkeep.tpl');

  // inner false
  const innerFalse = { ...BASE_MANAGED, persistence: { enabled: true, migrations: { enabled: false } } };
  const r2 = evalPathSegments('_when.persistence.enabled/_when.persistence.migrations.enabled/migrations/.gitkeep.tpl', innerFalse);
  assert.equal(r2.included, false);
});

test('_when.* absent key => false => omit', () => {
  const r = evalPathSegments('_when.design_system.install/design-system/README.md.tpl', BASE_MANAGED);
  assert.equal(r.included, false);
});

// -----------------------------------------------------------------------------
// glob matching + render.map
// -----------------------------------------------------------------------------

test('globToRegExp: ** matches across segments incl. zero', () => {
  assert.ok(globMatch('**/.mcp.json.tpl', '.mcp.json.tpl'));
  assert.ok(globMatch('**/.mcp.json.tpl', 'a/b/.mcp.json.tpl'));
  assert.ok(globMatch('**/design-system/**', 'design-system/theme/globals.css'));
  assert.ok(globMatch('**/.claude/hooks/contract-gate', '.claude/hooks/contract-gate'));
  assert.ok(!globMatch('**/.mcp.json.tpl', 'mcp.json'));
});

test('globToRegExp: single * stays within a segment', () => {
  assert.ok(globMatch('src/*.py', 'src/main.py'));
  assert.ok(!globMatch('src/*.py', 'src/sub/main.py'));
});

test('evalRenderMap: when=false omits the matching file', () => {
  const map = { rules: [{ glob: '**/.mcp.json.tpl', archetype: '*', when: 'features.mcp' }] };
  const off = evalRenderMap(map, '.mcp.json.tpl', 'backend-api', BASE_MANAGED); // mcp:false
  assert.equal(off.included, false);
  const on = evalRenderMap(map, '.mcp.json.tpl', 'backend-api', { ...BASE_MANAGED, features: { ...BASE_MANAGED.features, mcp: true } });
  assert.equal(on.included, true);
});

test('evalRenderMap: archetype-scoped rule ignored for other archetypes', () => {
  const map = { rules: [{ glob: '**/design-system/**', archetype: 'fullstack', when: 'design_system.install', requires_archetype: 'fullstack' }] };
  // backend-api path that happens not to match design-system glob -> included
  const r = evalRenderMap(map, '.mcp.json.tpl', 'backend-api', BASE_MANAGED);
  assert.equal(r.included, true);
});

test('evalRenderMap: requires_archetype mismatch ABORTS loudly when glob+when truthy', () => {
  const map = { rules: [{ glob: '**/design-system/**', archetype: '*', when: 'design_system.install', requires_archetype: 'fullstack' }] };
  const managed = { archetype: 'monorepo', design_system: { install: true } };
  assert.throws(
    () => evalRenderMap(map, 'design-system/theme/globals.css', 'monorepo', managed),
    (e) => e instanceof RenderError && /requires_archetype/.test(e.message),
  );
});

test('evalRenderMap: requires_archetype does NOT fire when when is falsy (silent omit instead)', () => {
  const map = { rules: [{ glob: '**/design-system/**', archetype: '*', when: 'design_system.install', requires_archetype: 'fullstack' }] };
  const managed = { archetype: 'monorepo' }; // design_system absent => when false
  const r = evalRenderMap(map, 'design-system/theme/globals.css', 'monorepo', managed);
  assert.equal(r.included, false);
});

// -----------------------------------------------------------------------------
// §2.3 JSON render: sorted keys + 2-space indent
// -----------------------------------------------------------------------------

test('renderJson: substitutes, parses, re-serializes with sorted keys + 2-space indent', () => {
  const tpl = '{ "z": "${project.name}", "a": 1, "nested": { "y": true, "x": 2 } }';
  const out = renderJson(tpl, BASE_MANAGED);
  assert.equal(
    out,
    ['{', '  "a": 1,', '  "nested": {', '    "x": 2,', '    "y": true', '  },', '  "z": "acme-orders-api"', '}', ''].join('\n'),
  );
});

test('renderJson: invalid JSON after substitution throws RenderError', () => {
  const tpl = '{ "a": ${project.name} }'; // unquoted string -> invalid JSON
  assert.throws(() => renderJson(tpl, BASE_MANAGED), RenderError);
});

// -----------------------------------------------------------------------------
// §6 path hygiene
// -----------------------------------------------------------------------------

test('assertPathHygiene: fires on a templates/archetypes/ leak', () => {
  assert.throws(
    () => assertPathHygiene('see templates/archetypes/backend-api/x', 'CLAUDE.md'),
    (e) => e instanceof RenderError && /templates\/archetypes\//.test(e.message) && e.path === 'CLAUDE.md',
  );
});

test('assertPathHygiene: fires on absolute ack install path leak', () => {
  const ackDir = '/Users/x/ai-core-kit';
  assert.throws(
    () => assertPathHygiene(`run ${ackDir}/templates/hooks/gate`, 'settings.json', ackDir),
    (e) => e instanceof RenderError && e.violation === ackDir,
  );
});

test('assertPathHygiene: allows ${CLAUDE_PROJECT_DIR}', () => {
  assert.ok(assertPathHygiene('python3 ${CLAUDE_PROJECT_DIR}/.claude/hooks/contract-gate', 'settings.json'));
});

// -----------------------------------------------------------------------------
// manifest_hash
// -----------------------------------------------------------------------------

test('computeManifestHash: stable + excludes manifest_hash and generator', () => {
  const a = { ...BASE_MANAGED };
  const b = { ...BASE_MANAGED, manifest_hash: 'sha256:' + 'f'.repeat(64), generator: { rendered_at: 'now' } };
  assert.equal(computeManifestHash(a), computeManifestHash(b));
  assert.match(computeManifestHash(a), /^sha256:[0-9a-f]{64}$/);
});

test('computeManifestHash: changes when a managed value changes', () => {
  const a = computeManifestHash(BASE_MANAGED);
  const b = computeManifestHash({ ...BASE_MANAGED, features: { ...BASE_MANAGED.features, mcp: true } });
  assert.notEqual(a, b);
});

// -----------------------------------------------------------------------------
// merge: text managed block + JSON key-set
// -----------------------------------------------------------------------------

test('mergeTextManaged: replaces only the managed region, preserves human prose', () => {
  const rendered = [
    '# title',
    '<!-- >>> ack:managed (do not edit) >>> -->',
    'NEW MANAGED',
    '<!-- <<< ack:managed <<< -->',
  ].join('\n');
  const existing = [
    '# title',
    'HOUSE STYLE PARAGRAPH (human)',
    '<!-- >>> ack:managed (do not edit) >>> -->',
    'OLD MANAGED',
    '<!-- <<< ack:managed <<< -->',
    'TRAILING HUMAN NOTE',
  ].join('\n');
  const merged = mergeTextManaged(existing, rendered);
  assert.match(merged, /HOUSE STYLE PARAGRAPH \(human\)/);
  assert.match(merged, /TRAILING HUMAN NOTE/);
  assert.match(merged, /NEW MANAGED/);
  assert.doesNotMatch(merged, /OLD MANAGED/);
});

test('mergeTextManaged: appends block when existing has no markers', () => {
  const rendered = ['<!-- >>> ack:managed >>> -->', 'M', '<!-- <<< ack:managed <<< -->'].join('\n');
  const existing = 'just human content\n';
  const merged = mergeTextManaged(existing, rendered);
  assert.match(merged, /just human content/);
  assert.match(merged, /ack:managed/);
});

test('mergeJsonManaged: settings.json owns hooks (sdd_gate on) but never permissions', () => {
  const rendered = { hooks: { PreToolUse: [{ matcher: 'Edit' }] }, env: { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' } };
  const existing = { permissions: { allow: ['Bash(uv run *)'] }, hooks: { PreToolUse: [{ matcher: 'OLD' }] } };
  const managed = { features: { sdd_gate: true, agent_teams: false } };
  const merged = mergeJsonManaged('json:hooks,env', rendered, existing, managed);
  assert.deepEqual(merged.permissions, { allow: ['Bash(uv run *)'] }, 'permissions untouched');
  assert.equal(merged.hooks.PreToolUse[0].matcher, 'Edit', 'hooks replaced');
  assert.equal(merged.env, undefined, 'env not owned when agent_teams off');
});

test('mergeJsonManaged: env owns ONLY CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS when agent_teams on', () => {
  const rendered = { env: { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' } };
  const existing = { env: { MY_TOKEN: 'secret' } };
  const managed = { features: { sdd_gate: false, agent_teams: true } };
  const merged = mergeJsonManaged('json:hooks,env', rendered, existing, managed);
  assert.equal(merged.env.MY_TOKEN, 'secret', 'human env key preserved');
  assert.equal(merged.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, '1', 'ack env key set');
});

test('mergeJsonManaged: .mcp.json owns ONLY ack-* servers, leaves user servers', () => {
  const rendered = { mcpServers: { 'ack-example': { command: 'python3' } } };
  const existing = { mcpServers: { 'my-server': { command: 'node' }, 'ack-stale': { command: 'old' } } };
  const merged = mergeJsonManaged('json:mcpServers', rendered, existing, {});
  assert.ok(merged.mcpServers['my-server'], 'user server preserved');
  assert.ok(merged.mcpServers['ack-example'], 'fresh ack server added');
  assert.equal(merged.mcpServers['ack-stale'], undefined, 'stale ack server dropped');
});

// -----------------------------------------------------------------------------
// renderFile: .tpl strip + static passthrough
// -----------------------------------------------------------------------------

test('renderFile: text .tpl is substituted; static is byte-for-byte (literal ${...} survives)', () => {
  const t = renderFile({
    rawBytes: Buffer.from('# ${project.name}\n'),
    outputRel: 'CLAUDE.md',
    kind: 'text',
    managed: BASE_MANAGED,
  });
  assert.equal(t.content, '# acme-orders-api\n');
  assert.equal(t.managedBlock, null);

  const staticContent = '#!/usr/bin/env python3\n# literal ${not_substituted} survives\n';
  const s = renderFile({
    rawBytes: Buffer.from(staticContent),
    outputRel: '.claude/hooks/contract-gate',
    kind: 'static',
    managed: BASE_MANAGED,
  });
  assert.equal(s.content.toString('utf8'), staticContent);
  assert.equal(s.managedBlock, null);
});

test('renderFile: text with ack:managed markers gets managedBlock=ack:managed', () => {
  const raw = '<!-- >>> ack:managed >>> -->\nx\n<!-- <<< ack:managed <<< -->\n';
  const r = renderFile({ rawBytes: Buffer.from(raw), outputRel: 'CLAUDE.md', kind: 'text', managed: BASE_MANAGED });
  assert.equal(r.managedBlock, 'ack:managed');
});

test('renderFile: JSON settings.json gets json:hooks,env descriptor', () => {
  const r = renderFile({ rawBytes: Buffer.from('{"hooks":{}}'), outputRel: '.claude/settings.json', kind: 'json', managed: BASE_MANAGED });
  assert.equal(r.managedBlock, 'json:hooks,env');
});

test('renderFile: path-hygiene assertion fires on a templates/ leak in rendered content', () => {
  assert.throws(
    () => renderFile({ rawBytes: Buffer.from('see templates/archetypes/x'), outputRel: 'README.md', kind: 'text', managed: BASE_MANAGED }),
    (e) => e instanceof RenderError && /templates\/archetypes\//.test(e.message),
  );
});

// -----------------------------------------------------------------------------
// planTree + renderTree end-to-end (hermetic fixture tree)
// -----------------------------------------------------------------------------

function buildFixtureTree() {
  const templates = mkTmp('ack-templates-');
  // render.map.yaml at archetypes dir root
  writeFile(templates, 'render.map.yaml', [
    'version: 1',
    'rules:',
    '  - glob: "**/.mcp.json.tpl"',
    '    archetype: "*"',
    '    when: features.mcp',
    '  - glob: "**/.claude/hooks/contract-gate"',
    '    archetype: "*"',
    '    when: features.sdd_gate',
    '  - glob: "**/design-system/**"',
    '    archetype: fullstack',
    '    when: design_system.install',
    '    requires_archetype: fullstack',
  ].join('\n'));

  // backend-api tree
  writeFile(templates, 'backend-api/CLAUDE.md.tpl', [
    '# ${project.name}',
    '<!-- >>> ack:managed >>> -->',
    'gate: ${contract_gate.mode}',
    '#ack:each contract_gate.protected_paths as "- $item"',
    '<!-- <<< ack:managed <<< -->',
  ].join('\n') + '\n');
  writeFile(templates, 'backend-api/.claude/settings.json.tpl', JSON.stringify({
    hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'python3 ${CLAUDE_PROJECT_DIR}/.claude/hooks/contract-gate' }] }] },
  }));
  writeFile(templates, 'backend-api/.mcp.json.tpl', JSON.stringify({ mcpServers: { 'ack-example': { command: 'python3' } } }));
  writeFile(templates, 'backend-api/.claude/hooks/contract-gate', '#!/usr/bin/env python3\n# static, ${literal} survives\n');
  writeFile(templates, 'backend-api/_when.persistence.enabled/src/infra/db/.gitkeep.tpl', '');
  writeFile(templates, 'backend-api/_when.persistence.enabled/_when.persistence.migrations.enabled/migrations/.gitkeep.tpl', '');

  // fullstack tree (design-system gated)
  writeFile(templates, 'fullstack/CLAUDE.md.tpl', '# ${project.name} (fullstack)\n');
  writeFile(templates, 'fullstack/.mcp.json.tpl', JSON.stringify({ mcpServers: { 'ack-example': { command: 'python3' } } }));
  writeFile(templates, 'fullstack/_when.design_system.install/design-system/README.md.tpl', '# DS for ${project.name}\n');

  return templates;
}

test('planTree: backend-api omits .mcp.json (mcp false) and design-system; includes persistence', async () => {
  const templates = buildFixtureTree();
  const { loadRenderMap } = await import('./render.mjs');
  const renderMap = await loadRenderMap(templates);
  const plan = planTree({ managed: BASE_MANAGED, archetypesDir: templates, renderMap });
  const byOut = Object.fromEntries(plan.files.map((f) => [f.outputRel, f]));

  assert.equal(byOut['.mcp.json'].included, false, '.mcp.json omitted (features.mcp false)');
  assert.equal(byOut['.claude/hooks/contract-gate'].included, true, 'gate included (sdd_gate true)');
  assert.equal(byOut['CLAUDE.md'].included, true);
  assert.equal(byOut['src/infra/db/.gitkeep'].included, true, 'persistence db included');
  assert.equal(byOut['migrations/.gitkeep'].included, true, 'migrations included (both guards true)');
  // strip .tpl
  assert.ok('CLAUDE.md' in byOut, '.tpl stripped from CLAUDE.md.tpl');
});

test('renderTree: T2 conditional — backend-api child has no .mcp.json, no design-system', async () => {
  const templates = buildFixtureTree();
  const { loadRenderMap } = await import('./render.mjs');
  const map = await loadRenderMap(templates);
  const out = mkTmp('ack-out-t2-');
  const managed = { ...BASE_MANAGED, manifest_hash: 'sha256:' + '1'.repeat(64) };
  const res = renderTree({ managed, archetypesDir: templates, outDir: out, renderMap: map, ackInstallDir: '/nonexistent-ack-dir' });
  assert.ok(!fs.existsSync(path.join(out, '.mcp.json')), 'backend-api: .mcp.json omitted (features.mcp false)');
  assert.ok(!fs.existsSync(path.join(out, 'design-system')), 'backend-api: design-system absent');
  assert.ok(res.omitted.includes('.mcp.json'), '.mcp.json reported omitted');
});

test('renderTree: with render.map omits .mcp.json under backend-api; fullstack includes design-system', async () => {
  const templates = buildFixtureTree();
  // Use the engine's own YAML loader to read the fixture render.map.yaml.
  const { loadRenderMap } = await import('./render.mjs');
  const map = await loadRenderMap(templates);

  // backend-api
  const outB = mkTmp('ack-out-b-');
  const managedB = { ...BASE_MANAGED, manifest_hash: 'sha256:' + '2'.repeat(64) };
  const resB = renderTree({ managed: managedB, archetypesDir: templates, outDir: outB, renderMap: map, ackInstallDir: '/nonexistent' });
  assert.ok(!fs.existsSync(path.join(outB, '.mcp.json')), 'backend-api: .mcp.json omitted');
  assert.ok(!fs.existsSync(path.join(outB, 'design-system')), 'backend-api: no design-system');
  assert.ok(fs.existsSync(path.join(outB, 'CLAUDE.md')), 'CLAUDE.md written');
  assert.ok(fs.existsSync(path.join(outB, '.claude/hooks/contract-gate')), 'gate hook written');
  // ledger entries
  assert.ok(resB.ledger.find((e) => e.path === 'CLAUDE.md' && e.managed_block === 'ack:managed'));
  assert.ok(resB.ledger.find((e) => e.path === '.claude/settings.json' && e.managed_block === 'json:hooks,env'));
  assert.ok(resB.ledger.find((e) => e.path === '.claude/hooks/contract-gate' && e.managed_block === null));

  // fullstack with design_system.install true
  const outF = mkTmp('ack-out-f-');
  const managedF = {
    ...BASE_MANAGED,
    archetype: 'fullstack',
    design_system: { install: true, source: 'templates/archetypes/fullstack/design-system' },
    features: { hooks: true, mcp: true, agent_teams: false, sdd_gate: true },
    manifest_hash: 'sha256:' + '3'.repeat(64),
  };
  const resF = renderTree({ managed: managedF, archetypesDir: templates, outDir: outF, renderMap: map, ackInstallDir: '/nonexistent' });
  assert.ok(fs.existsSync(path.join(outF, '.mcp.json')), 'fullstack+mcp: .mcp.json present');
  assert.ok(fs.existsSync(path.join(outF, 'design-system/README.md')), 'fullstack+ds: design-system present');
  void resF;
});

test('renderTree: ${CLAUDE_PROJECT_DIR} preserved in rendered settings.json; JSON sorted', () => {
  const templates = buildFixtureTree();
  const out = mkTmp('ack-out-cpd-');
  const managed = { ...BASE_MANAGED, manifest_hash: 'sha256:' + '4'.repeat(64) };
  renderTree({ managed, archetypesDir: templates, outDir: out, renderMap: { rules: [] }, ackInstallDir: '/nonexistent' });
  const settings = fs.readFileSync(path.join(out, '.claude/settings.json'), 'utf8');
  assert.match(settings, /\$\{CLAUDE_PROJECT_DIR\}/, 'shell var preserved');
  // valid JSON
  const parsed = JSON.parse(settings);
  assert.ok(parsed.hooks);
  // 2-space indent (a nested line is indented in multiples of two spaces)
  assert.match(settings, /\n {2}"hooks": \{/, 'top-level key at 2-space indent');
  // sorted keys: re-serialize the parsed object with deep-sorted keys and 2-space
  // indent; the on-disk bytes must match exactly (byte-determinism).
  const expected = (function sortAndDump(v) {
    const sort = (o) => {
      if (Array.isArray(o)) return o.map(sort);
      if (o && typeof o === 'object') {
        const s = {};
        for (const k of Object.keys(o).sort()) s[k] = sort(o[k]);
        return s;
      }
      return o;
    };
    return JSON.stringify(sort(v), null, 2) + '\n';
  })(parsed);
  assert.equal(settings, expected, 'JSON output is sorted-key, 2-space, trailing newline');
});

test('renderTree: T3 no-op fast path — identical hash + intact ledger => zero writes', () => {
  const templates = buildFixtureTree();
  const out = mkTmp('ack-out-noop-');
  // First render with a correct hash + ledger.
  const baseManaged = { ...BASE_MANAGED };
  delete baseManaged.manifest_hash;
  const hash = computeManifestHash(baseManaged);
  const managed1 = { ...baseManaged, manifest_hash: hash };
  const res1 = renderTree({ managed: managed1, archetypesDir: templates, outDir: out, renderMap: { rules: [] }, ackInstallDir: '/nonexistent' });
  assert.equal(res1.noop, false);
  assert.ok(res1.written.length > 0);

  // Second render: same hash, ledger carried in managed.rendered_files => no-op.
  const managed2 = { ...baseManaged, manifest_hash: hash, rendered_files: res1.ledger };
  const res2 = renderTree({ managed: managed2, archetypesDir: templates, outDir: out, renderMap: { rules: [] }, ackInstallDir: '/nonexistent' });
  assert.equal(res2.noop, true, 'second identical run is a no-op');
  assert.equal(res2.written.length, 0, 'zero writes on no-op');
});

test('renderTree: T3 two-run non-destructive — human prose outside managed block survives', () => {
  const templates = buildFixtureTree();
  const out = mkTmp('ack-out-nondestr-');
  const managed = { ...BASE_MANAGED, manifest_hash: 'sha256:' + '5'.repeat(64) };
  renderTree({ managed, archetypesDir: templates, outDir: out, renderMap: { rules: [] }, ackInstallDir: '/nonexistent' });

  // Human edits CLAUDE.md outside the managed markers.
  const claudePath = path.join(out, 'CLAUDE.md');
  const edited = fs.readFileSync(claudePath, 'utf8') + '\nHOUSE STYLE: prefer pytest fixtures.\n';
  fs.writeFileSync(claudePath, edited, 'utf8');

  // Re-render with a CHANGED hash (so not a no-op) and the ledger present.
  const managed2 = { ...BASE_MANAGED, contract_gate: { ...BASE_MANAGED.contract_gate, mode: 'warn' }, manifest_hash: 'sha256:' + '6'.repeat(64) };
  renderTree({ managed: managed2, archetypesDir: templates, outDir: out, renderMap: { rules: [] }, ackInstallDir: '/nonexistent' });

  const after = fs.readFileSync(claudePath, 'utf8');
  assert.match(after, /HOUSE STYLE: prefer pytest fixtures\./, 'human prose preserved across re-run');
  assert.match(after, /gate: warn/, 'managed region updated to new mode');
});

// -----------------------------------------------------------------------------
// requires_archetype abort end-to-end through planTree
// -----------------------------------------------------------------------------

test('planTree: requires_archetype mismatch aborts loudly (design-system reached under wrong archetype)', () => {
  const templates = mkTmp('ack-tpl-abort-');
  // A misauthored tree: a monorepo archetype that ships a design-system file.
  writeFile(templates, 'render.map.yaml', [
    'version: 1',
    'rules:',
    '  - glob: "**/design-system/**"',
    '    archetype: "*"',
    '    when: design_system.install',
    '    requires_archetype: fullstack',
  ].join('\n'));
  writeFile(templates, 'monorepo/design-system/x.txt', 'oops');

  // managed with design_system.install true but archetype monorepo
  const managed = { archetype: 'monorepo', design_system: { install: true } };
  // load map via engine loader
  return import('./render.mjs').then(({ loadRenderMap }) =>
    loadRenderMap(templates).then((map) => {
      assert.throws(
        () => planTree({ managed, archetypesDir: templates, renderMap: map }),
        (e) => e instanceof RenderError && /requires_archetype/.test(e.message),
      );
    }),
  );
});

// -----------------------------------------------------------------------------
// Path-hygiene fires end-to-end on a leaking template
// -----------------------------------------------------------------------------

test('renderTree: path-hygiene aborts when a template leaks templates/archetypes/', () => {
  const templates = mkTmp('ack-tpl-leak-');
  writeFile(templates, 'render.map.yaml', 'version: 1\nrules: []\n');
  writeFile(templates, 'backend-api/leak.md.tpl', 'see templates/archetypes/backend-api/x for details\n');
  const managed = { ...BASE_MANAGED, manifest_hash: 'sha256:' + '7'.repeat(64) };
  const out = mkTmp('ack-out-leak-');
  assert.throws(
    () => renderTree({ managed, archetypesDir: templates, outDir: out, renderMap: { rules: [] }, ackInstallDir: '/nonexistent' }),
    (e) => e instanceof RenderError && /templates\/archetypes\//.test(e.message),
  );
});

// -----------------------------------------------------------------------------
// lookup / lookupBool primitives
// -----------------------------------------------------------------------------

test('lookup: found vs not-found vs descend-into-scalar', () => {
  assert.deepEqual(lookup('project.name', BASE_MANAGED), { found: true, value: 'acme-orders-api' });
  assert.deepEqual(lookup('project.nope', BASE_MANAGED), { found: false, value: undefined });
  assert.deepEqual(lookup('project.name.x', BASE_MANAGED), { found: false, value: undefined });
});

test('lookupBool: absent => false; present bool coerced', () => {
  assert.equal(lookupBool('features.mcp', BASE_MANAGED), false);
  assert.equal(lookupBool('features.sdd_gate', BASE_MANAGED), true);
  assert.equal(lookupBool('design_system.install', BASE_MANAGED), false);
});
