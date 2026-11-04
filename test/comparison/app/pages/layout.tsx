import { Link, useShared } from '@void/react';
import { useState, type ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const shared = useShared();
  return (
    <div>
      <nav>
        <Link href="/" data-testid="nav-home">Home</Link>{' '}
        <Link href="/items/one" data-testid="nav-detail">Item</Link>{' '}
        <Link href="/forms" data-testid="nav-form">Forms</Link>{' '}
        <Link href="/islands" data-testid="nav-islands">Islands</Link>{' '}
        <Link href="/deferred" data-testid="nav-deferred">Deferred</Link>{' '}
        <Link href="/auth" data-testid="nav-auth">Auth</Link>{' '}
        <Link href="/errors" data-testid="nav-errors">Errors</Link>{' '}
        <Link href="/differences" data-testid="nav-differences">Differences</Link>
        <Link href="/root-suspend" data-testid="nav-root-suspend">Root suspense</Link>
      </nav>
      <p data-testid="shared-app">{shared.appName}</p>
      <output data-testid="layout-count">{count}</output>
      <button data-testid="layout-increment" onClick={() => setCount((value) => value + 1)}>Increment layout</button>
      <main>{children}</main>
    </div>
  );
}
