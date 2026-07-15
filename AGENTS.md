# VoiceCalendar Development Guide

## Project Overview

VoiceCalendar is evolving from a voice-enabled calendar demo into a production-style intelligent personal productivity platform.

Current frontend stack:

- React
- TypeScript
- Vite
- CSS
- Web Speech API

Future architecture:

- React + TypeScript frontend
- C++ backend
- Database persistence
- Python intelligent analysis service

The project currently already contains working features such as calendar views, date detail interactions, festivals, countdowns, categories, voice recognition, voice-based event creation/query/deletion, voice summary, wake-word support, text-to-speech, and related UI interactions.

Existing working functionality should be preserved during the frontend redesign unless a task explicitly asks to change or replace it.

---

## Development Workflow

This repository uses incremental pull-request-based development.

Rules:

1. Each PR should focus on one clear feature or refactor.
2. Do not combine unrelated features in one task.
3. Do not rewrite the entire project unless explicitly requested.
4. Preserve existing functionality whenever possible.
5. Prefer incremental refactoring over complete replacement.
6. Keep changes easy to review.
7. Before finishing a task, run the relevant build, type-check, lint, or tests available in the repository.
8. Report any existing errors that are unrelated to the current task instead of silently modifying unrelated code.
9. Do not create commits or push to GitHub unless explicitly requested.
10. Do not modify README, package metadata, or unrelated files unless necessary for the current task.

---

## Code Quality

- Use TypeScript types instead of unnecessary `any`.
- Prefer reusable React components.
- Avoid putting large amounts of logic into App.tsx.
- Keep components focused on one responsibility.
- Reuse existing components and utilities where appropriate.
- Avoid duplicate CSS rules.
- Avoid hard-coded magic values when design tokens or CSS variables are appropriate.
- Keep responsive behavior working.
- Maintain keyboard accessibility for interactive UI.
- Respect `prefers-reduced-motion` for non-essential animation.
- Avoid unnecessary production dependencies.
- Ask before introducing a large UI, animation, 3D, or state-management dependency.

---

## VoiceCalendar 2.0 Visual Direction

The visual goal is:

- Dark Ambient
- Minimal Futuristic
- Spatial UI
- Glass Layering
- Subtle Motion
- Productivity OS
- Technology-oriented but professional

The interface should feel like a mature productivity application, not an AI-generated landing page.

Avoid:

- excessive purple gradients
- cyberpunk neon
- excessive glow
- excessive glassmorphism
- floating cards everywhere
- meaningless animations
- oversized AI labels
- generic AI dashboard styling
- excessive rounded rectangles
- overly colorful UI

Use restrained visual effects.

The application should have clear depth:

Z0: deep background base

Z1: ambient aurora / grid / particles

Z2: application workspace

Z3: contextual floating information

Z4: drawers and overlays

Z5: command palette

---

## Dynamic Background Direction

The background should eventually contain:

- deep dark base
- subtle animated aurora lighting
- very low-opacity grid
- a small number of slow particles
- subtle pointer parallax
- optional time-aware ambient theme

Animation must remain slow and restrained.

The background should never interfere with readability or application interaction.

Prefer CSS for simple effects.

Use Canvas only where it provides meaningful value.

Do not introduce Three.js or another heavy graphics framework without explicit approval.

---

## Layout Direction

The final application shell should support:

- left navigation sidebar
- top command/search area
- central workspace
- optional contextual right panel
- floating Voice Orb

Primary workspaces:

- Today
- Calendar
- Tasks
- Insights
- Settings

AI and voice capabilities should be integrated naturally into the product instead of dominating the interface.

---

## Existing Feature Protection

When redesigning the frontend:

- preserve existing event data behavior
- preserve voice recognition logic
- preserve voice commands
- preserve text-to-speech
- preserve event CRUD behavior
- preserve countdown logic
- preserve festival information
- preserve existing useful interactions

If an existing UI needs replacement, separate UI changes from business-logic changes whenever possible.

Do not delete a working feature merely because it does not fit the new design.

---

## Completion Requirements

At the end of every task:

1. Summarize changed files.
2. Explain the main implementation decisions.
3. List any existing functionality that may be affected.
4. Run available validation commands.
5. Report validation results.
6. Do not continue implementing unrelated future PRs.

