# WikiGov Architecture Protocol

## Purpose

WikiGov is a public Government Knowledge Platform. It must deliver answers that are official, verifiable, traceable, and continuously governed—not merely plausible AI responses.

## Delivery Order

1. Build and host the public web application.
2. Establish its knowledge and retrieval architecture alongside the user experience.
3. After launch, operate and improve the knowledge factory that supplies the platform.

## Knowledge Architecture

Represent knowledge as a durable, versioned network of typed nodes and relationships, in the spirit of a wiki: documents, Government Orders, provisions, schemes, departments, people, places, dates, amendments, budgets, and citations. Every derived statement must retain links to its original approved source, relevant passage, version, effective date, and review status.

The model must support a document lifecycle: `draft → pending review → approved → published → superseded/archived`. Preserve prior versions and audit events; never silently overwrite a source or citation.

## Retrieval and Answering

Use the fastest suitable retrieval method for each question. Start with deterministic retrieval—metadata, filters, exact GO/Act references, keyword search, and graph relationships—then add semantic/vector retrieval only when it improves recall or discovery. The architecture must support vectorless operation.

Use a portable retrieval boundary. A free-tier managed store such as Supabase is an acceptable starting point, provided source data, embeddings, and indexes can be migrated without rewriting product behavior. Answers may use RAG only from approved sources, must show citations, and must return “No verified information was found” rather than invent unsupported information.

## Hosting and Scalability

Keep the web client, API/retrieval layer, ingestion jobs, and data store independently deployable. Prefer stateless services, asynchronous ingestion, idempotent jobs, explicit versioning, and observable health checks. Design interfaces so data volume, retrieval strategies, and hosting providers can change without changing the public experience.

## Knowledge Factory After Launch

Run a regular governed pipeline to discover, ingest, OCR, normalize, classify, link, validate, and review official material. Monitor source health, amendments, broken links, duplicate records, citation quality, language quality, and knowledge gaps. Generate review queues for stewards; do not auto-publish uncertain sources, interpretations, or policy changes.

## Non-Negotiable Guardrails

- Official sources and citation provenance are mandatory for factual answers.
- User feedback, corrections, approvals, and answer generation must be auditable.
- Security, privacy, accessibility, English/Tamil support, and mobile usability are product requirements.
- Treat the protocol as a living document: propose changes through review and record the rationale.
