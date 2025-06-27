# Creating Extension Icon

Since we can't generate images directly, here's how to create a simple icon for Ritalin:

## Option 1: Quick Text-Based Icon

1. Use any image editor (or online tool like Canva)
2. Create a 128x128 pixel canvas
3. Background: Dark gray (#1e1e1e)
4. Add text: "R" in a gaming/pixel font
5. Color: Bright blue or green (#00ff00 or #0099ff)
6. Save as `icon.png` in the `media` folder

## Option 2: Simple SVG Icon

Create `media/icon.svg`:

```svg
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="20" fill="#1e1e1e"/>
  <text x="64" y="85" font-family="monospace" font-size="72" font-weight="bold" 
        text-anchor="middle" fill="#00ff00">R</text>
  <text x="64" y="105" font-family="monospace" font-size="16" 
        text-anchor="middle" fill="#00ff00">focus</text>
</svg>
```

Then convert to PNG using an online converter.

## Option 3: Game Controller Icon

1. Find a free game controller icon (e.g., from Font Awesome or Feather Icons)
2. Modify colors to match theme
3. Add "R" overlay
4. Export as 128x128 PNG

## Requirements
- Exactly 128x128 pixels
- PNG format
- Works on both light and dark backgrounds
- Clear at small sizes 