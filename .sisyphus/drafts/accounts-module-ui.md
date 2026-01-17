# Draft: Accounts Module Activation UI

## Requirements (confirmed)

- New Modules page under Settings.
- List all modules (museum related): `fine_art`, `wine`, `automotive`, `natural_history`, `archive`, `library`, `accounts`.
- Gate toggles by `organization.manage_settings`.
- Modules should be user-activatable in app.
- Show descriptions for each module.
- No confirmation dialogs.
- Library module visible but gated by Library integration subscription.

## Technical Decisions

- Create route `apps/app/src/app/[locale]/(dashboard)/settings/modules/page.tsx`.
- Add nav entry in settings layout/menu.
- Use `organizations.update` to set `settings.enabledModules`.
- Treat missing `enabledModules` as empty array.
- Disable library toggle unless `integrations.getEnabled` includes `library`.

## Research Findings

- Integrations UI at `apps/app/src/app/[locale]/(dashboard)/settings/integrations/page.tsx`.
- Organization settings page at `apps/app/src/app/[locale]/(dashboard)/settings/organization/page.tsx`.
- Modules stored in `settings.enabledModules` in schema.

## Open Questions

- Any auto-setup when enabling modules?

## Scope Boundaries

- INCLUDE: Modules page UI + toggle updates.
- EXCLUDE: New module logic, subscriptions, auto-setup.
