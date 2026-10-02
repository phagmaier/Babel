# Offline PDF viewer runtime (M5-05)

Direct dependency: `pdfjs-dist` **6.3.289**, Apache-2.0.
[Upstream package](https://github.com/mozilla/pdfjs-dist),
[retained license](pdf-viewer/pdfjs-dist-6.3.289-LICENSE.txt),
[viewer decision](../decisions/0038-offline-pdf-viewer.md).
`pnpm-lock.yaml` pins the package integrity and resolved optional dependencies.

Production Vite emits a lazy display module and one local module-derived worker
bundle. It uses the renderer's embedded Courier Prime fonts and actual artifact
bytes. `web/` viewer, scripting sandbox, CMaps, standard-font files, WASM, image
decoders and optional Node `@napi-rs/canvas` binaries are not copied as application
resources. The current text-only frozen pipeline needs none of these assets;
missing required resources fail rather than obtaining network substitutes.

The optional Node canvas dependency is install-time/tooling only; production
build output is browser JS and the app needs no end-user Node/native canvas.
Its lockfile entries must still be covered in M6's full transitive build/runtime
license review. This task records the direct viewer license, not complete
application distribution clearance. The renderer and font notices remain owned
by M5-01/03.
