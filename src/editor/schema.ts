import {
  Schema,
  type Node as EditorNode,
  type NodeSpec,
} from 'prosemirror-model';

export const screenplayKinds = [
  'sceneHeading',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
  'lyrics',
  'centered',
  'section',
  'synopsis',
  'note',
  'boneyard',
  'pageBreak',
  'raw',
  'title',
  'titleContinuation',
] as const;

/** Physical source rows remain explicit; visual wrapping never creates a source row. */
export const screenplaySchema = new Schema({
  nodes: {
    doc: { content: 'line+', attrs: { sourceOrigin: { default: null } } },
    ...Object.fromEntries(
      screenplayKinds.map((kind): [string, NodeSpec] => [
        kind,
        {
          group: 'line',
          content: 'text*',
          attrs: {
            id: { default: null },
            sourceIndex: { default: -1 },
            protected: { default: true },
            literal: { default: true },
            sceneNumber: { default: null },
            sectionLevel: { default: null },
            actionSubtype: { default: null },
            speechOf: { default: null },
            dualWith: { default: null },
            titleOf: { default: null },
            hiddenOf: { default: null },
          },
          toDOM(node: EditorNode) {
            return [
              'p',
              {
                'data-kind': kind,
                'data-id': String(node.attrs.id),
                'data-origin': JSON.stringify(node.attrs),
                ...(node.attrs.protected ? { contenteditable: 'false' } : {}),
              },
              0,
            ];
          },
          parseDOM: [
            {
              tag: `p[data-kind="${kind}"]`,
              preserveWhitespace: 'full',
              getAttrs(dom: HTMLElement) {
                const value = dom.dataset.origin;
                if (!value || value.length > 4096) return false;
                try {
                  return JSON.parse(value) as Record<string, unknown>;
                } catch {
                  return false;
                }
              },
            },
          ],
          // DOM-origin attributes must still match the existing state in the transaction guard.
        },
      ]),
    ),
    text: {},
  },
  marks: {
    bold: { toDOM: () => ['strong', 0], parseDOM: [{ tag: 'strong' }] },
    italic: { toDOM: () => ['em', 0], parseDOM: [{ tag: 'em' }] },
    underline: { toDOM: () => ['u', 0], parseDOM: [{ tag: 'u' }] },
  },
});
