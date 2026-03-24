# Implementation Plan: UI Polish Audit Fixes

## Task Type
- [x] Frontend
- [ ] Backend
- [ ] Fullstack

## Summary

Apply "make interfaces feel better" design principles to the ETF IQ frontend. All changes are CSS/Tailwind-only — no logic changes, no new dependencies, no motion library needed.

## Technical Solution

10 targeted fixes across global CSS, the shadcn `ui/` component library, and 3 feature components. Every fix maps to a specific design principle from the audit. Changes are ordered so each step is independently shippable.

---

## Implementation Steps

### Step 1: Global CSS — text-wrap + typography polish
**Deliverable**: Headings use `text-wrap: balance`, body text uses `text-wrap: pretty`

**File**: `frontend/src/index.css`

Add to the existing `h1, h2, h3, h4, h5, h6` rule:
```css
h1, h2, h3, h4, h5, h6 {
  font-family: 'Cormorant Garamond', serif;
  text-wrap: balance;    /* NEW — prevents orphaned words */
}

p {
  text-wrap: pretty;     /* NEW — avoids widows on body text */
}
```

### Step 2: Button — scale on press + transition specificity
**Deliverable**: All buttons have tactile `scale(0.96)` on press; `transition-colors` remains (already correct), add `scale` to the transition

**File**: `frontend/src/components/ui/button.tsx` (line 7)

Replace the base CVA string:
```
OLD: "... transition-colors ..."
NEW: "... transition-[color,background-color,border-color,scale] duration-150 ease-out active:scale-[0.96] ..."
```

The key change: `transition-colors` → `transition-[color,background-color,border-color,scale]` and add `active:scale-[0.96]`.

### Step 3: Card — shadows instead of side borders
**Deliverable**: Cards use layered `box-shadow` for depth (dark mode), keep gold top accent border

**File**: `frontend/src/components/ui/card.tsx` (line 5)

Replace:
```
OLD: "rounded-xl border border-border border-t-2 border-t-primary/30 bg-card text-card-foreground shadow"
NEW: "rounded-xl border-t-2 border-t-primary/30 bg-card text-card-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_1px_3px_rgba(0,0,0,0.3),0_2px_6px_rgba(0,0,0,0.15)]"
```

Changes:
- Remove `border border-border` (side/bottom borders)
- Remove `shadow` (generic Tailwind shadow)
- Add layered dark-mode-friendly `box-shadow` (1px inset ring + two soft depth layers)
- Keep `border-t-2 border-t-primary/30` gold accent

### Step 4: Tabular numbers on dashboard metrics
**Deliverable**: Portfolio value, P&L, confidence scores don't shift layout on update

**File**: `frontend/src/components/dashboard/health-summary.tsx`

Add `tabular-nums` class to three elements:
- Line 67: `<p className="text-2xl font-bold">` → `<p className="text-2xl font-bold tabular-nums">`
- Line 84: `<p className={...text-lg font-semibold...}>` → add `tabular-nums` to the className
- Line 100: `<span>` for agent score → add `tabular-nums`

### Step 5: Fix `transition-all` — sidebar
**Deliverable**: Sidebar only transitions `width`, not every CSS property

**File**: `frontend/src/components/layout/sidebar.tsx` (line 40)

Replace:
```
OLD: "... transition-all duration-200 ..."
NEW: "... transition-[width] duration-200 ..."
```

### Step 6: Fix `transition-all` — chatbot FAB
**Deliverable**: Chat toggle button transitions only what changes

**File**: `frontend/src/components/layout/chatbot-bar.tsx` (line 77)

Replace:
```
OLD: "... transition-all duration-200"
NEW: "... transition-[transform,background-color,box-shadow] duration-200"
```

### Step 7: Fix `transition-all` — tabs + toggle group
**Deliverable**: Tab triggers transition only `color` and `border-color`

**File**: `frontend/src/components/ui/tabs.tsx` (line 16)

Replace:
```
OLD: "... transition-all ..."
NEW: "... transition-colors ..."
```

**File**: `frontend/src/components/ui/toggle-group.tsx` (line 14)

Replace:
```
OLD: "... transition-all ..."
NEW: "... transition-colors ..."
```

### Step 8: Fix `transition-all` — quick actions + progress stepper
**Deliverable**: Quick action cards and stepper circles use specific transitions

**File**: `frontend/src/components/dashboard/quick-actions.tsx` (line 20)

Replace:
```
OLD: "... transition-all duration-200"
NEW: "... transition-[border-color,background-color] duration-200"
```

**File**: `frontend/src/components/onboarding/progress-stepper.tsx` (line 31)

Replace:
```
OLD: "... transition-all duration-300"
NEW: "... transition-[background-color,border-color,color] duration-300"
```

### Step 9: Fix `transition-all` — sheet component
**Deliverable**: Sheet panel transitions only transform

**File**: `frontend/src/components/ui/sheet.tsx` (line 46)

Replace:
```
OLD: "... transition ease-in-out duration-300"
NEW: "... transition-transform ease-in-out duration-300"
```

### Step 10: Dialog/Sheet close button hit area
**Deliverable**: Close buttons have 40x40px hit area

**File**: `frontend/src/components/ui/dialog.tsx` (line 41)

Replace:
```
OLD: "absolute right-4 top-4 rounded-sm opacity-70 ..."
NEW: "absolute right-4 top-4 rounded-sm opacity-70 p-2 -m-2 ..."
```

**File**: `frontend/src/components/ui/sheet.tsx` (line 54)

Same change:
```
OLD: "absolute right-4 top-4 rounded-sm opacity-70 ..."
NEW: "absolute right-4 top-4 rounded-sm opacity-70 p-2 -m-2 ..."
```

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `frontend/src/index.css` | Modify L88-90 | Add `text-wrap: balance` to headings, new `p { text-wrap: pretty }` |
| `frontend/src/components/ui/button.tsx` | Modify L7 | Add `active:scale-[0.96]`, specific transition properties |
| `frontend/src/components/ui/card.tsx` | Modify L5 | Replace border with layered box-shadow |
| `frontend/src/components/dashboard/health-summary.tsx` | Modify L67,84,100 | Add `tabular-nums` to dynamic numbers |
| `frontend/src/components/layout/sidebar.tsx` | Modify L40 | `transition-all` → `transition-[width]` |
| `frontend/src/components/layout/chatbot-bar.tsx` | Modify L77 | `transition-all` → specific properties |
| `frontend/src/components/ui/tabs.tsx` | Modify L16 | `transition-all` → `transition-colors` |
| `frontend/src/components/ui/toggle-group.tsx` | Modify L14 | `transition-all` → `transition-colors` |
| `frontend/src/components/dashboard/quick-actions.tsx` | Modify L20 | `transition-all` → specific properties |
| `frontend/src/components/onboarding/progress-stepper.tsx` | Modify L31 | `transition-all` → specific properties |
| `frontend/src/components/ui/sheet.tsx` | Modify L46,54 | `transition` → `transition-transform`, close btn hit area |
| `frontend/src/components/ui/dialog.tsx` | Modify L41 | Close button hit area expansion |

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Card shadow looks off in light mode | The `rgba(255,255,255,0.06)` ring is dark-mode-tuned; light mode may need a separate shadow. Verify in both themes and add `html.light` override if needed. |
| `text-wrap: balance` on Cormorant Garamond serif may produce odd line breaks on very long titles | Only affects headings (6-line limit in Chrome). Verify on dashboard and analysis pages. |
| `active:scale-[0.96]` on `asChild` buttons (e.g., Link wrappers) may not fire `:active` | Test Radix `Slot`-based buttons. If needed, gate scale behind `not-[data-asChild]`. |
| Removing card borders may reduce contrast in light mode | Keep gold top border; shadow ring provides 1px visual boundary. Test light mode explicitly. |

## Not Included (future improvements)

- Chat bubble animation could add `filter: blur(4px)` entrance — deferred (requires CSS keyframe edit)
- Sidebar collapse label cross-fade — deferred (needs CSS cross-fade pattern, more complex)
- Image outlines on avatars/logos — deferred (need to audit all `<img>` usages)
- Concentric border radius audit — deferred (no critical violations found)

## SESSION_ID
- CODEX_SESSION: N/A (codeagent-wrapper not available)
- GEMINI_SESSION: N/A (codeagent-wrapper not available)
