import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { JoinedTripleRecord } from '../services/graphql.service';
import type { Bytes32 } from '../types';
import { useIndexer } from './use-indexer';

const DEFAULT_LIMIT = 100;

export interface LiveTriplesWithContext {
  /** Recently published triples (subject/predicate/object joined inline). */
  recent: JoinedTripleRecord[];
  /**
   * Nested 'in context of' triples grouped by parent triple id. The key
   * is the parent triple's `term_id`; the value is the list of context
   * triples whose subject is that parent (each context triple's object
   * is the topic atom). Used by the live graph to render topic orbits
   * around an intention edge without a per-edge round-trip.
   */
  contextByParent: Map<Bytes32, JoinedTripleRecord[]>;
}

export interface UseLiveTriplesWithContextArgs {
  limit?: number;
  offset?: number;
  /** TanStack Query staleness in ms. Defaults to 30s. */
  staleTime?: number;
  /** When false, the query is skipped entirely. */
  enabled?: boolean;
}

/**
 * Single-source live-graph data fetcher: pulls the most recent triples
 * with their atoms joined, then in a second round-trip pulls the
 * 'in context of' nested triples whose subject is one of those parents.
 *
 * Two passes rather than one because the indexer cannot express
 * "include nested triples whose subject is the current row" in a single
 * GraphQL query — the schema joins atoms via FK on subject_id /
 * predicate_id / object_id, but a triple-as-subject has no atom row to
 * join against. The second `_in:` query is bounded by the first page's
 * size, so it scales linearly with what's already on screen.
 *
 * Returns a `Map` keyed by parent term_id; consumers do `map.get(id) ?? []`
 * when rendering a node so missing entries (no context published yet)
 * cost zero.
 */
export function useLiveTriplesWithContext(
  args: UseLiveTriplesWithContextArgs = {}
): UseQueryResult<LiveTriplesWithContext, Error> {
  const indexer = useIndexer();
  const limit = args.limit ?? DEFAULT_LIMIT;
  const offset = args.offset ?? 0;
  return useQuery({
    queryKey: ['intuition', 'triples', 'recent-with-context', { limit, offset }],
    queryFn: async (): Promise<LiveTriplesWithContext> => {
      const recent = await indexer.listRecentTriples({ limit, offset });
      const parentIds = recent.map((t) => t.term_id);
      const contextTriples = await indexer.listContextTriplesForParents(parentIds);
      const contextByParent = new Map<Bytes32, JoinedTripleRecord[]>();
      for (const ctx of contextTriples) {
        const parentId = ctx.subject_id;
        const existing = contextByParent.get(parentId);
        if (existing === undefined) {
          contextByParent.set(parentId, [ctx]);
        } else {
          existing.push(ctx);
        }
      }
      return { recent, contextByParent };
    },
    staleTime: args.staleTime ?? 30_000,
    enabled: args.enabled ?? true,
  });
}
