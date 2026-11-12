---
name: api-design
description: "Design consistent HTTP/GraphQL APIs: resources, naming, errors, pagination, idempotency, versioning, auth. Use before adding or changing endpoints."
---

# API Design

An API is a promise; make it predictable.

## Conventions
- Plural nouns for resources, verbs only for true actions.
- One error shape everywhere: code, message, details, request id.
- Cursor pagination for large lists; filtering and sorting via query params.
- Idempotency keys for create/payment endpoints; version in the path or header.
- Validate input at the edge; never trust client-sent IDs for authorization.
