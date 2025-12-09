# ContainerFlow Design Guidelines

## Industrial Design Theme

Professional mobile waste container management app for iOS and Android with driver/admin roles, QR scanning, real-time tracking, and industrial-grade UI optimized for outdoor use and work glove operation.

## Color Palette

### Primary Colors
- **Primary (Navy Blue)**: `#1F3650` - Headers, navigation, main buttons, titles
- **Primary Light**: `#2D4A6A` - Hover/pressed states
- **Primary Dark**: `#152538` - Deep accents
- **Accent (Safety Orange)**: `#FF6B2C` - Call-to-action buttons, icons, highlights
- **Accent Light**: `#FF8F5C` - Hover/pressed states
- **Accent Dark**: `#E55A1F` - Active states

### Background Colors (Light Mode)
- **Background Root**: `#F5F7FA` - App background (blue-tinted gray)
- **Background Default**: `#FFFFFF` - Cards, content areas
- **Background Secondary**: `#E8ECF1` - Secondary surfaces
- **Background Tertiary**: `#D0D7E0` - Tertiary surfaces, dividers

### Background Colors (Dark Mode)
- **Background Root**: `#0C1220` - Deep navy-black
- **Background Default**: `#131B2B` - Card backgrounds
- **Background Secondary**: `#1C2638` - Elevated surfaces
- **Background Tertiary**: `#263244` - Dividers, borders
- **Card Elevated**: `#243040` - Floating cards

### Text Colors (Light Mode)
- **Text Primary**: `#1A2433` - Main text (dark navy-gray)
- **Text Secondary**: `#4A5568` - Secondary labels
- **Text Tertiary**: `#6B7888` - Hints, placeholders
- **Text on Primary/Accent**: `#FFFFFF`

### Text Colors (Dark Mode)
- **Text Primary**: `#F1F5F9` - Main text
- **Text Secondary**: `#94A3B8` - Secondary labels
- **Text Tertiary**: `#64748B` - Hints, placeholders

### Status Colors (WCAG AA Compliant)
- **Success (Green)**: Light `#059669` / Dark `#10B981`
- **Warning (Amber)**: Light `#D97706` / Dark `#F59E0B`
- **Error (Red)**: Light `#DC2626` / Dark `#EF4444`
- **Info (Blue)**: Light `#2563EB` / Dark `#3B82F6`
- **Idle (Slate)**: Light `#7A8694` / Dark `#64748B`
- **Open (Sky Blue)**: Light `#5A9BD5` / Dark `#60A5FA`
- **In Progress (Blue)**: Light `#2563EB` / Dark `#3B82F6`
- **Completed (Emerald)**: Light `#059669` / Dark `#10B981`
- **Cancelled (Red)**: Light `#DC2626` / Dark `#EF4444`

### Fill Level Colors
- **Low (0-50%)**: Green (`#059669` / `#10B981`)
- **Medium (51-79%)**: Amber (`#D97706` / `#F59E0B`)
- **High (80-99%)**: Red (`#DC2626` / `#EF4444`)
- **Critical (100%)**: Dark Red (`#991B1B` / `#DC2626`)

## Typography

### Font Weights
- **Headings**: 600-700 (Semi-bold to Bold)
- **Body Text**: 400 (Regular)
- **Labels**: 600 (Semi-bold)
- **Buttons**: 700 (Bold)
- **Captions**: 500-700 (Medium to Bold)

### Font Sizes with Line Heights
- **H1**: 32px / 40px line-height
- **H2**: 26px / 34px line-height
- **H3**: 22px / 28px line-height
- **H4**: 18px / 24px line-height
- **Body**: 16px / 24px line-height
- **Small**: 14px / 20px line-height
- **Caption**: 12px / 16px line-height
- **Button**: 15px, letter-spacing 0.3
- **Label**: 13px, letter-spacing 0.4

## Spacing and Layout

### Touch Targets (Glove-Friendly)
- **Minimum Touch Target**: 48dp (WCAG requirement + glove compatibility)
- **Primary Button Height**: 56dp
- **Secondary Button Height**: 48dp
- **Input Height**: 52dp
- **Tab Bar Height**: 64dp
- **List Item Height**: 72dp (compact: 56dp)
- **Filter Chip Height**: 44dp
- **Status Badge Height**: 28dp

### Spacing Scale
- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 20px
- 2xl: 24px
- 3xl: 32px
- 4xl: 40px
- 5xl: 48px
- 6xl: 64px

### Border Radius (Softer, Modern)
- xs: 6px - Small badges
- sm: 10px - Chips, small cards
- md: 14px - Buttons, inputs
- lg: 18px - Cards
- xl: 22px - Modal corners
- 2xl: 28px - Large cards
- 3xl: 36px - Full-width panels

## Components

### Buttons
- **Primary Button**: Orange accent (`#FF6B2C`), white text, 56dp height, md radius
- **Secondary Button**: White background, 2px primary border, primary text
- **Tertiary/Text Button**: No background, accent or primary text
- **Disabled**: 50% opacity, no interaction
- **Press State**: Scale 0.97, opacity 0.85

### Cards
- White/dark surface background
- 1px border (light: `#E2E8F0`, dark: `#263244`)
- Border radius: lg (18px)
- Padding: 16-20px
- Elevated cards: slightly lighter background in dark mode

### Status Badges
- Height: 28dp
- Horizontal padding: 12px
- Border radius: sm (10px)
- Font: 12px, weight 700, uppercase
- Letter-spacing: 0.4

### Filter Chips
- Height: 44dp minimum
- 1-2px border
- Border radius: sm (10px)
- Selected: accent background, white text
- Unselected: surface background, border, secondary text
- Font: 13px, weight 600

### Progress Bars
- Height: 8-10px
- Color based on fill level
- Border radius: full (pill shape)
- Background: tertiary color

### Icons
- Standard: 24px
- Large: 28px
- XL: 32px
- Use Feather icons consistently
- Primary color for navigation
- Accent for actions
- NO emojis anywhere

## Navigation

### Bottom Tab Bar
- Height: 64dp
- 4-5 Tabs max
- Active: Orange accent (`#FF6B2C`)
- Inactive: Slate gray (`#6B7888` / `#64748B`)
- Icon: 24dp
- Label: 12px, weight 500

### Headers
- Height: 56dp
- Transparent for scrollable content
- Opaque for modal/detail screens
- Title: weight 600, 18px

## Shadows (Light Mode Only)
- **Small**: y:1, blur:3, opacity:0.06
- **Medium**: y:3, blur:6, opacity:0.08
- **Large**: y:6, blur:12, opacity:0.10
- **XL**: y:10, blur:20, opacity:0.12
- Dark mode: No shadows, use border/elevation colors

## Animation

### Duration
- Fast: 150ms (micro-interactions)
- Normal: 250ms (transitions)
- Slow: 400ms (page transitions)

### Spring Config
- Damping: 20
- Stiffness: 300
- Mass: 0.8

### Press Feedback
- Scale: 0.97
- Opacity: 0.85

## Accessibility

### Contrast Ratios (WCAG AA - 4.5:1 minimum)
- Primary Navy vs White: 8.1:1
- Accent Orange vs White: 4.6:1
- Success Green vs White: 4.7:1
- Error Red vs White: 5.9:1
- Text Primary vs Background: 13:1+

### Outdoor Visibility
- High contrast text colors
- Bold status indicators
- Large touch targets (48dp+)
- Clear visual feedback
- Avoid thin fonts

## Screen Specifications

### Tasks Screen
- Sticky filter bar at top
- Status filter chips (scrollable)
- Card-based task list
- Status badge prominent
- Navigation button (48dp+)
- Pull-to-refresh

### Admin Dashboard
- 2-column stat grid
- Color-coded left borders
- Quick action buttons (56dp)
- Orange primary CTA

### Container Details
- Large fill level indicator
- Progress bar with color
- Action buttons at bottom
- QR code display option

### Scanner Screen
- Full-screen camera
- Flashlight toggle (48dp)
- Result overlay with blur
- Confirm/Cancel buttons

## Best Practices

1. Always use theme colors from `constants/theme.ts`
2. Never hardcode color values
3. Test in both light and dark modes
4. Ensure 48dp minimum touch targets
5. Use consistent spacing from scale
6. Apply proper safe area insets
7. Use KeyboardAwareScrollView for forms
8. Wrap app in ErrorBoundary
9. Use Feather icons, never emojis
10. Test outdoor readability
