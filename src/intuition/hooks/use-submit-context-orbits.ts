import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWalletClient,
} from 'wagmi';
import type { Hex } from 'viem';

import { env } from '../../config/env';
import { createIntuitionServices } from '../services/factory';
import type { ClaimSubmissionPhase } from '../services/claim-submission.service';
import type { AtomId, TripleId } from '../types';
import { useIntuitionSession } from './use-intuition-session';

/**
 * Discriminated state for the nested `in context of` orbit publishing
 * flow. Mirrors the shape of `useSubmitBatch` so the consumer UI can
 * share status rendering logic across the flat and nested phases of a
 * combined seed.
 */
export type ContextOrbitSubmissionState =
  | { status: 'idle' }
  | { status: 'preparing' }
  | { status: 'creating-atoms'; atomCount: number }
  | { status: 'creating-triple' }
  | {
      status: 'confirmed';
      predicateAtomTxHash: Hex | undefined;
      tripleTxHash: Hex | undefined;
      results: Array<{ tripleId: TripleId; alreadyExisted: boolean }>;
    }
  | { status: 'error'; error: Error };

export interface ContextOrbitDraft {
  parentTripleId: TripleId;
  topicAtomId: AtomId;
}

export interface UseSubmitContextOrbitsReturn {
  submit: (orbits: ContextOrbitDraft[]) => Promise<void>;
  reset: () => void;
  state: ContextOrbitSubmissionState;
  isReady: boolean;
}

/**
 * React binding around `ClaimSubmissionService.submitContextOrbits`.
 *
 * Pure orchestration: no business decisions about *which* triples
 * should get qualified — that's the consumer's responsibility (the
 * Sofia seed, in our case, predefines a list of (parent, topic) pairs
 * and looks up the resolved IDs from the prior flat-batch result).
 */
export function useSubmitContextOrbits(): UseSubmitContextOrbitsReturn {
  const [state, setState] = useState<ContextOrbitSubmissionState>({
    status: 'idle',
  });
  const { address, chain } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const session = useIntuitionSession();
  const queryClient = useQueryClient();

  const services = useMemo(() => {
    if (publicClient === undefined || walletClient === undefined) {
      return null;
    }
    return createIntuitionServices({
      publicClient,
      walletClient,
      graphqlUrl: env.graphqlUrl,
      multivaultAddress: env.multivaultAddress,
    });
  }, [publicClient, walletClient]);

  const isReady =
    address !== undefined &&
    chain !== undefined &&
    services !== null &&
    session.status === 'success';

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  const submit = useCallback(
    async (orbits: ContextOrbitDraft[]) => {
      if (
        services === null ||
        address === undefined ||
        chain === undefined ||
        session.status !== 'success'
      ) {
        setState({
          status: 'error',
          error: new Error(
            'Wallet not connected or Intuition session not loaded'
          ),
        });
        return;
      }
      if (orbits.length === 0) return;

      try {
        const result = await services.claimSubmission.submitContextOrbits({
          orbits,
          context: {
            account: address,
            chain,
            chainId,
            session: session.data,
          },
          onPhase: (phase: ClaimSubmissionPhase) => setState(phase),
        });
        setState({
          status: 'confirmed',
          predicateAtomTxHash: result.predicateAtomTxHash,
          tripleTxHash: result.tripleTxHash,
          results: result.results,
        });
        // The new context triples qualify existing intention edges, so
        // every live-graph view that pulled `useLiveTriplesWithContext`
        // needs to re-fetch its nested round-trip. Invalidate the whole
        // 'intuition' prefix to keep the cascade consistent with the
        // flat-batch invalidation pattern.
        void queryClient.invalidateQueries({ queryKey: ['intuition'] });
      } catch (error) {
        setState({
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    },
    [services, address, chain, chainId, session, queryClient]
  );

  return { submit, reset, state, isReady };
}
