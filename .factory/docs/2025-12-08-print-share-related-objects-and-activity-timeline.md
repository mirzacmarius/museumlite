## Implementation Plan

### 1. Print Button - Print Preview Modal

**File:** `page.tsx`

- Add state for print modal: `const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)`
- Create `PrintPreviewModal` component with:
  - Full-width dialog with print-optimized layout
  - Object title, accession number, images grid
  - Key metadata (dimensions, materials, provenance summary)
  - Print button that calls `window.print()` with print-specific CSS
  - Uses `@media print` styles for clean output

```tsx
<Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
  <DialogContent className="max-w-4xl print:shadow-none">
    {/* Print-optimized object summary */}
  </DialogContent>
</Dialog>
```

### 2. Share Button - Dropdown Menu

**File:** `page.tsx`

Replace single Share button with DropdownMenu containing:

| Action | Icon | Description |
|--------|------|-------------|
| Copy Link | `Link2` | Copies object URL to clipboard |
| Export to PDF | `FileDown` | Generate PDF report (placeholder) |
| Request Loan | `Send` | Museum loan request workflow |

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <Share2 className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={copyLink}>
      <Link2 /> Copy Object Link
    </DropdownMenuItem>
    <DropdownMenuItem>
      <FileDown /> Export to PDF
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>
      <Send /> Request Loan
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### 3. Related Objects - Thumbnail Enhancement

**File:** `record-context-sidebar.tsx`

- Use existing `getChildObjects` query (already returns `thumbnailUrl`)
- Use `getParentObjectWithThumbnail` instead of `getParentObject`
- Update UI to show Avatar with thumbnail, matching parent/siblings pill design:

```tsx
<Link className="group flex items-center gap-2 rounded-full border border-border bg-background/50 py-1 pl-1 pr-3 transition-all hover:border-accent hover:bg-accent/5">
  <Avatar className="h-8 w-8 ring-1 ring-border">
    <AvatarImage src={obj.thumbnailUrl} />
    <AvatarFallback><ImageOff /></AvatarFallback>
  </Avatar>
  <div>
    <p className="text-xs font-medium">{truncateTitle(obj.title)}</p>
    <p className="text-[10px] text-accent">{obj.relationship}</p>
  </div>
</Link>
```

### 4. Recent Activity - Internal Procedures Timeline

**File:** `record-context-sidebar.tsx`

Enhance timeline with styled activity items per the HTML design:

- First item: Accent dot (`bg-accent`) with ring
- Other items: Muted dot (`bg-muted-foreground/50`) with hover effect
- Action descriptions with highlighted targets
- Relative timestamps with user attribution

```tsx
<div className="relative space-y-6 border-l border-border/60 pl-3">
  {activities.map((activity, index) => (
    <div key={activity._id} className="group relative">
      <div className={cn(
        "absolute -left-[17px] top-1 h-2 w-2 rounded-full ring-4 ring-background transition-colors",
        index === 0 
          ? "bg-accent" 
          : "bg-muted-foreground/50 group-hover:bg-muted-foreground"
      )} />
      <div>
        <p className="text-[11px] text-muted-foreground">
          {activity.action}
          {activity.target && (
            <span className="text-foreground"> {activity.target}</span>
          )}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {formatRelativeTime(activity.timestamp)}
          {activity.userName && ` • ${activity.userName}`}
        </p>
      </div>
    </div>
  ))}
</div>
```

### Files to Modify

1. **`page.tsx`** - Print modal + Share dropdown
2. **`record-context-sidebar.tsx`** - Related objects thumbnails + Activity timeline styling

### New Imports Required

- `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`, `DropdownMenuSeparator`
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
- `Avatar`, `AvatarImage`, `AvatarFallback`
- `Link2`, `FileDown`, `Send` from lucide-react