import { useCallback, useEffect, useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';

import { env } from '../config/env';
import { buildSofiaSeed, type SofiaSeed } from '../data/sofia-seed';
import { useSubmitBatch } from '../intuition/hooks/use-submit-batch';
import {
  useSubmitContextOrbits,
  type ContextOrbitDraft,
} from '../intuition/hooks/use-submit-context-orbits';
import { useLocalStorage } from '../lib/use-local-storage';
import type { ClaimSubmissionResult } from '../intuition/services/claim-submission.service';

/**
 * Deterministic short hash of the seed (drafts + nested orbits) so the
 * publish UI auto-hides once a given seed has been confirmed on-chain
 * and reappears the moment the source seed definition changes. FNV-1a-
 * style accumulation; cryptographic strength isn't needed since this
 * only gates UI visibility.
 */
function fingerprintSeed(seed: SofiaSeed): string {
  let hash = 0;
  const fold = (s: string): void => {
    for (let i = 0; i < s.length; i += 1) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
  };
  for (const d of seed.drafts) {
    fold(`${d.subject}|${d.subjectType}|${d.predicateLabel}|${d.object}|${d.objectType}`);
  }
  for (const o of seed.contextOrbits) {
    fold(
      `${o.parent.subject}|${o.parent.predicateLabel}|${o.parent.object}|${o.topic.label}`
    );
  }
  return String(hash);
}

/**
 * Resolve each context-orbit spec into the (parentTripleId, topicAtomId)
 * pair that the nested-publishing service needs. Matches by index
 * against the flat batch's result list (where subject/predicate/object
 * strings live in the seed-side drafts, and the resolved IDs live in
 * the per-result entries). Topic atom ids are recovered from any
 * `has tag` draft whose object equals the orbit's topic label —
 * guaranteed to exist because the seed is authored that way.
 */
function resolveOrbits(
  seed: SofiaSeed,
  batchResults: ClaimSubmissionResult[]
): ContextOrbitDraft[] {
  const topicAtomIdByLabel = new Map<string, ClaimSubmissionResult['objectAtomId']>();
  for (let i = 0; i < seed.drafts.length; i += 1) {
    const draft = seed.drafts[i]!;
    const result = batchResults[i];
    if (result === undefined) continue;
    if (draft.predicateLabel === 'has tag') {
      topicAtomIdByLabel.set(draft.object, result.objectAtomId);
    }
  }

  const orbits: ContextOrbitDraft[] = [];
  for (const spec of seed.contextOrbits) {
    const parentIdx = seed.drafts.findIndex(
      (d) =>
        d.subject === spec.parent.subject &&
        d.subjectType === spec.parent.subjectType &&
        d.predicateLabel === spec.parent.predicateLabel &&
        d.object === spec.parent.object &&
        d.objectType === spec.parent.objectType
    );
    if (parentIdx === -1) continue;
    const parentResult = batchResults[parentIdx];
    if (parentResult === undefined) continue;
    const topicAtomId = topicAtomIdByLabel.get(spec.topic.label);
    if (topicAtomId === undefined) continue;
    orbits.push({
      parentTripleId: parentResult.tripleId,
      topicAtomId,
    });
  }
  return orbits;
}

/**
 * One-click "publish the demo seed" affordance for the Sofia interop
 * showcase. Two phases under the hood:
 *
 *   1. Flat batch — every atom + every regular triple in the seed
 *      (drafts), via useSubmitBatch. 2 tx max (createAtoms +
 *      createTriples).
 *   2. Nested orbits — `<parentTriple> --in context of--> <topic>`
 *      pairs, via useSubmitContextOrbits. Up to 2 more tx
 *      (createAtoms only when 'in context of' is fresh on-chain;
 *      createTriples for the new orbits).
 *
 * The button auto-hides once the entire seed (flat + nested) is on-
 * chain and reappears whenever the seed definition is edited. Status
 * line under the description names whichever phase is in flight so
 * the user knows what they're signing in MetaMask.
 */
export function SofiaSeedButton(): JSX.Element | null {
  const { address, isConnected, chain } = useAccount();
  const walletChainId = useChainId();
  const submitBatch = useSubmitBatch();
  const submitOrbits = useSubmitContextOrbits();
  const [publishedFingerprint, setPublishedFingerprint] = useLocalStorage<
    string | null
  >('ontology.sofia-seed.published-fingerprint', null);

  const seed = useMemo(() => {
    if (address === undefined) return null;
    return buildSofiaSeed(address);
  }, [address]);

  const currentFingerprint = useMemo(
    () => (seed === null ? null : fingerprintSeed(seed)),
    [seed]
  );

  // Phase 2 auto-trigger: as soon as the flat batch confirms, kick off
  // the nested-orbit publish from the resolved per-draft results.
  // Skipped when the seed has no orbits to publish.
  useEffect(() => {
    if (seed === null) return;
    if (seed.contextOrbits.length === 0) return;
    if (submitBatch.state.status !== 'confirmed') return;
    if (submitOrbits.state.status !== 'idle') return;
    const orbits = resolveOrbits(seed, submitBatch.state.results);
    if (orbits.length === 0) return;
    void submitOrbits.submit(orbits);
  }, [seed, submitBatch.state, submitOrbits]);

  // Pin the fingerprint once the entire two-phase flow has settled.
  // For seeds without orbits, completing the flat batch is enough; for
  // seeds with orbits, we wait until phase 2 also confirms so a reload
  // mid-phase-2 leaves the button visible to retry.
  useEffect(() => {
    if (currentFingerprint === null) return;
    if (submitBatch.state.status !== 'confirmed') return;
    const noOrbits = seed?.contextOrbits.length === 0;
    const orbitsDone = submitOrbits.state.status === 'confirmed';
    if (noOrbits === true || orbitsDone) {
      setPublishedFingerprint(currentFingerprint);
    }
  }, [
    submitBatch.state.status,
    submitOrbits.state.status,
    seed,
    currentFingerprint,
    setPublishedFingerprint,
  ]);

  const phase1Active =
    submitBatch.state.status === 'preparing' ||
    submitBatch.state.status === 'creating-atoms' ||
    submitBatch.state.status === 'creating-triple';
  const phase2Active =
    submitOrbits.state.status === 'preparing' ||
    submitOrbits.state.status === 'creating-atoms' ||
    submitOrbits.state.status === 'creating-triple';
  const isPublishing = phase1Active || phase2Active;

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
        : phase1Active
          ? 'Phase 1 — publishing flat triples'
          : phase2Active
            ? 'Phase 2 — publishing context orbits'
            : null;

  const handlePublish = useCallback(() => {
    if (seed === null) return;
    void submitBatch.submit(seed.drafts);
  }, [seed, submitBatch]);

  if (seed === null) return null;
  if (!isConnected) return null;
  if (
    currentFingerprint !== null &&
    publishedFingerprint === currentFingerprint
  ) {
    return null;
  }

  const totalCount = seed.drafts.length + seed.contextOrbits.length;

  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-amber-200">Sofia demo seed</p>
        <p className="text-xs text-[var(--color-text-muted)]">
          Publish {seed.drafts.length} flat triples + {seed.contextOrbits.length}{' '}
          nested `in context of` orbits covering every Sofia predicate
          category. Your connected EOA is included as the `me` user.
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
        disabled={disabledReason !== null || isPublishing}
        title={
          disabledReason ??
          `Publish ${seed.drafts.length} flat + ${seed.contextOrbits.length} nested triples (up to 4 transactions)`
        }
        className="focus-ring shrink-0 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {isPublishing ? 'Publishing…' : `Publish seed (${totalCount})`}
      </button>
    </div>
  );
}
