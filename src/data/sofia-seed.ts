import type { ClaimSubmissionDraft } from '../intuition/services/claim-submission.service';

/**
 * Seed graph for the Sofia interop demo. Designed to surface every
 * predicate category at least once (intentions, trust, social, tag) so
 * the leader-facing live graph reads as a multi-axis network at a
 * glance, with Sofia naturally emerging as the hub via member_of edges
 * and the `d551` user (the connected wallet) anchoring a realistic
 * personal cluster.
 *
 * The function takes the connected user's EOA so the seed always
 * includes the actual wallet that signed the publishing transactions —
 * the leader sees their own address inside the graph, not a synthetic
 * placeholder. Mock co-users (Alice / Bob / Charlie) are pinned as
 * regular Person atoms; their addresses are not generated since the
 * seed never needs them to sign anything.
 */
export interface SofiaSeed {
  /** Human-readable label of every atom involved in the seed. Useful
   *  for displaying a preview before the user signs the batch. */
  atoms: Array<{ label: string; type: string }>;
  /** Concrete claim drafts to feed into useSubmitBatch.submit(). */
  drafts: ClaimSubmissionDraft[];
}

export function buildSofiaSeed(userEoa: string): SofiaSeed {
  // Atom labels (string form used by the claim builder / pin pipeline).
  const sofia = 'Sofia';
  const me = userEoa;
  const alice = 'Alice';
  const bob = 'Bob';
  const charlie = 'Charlie';
  const intuitionSite = 'https://intuition.systems';
  const arxivPaper = 'https://arxiv.org/abs/2305.13245';
  const githubOrg = 'https://github.com/0xIntuition';
  const sofiaSite = 'https://sofia.intuition.box';
  const podcastUrl = 'https://lexfridman.com/podcast';
  const musicUrl = 'https://open.spotify.com/album/0d7AAJlYrOXIvCjihM5Mp4';
  const topicAi = 'AI';
  const topicCrypto = 'crypto';
  const topicRust = 'rust';
  const topicPhilosophy = 'philosophy';
  const topicMusic = 'music';

  const atoms: SofiaSeed['atoms'] = [
    { label: sofia, type: 'Organization' },
    { label: me, type: 'Person' },
    { label: alice, type: 'Person' },
    { label: bob, type: 'Person' },
    { label: charlie, type: 'Person' },
    { label: intuitionSite, type: 'WebPage' },
    { label: arxivPaper, type: 'WebPage' },
    { label: githubOrg, type: 'WebPage' },
    { label: sofiaSite, type: 'WebPage' },
    { label: podcastUrl, type: 'WebPage' },
    { label: musicUrl, type: 'WebPage' },
    { label: topicAi, type: 'DefinedTerm' },
    { label: topicCrypto, type: 'DefinedTerm' },
    { label: topicRust, type: 'DefinedTerm' },
    { label: topicPhilosophy, type: 'DefinedTerm' },
    { label: topicMusic, type: 'DefinedTerm' },
  ];

  // Helper to keep draft construction terse.
  const t = (
    subject: string,
    subjectType: string,
    predicateLabel: string,
    object: string,
    objectType: string
  ): ClaimSubmissionDraft => ({
    subject,
    subjectType,
    predicateLabel,
    object,
    objectType,
  });

  const drafts: ClaimSubmissionDraft[] = [
    // ─── Membership: every user is a member of Sofia (the hub edges) ──
    t(me, 'Person', 'member_of', sofia, 'Organization'),
    t(alice, 'Person', 'member_of', sofia, 'Organization'),
    t(bob, 'Person', 'member_of', sofia, 'Organization'),
    t(charlie, 'Person', 'member_of', sofia, 'Organization'),

    // ─── Intentions: the visit-for-X axis (amber edges) ───────────────
    t(me, 'Person', 'visits for learning', arxivPaper, 'WebPage'),
    t(me, 'Person', 'visits for work', githubOrg, 'WebPage'),
    t(me, 'Person', 'visits for inspiration', intuitionSite, 'WebPage'),
    t(alice, 'Person', 'visits for learning', arxivPaper, 'WebPage'),
    t(alice, 'Person', 'visits for fun', podcastUrl, 'WebPage'),
    t(alice, 'Person', 'visits for music', musicUrl, 'WebPage'),
    t(bob, 'Person', 'visits for work', githubOrg, 'WebPage'),
    t(bob, 'Person', 'visits for inspiration', sofiaSite, 'WebPage'),
    t(bob, 'Person', 'visits for buying', musicUrl, 'WebPage'),
    t(charlie, 'Person', 'visits for fun', podcastUrl, 'WebPage'),
    t(charlie, 'Person', 'visits for learning', intuitionSite, 'WebPage'),
    t(charlie, 'Person', 'visits for music', musicUrl, 'WebPage'),

    // ─── Social: who follows whom (blue edges) ────────────────────────
    t(me, 'Person', 'follow', alice, 'Person'),
    t(me, 'Person', 'follow', bob, 'Person'),
    t(alice, 'Person', 'follow', bob, 'Person'),
    t(bob, 'Person', 'follow', charlie, 'Person'),

    // ─── Trust / distrust (emerald + red edges) ───────────────────────
    t(me, 'Person', 'trusts', bob, 'Person'),
    t(alice, 'Person', 'trusts', charlie, 'Person'),
    t(charlie, 'Person', 'distrust', alice, 'Person'),

    // ─── Tags: URLs categorized by topic (purple edges) ───────────────
    t(intuitionSite, 'WebPage', 'has tag', topicCrypto, 'DefinedTerm'),
    t(arxivPaper, 'WebPage', 'has tag', topicAi, 'DefinedTerm'),
    t(githubOrg, 'WebPage', 'has tag', topicRust, 'DefinedTerm'),
    t(githubOrg, 'WebPage', 'has tag', topicCrypto, 'DefinedTerm'),
    t(podcastUrl, 'WebPage', 'has tag', topicPhilosophy, 'DefinedTerm'),
    t(musicUrl, 'WebPage', 'has tag', topicMusic, 'DefinedTerm'),
    t(sofiaSite, 'WebPage', 'has tag', topicCrypto, 'DefinedTerm'),
  ];

  return { atoms, drafts };
}
