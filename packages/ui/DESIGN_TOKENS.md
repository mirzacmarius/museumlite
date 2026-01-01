# MuseumLite Design System Tokens

Reference design: `aura-html-pages/dasboard-as-admin.html`

## Color Palette

### Base Colors (Zinc Scale)

| Token | Tailwind Class | Usage |
|-------|----------------|-------|
| Background | `bg-zinc-950` | Page background, sidebars |
| Card | `bg-zinc-900/40` | Card backgrounds, panels |
| Surface | `bg-zinc-900` | Inputs, hover states |
| Border | `border-zinc-800/60` | Card borders, dividers |
| Border Subtle | `border-zinc-800` | Secondary borders |
| Text Primary | `text-white` | Headings, emphasized text |
| Text Secondary | `text-zinc-200` | Card titles, important text |
| Text Body | `text-zinc-400` | Body text, descriptions |
| Text Muted | `text-zinc-500` | Labels, timestamps |
| Text Subtle | `text-zinc-600` | Disabled, hints |

### Accent Colors

Each accent has a consistent pattern for borders, text, and backgrounds:

| Color | Border | Text | Background |
|-------|--------|------|------------|
| Indigo | `border-indigo-500/30` | `text-indigo-400` | `bg-indigo-500/20` |
| Amber | `border-amber-500/30` | `text-amber-400` | `bg-amber-500/20` |
| Emerald | `border-emerald-500/30` | `text-emerald-400` | `bg-emerald-500/20` |
| Rose | `border-rose-500/30` | `text-rose-400` | `bg-rose-500/20` |
| Cyan | `border-cyan-500/30` | `text-cyan-400` | `bg-cyan-500/20` |
| Purple | `border-purple-500/30` | `text-purple-400` | `bg-purple-500/20` |
| Blue | `border-blue-500/30` | `text-blue-400` | `bg-blue-500/20` |

### Status Colors

| Status | Dot | Badge Border | Badge Text |
|--------|-----|--------------|------------|
| Active/Display | `bg-emerald-500` | `border-emerald-500/30` | `text-emerald-200` |
| Warning/Storage | `bg-amber-500` | `border-amber-500/30` | `text-amber-200` |
| Loaned | `bg-purple-500` | `border-purple-500/30` | `text-purple-200` |
| Conservation | `bg-rose-500` | `border-rose-500/30` | `text-rose-200` |
| Info | `bg-cyan-500` | `border-cyan-500/30` | `text-cyan-200` |

## Typography

### Font Stack

```
font-family: 'Inter', -apple-system, system-ui, sans-serif
```

### Scale

| Element | Classes |
|---------|---------|
| Page Title | `text-xl font-semibold text-white tracking-tight` |
| Card Title | `text-sm font-semibold text-white tracking-tight` |
| Section Label | `text-[10px] font-medium text-zinc-500 uppercase tracking-widest` |
| Body | `text-xs text-zinc-400` |
| Small | `text-[11px] text-zinc-500` |
| Tiny | `text-[10px] text-zinc-600` |

## Spacing

| Context | Value |
|---------|-------|
| Card Padding | `p-3` |
| Section Gap | `gap-6` |
| Item Gap | `gap-4` |
| Tight Gap | `gap-2` |
| Border Radius | `rounded-xl` (cards), `rounded-lg` (panels), `rounded-md` (buttons/inputs) |

## Effects

### Glass Panel

```css
.glass-panel {
  background: rgba(24, 24, 27, 0.7);
  backdrop-filter: blur(12px);
}
```

Usage: `glass-panel` utility class

### Shadows

| Element | Classes |
|---------|---------|
| Card Default | `shadow-lg` |
| Card Hover | `shadow-2xl shadow-{color}-900/10` |
| Button Primary | `shadow-lg shadow-indigo-500/20` |

### Hover Effects

Card hover pattern:
```
hover:border-{accent}-500/30 hover:ring-1 hover:ring-{accent}-500/30
```

Image scale on hover:
```
group-hover:scale-105 transition-transform duration-700
```

## Animations

### Enter Animation

```css
.animate-enter {
  animation: enter 0.4s ease-out forwards;
  opacity: 0;
  transform: translateY(10px);
}
```

With staggered delays: `delay-0`, `delay-100`, `delay-200`, `delay-300`, `delay-400`, `delay-500`

### Hover Target

For revealing elements on hover:
```html
<div class="hover-trigger group">
  <div class="hover-target">Revealed on hover</div>
</div>
```

## Component Patterns

### Status Badge

```html
<div class="flex items-center gap-1.5 px-2 py-1 bg-zinc-950/90 backdrop-blur-md 
            rounded-md border border-amber-500/30 shadow-sm">
  <Icon class="w-3 h-3 text-amber-400" />
  <span class="text-[10px] font-medium text-amber-200">Label</span>
</div>
```

### Card Structure

```html
<div class="hover-trigger group relative bg-zinc-900/40 border border-zinc-800/60 
            rounded-xl overflow-hidden hover:border-{accent}-500/30 
            hover:ring-1 hover:ring-{accent}-500/30 transition-all duration-300 
            cursor-pointer shadow-lg hover:shadow-2xl animate-enter">
  <!-- Image with gradient overlay -->
  <div class="relative aspect-[2/1] bg-zinc-900 overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent 
                to-transparent opacity-90 z-10"></div>
    <img class="w-full h-full object-cover group-hover:scale-105 
                transition-transform duration-700 opacity-60 group-hover:opacity-80" />
    <!-- Badges positioned absolutely -->
  </div>
  <!-- Content -->
  <div class="p-3 bg-zinc-900/20">
    <!-- Card body -->
  </div>
</div>
```

### Filter Button

```html
<button class="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900 
               border border-zinc-800 px-3 py-1.5 rounded-md 
               hover:border-zinc-700 hover:bg-zinc-800/80 transition-all shadow-sm">
  <Icon class="w-3.5 h-3.5 text-zinc-500" />
  <span>Label</span>
  <ChevronDown class="w-3 h-3 text-zinc-600 ml-1" />
</button>
```

### Primary Button

```html
<button class="flex items-center gap-2 bg-indigo-600 text-white 
               hover:bg-indigo-500 border border-indigo-500 
               px-3 py-1.5 rounded-md text-xs font-medium 
               transition-all shadow-lg shadow-indigo-500/20">
  <Plus class="w-3.5 h-3.5" />
  <span>Add Object</span>
</button>
```

## Sidebar Patterns

### Section Header

```html
<div class="px-2 pb-2 text-[10px] font-medium text-zinc-500 
            uppercase tracking-widest">
  Section Name
</div>
```

### Active Nav Item

```html
<a class="flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-200 
          bg-zinc-800/40 rounded-md border border-zinc-800/60 shadow-sm">
  <Icon class="w-4 h-4 text-indigo-400" />
  <span class="font-medium">Item Name</span>
</a>
```

### Inactive Nav Item

```html
<a class="flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-400 
          hover:bg-zinc-900/50 hover:text-zinc-200 rounded-md transition-all group">
  <Icon class="w-4 h-4 group-hover:text-zinc-400 transition-colors" />
  <span>Item Name</span>
</a>
```
