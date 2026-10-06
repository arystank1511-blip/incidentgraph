# IncidentGraph design system

The product is an investigation workbench: high-density dark surfaces, a quiet green brand accent, and a visible chain from symptoms to evidence. The incident detail is the core experience; the public site explains the product without replacing it.

Guidance consulted: `ui-ux-pro-max` (dark developer tooling, data-dense dashboards, Next.js loading states, keyboard/focus/contrast rules), `21st-ai` (available but not authenticated), and Sites design guidance. The specified Next.js/NestJS/PostgreSQL architecture takes precedence over the Sites hosting starter. No Figma file is required for this implementation.

- Typeface: locally bundled Inter Variable. JetBrains Mono for telemetry, timestamps, and IDs.
- Background `#101212`; surface `#151818`; border `#2a302c`; primary text `#e8ece9`.
- Brand/healthy `#91d8ad`; critical `#ee8e88`; warning `#deb67b`; informational `#8eafd6`.
- 4px spacing rhythm, 6–8px corners, thin borders, minimal shadows.
- Semantic status names accompany color. Dialogs use Radix focus trapping and escape handling. Keyboard navigation includes a skip link, visible focus, and Ctrl/Cmd+K.
- Responsive layout collapses the sidebar, stacks charts and investigation panels, and preserves table scrolling inside containers.
- Graph nodes are keyboard-selectable via React Flow. Zoom controls and the service catalog provide alternatives to drag gestures.
- Reduced-motion preferences disable animation; charts render without entrance animations.

No generated image assets are needed. All visuals are functional charts, service graphs, icons, or architecture diagrams.
