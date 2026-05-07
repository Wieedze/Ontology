import { useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';

import { buildSofiaSeed } from '../data/sofia-seed';
import { useSubmitBatch } from '../intuition/hooks/use-submit-batch';

/**
 * One-click "publish the demo seed" affordance for the Sofia interop
 * showcase. Uses the connected wallet's EOA as the `me` user inside
 * the seed so the leader views their own address embedded in the
 * graph. Goes through `useSubmitBatch` so the user signs at most two
 * transactions (createAtoms + createTriples) regardless of seed size.
 *
 * Intentionally minimal — sits next to the claim builder rather than
 * occupying its own page, so a developer doing a quick reset on
 * testnet can re-publish in a single click and the production UX is
 * not cluttered.
 */
export function SofiaSeedButton(): JSX.Element | null {
  const { address, isConnected } = useAccount();
  const submitBatch = useSubmitBatch();

  const seed = useMemo(() => {
    if (address === undefined) return null;
    return buildSofiaSeed(address);
  }, [address]);

  const isPublishing =
    submitBatch.state.status === 'preparing' ||
    submitBatch.state.status === 'creating-atoms' ||
    submitBatch.state.status === 'creating-triple';

  const handlePublish = useCallback(() => {
    if (seed === null) return;
    void submitBatch.submit(seed.drafts);
  }, [seed, submitBatch]);

  if (seed === null) return null;
  if (!isConnected) return null;

  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-amber-200">Sofia demo seed</p>
        <p className="text-xs text-[var(--color-text-muted)]">
          Publish {seed.drafts.length} triples covering every Sofia
          predicate category (intentions, trust, social, tags). Your
          connected EOA is included as the `me` user.
        </p>
      </div>
      <button
        onClick={handlePublish}
        disabled={!submitBatch.isReady || isPublishing}
        className="focus-ring shrink-0 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {isPublishing ? 'Publishing…' : `Publish seed (${seed.drafts.length})`}
      </button>
    </div>
  );
}
