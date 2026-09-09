# UI redesign: Tailwind + shadcn-vue, DaisyUI removed

This fork drops DaisyUI in favour of shadcn-vue style primitives (branch
`ui-redesign-tailwind-shadcn`), matching the direction the admin UI
(`forks/admin`) is migrating towards, so both surfaces read as one product
and share a design vocabulary.

## Why remove DaisyUI

Portal was already Tailwind-based, so this isn't a framework swap the way
admin's Bootstrap -> Tailwind migration is — it's removing DaisyUI's plugin
classes (`btn`, `alert-*`, `input-bordered`, `join`, `card`, ...) in favour of
small Vue components built directly on Tailwind utilities + a `cva` variant
each, exactly like the admin primitives. Less indirection: a component's
style lives in its own file instead of a plugin's generated class names, and
there's one fewer dependency + config surface (`daisyui`, `tailwind.config.js`
theme block) to keep in sync with Tailwind upgrades.

## The multi-theme picker was intentionally dropped

DaisyUI shipped ~13 named color themes (`synthwave`, `cyberpunk`, `nord`,
...) selectable per-user via `pages/edit.vue`, backed by the `portal_theme`
setting. This was a deliberate product decision, not an oversight: portal now
ships one design in light/dark, controlled the normal way (`auto` / `light` /
`dark`, `usePreferedTheme` in `composables/states.ts`). If `portal_theme` on
a given instance is still set to an old DaisyUI theme name from before this
migration, treat it as `dark` unless it's a recognizable light theme name —
this isn't handled specially in code, so check `composables/states.ts` if
that turns out to matter in practice.

## What changed

- `tailwind.config.js`: `daisyui` plugin/theme config removed; added the same
  `brand` color scale as `forks/admin`'s Tailwind config, and a small
  `addComponents` plugin providing `.link` (DaisyUI's `.link` is gone, and
  `components/CustomText.vue` needs it as a real Tailwind class to `@apply`
  it into user-supplied HTML content).
- Every component that used DaisyUI classes rewritten on plain Tailwind +
  `cva` where there's more than one visual variant (`YButton`, `BaseAlert`);
  everything else (`TextInput`, `FormField`, `TextInputList`, `pages/edit.vue`,
  `pages/index.vue`) restyled with plain Tailwind utilities.
- `pages/index.vue`'s three tile themes (`descriptive`/`simple`/`periodic`)
  and their hover/color-cycling CSS are unchanged — that's custom CSS, not
  DaisyUI.
- New shared primitive: `utils/cn.ts` (same `clsx` + `tailwind-merge` helper
  as admin's `src/lib/utils.ts`, Nuxt auto-imports from `utils/`).

## Icons

Untouched — still `nuxt-icons` / `YIcon` with the existing Material Design
icon names. No reason to churn this; DaisyUI was the only real complexity
source here.
