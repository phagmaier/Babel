import { execFileSync } from 'node:child_process';
import { posix, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Frozen F4-05 source is loaded from Git, without copying tests or editing files.
// Advance only after reviewing changed outcomes against independent oracles.
export const baseline = '808469088db8eee0b95742e67fc2f79ec3a3bea4';
const prefix = resolve('.babel-differential-baseline') + '/';
const cache = new Map<string, string>();

export default defineConfig({
  plugins: [
    {
      name: 'frozen-capture-control',
      enforce: 'pre',
      resolveId(source, importer) {
        let path: string | undefined;
        if (source.startsWith('@baseline/')) path = source.slice(10);
        else if (importer?.startsWith(prefix) && source.startsWith('.'))
          path = posix.normalize(
            posix.join(posix.dirname(importer.slice(prefix.length)), source),
          );
        if (path === undefined) return;
        if (path.startsWith('../')) throw new Error('Baseline escaped src');
        return prefix + path + (/\.(?:ts|json)$/.test(path) ? '' : '.ts');
      },
      load(id) {
        if (id.startsWith(prefix)) {
          if (!cache.has(id))
            cache.set(
              id,
              execFileSync(
                'git',
                ['show', `${baseline}:src/${id.slice(prefix.length)}`],
                {
                  encoding: 'utf8',
                  maxBuffer: 2 ** 20,
                },
              ),
            );
          return cache.get(id);
        }
        // Deliberate in-memory faults prove the regression gates reject changes.
        const fault = process.env.BABEL_DIFFERENTIAL_FAULT;
        if (fault === 'capture' && id.endsWith('/src/editor/sourceBridge.ts'))
          return (
            readFileSync(id, 'utf8').replace(
              'export function captureEditor(',
              'export function captureEditorBroken(',
            ) +
            '\nexport function captureEditor() { throw new Error("injected capture fault"); }\n'
          );
        if (
          fault === 'renderer' &&
          id.endsWith('/src/domain/rendererReading.ts')
        )
          return readFileSync(id, 'utf8').replace(
            "return { kind: 'action', roles: all('action') }",
            "return { kind: 'transition', roles: all('transition') }",
          );
        if (
          fault === 'assessment' &&
          id.endsWith('/src/domain/exportAssessment.ts')
        )
          return readFileSync(id, 'utf8').replace(
            'issues: Object.freeze(issues),',
            'issues: Object.freeze([]),',
          );
      },
    },
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/differential/*.test.ts'],
    maxWorkers: 1,
    testTimeout: 180000,
  },
});
