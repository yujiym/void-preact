import { useNavigation, useParams, useRouter } from '@void/react';
import type { Props } from './[id].server.ts';

export default function Item({ query }: Props) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  return <section>
    <h1>Item</h1>
    <output data-testid="item-id">{id}</output>
    <output data-testid="item-query">{query}</output>
    <output data-testid="navigation-state">{navigation.state}</output>
    <button data-testid="router-refresh" onClick={() => router.refresh()}>Refresh</button>
  </section>;
}
