# Ralph Wiggum - React Guardrails Quick Reference
**For AI Code Generation - SwiftList MVP**
**Date**: January 10, 2026

---

## 🚨 MANDATORY RULES (Read Before Generating React Code)

### Rule 1: Default to Server Components
```tsx
// ✅ DO THIS (Server Component - default)
// app/dashboard/page.tsx
export default async function DashboardPage() {
  const data = await fetchData(); // Fetch directly in component
  return <div>{data}</div>;
}

// ❌ DON'T DO THIS (Unnecessary Client Component)
'use client';
export default function DashboardPage() {
  const [data, setData] = useState(null);
  useEffect(() => { fetchData().then(setData); }, []);
  return <div>{data}</div>;
}
```

**When to use 'use client'**: ONLY when you need:
- Event handlers (onClick, onChange, onSubmit)
- Browser APIs (localStorage, window, document)
- React hooks (useState, useEffect, useContext)

---

### Rule 2: Use SWR for Data Fetching (Client Components ONLY)
```tsx
// ✅ DO THIS (SWR)
'use client';
import useSWR from 'swr';

export default function JobsTable() {
  const { data, error, isLoading } = useSWR('/api/jobs', fetcher);
  if (isLoading) return <Spinner />;
  if (error) return <Error />;
  return <Table data={data} />;
}

// ❌ DON'T DO THIS (Manual useEffect)
'use client';
export default function JobsTable() {
  const [data, setData] = useState([]);
  useEffect(() => {
    fetch('/api/jobs').then(r => r.json()).then(setData);
  }, []); // ❌ BANNED
  return <Table data={data} />;
}
```

**SWR Benefits**:
- Automatic caching, revalidation, error retry
- No cleanup needed (SWR handles it)
- No dependency array bugs
- Real-time polling: `useSWR(url, fetcher, { refreshInterval: 5000 })`

---

### Rule 3: Use Zustand for Global State
```tsx
// ✅ DO THIS (Zustand store)
// lib/store/filters.ts
import { create } from 'zustand';

export const useFilters = create((set) => ({
  status: 'all',
  setStatus: (status) => set({ status }),
}));

// Usage
'use client';
import { useFilters } from '@/lib/store/filters';

export default function FilterBar() {
  const { status, setStatus } = useFilters();
  return <select value={status} onChange={(e) => setStatus(e.target.value)} />;
}

// ❌ DON'T DO THIS (Context API)
const FilterContext = createContext(undefined);
export function FilterProvider({ children }) {
  const [status, setStatus] = useState('all');
  return <FilterContext.Provider value={{ status, setStatus }}>{children}</FilterContext.Provider>;
}
```

**Why Zustand**: Less boilerplate, no provider nesting, simpler for AI to generate correctly.

---

### Rule 4: Use React Hook Form + Zod
```tsx
// ✅ DO THIS (React Hook Form + Zod)
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export default function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    // Data is validated by Zod
    await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
      <button type="submit">Login</button>
    </form>
  );
}

// ❌ DON'T DO THIS (Manual state)
const [email, setEmail] = useState('');
const [errors, setErrors] = useState({});
const handleSubmit = (e) => {
  e.preventDefault();
  if (!email.includes('@')) setErrors({ email: 'Invalid' }); // ❌ BANNED
};
```

---

### Rule 5: NO Complex useEffect
```tsx
// ❌ BANNED (>2 dependencies)
useEffect(() => {
  // Complex logic
}, [dep1, dep2, dep3, dep4]); // ❌ Too many dependencies

// ✅ DO THIS INSTEAD (Refactor to SWR)
const { data } = useSWR(`/api/data?a=${dep1}&b=${dep2}&c=${dep3}`, fetcher);
```

**Maximum useEffect Complexity**:
- ≤2 dependencies: ✅ OK
- >2 dependencies: ❌ REFACTOR to SWR or Server Component

---

### Rule 6: Use shadcn/ui Components
```tsx
// ✅ DO THIS (shadcn/ui)
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';

export default function Dashboard() {
  return (
    <Card>
      <Table />
      <Button>Click Me</Button>
    </Card>
  );
}

// ❌ DON'T DO THIS (Custom component when shadcn/ui exists)
// Only build custom if shadcn/ui doesn't have it
```

**Available shadcn/ui Components**:
- Button, Card, Table, Input, Select, Dialog, Alert, Badge, Tabs, Dropdown, etc.
- Check: https://ui.shadcn.com/docs/components

---

## 🚫 BANNED PATTERNS

### ❌ Class Components
```tsx
// NEVER DO THIS
class MyComponent extends React.Component {
  render() { return <div />; }
}
```

### ❌ Redux
```tsx
// NEVER DO THIS
const slice = createSlice({ /* ... */ });
```

### ❌ Context API for State
```tsx
// NEVER DO THIS (use Zustand instead)
const MyContext = createContext(undefined);
```

### ❌ Prop Drilling >2 Levels
```tsx
// NEVER DO THIS
<A user={user}>
  <B user={user}>
    <C user={user}>
      <D user={user} /> {/* ❌ Use Zustand instead */}
    </C>
  </B>
</A>
```

### ❌ Inline Anonymous Functions
```tsx
// NEVER DO THIS (causes unnecessary re-renders)
<button onClick={() => handleClick(id)}>Click</button>

// DO THIS INSTEAD
const handleButtonClick = useCallback(() => handleClick(id), [id]);
<button onClick={handleButtonClick}>Click</button>
```

---

## 📁 File Structure Template

```
/app/
├── (auth)/
│   ├── login/page.tsx          # Server Component
│   └── signup/page.tsx         # Server Component
│
├── dashboard/
│   ├── page.tsx                # Server Component (fetch data here)
│   └── components/
│       ├── JobsTable.tsx       # 'use client' (SWR for real-time data)
│       └── StatsCards.tsx      # Server Component (static cards)
│
├── admin/
│   ├── mission-control/
│   │   ├── page.tsx            # Server Component
│   │   └── components/
│   │       └── PipelineViz.tsx # 'use client' (D3.js animation)
│
└── api/
    ├── jobs/submit/route.ts    # Server-side API route
    └── admin/stats/route.ts    # Server-side API route

/lib/
├── supabase/
│   ├── server.ts               # For Server Components
│   └── client.ts               # For Client Components
│
├── store/
│   ├── filters.ts              # Zustand store
│   └── preferences.ts          # Zustand store
│
└── utils/
    ├── fetchers.ts             # SWR fetcher functions
    └── schemas.ts              # Zod validation schemas

/components/
├── ui/                         # shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   └── table.tsx
│
└── shared/
    ├── Navbar.tsx              # Server Component
    └── Footer.tsx              # Server Component
```

---

## ✅ Code Generation Checklist

Before generating React code, verify:

- [ ] Component is Server Component by default (no 'use client')
- [ ] If Client Component needed, does it use SWR for data fetching?
- [ ] Global state uses Zustand (not Context API)?
- [ ] Forms use React Hook Form + Zod?
- [ ] useEffect has ≤2 dependencies (or refactored to SWR)?
- [ ] Uses shadcn/ui components where available?
- [ ] All props have TypeScript types?
- [ ] No banned patterns (class components, Redux, prop drilling)?
- [ ] No inline anonymous functions in JSX?

---

## 📚 Pattern Examples

### Example 1: Server Component with Data Fetching
```tsx
// app/admin/jobs/page.tsx
import { createClient } from '@/lib/supabase/server';

export default async function JobsPage() {
  const supabase = createClient();

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div>
      <h1>Recent Jobs</h1>
      <JobsTable jobs={jobs} />
    </div>
  );
}
```

### Example 2: Client Component with Real-Time Updates (SWR)
```tsx
// app/admin/jobs/components/JobsTable.tsx
'use client';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function JobsTable() {
  const { data: jobs, error, isLoading } = useSWR(
    '/api/admin/jobs/active',
    fetcher,
    { refreshInterval: 5000 } // Poll every 5 seconds
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <table>
      {jobs.map(job => (
        <tr key={job.job_id}>
          <td>{job.workflow_chain}</td>
          <td>{job.status}</td>
        </tr>
      ))}
    </table>
  );
}
```

### Example 3: Zustand Store for Filters
```tsx
// lib/store/job-filters.ts
import { create } from 'zustand';

interface JobFilters {
  status: 'all' | 'active' | 'completed' | 'failed';
  workflowId: string | null;
  setStatus: (status: string) => void;
  setWorkflowId: (id: string | null) => void;
  reset: () => void;
}

export const useJobFilters = create<JobFilters>((set) => ({
  status: 'all',
  workflowId: null,
  setStatus: (status) => set({ status }),
  setWorkflowId: (workflowId) => set({ workflowId }),
  reset: () => set({ status: 'all', workflowId: null }),
}));

// Usage in component
'use client';
import { useJobFilters } from '@/lib/store/job-filters';

export default function FilterBar() {
  const { status, setStatus, reset } = useJobFilters();

  return (
    <div>
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="all">All</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
      </select>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

### Example 4: React Hook Form + Zod
```tsx
// app/admin/job-lookup/components/SearchForm.tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const searchSchema = z.object({
  jobId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
}).refine(data => data.jobId || data.userId || data.email, {
  message: 'At least one search field required',
});

type SearchForm = z.infer<typeof searchSchema>;

export default function JobSearchForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
  });

  const onSubmit = async (data: SearchForm) => {
    const results = await fetch('/api/admin/jobs/search', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    // Handle results
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label>Job ID</label>
        <input {...register('jobId')} placeholder="UUID" />
        {errors.jobId && <span>{errors.jobId.message}</span>}
      </div>

      <div>
        <label>User ID</label>
        <input {...register('userId')} placeholder="UUID" />
        {errors.userId && <span>{errors.userId.message}</span>}
      </div>

      <div>
        <label>Email</label>
        <input {...register('email')} type="email" />
        {errors.email && <span>{errors.email.message}</span>}
      </div>

      <button type="submit">Search</button>
    </form>
  );
}
```

---

## 🎯 Ralph Integration

### How Ralph Should Use This Document

**Step 1**: Read this document BEFORE generating any React code
**Step 2**: Follow patterns exactly as shown in examples
**Step 3**: Run mental checklist (Server Component? SWR? Zustand? etc.)
**Step 4**: Generate code using correct patterns
**Step 5**: Self-review against checklist before presenting to user

### Ralph Prompt Template (Updated)

```
TASK: [Your task here]

MANDATORY REACT PATTERNS:
1. Read /RALPH-REACT-GUARDRAILS-REFERENCE.md
2. Default to Server Components (no 'use client' unless needed)
3. Use SWR for data fetching in Client Components
4. Use Zustand for global state
5. Use React Hook Form + Zod for forms
6. NO useEffect with >2 dependencies
7. Use shadcn/ui components first
8. All components have TypeScript types

VERIFICATION CHECKLIST:
- [ ] Server Components used where possible?
- [ ] SWR used for client-side data fetching?
- [ ] Zustand used for global state?
- [ ] Forms use React Hook Form + Zod?
- [ ] No complex useEffect (≤2 dependencies)?
- [ ] shadcn/ui components used?
- [ ] TypeScript types on all props?
- [ ] No banned patterns?

BEGIN IMPLEMENTATION.
```

---

## 📞 Support

**Questions?** Read full documentation:
- `/docs/architecture/REACT-GUARDRAILS-ADDENDUM-2026-01-10.md`

**Code Review**: All AI-generated React code will be reviewed by CTO (Dr. Priya Krishnan)

**Validation**: If patterns unclear, ask user BEFORE generating code

---

**Last Updated**: January 10, 2026
**Status**: ACTIVE - Mandatory for all SwiftList React development
