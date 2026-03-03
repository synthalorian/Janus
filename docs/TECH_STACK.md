# Janus Tech Stack Decisions

## Overview

This document captures the rationale for technology choices in Janus. These are preliminary and may evolve during Phase 0.

---

## Backend

### Primary Language: Rust

**Decision:** Rust with Axum framework

**Rationale:**
- Performance: Sub-millisecond latency for critical paths
- Safety: Memory safety without garbage collection
- Concurrency: Async/await with Tokio, excellent for WebSocket handling
- Type system: Strong typing catches errors at compile time
- Ecosystem: Growing web ecosystem (Axum, Tower, sqlx)

**Alternatives Considered:**
- Go: Simpler, but less type-safe; GC pauses for high throughput
- Node.js: Fast development, but single-threaded, less performant
- Elixir/Erlang: Excellent for concurrency, but smaller ecosystem

### Graph Database: Neo4j (with fallback)

**Decision:** Neo4j for initial development, custom solution if needed

**Rationale:**
- Mature: Battle-tested, widely used
- Query language: Cypher is expressive and well-documented
- Performance: Optimized for graph traversals
- Ecosystem: Good tooling, visualization, drivers

**Fallback Plan:**
If Neo4j proves problematic (licensing, scaling), build on PostgreSQL with:
- Adjacency list tables
- Recursive CTEs for queries
- Materialized paths for deep traversals

### Primary Database: PostgreSQL

**Decision:** PostgreSQL for relational data

**Rationale:**
- Reliability: Proven at scale
- Features: JSON, full-text search, extensions
- Ecosystem: Excellent tooling and drivers
- Flexibility: Can handle some graph-like queries

### Cache: Redis (or Dragonfly)

**Decision:** Redis for caching and real-time features

**Rationale:**
- Performance: Sub-millisecond reads
- Data structures: Rich types (sets, sorted sets, streams)
- Pub/Sub: Built-in for real-time notifications
- Ecosystem: Mature, well-understood

**Alternative:** Dragonfly (Redis-compatible, higher performance)

---

## Frontend

### Web Framework: React + TypeScript

**Decision:** React with TypeScript, Vite for build

**Rationale:**
- Ecosystem: Largest component ecosystem
- TypeScript: Type safety for complex state
- Vite: Fast development, optimized builds
- Team familiarity: Most developers know React

**Alternatives Considered:**
- Vue: Simpler, but smaller ecosystem
- Svelte: Better performance, but less mature ecosystem
- Solid: Excellent performance, but smaller community

### Desktop: Tauri

**Decision:** Tauri for desktop apps

**Rationale:**
- Performance: Rust backend, smaller bundles than Electron
- Security: Fine-grained permissions system
- Native: Better OS integration
- Size: ~10MB vs Electron's ~150MB

**Alternative:** Electron (larger ecosystem, but heavier)

### Mobile: React Native

**Decision:** React Native for iOS and Android

**Rationale:**
- Code sharing: Shared logic with web
- Performance: Good enough for chat app
- Ecosystem: Mature, many libraries
- Team: One codebase, two platforms

**Alternatives Considered:**
- Flutter: Better performance, but Dart learning curve
- Native (Swift/Kotlin): Best performance, but double development

---

## Real-Time

### WebSocket Server: Custom Rust (Axum + Tokio)

**Decision:** Built-in WebSocket server

**Rationale:**
- Integration: Direct access to graph and database
- Performance: No intermediate layers
- Control: Full control over protocol
- Cost: No third-party service fees

### Message Streaming: Server-Sent Events (SSE) + WebSocket

**Decision:** Hybrid approach

**Rationale:**
- WebSocket: Bidirectional (chat, presence)
- SSE: Unidirectional streaming (AI responses)
- Fallback: HTTP long-polling for restricted networks

---

## AI Runtime

### SDK Languages: Python (primary), TypeScript, Rust

**Decision:** Multi-language SDK with Python first

**Rationale:**
- Python: Most AI/ML work happens in Python
- TypeScript: Web developers, Node.js backends
- Rust: High-performance, native integrations

### LLM Integration: External (Bring Your Own LLM)

**Decision:** Start with external LLMs, add hosting later

**Rationale:**
- Flexibility: Users choose their LLM
- Cost: No inference infrastructure initially
- Focus: Core platform, not LLM hosting

**Future:** Optional hosted LLMs in Phase 3

---

## Infrastructure

### Container Orchestration: Kubernetes

**Decision:** Kubernetes for production

**Rationale:**
- Scale: Proven at massive scale
- Ecosystem: Rich tooling (Helm, operators)
- Portability: Runs anywhere (cloud, on-prem)
- Features: Auto-scaling, self-healing, secrets

**Development:** Docker Compose for local dev

### Cloud Provider: Multi-cloud (AWS primary)

**Decision:** AWS for initial, design for multi-cloud

**Rationale:**
- AWS: Mature, feature-complete
- Multi-cloud: Avoid vendor lock-in
- Self-hosted: Support for on-prem deployments

### CDN: CloudFront or Cloudflare

**Decision:** CloudFront (AWS integration) or Cloudflare (DDoS protection)

**Rationale:**
- Performance: Global edge locations
- Cost: Cheap for static assets
- Security: DDoS protection built-in

---

## Observability

### Metrics: Prometheus + Grafana

**Decision:** Prometheus for metrics, Grafana for visualization

**Rationale:**
- Standard: Most widely used
- Integration: K8s native, Rust exporters
- Query: PromQL is powerful
- Alerting: Alertmanager built-in

### Logging: Loki + Grafana

**Decision:** Loki for logs (integrates with Grafana)

**Rationale:**
- Integration: Same stack as metrics
- Cost: Cheaper than Elasticsearch
- Query: LogQL similar to PromQL

### Tracing: Jaeger or Tempo

**Decision:** Tempo (integrated with Grafana stack)

**Rationale:**
- Integration: Grafana ecosystem
- Cost: Efficient storage
- Trace ID: Correlate across services

---

## Security

### Identity: Keycloak or Custom

**Decision:** Custom identity for AIs, OAuth/Passkey for humans

**Rationale:**
- AI needs: Keypairs, not passwords
- Human needs: Familiar OAuth flows
- Flexibility: Custom for Janus-specific features

### Encryption: TLS 1.3, AES-256-GCM

**Decision:** Standard encryption everywhere

**Rationale:**
- In transit: TLS 1.3 mandatory
- At rest: AES-256-GCM for sensitive data
- Keys: HashiCorp Vault for key management

---

## Development Tools

### Version Control: Git + GitHub

**Decision:** GitHub for hosting, Git for version control

**Rationale:**
- Standard: Most developers use GitHub
- Features: Actions, Issues, PRs, Discussions
- Community: Open source visibility

### CI/CD: GitHub Actions

**Decision:** GitHub Actions for CI/CD

**Rationale:**
- Integration: Native with GitHub
- Cost: Free for public repos
- Flexibility: Any build environment

### Documentation: MkDocs or Docusaurus

**Decision:** Docusaurus for docs site

**Rationale:**
- Features: Versioning, search, i18n
- Markdown: Easy to write
- React: Extensible with components

---

## Summary Table

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Backend Language | Rust (Axum) | Performance, safety, concurrency |
| Graph DB | Neo4j | Mature, expressive queries |
| Primary DB | PostgreSQL | Reliable, feature-rich |
| Cache | Redis | Fast, versatile |
| Web Frontend | React + TypeScript | Ecosystem, type safety |
| Desktop | Tauri | Lightweight, native |
| Mobile | React Native | Cross-platform |
| Real-time | WebSocket + SSE | Bidirectional + streaming |
| AI SDK | Python (primary) | AI/ML ecosystem |
| Orchestration | Kubernetes | Scale, portability |
| Observability | Prometheus + Grafana | Standard, integrated |
| CI/CD | GitHub Actions | Native, flexible |

---

*"The right tools for the right job."*
