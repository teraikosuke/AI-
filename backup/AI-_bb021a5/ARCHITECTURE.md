# Dashboard Architecture Documentation

## Overview
Complete modular ES6+ architecture with hash-based routing, component system, and comprehensive type safety.

## Directory Structure
```
AI-/
├── index.html              # Application shell with navigation
├── components/             # Reusable UI components
│   ├── DateRangePicker.js
│   ├── SearchFilter.js
│   ├── SortableTable.js
│   ├── Pagination.js
│   ├── components.css
│   └── index.js
├── pages/                  # Route-specific pages
│   ├── yield/
│   │   ├── index.html
│   │   ├── yield.js
│   │   └── yield.css
│   ├── candidates/
│   │   ├── index.html
│   │   └── candidates.js
│   ├── ad-performance/
│   │   ├── index.html
│   │   └── ad-performance.js
│   ├── teleapo/
│   │   ├── index.html
│   │   └── teleapo.js
│   └── referral/
│       ├── index.html
│       └── referral.js
├── scripts/                # Core application logic
│   ├── router.js          # Hash-based routing
│   ├── api/               # API layer
│   │   ├── client.js      # HTTP client
│   │   ├── repositories/
│   │   │   └── kpi.js     # KPI data repository
│   │   └── index.js       # Repository factory
│   └── types/             # Type definitions
│       └── index.js       # Type system with validation
└── styles/                # Modular CSS architecture
    ├── tokens.css         # CSS variables
    ├── base.css          # Base styles
    └── utilities.css     # Utility classes
```

## Key Features

### 1. Hash-Based Router (`scripts/router.js`)
- Dynamic ES module imports
- Page-specific CSS loading
- Mount/unmount lifecycle
- Navigation state management

### 2. Component System (`components/`)
- Reusable UI components
- Factory pattern for initialization
- CSS encapsulation
- Event handling and cleanup

### 3. API Layer (`scripts/api/`)
- Repository pattern
- HTTP client with retry logic
- Caching with TTL
- Mock data fallback

### 4. Type System (`scripts/types/`)
- JSDoc type definitions
- Runtime validation
- Type casting utilities
- Error handling

### 5. Modular CSS (`styles/`)
- CSS custom properties (tokens)
- Base styling layer
- Utility classes
- Page-specific CSS loaded dynamically

## Router Navigation

### Route Configuration
```javascript
const routes = {
  '/': () => import('../pages/yield/yield.js'),
  '/yield': () => import('../pages/yield/yield.js'),
  '/candidates': () => import('../pages/candidates/candidates.js'),
  '/ad-performance': () => import('../pages/ad-performance/ad-performance.js'),
  '/teleapo': () => import('../pages/teleapo/teleapo.js'),
  '/referral': () => import('../pages/referral/referral.js')
};
```

### Page Lifecycle
Each page module must export:
- `mount()` function - Initialize page
- `unmount()` function - Cleanup page

## Component Usage

### Component Registration
```javascript
import { ComponentFactory } from './components/index.js';

// Auto-initialize all components
ComponentFactory.initializeAll();
```

### Individual Component Usage
```javascript
import { DateRangePicker } from './components/DateRangePicker.js';

const picker = new DateRangePicker({
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  onChange: (startDate, endDate) => {
    console.log('Date range changed:', startDate, endDate);
  }
});

picker.mount('#date-picker-container');
```

## API Usage

### Repository Pattern
```javascript
import { RepositoryFactory } from './scripts/api/index.js';

const repositories = RepositoryFactory.create();
const kpiData = await repositories.kpi.getPersonalKpi('2024-01-01', '2024-12-31');
```

### Type Safety
```javascript
import { TypeValidators, TypeCasters } from './scripts/types/index.js';

// Validate data
if (TypeValidators.isKpiData(data)) {
  // Safe to use data
}

// Cast data
const kpiArray = TypeCasters.toKpiDataArray(rawData);
```

### API Response Contracts (Draft)

将来の OpenAPI 連携を見据え、主要エンドポイントの返却JSON契約を簡易的に定義する。

- `GET /api/kpi/personal`, `GET /api/kpi/company`
  - 目的: 個人 / 全社のKPI一覧取得
  - 返却スキーマ:
    - `success` (boolean, 必須)
    - `data` (KpiDto[], 必須)
    - `data[].period` (string, 必須, 例: `"2024-11"`)
    - `data[].applications` (number, 必須)
    - `data[].introductions` (number, 必須)
    - `data[].hires` (number, 必須)
    - `data[].cost` (number, 必須)
    - `data[].currency` (string, 必須, 例: `"JPY"`)

- `GET /api/employees/performance`
  - 目的: 従業員ごとの成績一覧取得
  - 返却スキーマ:
    - `success` (boolean, 必須)
    - `data` (EmployeeDto[], 必須)
    - `data[].id` (string, 必須)
    - `data[].name` (string, 必須)
    - `data[].department` (string, 必須)
    - `data[].applications` (number, 必須)
    - `data[].introductions` (number, 必須)
    - `data[].hires` (number, 必須)
    - `data[].rate` (number, 必須, 単位: パーセント)
    - `data[].rank` (string, 必須, 例: `"A" | "B" | "C"`)

- `POST /api/auth/login`
  - 目的: 認証とセッション生成
  - リクエストボディ:
    - `email` (string, 必須)
    - `password` (string, 必須)
  - 返却スキーマ:
    - `session` (Session, 必須)
    - `session.user.email` (string, 必須)
    - `session.user.name` (string, 必須)
    - `session.role` (string, 必須, 例: `"admin" | "member"`)
    - `session.roles` (string[], 必須)
    - `session.token` (string, 必須)
    - `session.exp` (number, 必須, Unixタイムスタンプ)

## CSS Architecture

### CSS Custom Properties (tokens.css)
```css
:root {
  --color-primary: #3b82f6;
  --color-success: #10b981;
  --space-sm: 0.5rem;
  --space-md: 1rem;
}
```

### Utility Classes (utilities.css)
```css
.text-center { text-align: center; }
.mb-4 { margin-bottom: 1rem; }
.grid-cols-5 { grid-template-columns: repeat(5, 1fr); }
```

## Development Guidelines

### Adding New Pages
1. Create page directory in `pages/`
2. Add HTML content and JS module
3. Export `mount()` and `unmount()` functions
4. Register route in `scripts/router.js`

### Creating Components
1. Create component class with mount/unmount
2. Add CSS styles to components.css
3. Export from `components/index.js`
4. Use factory pattern for initialization

### Type Definitions
1. Define types in `scripts/types/index.js`
2. Add validators and casters
3. Use JSDoc for documentation
4. Export for use in other modules

## Performance Features

### Lazy Loading
- Pages loaded only when needed
- CSS loaded per route
- Components initialized on demand

### Caching
- API responses cached with TTL
- Repository pattern for data management
- Cache invalidation strategies

### Bundle Optimization
- ES module tree shaking
- No build step required
- Native browser module loading

## Browser Compatibility

- Modern browsers with ES6+ module support
- No transpilation required
- Progressive enhancement approach
- Graceful fallbacks for older browsers
