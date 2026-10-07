# Resume and LinkedIn copy

Repository: https://github.com/arystank1511-blip/incidentgraph

Maintainer: **Arystan Kabdesh**. Developed collaboratively with Tlegen.

Use this as a portfolio project. Describe only your own verified contributions when adapting these project-level descriptions to a personal resume. The descriptions below refer to implemented functionality, not production adoption or measured business outcomes. Add a hosted demo link only after one is deployed.

## Resume — English

**IncidentGraph — Distributed Systems Incident Investigation | Portfolio Project**

Next.js · React · TypeScript · NestJS · PostgreSQL · Prisma · Redis · Docker · GitHub Actions

- Full-stack incident investigation MVP connecting service dependency graphs, correlated anomaly timelines, logs, metrics, and distributed trace waterfalls.
- Deterministic root cause ranking using temporal evidence, reverse graph traversal, anomaly magnitude, and propagation order, with inspectable scoring factors.
- Transactional PostgreSQL persistence, idempotent demo seeding, revocable HTTP-only sessions, input validation, and concurrency-safe incident updates within one API process.
- Unit, integration, and browser verification covering analysis behavior, database persistence, investigation workflows, responsive layouts, and automated accessibility checks.

## Резюме — русский

**IncidentGraph — платформа расследования инцидентов в распределённых системах | Портфолио-проект**

- Full-stack MVP на Next.js, NestJS и TypeScript: граф зависимостей сервисов, таймлайн инцидентов, логи, метрики и waterfall распределённых трассировок.
- Объяснимое ранжирование первопричин на основе времени событий, обхода графа, величины аномалий и порядка распространения сбоев.
- PostgreSQL/Prisma, транзакционное сохранение, повторяемый seed, авторизация демосессий и защита от потери одновременных изменений внутри одного API-процесса.
- Unit-, интеграционные и браузерные проверки, включая сохранение данных, основные пользовательские сценарии, адаптивность и автоматические проверки доступности.

## LinkedIn project description

IncidentGraph is a full-stack portfolio MVP for investigating failures in distributed systems. It connects logs, metrics, trace waterfalls, and service dependencies in one investigation workspace and ranks root cause candidates with an explainable, deterministic TypeScript engine.

The project includes a Next.js frontend, NestJS API, PostgreSQL/Prisma persistence, optional Redis caching, Docker Compose, and GitHub Actions. A reproducible commerce-platform scenario demonstrates how database saturation propagates into payment, order, and gateway failures.

The focus is on engineering clarity: traceable evidence, explicit scoring tradeoffs, durable incident workflows, and automated verification. Telemetry is synthetic; realtime collection and multi-tenant production operation are outside the current scope.

## Short LinkedIn post

I maintain IncidentGraph, a collaborative portfolio project exploring a practical question: when several services fail together, how do you identify where the failure started?

The application connects an incident timeline, service dependency graph, logs, metrics, and distributed traces. Its root cause engine uses deterministic scoring with visible evidence rather than generating an unexplained answer.

One useful challenge was protecting investigation state from concurrent updates: changing an incident's owner and status at the same time should preserve both changes. The project includes a regression test for that behavior, alongside PostgreSQL persistence and browser tests.

Stack: Next.js, NestJS, TypeScript, PostgreSQL, Prisma, Redis, React Flow, and Playwright.

This is an MVP with synthetic telemetry, not a production monitoring service. Code, screenshots, architecture, and a three-minute walkthrough: https://github.com/arystank1511-blip/incidentgraph

## Interview preparation

Be ready to explain the graph direction, bounded correlation window, heuristic score, repository boundary, transactional writes, single-process concurrency limit, and what would change for real traffic. Demonstrate the code and tests you understand; avoid claims about uptime, revenue saved, scale, or customers without measurements.
