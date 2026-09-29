---
title: TypeScript modular monolith
description: Record why Nischit uses one TypeScript codebase with separate web, API, and worker processes.
docType: explanation
---

# Use a TypeScript modular monolith for the first product

**Status: accepted.** Nischit uses TypeScript across the web application, API, worker, validation schemas, and chain adapters, organized as a modular monolith with separate deployable web, API, and worker processes. This keeps language boundaries small while preserving deep module interfaces and extraction seams if operational evidence later supports scaling a module independently.
