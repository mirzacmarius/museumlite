# Frontend Design

Create distinctive, production-grade frontend interfaces following the Aura design system. Use this skill when the user asks to build web components, pages, dashboards, React components, or any UI for this project.

## Design Reference

**Primary Source**: `docs/design/aura-html-pages/dasboard-as-admin.html`
**Additional Pages**: Browse `docs/design/aura-html-pages/` folder for specific page designs (loans, collections, objects, patrons, etc.)

When no specific design exists for a page, derive the visual style from `dashboard-as-admin.html` to maintain consistency.

---

## ⚠️ Theme-Aware Styling (IMPORTANT)

This project uses `next-themes` with CSS variables for light/dark mode support. **Never hardcode color classes** like `bg-zinc-950` or `text-zinc-400` for semantic colors.

### Use Semantic Classes Instead

| ❌ Don't Use | ✅ Use Instead | Purpose |
|-------------|---------------|---------|
| `bg-zinc-950` | `bg-background` | Main background |
| `bg-zinc-900/40` | `bg-card` | Card/panel surfaces |
| `bg-zinc-900` | `bg-secondary` | Secondary surfaces |
| `bg-zinc-800` | `bg-muted` | Muted backgrounds |
| `text-white` | `text-foreground` | Primary text |
| `text-zinc-400` | `text-muted-foreground` | Secondary/muted text |
| `border-zinc-800` | `border-border` | Standard borders |
| `border-zinc-700` | `border-input` | Input borders |

### When Hardcoded Colors ARE Acceptable

- **Accent colors** that don't change between themes: `bg-indigo-600`, `text-amber-400`, `border-emerald-500/30`
- **Status indicators**: `bg-emerald-500` (success), `bg-amber-500` (warning), `bg-rose-500` (error)
- **Opacity modifiers** on semantic colors: `bg-card/50`, `border-border/60`

### CSS Variables Reference (from `globals.css`)

```css
/* Light theme (:root) and Dark theme (.dark) define these: */
--background    /* Main page background */
--foreground    /* Primary text color */
--card          /* Card/elevated surface background */
--card-foreground
--popover       /* Dropdown/popover background */
--popover-foreground
--primary       /* Primary action color */
--primary-foreground
--secondary     /* Secondary surface */
--secondary-foreground
--muted         /* Muted/disabled background */
--muted-foreground  /* Secondary text */
--accent        /* Accent highlight (indigo in dark) */
--accent-foreground
--destructive   /* Error/danger color */
--border        /* Default border color */
--input         /* Input field border */
--ring          /* Focus ring color */
```

---

## Color Palette

### Semantic Colors (Theme-Aware)

| Purpose | Class | Notes |
|---------|-------|-------|
| Background | `bg-background` | Main page background |
| Surface | `bg-card` | Cards, panels, elevated surfaces |
| Secondary surface | `bg-secondary` | Subtle surface differentiation |
| Muted surface | `bg-muted` | Disabled states, subtle backgrounds |
| Text primary | `text-foreground` | Headings, important text |
| Text secondary | `text-muted-foreground` | Body text, descriptions |
| Border | `border-border` | Standard borders |
| Accent | `bg-accent`, `text-accent-foreground` | Highlighted elements |

### Accent Colors (Static - Same in Both Themes)

| Color | Usage | Example Classes |
|-------|-------|-----------------|
| Indigo | Primary actions, selected states | `bg-indigo-600`, `border-indigo-500/30`, `text-indigo-400` |
| Amber | Permanent/featured items | `bg-amber-500/20`, `border-amber-500/30`, `text-amber-200` |
| Emerald | Success, stable, active | `bg-emerald-500`, `border-emerald-500/30`, `text-emerald-400` |
| Rose | Warnings, on-display | `border-rose-500/30`, `text-rose-400` |
| Cyan | Storage, neutral info | `border-cyan-500/30`, `text-cyan-400` |
| Purple | Loans, external items | `border-purple-500/30`, `text-purple-400` |

---

## Typography

- **Font**: Inter (`font-family: 'Inter', sans-serif`)
- **Base size**: `text-sm` (14px) for body
- **Small text**: `text-xs` (12px) for cards, buttons, metadata
- **Micro text**: `text-[10px]` or `text-[11px]` for labels, tags, timestamps
- **Headings**: `text-sm font-semibold` to `text-xl font-semibold`
- **Labels**: `text-[10px] font-medium uppercase tracking-widest text-muted-foreground`
- **Antialiasing**: Always use `antialiased` class on body

### Spacing System

- **Padding**: `p-2`, `p-3`, `p-4`, `p-5`, `p-6` (consistent increments)
- **Gaps**: `gap-1`, `gap-2`, `gap-3`, `gap-4`, `gap-6`
- **Border radius**: `rounded-md` (buttons), `rounded-lg` (panels), `rounded-xl` (cards)

---

## Component Patterns

### Cards (Collection/Role Cards)

```html
<div class="hover-trigger group relative bg-card border border-border rounded-xl overflow-hidden hover:border-indigo-500/30 hover:ring-1 hover:ring-indigo-500/30 transition-all duration-300 flex flex-col cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-indigo-900/10 animate-enter">
  <div class="relative aspect-[2/1] bg-secondary overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-90 z-10"></div>
    <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out opacity-60 group-hover:opacity-80">
    <!-- Badge top-left -->
    <div class="absolute top-2 left-2 z-20">
      <div class="flex items-center gap-1.5 px-2 py-1 bg-background/90 backdrop-blur-md rounded-md border border-indigo-500/30">
        <i data-lucide="icon" class="w-3 h-3 text-indigo-400"></i>
        <span class="text-[10px] font-medium text-indigo-200">Label</span>
      </div>
    </div>
    <!-- Title overlay -->
    <div class="absolute bottom-3 left-3 right-3 z-20">
      <h3 class="text-sm font-semibold text-foreground tracking-tight">Title</h3>
      <p class="text-[11px] text-muted-foreground truncate opacity-90">Subtitle</p>
    </div>
  </div>
  <div class="p-3 bg-card/50 flex-1">
    <!-- Card content -->
  </div>
</div>
```

### Buttons

```html
<!-- Primary (accent color - static) -->
<button class="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-500 px-3 py-1.5 rounded-md text-xs font-medium transition-all shadow-lg shadow-indigo-500/20">
  <i data-lucide="plus" class="w-3.5 h-3.5"></i>
  <span>Add Object</span>
</button>

<!-- Secondary (theme-aware) -->
<button class="py-2 px-3 bg-secondary hover:bg-muted text-foreground text-xs font-medium rounded-md transition-all border border-border">
  Label
</button>

<!-- Ghost (theme-aware) -->
<button class="text-xs text-muted-foreground hover:text-foreground transition-colors">
  Reset filters
</button>
```

### Dropdown Filters

```html
<button class="flex items-center gap-2 text-xs text-foreground bg-secondary border border-border px-3 py-1.5 rounded-md hover:border-input hover:bg-muted transition-all group shadow-sm">
  <i data-lucide="icon" class="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground"></i>
  <span>Label</span>
  <i data-lucide="chevron-down" class="w-3 h-3 text-muted-foreground ml-1"></i>
</button>
```

### Status Badges

```html
<!-- With dot indicator (accent colors are static) -->
<span class="flex items-center gap-2 text-xs">
  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
  On Display
</span>

<!-- Tag style (accent colors are static) -->
<span class="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-[10px] text-amber-200 font-medium">
  GR-2023-442
</span>

<!-- Neutral tag (theme-aware) -->
<span class="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] text-muted-foreground">
  Sculpture
</span>
```

### Sidebar Navigation

```html
<!-- Active item -->
<a class="flex items-center gap-2.5 px-3 py-1.5 text-xs text-foreground bg-muted/40 rounded-md border border-border shadow-sm">
  <i data-lucide="icon" class="w-4 h-4 text-indigo-400"></i>
  <span class="font-medium">Active Item</span>
</a>

<!-- Inactive item -->
<a class="flex items-center gap-2.5 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground rounded-md transition-all group">
  <i data-lucide="icon" class="w-4 h-4 group-hover:text-muted-foreground"></i>
  <span>Inactive Item</span>
</a>
```

### Panels & Containers

```html
<!-- Standard panel -->
<div class="bg-card border border-border rounded-lg p-4">
  <!-- Content -->
</div>

<!-- Glass panel (for overlays - uses custom class) -->
<div class="glass-panel border border-border/60 rounded-lg p-4">
  <!-- Content -->
</div>

<!-- Header bar -->
<header class="h-14 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
  <!-- Breadcrumb left, actions right -->
</header>

<!-- Filter bar -->
<div class="px-6 py-3 border-b border-border flex flex-wrap items-center justify-between gap-4 bg-background/50 backdrop-blur-sm">
  <!-- Filters left, sort right -->
</div>
```

---

## Animation Patterns

### Entry Animation (Staggered Cards)

```css
/* Already defined in globals.css */
.animate-enter {
  animation: enter 0.4s ease-out forwards;
  opacity: 0;
  transform: translateY(10px);
}
```

Use with `style="animation-delay: 0ms/100ms/200ms/300ms"` for stagger effect.

### Hover Reveal Pattern

```css
/* Already defined in globals.css */
.hover-trigger .hover-target { /* reveals child on parent hover */ }
```

### Standard Transitions

- Fast: `transition-colors` (instant feedback)
- Normal: `transition-all duration-200` (buttons, hovers)
- Slow: `transition-all duration-300` (cards, panels)
- Image zoom: `transition-transform duration-700 ease-out`

---

## Layout Patterns

### Three-Column Dashboard

- **Sidebar**: `w-64` (256px), fixed left
- **Main content**: `flex-1`, scrollable
- **Inspector panel**: `w-96` (384px), fixed right, hidden below 2xl

### Grid Layouts

```html
<!-- Card grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
  <!-- Cards -->
</div>

<!-- Feature cards (larger) -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <!-- Feature cards -->
</div>
```

---

## Icons

- **Library**: lucide-react (Lucide icons)
- **Default size**: `w-4 h-4` (navigation), `w-3.5 h-3.5` (buttons, badges)
- **Small**: `w-3 h-3` (inline with text)
- **Colors**: Use `text-muted-foreground` for default, accent colors for emphasis

---

## Best Practices

1. **Always use semantic color classes** (`bg-background`, `text-foreground`, etc.) for theme compatibility
2. **Reference design files** in `docs/design/aura-html-pages/` before implementing new pages
3. **Accent colors are static** - indigo, amber, emerald, etc. don't change between themes
4. **Use opacity on semantic colors**: `bg-card/50`, `border-border/60` for subtle variants
5. **Layer shadows for depth**: `shadow-lg hover:shadow-2xl hover:shadow-{accent}-900/10`
6. **Image overlays**: Use `bg-gradient-to-t from-background` for text readability
7. **Interactive states**: Border color + ring + shadow change on hover
8. **Avatar stacks**: Use negative margin `-space-x-2` with `ring-2 ring-background`
9. **Timestamps**: Right-aligned, `text-muted-foreground`, relative format ("Today, 09:42 AM")

---

## File Reference Quick Links

| Design | File |
|--------|------|
| Main dashboard | `docs/design/aura-html-pages/dasboard-as-admin.html` |
| Object detail | `docs/design/aura-html-pages/object.html` |
| Loans overview | `docs/design/aura-html-pages/loans-overview.html` |
| New record form | `docs/design/aura-html-pages/new-record.html` |
| Collection grid | `docs/design/aura-html-pages/collection.html` |
| Patron editing | `docs/design/aura-html-pages/edit-patron-*.html` |
| Location tracking | `docs/design/aura-html-pages/location-and-tracking.html` |
