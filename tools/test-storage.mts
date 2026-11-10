/**
 * test-storage.mts — runtime round-trip checks for src/storage.ts.
 *
 * This repository has no JS test runner; this script is the executable
 * regression evidence for review 2026-11-02 P1 (local mode must persist
 * folders / notes / AI configs, not only videos / reports / reminders).
 *
 * Run:  node --experimental-strip-types tools/test-storage.mts
 * Exit: 0 = all checks passed, 1 = at least one failed
 */

// Minimal localStorage stub (Map-backed, fresh per run = "page reload").
const backing = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
  setItem: (k: string, v: string) => void backing.set(k, String(v)),
  removeItem: (k: string) => void backing.delete(k),
  clear: () => backing.clear(),
  key: () => null,
  get length() {
    return backing.size;
  },
};

const storage = await import('../src/storage.ts');

let failures = 0;
function check(name: string, ok: boolean): void {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${name}`);
  if (!ok) failures += 1;
}

const cases = [
  { name: 'videos', save: storage.saveVideos, load: storage.loadVideos, item: { id: 'v1', title: 'demo' } },
  { name: 'reports', save: storage.saveReports, load: storage.loadReports, item: { id: 'r1', title: 'rep' } },
  { name: 'reminders', save: storage.saveReminders, load: storage.loadReminders, item: { id: 'rem1' } },
  { name: 'folders', save: storage.saveFolders, load: storage.loadFolders, item: { id: 'f1', name: 'folder' } },
  { name: 'notes', save: storage.saveNotes, load: storage.loadNotes, item: { id: 'n1', content: 'note' } },
  { name: 'aiConfigs', save: storage.saveAIConfigs, load: storage.loadAIConfigs, item: { id: 'a1', model: 'm' } },
] as const;

for (const c of cases) {
  check(`${c.name}: empty storage loads []`, (c.load() as unknown[]).length === 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (c.save as (items: any[]) => void)([c.item]);
  const loaded = c.load() as Array<Record<string, unknown>>;
  check(`${c.name}: save -> load round-trip survives a reload`, loaded.length === 1 && loaded[0]!.id === (c.item as { id: string }).id);
}

// A write to one collection must not leak into another (distinct keys).
check(
  'collections are isolated (folders write does not appear in notes)',
  (storage.loadNotes() as unknown[]).every((n) => (n as { id: string }).id !== 'f1'),
);

// Corrupt payloads must degrade to [] instead of throwing (existing contract).
backing.set('videovault_folders', '{not json');
check('corrupt folders payload loads []', (storage.loadFolders() as unknown[]).length === 0);
backing.set('videovault_aiconfigs', '[1,2'); // truncated
check('corrupt aiConfigs payload loads []', (storage.loadAIConfigs() as unknown[]).length === 0);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log(`\nAll storage checks passed (${cases.length} collections).`);
