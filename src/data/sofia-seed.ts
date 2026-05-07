import type { ClaimSubmissionDraft } from '../intuition/services/claim-submission.service';

/**
 * Seed graph for the Sofia interop demo.
 *
 * Designed so the leader-facing live graph reads as a multi-axis
 * social-knowledge network at a glance:
 *   - Sofia is the natural hub (every user has a `member_of` edge to it).
 *   - The connected wallet's EOA is one of the four users so the leader
 *     sees their own address embedded in the cluster.
 *   - URLs span 8 of Sofia's 14 canonical topics (Tech & Dev, Music,
 *     Web3, Science, Design, Gaming, Business, Growth) so every topic
 *     pill in the graph corresponds to a real Sofia taxonomy bucket.
 *   - Intentions cover all six visit-for-X axes; trust and follow weave
 *     the user cluster together; `has tag` lights up the URL→topic
 *     edges.
 *
 * Topic labels match Sofia's `TOPIC_LABELS` from
 * `extension/lib/config/topicConfig.ts` so the labels render identically
 * to what the extension would surface — modulo the atom hash divergence
 * between the two pin pipelines, see follow-up note in the bounty PR.
 */
/**
 * Specification of a nested `in context of` orbit. Stored as a
 * (parentDraft selector, topic) pair rather than concrete IDs because
 * the parent triple's id is only known after the flat batch confirms.
 * The publisher matches each orbit against the flat results by
 * (subject, predicate, object) tuple to recover the parent's TripleId
 * and the topic atom's AtomId, then drives the nested phase from there.
 */
export interface SofiaContextOrbitSpec {
  parent: {
    subject: string;
    subjectType: string;
    predicateLabel: string;
    object: string;
    objectType: string;
  };
  /** Topic atom that qualifies the parent. The label/type pair must
   *  appear elsewhere in `drafts` (typically as the object of a
   *  `has tag` triple) so the publisher can recover its AtomId from
   *  the flat-batch result without an extra round-trip. */
  topic: { label: string; type: string };
}

export interface SofiaSeed {
  /** Human-readable label of every atom involved in the seed. Useful
   *  for displaying a preview before the user signs the batch. */
  atoms: Array<{ label: string; type: string }>;
  /** Concrete claim drafts to feed into useSubmitBatch.submit(). */
  drafts: ClaimSubmissionDraft[];
  /** Nested `in context of` orbits qualifying intention triples
   *  (Sofia interop pattern). Published in a second phase after the
   *  flat batch confirms; resolved against `drafts` to recover the
   *  parent TripleId and topic AtomId. */
  contextOrbits: SofiaContextOrbitSpec[];
}

export function buildSofiaSeed(userEoa: string): SofiaSeed {
  // ─── Users + the master entity ────────────────────────────────────
  const sofia = 'Sofia';
  const me = userEoa;
  const alice = 'Alice';
  const bob = 'Bob';
  const charlie = 'Charlie';

  // ─── Topics — labels mirror Sofia's canonical TOPIC_LABELS ────────
  const topics = {
    tech: 'Tech & Dev',
    music: 'Music',
    web3: 'Web3',
    science: 'Science',
    design: 'Design',
    gaming: 'Gaming',
    business: 'Business',
    growth: 'Growth',
  } as const;

  // ─── URLs — 2 per topic, real-feeling addresses ───────────────────
  const urls = {
    githubIntuition:    'https://github.com/0xIntuition',
    hackernews:         'https://news.ycombinator.com',
    spotifyAlbum:       'https://open.spotify.com/album/0d7AAJlYrOXIvCjihM5Mp4',
    bandcamp:           'https://bandcamp.com/discover',
    intuitionSite:      'https://intuition.systems',
    uniswap:            'https://app.uniswap.org',
    arxivPaper:         'https://arxiv.org/abs/2305.13245',
    natureArticle:      'https://www.nature.com/articles/s41586-024-08025-4',
    figmaCommunity:     'https://www.figma.com/community',
    dribbble:           'https://dribbble.com',
    steamSpy:           'https://steamspy.com',
    indieHackersGames:  'https://indieworld.nintendo.com',
    yCombinator:        'https://www.ycombinator.com',
    paulGraham:         'https://paulgraham.com/articles.html',
    farnamStreet:       'https://fs.blog',
    substackGrowth:     'https://growth.substack.com',
  } as const;

  // ─── Atoms inventory (for preview/UI; the publish flow derives this
  //     itself, but exposing it lets the button render a count) ──────
  const atoms: SofiaSeed['atoms'] = [
    { label: sofia, type: 'Organization' },
    { label: me, type: 'Person' },
    { label: alice, type: 'Person' },
    { label: bob, type: 'Person' },
    { label: charlie, type: 'Person' },
    ...Object.values(urls).map((url) => ({ label: url, type: 'WebPage' })),
    ...Object.values(topics).map((label) => ({ label, type: 'DefinedTerm' })),
  ];

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
    // ─── Membership: every user is a member of Sofia (the hub edges) ─
    t(me, 'Person', 'member_of', sofia, 'Organization'),
    t(alice, 'Person', 'member_of', sofia, 'Organization'),
    t(bob, 'Person', 'member_of', sofia, 'Organization'),
    t(charlie, 'Person', 'member_of', sofia, 'Organization'),

    // ─── Intentions: each user has a personality across the 6 axes ───
    // me — tech-leaning founder profile
    t(me, 'Person', 'visits for work', urls.githubIntuition, 'WebPage'),
    t(me, 'Person', 'visits for learning', urls.arxivPaper, 'WebPage'),
    t(me, 'Person', 'visits for inspiration', urls.intuitionSite, 'WebPage'),
    t(me, 'Person', 'visits for inspiration', urls.paulGraham, 'WebPage'),
    t(me, 'Person', 'visits for fun', urls.hackernews, 'WebPage'),
    t(me, 'Person', 'visits for buying', urls.uniswap, 'WebPage'),
    t(me, 'Person', 'visits for music', urls.spotifyAlbum, 'WebPage'),

    // alice — designer / creative profile
    t(alice, 'Person', 'visits for work', urls.figmaCommunity, 'WebPage'),
    t(alice, 'Person', 'visits for inspiration', urls.dribbble, 'WebPage'),
    t(alice, 'Person', 'visits for learning', urls.farnamStreet, 'WebPage'),
    t(alice, 'Person', 'visits for music', urls.bandcamp, 'WebPage'),
    t(alice, 'Person', 'visits for music', urls.spotifyAlbum, 'WebPage'),
    t(alice, 'Person', 'visits for fun', urls.indieHackersGames, 'WebPage'),

    // bob — researcher / scientist profile
    t(bob, 'Person', 'visits for work', urls.arxivPaper, 'WebPage'),
    t(bob, 'Person', 'visits for learning', urls.natureArticle, 'WebPage'),
    t(bob, 'Person', 'visits for inspiration', urls.intuitionSite, 'WebPage'),
    t(bob, 'Person', 'visits for fun', urls.steamSpy, 'WebPage'),
    t(bob, 'Person', 'visits for buying', urls.uniswap, 'WebPage'),

    // charlie — entrepreneur / growth profile
    t(charlie, 'Person', 'visits for work', urls.yCombinator, 'WebPage'),
    t(charlie, 'Person', 'visits for inspiration', urls.paulGraham, 'WebPage'),
    t(charlie, 'Person', 'visits for learning', urls.substackGrowth, 'WebPage'),
    t(charlie, 'Person', 'visits for fun', urls.steamSpy, 'WebPage'),
    t(charlie, 'Person', 'visits for music', urls.bandcamp, 'WebPage'),

    // ─── Social: who follows whom (blue edges) ────────────────────────
    t(me, 'Person', 'follow', alice, 'Person'),
    t(me, 'Person', 'follow', bob, 'Person'),
    t(alice, 'Person', 'follow', bob, 'Person'),
    t(bob, 'Person', 'follow', charlie, 'Person'),
    t(charlie, 'Person', 'follow', me, 'Person'),

    // ─── Trust / distrust (emerald + red edges) ───────────────────────
    t(me, 'Person', 'trusts', bob, 'Person'),
    t(alice, 'Person', 'trusts', charlie, 'Person'),
    t(charlie, 'Person', 'distrust', alice, 'Person'),

    // ─── Tags: URLs categorized by topic (purple edges) ───────────────
    // Tech & Dev
    t(urls.githubIntuition, 'WebPage', 'has tag', topics.tech, 'DefinedTerm'),
    t(urls.hackernews, 'WebPage', 'has tag', topics.tech, 'DefinedTerm'),
    // Web3 (with cross-tag from Tech & Dev for github/intuition)
    t(urls.githubIntuition, 'WebPage', 'has tag', topics.web3, 'DefinedTerm'),
    t(urls.intuitionSite, 'WebPage', 'has tag', topics.web3, 'DefinedTerm'),
    t(urls.uniswap, 'WebPage', 'has tag', topics.web3, 'DefinedTerm'),
    // Music
    t(urls.spotifyAlbum, 'WebPage', 'has tag', topics.music, 'DefinedTerm'),
    t(urls.bandcamp, 'WebPage', 'has tag', topics.music, 'DefinedTerm'),
    // Science
    t(urls.arxivPaper, 'WebPage', 'has tag', topics.science, 'DefinedTerm'),
    t(urls.natureArticle, 'WebPage', 'has tag', topics.science, 'DefinedTerm'),
    // Design
    t(urls.figmaCommunity, 'WebPage', 'has tag', topics.design, 'DefinedTerm'),
    t(urls.dribbble, 'WebPage', 'has tag', topics.design, 'DefinedTerm'),
    // Gaming
    t(urls.steamSpy, 'WebPage', 'has tag', topics.gaming, 'DefinedTerm'),
    t(urls.indieHackersGames, 'WebPage', 'has tag', topics.gaming, 'DefinedTerm'),
    // Business
    t(urls.yCombinator, 'WebPage', 'has tag', topics.business, 'DefinedTerm'),
    t(urls.paulGraham, 'WebPage', 'has tag', topics.business, 'DefinedTerm'),
    // Growth
    t(urls.farnamStreet, 'WebPage', 'has tag', topics.growth, 'DefinedTerm'),
    t(urls.substackGrowth, 'WebPage', 'has tag', topics.growth, 'DefinedTerm'),
    t(urls.paulGraham, 'WebPage', 'has tag', topics.growth, 'DefinedTerm'),
  ];

  // ─── Context orbits (Sofia nested-triple pattern) ────────────────
  // Each entry attaches a topic to a specific intention edge — the
  // semantic difference vs `has tag` is that the topic qualifies the
  // *visit*, not the URL in absolute. So the same arxiv URL can be
  // 'AI' when me visits it for learning and 'Science' when bob visits
  // it for work. The publisher will resolve each parent's TripleId
  // and the topic's AtomId from the flat batch result before driving
  // the nested createTriples call.
  const contextOrbits: SofiaContextOrbitSpec[] = [
    // me's profile
    {
      parent: { subject: me, subjectType: 'Person', predicateLabel: 'visits for learning', object: urls.arxivPaper, objectType: 'WebPage' },
      topic: { label: topics.science, type: 'DefinedTerm' },
    },
    {
      parent: { subject: me, subjectType: 'Person', predicateLabel: 'visits for work', object: urls.githubIntuition, objectType: 'WebPage' },
      topic: { label: topics.web3, type: 'DefinedTerm' },
    },
    {
      parent: { subject: me, subjectType: 'Person', predicateLabel: 'visits for inspiration', object: urls.intuitionSite, objectType: 'WebPage' },
      topic: { label: topics.web3, type: 'DefinedTerm' },
    },
    {
      parent: { subject: me, subjectType: 'Person', predicateLabel: 'visits for inspiration', object: urls.paulGraham, objectType: 'WebPage' },
      topic: { label: topics.business, type: 'DefinedTerm' },
    },
    // alice's profile
    {
      parent: { subject: alice, subjectType: 'Person', predicateLabel: 'visits for work', object: urls.figmaCommunity, objectType: 'WebPage' },
      topic: { label: topics.design, type: 'DefinedTerm' },
    },
    {
      parent: { subject: alice, subjectType: 'Person', predicateLabel: 'visits for inspiration', object: urls.dribbble, objectType: 'WebPage' },
      topic: { label: topics.design, type: 'DefinedTerm' },
    },
    {
      parent: { subject: alice, subjectType: 'Person', predicateLabel: 'visits for music', object: urls.bandcamp, objectType: 'WebPage' },
      topic: { label: topics.music, type: 'DefinedTerm' },
    },
    // bob's profile — same arxiv URL, different intention/context vs me
    {
      parent: { subject: bob, subjectType: 'Person', predicateLabel: 'visits for work', object: urls.arxivPaper, objectType: 'WebPage' },
      topic: { label: topics.science, type: 'DefinedTerm' },
    },
    {
      parent: { subject: bob, subjectType: 'Person', predicateLabel: 'visits for learning', object: urls.natureArticle, objectType: 'WebPage' },
      topic: { label: topics.science, type: 'DefinedTerm' },
    },
    // charlie's profile
    {
      parent: { subject: charlie, subjectType: 'Person', predicateLabel: 'visits for work', object: urls.yCombinator, objectType: 'WebPage' },
      topic: { label: topics.business, type: 'DefinedTerm' },
    },
    {
      parent: { subject: charlie, subjectType: 'Person', predicateLabel: 'visits for learning', object: urls.substackGrowth, objectType: 'WebPage' },
      topic: { label: topics.growth, type: 'DefinedTerm' },
    },
  ];

  return { atoms, drafts, contextOrbits };
}
