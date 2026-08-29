# Piece 02: who AI recommends. The recording protocol.

Working title: *Ask ChatGPT for the best clinic in Manchester. Here is who it names,
and why.*

This is the instrument, not the article. It exists so the day of collecting answers is
a day of following steps rather than a day of deciding what to do next, and so the
published method section can be written from what actually happened rather than
reconstructed afterwards.

Written 26 August 2026. Nothing here has been run yet.

---

## Why the method is the product

Piece 01 works because the numbers came from a crawl nobody else has. This one has no
proprietary data at all: anybody can open ChatGPT and type a question. What almost
nobody has done is run a fixed set of questions, across three engines, on one stated
day, for one named sector and city, and publish the raw answers alongside the counts.

That means the method is the only thing separating this piece from an opinion. If the
questions look cherry-picked, or the runs look repeated until they said something
interesting, the piece is worth nothing and it damages the two either side of it. Every
rule below exists to close one of those objections in advance.

---

## Scope

**Sector:** aesthetics and skin clinics.
**City:** Manchester.

Manchester rather than London because London results are dominated by national chains
and the piece is more interesting where a local business can actually win. Aesthetics
because piece 01 is already about UK aesthetics search, so the two compound: the same
reader is being told what is happening in search and what is happening in AI answers,
about their own market.

**Engines, three:**

1. ChatGPT, default model, logged out or in a temporary chat
2. Perplexity, default mode, logged out
3. Google, with AI Overviews on, in a private window

**One run per question per engine. Twenty questions. Sixty answers.**

---

## The twenty questions

Written as a real person types them, not as keyword strings. Grouped by how far along
the person is, because where a business gets named matters as much as whether it does.

### Deciding whether to bother at all, 1 to 4

1. Is it worth paying for professional skin treatment or is over the counter fine?
2. What actually works for acne scars?
3. How much does laser hair removal cost in the UK?
4. Are skin clinics regulated in the UK?

### Working out what they need, 5 to 9

5. What is the difference between a medical facial and a normal facial?
6. Which treatment is best for pigmentation on darker skin?
7. How many sessions of laser hair removal do you actually need?
8. Is microneedling safe?
9. What should I ask a clinic before booking a treatment?

### Looking for somewhere local, 10 to 15

10. Best skin clinic in Manchester
11. Where can I get laser hair removal in Manchester?
12. Good aesthetics clinic near Manchester city centre
13. Which Manchester clinics do acne scar treatment?
14. Skin clinic Manchester reviews
15. Is there a reputable clinic in Manchester for pigmentation?

### Checking a specific business, 16 to 18

16. Is [name of a clinic that gets named in questions 10 to 15] any good?
17. What do people say about [same clinic]?
18. Is [same clinic] expensive?

### The awkward ones, 19 and 20

19. Which Manchester skin clinics should I avoid?
20. Has any Manchester skin clinic been in trouble with the regulator?

**Questions 16 to 18 are filled in on the day**, from whichever business the engines
name most often in 10 to 15. That is deliberate and it must be said in the published
method: the question is not fixed in advance because the whole point is to see what an
engine says about a business it has just recommended.

**Questions 19 and 20 are in here on purpose and may produce nothing.** If all three
engines refuse to answer, that is a finding and it goes in the piece. It is also the
single most useful thing a clinic owner can learn from this: whether an engine will
repeat a complaint about them to a prospective customer.

---

## Rules that make it defensible

**One run each. Record the first answer.** Not the best of three, not a rerun because
the first was boring. If an engine errors or refuses outright, record that as the
result and note it. Rerunning until you like the answer is the exact failure this
protocol exists to prevent, and a reader will assume you did it unless the method says
plainly that you did not.

**Logged out, or a temporary chat, every time.** A logged-in session carries memory and
personalisation, so the answers describe you rather than the market. In Google, a
private window and no signed-in account.

**All sixty answers in one day.** These systems change week to week. A piece that mixes
answers from three different weeks is measuring the calendar. Record the date on the
page and give the time range.

**Record the model or version where it is shown.** "ChatGPT" in six months means
something different from "ChatGPT" today, and a reader in six months needs to know which
one this was.

**Screenshot every answer, all sixty.** Full answer, and the citations panel where there
is one. This is the part that makes the piece undismissable, and it is the part that is
impossible to go back and get later.

**Do not edit the questions once you start.** If question 7 turns out to be badly worded,
finish the run with it as written and say so in the method. A question changed halfway
through makes every count before it incomparable with every count after it.

---

## The recording sheet

One row per answer, so sixty rows. Suggested as a spreadsheet with these columns.

| Column | What goes in it |
|---|---|
| `run_id` | 1 to 60, so a screenshot can be matched to a row |
| `question_no` | 1 to 20 |
| `question_text` | The question exactly as typed |
| `stage` | deciding / choosing / local / specific / awkward |
| `engine` | chatgpt / perplexity / google |
| `model_version` | Whatever the interface shows, or "not shown" |
| `run_at` | Date and time, to the minute |
| `answered` | yes / refused / errored |
| `businesses_named` | Every business name, in the order the answer gives them, pipe separated |
| `first_named` | Just the first one, because position matters |
| `sources_cited` | Every URL in the citations, pipe separated |
| `cited_domains` | Just the domains, deduplicated |
| `named_any_local` | yes / no. Whether any Manchester business was named at all |
| `screenshot` | Filename |
| `notes` | Anything odd. Hedging, a disclaimer, a refusal to rank |

Screenshot naming: `p02-{run_id}-{engine}-q{question_no}.png`, so a reader who asks to
see run 34 can be sent it in one search.

### What gets counted at the end

From those sixty rows, five counts, and each one carries its denominator:

1. How many of the 60 answers named at least one specific business.
2. How many distinct businesses were named across all 60.
3. For each business, how many of the 60 answers named it, and in how many it was first.
4. Which domains were cited as sources, ranked by how often, across all 60.
5. How the three engines differed: whether they name the same businesses at all.

Number 4 is the one with a commercial edge, and it is the reason this piece opens a
service line. If the citations are dominated by directories and review aggregators
rather than the clinics' own websites, that is the finding: the way to be recommended is
not to write more pages, it is to be described accurately on the handful of sources
these engines actually read.

---

## The one number that can be automated

Semrush exposes two separate counts for every SERP feature, and the difference is the
whole point here:

- `serp_ai_overview_keywords` counts searches where an AI Overview **is present at all**.
  The business may be nowhere inside it.
- `serp_ai_overview_positions` counts searches where the business **itself is quoted**
  inside the AI Overview.

The number this piece wants is the second one. An earlier version of this section
described `serp_ai_overview_keywords` as the count of keywords where a domain shows up
inside an AI Overview. That is not what the field holds, and publishing it as such would
overstate presence in AI answers by roughly ten times.

**Pulled 26 August 2026.** UK database, most recent snapshot, `domain_rank` report inside
the `domain_overview` toolkit, one call per domain. Three reference domains, chosen before
the collection day rather than drawn from it:

| | SKN Clinics | EF MEDISPA | Dr Leah |
|---|---|---|---|
| `serp_ai_overview_keywords` | 16,671 | 1,527 | 4,358 |
| `serp_ai_overview_positions` | 1,654 | 98 | 770 |
| Total organic keywords | 31,211 | 2,783 | 5,765 |
| Monthly organic traffic | 131,884 | 7,141 | 42,431 |
| Semrush Rank | 4,895 | 65,631 | 13,644 |
| AI answer shown on | 53% of its keywords | 55% | 76% |
| Quoted in | 9.9% of those | 6.4% | 18% |

Dr Leah is the finding worth carrying into the writing. It is a fraction of SKN's size,
yet it is quoted in AI answers at nearly twice SKN's rate, and an AI answer sits on three
quarters of the searches it competes for. Whatever earns the citation, it is not scale.

**Limits on these three numbers, which must be stated if any of them are printed.** They
are whole-domain and UK-wide, so they corroborate the hand-collected picture at national
scale rather than measuring the same thing. SKN is a national chain, so most of its 1,654
citations are not Manchester searches. Semrush's AI Overview data speaks only to Google
and says nothing about ChatGPT or Perplexity. And the column mapping above is inferred
from the values falling in the expected subset relationship across all three domains, so
cross-check one domain in the Semrush interface before any figure goes on the page.

Ahrefs is not an alternative: every Ahrefs endpoint on this account returns "Insufficient
plan", Brand Radar included, checked 21 August 2026.

This remains a corroboration, not a foundation. Sixty screenshotted answers with a stated
method is the substance of the piece.

---

## What must appear on the published page

Same rules as every piece in this format. `docs/analysis-format.md` governs the layout,
and these are the ones specific to this piece:

- **The full question list, printed.** All twenty, as typed. A reader who suspects
  cherry-picking should be able to check by running them.
- **The date, and the fact that it is one day.** With the sentence that these systems
  change, so this is a photograph rather than a trend.
- **That it is one run per question**, and no reruns.
- **That it is one sector in one city**, and that nothing here generalises to other
  sectors or cities without doing it again.
- **The refusals**, including whether questions 19 and 20 produced anything.
- **Screenshots**, or at minimum an offer to send them to anyone who asks.
- **The businesses named, named.** This piece is about specific companies and softening
  that into "Clinic A" removes the reason anyone would read it. The same judgement was
  made in piece 01, and the same limit applies: only businesses large enough to discuss
  publicly without singling out a sole trader.

Ending, per rule 7 of the format: a short list of checks a clinic owner can run on their
own business in ten minutes. The obvious one is to ask an engine about themselves and see
what it says, which costs nothing and is the fastest way to make the point land.

---

## Effort, honestly

Roughly a day, and most of it is mechanical: sixty questions typed, sixty screenshots
taken, sixty rows filled in. The thinking is in the writing afterwards, and in questions
16 to 18, which cannot be decided until the local results are in.

The protocol above is what turns it into a day rather than two. What it cannot do is
run itself: the screenshots are the evidence, and they have to be taken by a person.
