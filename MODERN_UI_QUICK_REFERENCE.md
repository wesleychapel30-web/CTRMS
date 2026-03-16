# CTRMS Modern UI - Quick Reference Card

## 🎨 Color Variables

```css
/* Usage in inline styles */
style="background-color: var(--primary); color: var(--foreground);"
```

### Primary Colors
- `--primary` - Main brand color (Indigo)
- `--primary-light` - Lighter variant
- `--primary-dark` - Darker variant
- `--secondary` - Secondary color
- `--accent` - Accent color (Pink)

### Semantic
- `--success` - Success/approve (Green)
- `--warning` - Warning/pending (Amber)
- `--destructive` - Error/delete (Red)
- `--info` - Information (Blue)

### UI Colors
- `--background` - Page background
- `--foreground` - Text color
- `--card` - Card background
- `--muted` - Disabled/secondary
- `--border` - Border color
- `--input` - Form input background

---

## 📦 Component Classes

### Layout
```html
<div class="app-layout">           <!-- Main container -->
<aside class="sidebar">             <!-- Navigation sidebar -->
<div class="sidebar.collapsed">     <!-- Toggle collapse -->
<header class="header">             <!-- Top bar -->
<main class="page-wrapper">         <!-- Content area -->
```

### Sidebar
```html
<a class="nav-link">                <!-- Navigation item -->
<a class="nav-link active">         <!-- Active nav item -->
<i class="nav-icon">                <!-- Icon in nav -->
<span class="nav-text">             <!-- Text in nav -->
```

### Cards
```html
<div class="card">                  <!-- Default card -->
<div class="card stat-card">        <!-- Stat card (primary) -->
<div class="card stat-card success"><!-- Stat card (green) -->
<div class="card stat-card warning"><!-- Stat card (amber) -->
<div class="card stat-card danger">  <!-- Stat card (red) -->

<div class="card-header">           <!-- Card title section -->
<div class="card-body">             <!-- Card content -->
<div class="card-footer">           <!-- Card footer -->
```

### Buttons
```html
<button class="btn">                <!-- Base button -->
<button class="btn btn-primary">    <!-- Primary -->
<button class="btn btn-secondary">  <!-- Secondary -->
<button class="btn btn-success">    <!-- Success (green) -->
<button class="btn btn-danger">     <!-- Danger (red) -->
<button class="btn btn-outline">    <!-- Outline style -->
<button class="btn btn-ghost">      <!-- Ghost style -->

<button class="btn btn-sm">         <!-- Small -->
<button class="btn btn-lg">         <!-- Large -->

<button class="icon-btn">           <!-- Square icon button -->
```

### Forms
```html
<div class="form-group">            <!-- Form field wrapper -->
<label>Label Text</label>           <!-- Form label -->
<input class="form-control">        <!-- Text input -->
<select class="form-select">        <!-- Dropdown -->
<textarea class="form-control">     <!-- Text area -->
```

### Text
```html
<p class="text-muted">              <!-- Secondary text -->
<p class="text-sm">                 <!-- Small text -->
<p class="text-lg">                 <!-- Large text -->
<p class="text-center">             <!-- Center text -->
<p class="text-right">              <!-- Right align text -->
```

### Grid
```html
<div class="grid grid-4">           <!-- 4-column auto-fit -->
<div class="grid grid-3">           <!-- 3-column auto-fit -->
<div class="grid grid-2">           <!-- 2-column auto-fit -->
```

### Flexbox
```html
<div class="flex">                  <!-- Flex container -->
<div class="flex-between">          <!-- Space-between -->
<div class="flex-center">           <!-- Center items -->
```

### Spacing
```html
<div class="gap-sm">                <!-- Small gap -->
<div class="gap-md">                <!-- Medium gap -->
<div class="gap-lg">                <!-- Large gap -->

<div class="mb-sm">                 <!-- Margin bottom -->
<div class="mb-md">
<div class="mb-lg">

<div class="mt-sm">                 <!-- Margin top -->
<div class="p-lg">                  <!-- Padding -->
```

---

## 🎯 Status Badges

### Inline Styles
```html
<!-- Pending - Blue -->
<span style="background-color: rgba(59, 130, 246, 0.1); 
             color: var(--info); border-radius: var(--radius-md);">
  Pending
</span>

<!-- Approved - Green -->
<span style="background-color: rgba(16, 185, 129, 0.1); 
             color: var(--success); border-radius: var(--radius-md);">
  Approved
</span>

<!-- Rejected - Red -->
<span style="background-color: rgba(239, 68, 68, 0.1); 
             color: var(--destructive); border-radius: var(--radius-md);">
  Rejected
</span>

<!-- Warning - Amber -->
<span style="background-color: rgba(245, 158, 11, 0.1); 
             color: var(--warning); border-radius: var(--radius-md);">
  Under Review
</span>
```

---

## 🔗 Bootstrap Icons Cheat Sheet

### Common Icons
```html
<!-- Navigation -->
<i class="bi bi-house-door"></i>        <!-- Home -->
<i class="bi bi-file-text"></i>         <!-- Document -->
<i class="bi bi-calendar"></i>          <!-- Calendar -->
<i class="bi bi-gear"></i>              <!-- Settings -->
<i class="bi bi-person"></i>            <!-- User -->

<!-- Status -->
<i class="bi bi-check-circle"></i>      <!-- Approved -->
<i class="bi bi-x-circle"></i>          <!-- Rejected -->
<i class="bi bi-exclamation-circle"></i><!-- Warning -->
<i class="bi bi-info-circle"></i>       <!-- Info -->

<!-- Actions -->
<i class="bi bi-plus-circle"></i>       <!-- Add -->
<i class="bi bi-pencil"></i>            <!-- Edit -->
<i class="bi bi-trash"></i>             <!-- Delete -->
<i class="bi bi-eye"></i>               <!-- View -->

<!-- Theme -->
<i class="bi bi-moon"></i>              <!-- Dark mode -->
<i class="bi bi-sun"></i>               <!-- Light mode -->
<i class="bi bi-bell"></i>              <!-- Notifications -->
<i class="bi bi-search"></i>            <!-- Search -->

<!-- Financial -->
<i class="bi bi-currency-dollar"></i>   <!-- Dollar -->
<i class="bi bi-bar-chart"></i>         <!-- Chart -->
<i class="bi bi-arrow-up"></i>          <!-- Up -->
<i class="bi bi-arrow-down"></i>        <!-- Down -->
```

---

## 🎨 Complete Example

```html
<!-- Page with sidebar layout -->
{% extends 'base-modern.html' %}

{% block content %}
<div style="display: flex; flex-direction: column; gap: var(--spacing-lg);">
  
  <!-- Page Header -->
  <div>
    <h1>Requests</h1>
    <p class="text-muted">Manage your requests and approvals</p>
  </div>
  
  <!-- Filter Card -->
  <div class="card">
    <div class="card-body">
      <div class="grid grid-3">
        <div class="form-group">
          <label>Status</label>
          <select class="form-select">
            <option>All</option>
            <option>Pending</option>
            <option>Approved</option>
          </select>
        </div>
        <div class="form-group">
          <label>Amount</label>
          <input type="number" class="form-control" placeholder="Min amount">
        </div>
        <div>
          <label>&nbsp;</label>
          <button class="btn btn-primary" style="width: 100%;">Filter</button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Stat Cards -->
  <div class="grid grid-4">
    <div class="card stat-card">
      <div class="card-body">
        <h4>Total Requests</h4>
        <p class="stat-value">42</p>
      </div>
    </div>
    <div class="card stat-card success">
      <div class="card-body">
        <h4>Approved</h4>
        <p class="stat-value" style="color: var(--success);">35</p>
      </div>
    </div>
  </div>
  
  <!-- Data Table Card -->
  <div class="card">
    <div class="card-header">
      <h3 style="margin: 0;">Recent Requests</h3>
    </div>
    <div class="card-body">
      <table style="width: 100%;">
        <thead>
          <tr style="border-bottom: 2px solid var(--border);">
            <th style="padding: var(--spacing-md); text-align: left; 
                       font-weight: 600;">ID</th>
            <th style="padding: var(--spacing-md); text-align: left; 
                       font-weight: 600;">Applicant</th>
            <th style="padding: var(--spacing-md); text-align: right; 
                       font-weight: 600;">Amount</th>
            <th style="padding: var(--spacing-md); text-align: center; 
                       font-weight: 600;">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: var(--spacing-md); 
                       color: var(--primary); font-weight: 600;">REQ-001</td>
            <td style="padding: var(--spacing-md);">John Doe</td>
            <td style="padding: var(--spacing-md); text-align: right; 
                       font-weight: 600;">$5,000</td>
            <td style="padding: var(--spacing-md); text-align: center;">
              <span style="background: rgba(16, 185, 129, 0.1); 
                           color: var(--success); padding: 0.25rem 0.75rem; 
                           border-radius: var(--radius-md); font-size: 0.875rem;">
                Approved
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  
  <!-- Action Buttons -->
  <div style="display: flex; gap: var(--spacing-md);">
    <button class="btn btn-primary">
      <i class="bi bi-plus-circle"></i>
      New Request
    </button>
    <button class="btn btn-outline">
      <i class="bi bi-download"></i>
      Export
    </button>
  </div>
  
</div>
{% endblock %}
```

---

## 📐 Spacing Reference

```
xs:  0.25rem  (4px)
sm:  0.5rem   (8px)
md:  1rem     (16px)   ← Most common
lg:  1.5rem   (24px)   ← Cards, sections
xl:  2rem     (32px)
2xl: 3rem     (48px)   ← Page margins
```

---

## 🎥 Common Patterns

### Card with Header & Action
```html
<div class="card">
  <div class="card-header" style="display: flex; justify-content: space-between;">
    <h3 style="margin: 0;">Title</h3>
    <button class="btn btn-sm btn-ghost">
      <i class="bi bi-three-dots-vertical"></i>
    </button>
  </div>
  <div class="card-body">Content</div>
</div>
```

### Stat Card with Icon
```html
<div class="card stat-card success">
  <div class="card-body">
    <div class="stat-content">
      <div class="stat-info">
        <h4>Label</h4>
        <p class="stat-value" style="color: var(--success);">123</p>
      </div>
      <div class="stat-icon" style="color: var(--success);">
        <i class="bi bi-check-circle"></i>
      </div>
    </div>
  </div>
</div>
```

### Empty State
```html
<div class="card">
  <div class="card-body" style="text-align: center; padding: var(--spacing-2xl);">
    <i class="bi bi-inbox" style="font-size: 3rem; opacity: 0.5;"></i>
    <p style="margin-top: var(--spacing-lg); color: var(--muted-foreground);">
      No items found
    </p>
    <button class="btn btn-primary" style="margin-top: var(--spacing-lg);">
      Create One
    </button>
  </div>
</div>
```

---

## 🔧 Theme Toggle

The theme toggle is built into the header. Users can click it to switch between light and dark modes. The preference is saved automatically to localStorage.

---

## 📱 Responsive Breakpoints

```css
< 640px  - Mobile phones
640px    - Tablets
768px    - iPad
992px    - Desktop sidebar appears
1200px   - Large desktop
```

---

## ✅ Common Tasks

### Create a dropdown
```html
<select class="form-select">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

### Create a button group
```html
<div style="display: flex; gap: var(--spacing-sm);">
  <button class="btn btn-primary">Save</button>
  <button class="btn btn-outline">Cancel</button>
</div>
```

### Create a grid
```html
<div class="grid grid-3">
  <div class="card">Item 1</div>
  <div class="card">Item 2</div>
  <div class="card">Item 3</div>
</div>
```

### Show loading state
```html
<button class="btn btn-primary" disabled>
  <i class="bi bi-hourglass-split"></i>
  Loading...
</button>
```

---

**Print this card for quick reference while developing!**

Version: 1.0 | Last Updated: March 6, 2026
