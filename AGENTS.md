# Repository Guidelines

## Project Structure & Module Organization

GovGPT is a public Government Knowledge Platform. Keep the application small and easy to deploy:

- `index.html` is the browser entry point.
- `src/` holds application JavaScript and styles; organize larger features in folders such as `src/views/` and `src/components/`.
- `assets/` holds local images, icons, and fonts.
- `tests/` contains automated checks, mirroring `src/` paths where practical.
- `docs/` contains product and technical decisions.

Read [`docs/ARCHITECTURE_PROTOCOL.md`](docs/ARCHITECTURE_PROTOCOL.md) before altering platform architecture, retrieval, or source governance.

## Build, Test, and Development Commands

The initial app is dependency-free and can be served locally with:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. When package scripts are introduced, prefer `npm run dev`, `npm run build`, and `npm test` over invoking tools directly, and document them in `README.md`.

## Coding Style & Naming Conventions

Use 2-space indentation for HTML, CSS, and JavaScript. Prefer semantic HTML, CSS custom properties for shared design tokens, and modern browser JavaScript. Use `camelCase` for JavaScript variables/functions, `PascalCase` for component constructors, and `kebab-case` for CSS classes and assets (for example, `knowledge-explorer.css`).

Keep UI copy accessible and source-aware. Government claims must identify an official source or be marked as demonstration content. Never commit API keys, tokens, or personal data.

## Architecture & Knowledge Protocol

Build separately deployable web, API/retrieval, ingestion, and data layers. Model knowledge as versioned, typed nodes and links—documents, provisions, schemes, departments, dates, and citations—not chat history. Preserve provenance, effective dates, versions, and auditability.

Use the fastest relevant retrieval: exact metadata, keyword search, and graph relationships first; semantic/vector search only when it improves recall. Supabase or another free-tier managed service is acceptable, but keep interfaces portable and support vectorless retrieval. Answers must cite approved sources and safely decline unsupported claims.

After launch, maintain a governed knowledge factory for ingestion, OCR, validation, linking, review, and publication. Do not auto-publish uncertain sources or interpretations.

## Testing Guidelines

Verify relevant flows at desktop and mobile widths: search submission, role/language switching, keyboard navigation, and focus states. Add tests for non-trivial logic under `tests/`, naming them after behavior (for example, `search-submission.test.js`).

## Commit & Pull Request Guidelines

Use concise imperative Conventional Commit-style messages, such as `feat: add citizen search workspace` or `fix: preserve citations in answers`. Keep commits scoped to one intent.

Pull requests should describe the user-visible change, validation performed, and linked issue when available. Include screenshots or a short recording for UI changes, and flag changes to government content, source attribution, or configuration.
