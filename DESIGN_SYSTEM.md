# Chakou Trust - Design System

## Brand Identity

### Name: Chakou Trust
Swahili origin - "Chakou" means "each one" or "every single one", emphasizing inclusive community support.

### Tagline
*"Request Community Support - Together We Rise"*

## Design Philosophy

### Core Principles
1. **Minimal** - Remove clutter, focus on purpose
2. **Trustworthy** - Institutional, professional, reliable
3. **Accessible** - Easy for everyone to use
4. **Transparent** - Clear processes and results
5. **Community-Focused** - Human stories and impact

### Design Inspiration
- Stripe Dashboard (clean, modern, financial)
- Notion (minimal, organized, beautiful)
- Apple Developer Portal (premium, trusted)
- World Bank Digital Portals (institutional, clear)

## Color Palette

### Primary Colors

| Color | Hex Code | Usage | Psychology |
|-------|----------|-------|------------|
| Navy Blue | `#1a3a52` | Primary actions, headings, nav | Trust, stability, governance |
| Soft Green | `#2ecc71` | Success, growth, welfare | Growth, health, positive action |
| Accent Gold | `#d4af37` | Premium elements, highlights | Value, credibility, trust |

### Secondary Colors

| Color | Hex Code | Usage |
|-------|----------|-------|
| Light Gray | `#f8f9fa` | Backgrounds, sections |
| Border Gray | `#ecf0f1` | Dividers, borders |
| Text Dark | `#2c3e50` | Body text, content |
| White | `#ffffff` | Cards, main content areas |

### Status Colors

| Status | Color | Hex | Usage |
|--------|-------|-----|-------|
| Success | Green | `#27ae60` | Approved, completed |
| Warning | Orange | `#f39c12` | Pending, under review |
| Danger | Red | `#e74c3c` | Rejected, errors |
| Info | Blue | `#3498db` | Information, notes |

## Typography

### Typeface Selection

**Headings**: Georgia / Garamond serif
- Purpose: Institutional, elegant, trustworthy
- Weights: 600, 700
- Sizes: H1: 2.5rem, H2: 2rem, H3: 1.5rem, H4: 1.25rem, H5: 1.1rem, H6: 1rem

**Body Text**: Segoe UI / Roboto sans-serif
- Purpose: Modern, clean, readable
- Weight: 400 (normal), 500 (semi-bold), 600 (bold)
- Size: 0.95rem (14px) to 1.1rem (17.6px)
- Line height: 1.6

### Typography Hierarchy

```
H1: 2.5rem / 700 weight    - Page titles
H2: 2.0rem / 600 weight    - Section headings
H3: 1.5rem / 600 weight    - Subsection headings
H4: 1.25rem / 600 weight   - Card titles
H5: 1.1rem / 600 weight    - Small headings
H6: 1.0rem / 600 weight    - Mini headings
P:  0.95rem / 400 weight   - Body text
Small: 0.85rem / 400       - Help text, captions
```

## Layout & Spacing

### Spacing Scale
```
0.25rem (4px)  - Tiny
0.5rem  (8px)  - Extra small
1rem    (16px) - Small
1.5rem  (24px) - Medium
2rem    (32px) - Large
3rem    (48px) - Extra large
5rem    (80px) - Huge
```

### Container & Padding
- Max container width: 1200px
- Page padding: 3-5rem (top/bottom), 1-2rem (sides)
- Card padding: 1.5-2rem
- Form field padding: 0.75rem 1rem

### Border Radius
- Large cards/sections: 12px
- Standard cards: 8px
- Buttons: 6px
- Inputs: 6px
- Badges: 20px (fully rounded)

## Components

### Buttons

**Primary Button (Navy)**
```
Background: #1a3a52
Hover: #0f2a3f (darker)
Padding: 0.75rem 1.5rem
Border radius: 6px
Font weight: 500
```

**Success Button (Green)**
```
Background: #2ecc71
Hover: #27ae60 (darker)
Padding: 0.75rem 1.5rem
Border radius: 6px
Font weight: 500
```

**Outline Button**
```
Background: Transparent
Border: 1px solid var(--primary-navy)
Color: var(--primary-navy)
Hover: Background filled
```

### Cards

**Standard Card**
```
Border: None
Border radius: 12px
Box shadow: 0 2px 8px rgba(0,0,0,0.08)
Hover shadow: 0 8px 16px rgba(0,0,0,0.1)
Hover transform: translateY(-2px)
Padding: 1.5-2rem
Background: White
```

### Badges & Tags

**Status Badge**
```
Padding: 0.5rem 0.75rem
Border radius: 20px (pill shape)
Font size: 0.85rem
Font weight: 500
Display: inline-block
```

### Forms

**Input/Select**
```
Border: 1px solid #ecf0f1
Border radius: 6px
Padding: 0.75rem 1rem
Font size: 0.95rem
Focus border: var(--secondary-green)
Focus shadow: 0 0 0 0.2rem rgba(46,204,113,0.15)
```

**Labels**
```
Font weight: 500
Color: var(--text-dark)
Margin bottom: 0.5rem
Display: block
```

### Progress Indicators

**Step Indicator**
```
Completed: Green background (#27ae60)
Active: Green background (#2ecc71)
Pending: Light gray background (#ecf0f1)
Circle diameter: 50px
Font weight: 600
Label size: 0.85rem
```

**Timeline**
```
Bullet size: 16px
Bullet border: 3px white
Bullet shadow: 0 0 0 2px green
Completed: Green fill
Pending: Orange fill
Line: 2px solid
```

## Visual Elements

### Shadows

**Subtle** (most cards)
```
box-shadow: 0 2px 8px rgba(0,0,0,0.08)
```

**Medium** (on hover)
```
box-shadow: 0 8px 16px rgba(0,0,0,0.1)
```

**Strong** (modal-like)
```
box-shadow: 0 20px 25px rgba(0,0,0,0.15)
```

### Gradients

**Hero Section**
```
background: linear-gradient(135deg, #1a3a52 0%, #234565 100%)
```

### Icons
- Library: Bootstrap Icons 1.11.0
- Size: 1rem (default), 1.5rem (large), 2rem (xlarge)
- Color: Usually inherits or uses green (#2ecc71)

## Interactions & Animations

### Transitions
```
Default: 0.3s ease
Components: all 0.3s ease
Hover effects: 2px upward (translateY(-2px))
```

### Hover States
- **Buttons**: Darker shade, subtle lift
- **Cards**: Enhanced shadow, slight lift
- **Links**: Color change to green
- **Form inputs**: Green border on focus

## Responsive Design

### Breakpoints
```
Mobile: < 576px
Tablet: 576px - 992px
Desktop: 992px - 1200px
Large: > 1200px
```

### Mobile-First Approach
- Single column layout
- Full-width buttons and inputs
- Larger tap targets (48px minimum)
- Simplified navigation (hamburger menu)
- Stacked cards and sections

### Navigation
- **Desktop**: Horizontal menu in navbar
- **Mobile**: Hamburger menu (collapsible)
- **Sticky**: Navbar stays at top during scroll

## Accessibility

### Color Contrast
- Minimum WCAG AA (4.5:1 for text)
- Status not conveyed by color alone (use icons)

### Touch Targets
- Minimum 48x48px for interactive elements
- Extra padding on mobile

### Text
- Readable font sizes (minimum 16px on mobile)
- Sufficient line height (1.6)
- Descriptive link text (not "click here")
- Labels on form fields

### Keyboard Navigation
- Tab order follows visual flow
- Focus indicators visible
- Form submission on Enter key

## Dark Mode (Future)

For future implementation:
```
--primary-navy-dark: #0f2a3f
--bg-dark: #1a1a1a
--card-dark: #2a2a2a
--text-light: #e0e0e0
```

## Print Styles (Future)

For PDF/print functionality:
- Hide navigation and footer
- Adjust colors for print
- Ensure readability in grayscale
- Add page breaks for multi-page content

## Brand Assets

### Logo
- Heart icon in green + "Chakou Trust" text in navy
- Favicon: Heart icon
- Size variations: Full logo, icon-only, text-only

### Visual Elements
- Community figures illustration
- Book + plant icon
- Check marks for completed steps
- Timeline indicators

## Spacing Examples

### Page Layout
```
Top padding: 5rem
Section spacing: 3-5rem
Bottom padding: 3rem
Horizontal padding: 1-2rem
Container max-width: 1200px
```

### Card Layout
```
Card padding: 1.5-2rem
Row gap: 1rem
Column gap: 1rem
```

### Form Layout
```
Field spacing: 1rem
Row spacing: 1rem
Label margin: 0.5rem
Help text: 0.5rem above input
```

## Quality Standards

### Performance
- Page load < 3 seconds
- Time to Interactive < 4 seconds
- CSS bundle < 50KB (custom)

### Compatibility
- IE11+ (through polyfills)
- All modern browsers
- Mobile Safari, Chrome, Firefox
- Tablet support

### Testing
- Cross-browser testing
- Mobile device testing
- Accessibility audit
- Performance metrics

---

**Design System Version**: 1.0  
**Last Updated**: March 5, 2026  
**Status**: ✅ Complete & Ready for Implementation
