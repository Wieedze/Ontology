import { useCallback, useEffect, useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';

import { env } from '../config/env';
import { buildSofiaSeed } from '../data/sofia-seed';
import { useSubmitBatch } from '../intuition/hooks/use-submit-batch';
import { useLocalStorage } from '../lib/use-local-storage';
import type { ClaimSubmissionDraft } from '../intuition/services/claim-submission.service';

/**
 * Deterministic short hash of the seed drafts. Used as a versioning
 * fingerprint so the publish button auto-hides once a given seed has
 * been confirmed on-chain — but reappears the moment the seed
 * definition is edited (any change to subject/predicate/object across
 * any draft flips the hash). FNV-1a-style accumulation; cryptographic
 * strength isn't needed since we're just gating UI visibility.
 */
function fingerprintSeed(drafts: ClaimSubmissionDraft[]): string {
  let hash = 0;
  for (const d of drafts) {
    const s = `${d.subject}|${d.subjectType}|${d.predicateLabel}|${d.object}|${d.objectType}`;
    for (let i = 0; i < s.length; i += 1) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
  }
  return String(hash);
}

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
  const { address, isConnected, chain } = useAccount();
  const walletChainId = useChainId();
  const submitBatch = useSubmitBatch();
  // Persist the fingerprint of the most recently confirmed seed across
  // reloads so the publish button stays hidden once the demo data is
  // already live on-chain. Editing the seed (length or any draft
  // content) flips the fingerprint, the button reappears, and the next
  // confirmation re-pins it.
  const [publishedFingerprint, setPublishedFingerprint] = useLocalStorage<
    string | null
  >('ontology.sofia-seed.published-fingerprint', null);

  const seed = useMemo(() => {
    if (address === undefined) return null;
    return buildSofiaSeed(address);
  }, [address]);

  const currentFingerprint = useMemo(
    () => (seed === null ? null : fingerprintSeed(seed.drafts)),
    [seed]
  );

  // Pin the fingerprint as soon as the batch confirms so a follow-up
  // page reload finds the button hidden. Effect rather than inlining
  // in submit() because the confirmation arrives asynchronously after
  // the indexer round-trip.
  useEffect(() => {
    if (
      submitBatch.state.status === 'confirmed' &&
      currentFingerprint !== null
    ) {
      setPublishedFingerprint(currentFingerprint);
    }
  }, [submitBatch.state.status, currentFingerprint, setPublishedFingerprint]);

  const isPublishing =
    submitBatch.state.status === 'preparing' ||
    submitBatch.state.status === 'creating-atoms' ||
    submitBatch.state.status === 'creating-triple';

  // Diagnose why the publish action might be unavailable so the button
  // can surface a precise reason instead of just disabling itself
  // silently. Order matters: `isReady` requires both a matching chain
  // and a loaded session, so a wrong-chain wallet would otherwise read
  // as "session loading" forever.
  const onWrongChain = walletChainId !== env.chainId;
  const disabledReason: string | null = !isConnected
    ? 'Connect your wallet to publish'
    : onWrongChain
      ? `Switch your wallet to chain ${env.chainId} (currently on ${walletChainId})`
      : !submitBatch.isReady
        ? 'Loading Intuition session…'
        : isPublishing
          ? 'Publishing in progress'
          : null;

  const handlePublish = useCallback(() => {
    if (seed === null) return;
    void submitBatch.submit(seed.drafts);
  }, [seed, submitBatch]);

  if (seed === null) return null;
  if (!isConnected) return null;
  // Already published this exact seed in a prior session — stay hidden
  // until the seed definition itself changes (fingerprint flips).
  if (
    currentFingerprint !== null &&
    publishedFingerprint === currentFingerprint
  ) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-amber-200">Sofia demo seed</p>
        <p className="text-xs text-[var(--color-text-muted)]">
          Publish {seed.drafts.length} triples covering every Sofia
          predicate category (intentions, trust, social, tags). Your
          connected EOA is included as the `me` user.
          {chain !== undefined && (
            <span className="ml-1 text-[var(--color-text-muted)]">
              · Network: {chain.name} (chain {chain.id})
            </span>
          )}
        </p>
        {disabledReason !== null && (
          <p className="mt-1 text-[11px] text-amber-300/80">{disabledReason}</p>
        )}
      </div>
      <button
        onClick={handlePublish}
        disabled={disabledReason !== null}
        title={disabledReason ?? `Publish ${seed.drafts.length} claims in 2 transactions`}
        className="focus-ring shrink-0 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {isPublishing ? 'Publishing…' : `Publish seed (${seed.drafts.length})`}
      </button>
    </div>
  );
}
