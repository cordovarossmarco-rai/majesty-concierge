# Majesty Day Spa inquiry and booking concierge

A prototype that takes an inquiry from a prospective guest, works out what they are asking for,
recommends a treatment from the spa's own list, offers appointment times, and hands the front desk
something they can act on.

Built as a paid technical trial. It is a prototype, not a production system, and the sections on
limitations and production work below are specific about the difference.

---

## The idea it is built around

A spa inquiry is not really a data-entry problem. Most guests write a sentence or two, some know
exactly what they want, some want to be told, and a few are writing because something went wrong
last time. The useful thing a system can do is tell those apart and put the third group in front
of a person quickly.

So the design question is not "how good is the summary" but "what happens when the model is
wrong". Three answers run through the whole codebase:

**The assistant is only allowed to say things it was given.** Treatments come from a fixed
catalog, policies from a fixed list, appointment times from the availability module. Prices are
absent everywhere because there is no source for them, so there is nothing to quote and nothing to
invent. Where a field has to come from that data, the schema sent to the API is built from the
data itself, so an invented treatment or a time the spa cannot honour is refused by the API rather
than caught afterwards.

**Escalation does not depend on the model agreeing.** A separate set of plain pattern checks runs
before the model sees anything. If a guest mentions a manager, a refund, an allergy or an injury,
the inquiry goes to a person whatever the model decides. The third required test scenario passes
because of this, not because the model was asked nicely.

**A guard can add caution, never remove it.** Everything the model returns passes through one
function that can escalate but cannot de-escalate. If either the model or the pattern checks think
a person should look, a person looks.

---

## Technology and platforms

| | |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL, accessed with Drizzle ORM and the standard `pg` driver |
| AI | Claude (`claude-opus-5`) via the official Anthropic TypeScript SDK |
| Validation | Zod, one schema shared by the browser and the server |
| Tests | Vitest |
| Hosting | Vercel |

The `pg` driver is used rather than a hosted provider's own client so that the same code runs
against a local Postgres in development and a managed one in production, with nothing changing but
the connection string.

---

## How it fits together

```
Guest fills in the form
        |
        v
POST /api/inquiries
        |
        +-- validate (Zod, the same schema the form used)
        +-- INSERT the lead
        +-- respond 201 to the guest            <-- the guest is done here
        |
        v  (after the response, via Next's after())
   triage()        deterministic checks, before the model
   classify()      Claude, constrained by catalog + policies + free slots
   applyGuards()   drops anything invented, adds caution, never removes it
        |
        +-- INSERT the reading into lead_ai
        +-- record classification + run four automations, each logged
        |
        v
   /admin  staff read, edit the draft, change the status
```

**The lead is written down before anything calls a third party.** If the Anthropic API is slow,
rate limiting us or down, the spa still has the inquiry and the guest still gets a confirmation.
This was tested by running the whole flow with a deliberately invalid API key: the guest gets their
201, the message is stored intact, the lead is flagged for a person, and a plain holding reply is
prepared that a receptionist could send as it stands.

Reading an inquiry takes several seconds, so it happens after the response rather than during it.
The guest waits on a database insert, not on a model. The cost of that choice is a few seconds
where a lead exists with no reading attached, so the dashboard shows "being read" rather than a
blank row, which would look like a lost inquiry.

---

## Database structure

Three tables. The separation is deliberate rather than tidy-mindedness.

**`leads`** holds what the guest actually submitted, plus a status of `new`, `contacted`, `booked` or
`closed`. Nothing the model produces is written here, so re-reading an inquiry can never alter what
the guest said.

**`lead_ai`** holds one row per lead with the reading: summary, category, priority, recommended
treatment, whether a person is needed, the reason if so, the draft reply, the recommended next
action, the times offered, and which model produced it. Keyed on the lead id, so a re-run replaces
the previous reading instead of failing.

**`automation_runs`** holds one row per step per lead, with `ok`, `failed` or `skipped` and a detail
line. A step that decides not to act writes a `skipped` row with its reason rather than writing
nothing, so "the automation never ran" and "it ran and decided this guest should not be emailed"
are distinguishable when someone comes to look.

Schema lives in `lib/db/schema.ts`. Apply it with `npm run db:push`.

---

## The decision logic

### Before the model: `lib/triage.ts`

Plain pattern matching over the message for a manager or supervisor, a complaint, a refund,
dissatisfaction, an allergy, a possible injury or reaction, and legal language. Any hit forces
escalation regardless of what the model later says.

The patterns are deliberately loose. An inquiry escalated when it did not need to be costs a staff
member thirty seconds of reading; a complaint the assistant tries to answer alone costs a great
deal more. The reaction patterns match how guests actually write, so "my skin has been red and
irritated" escalates and not only the word "reaction", which nobody uses.

### The model: `lib/classify.ts`

One call, no agent loop, because this is a classification with a known output shape. The response
is constrained by a JSON schema built partly from live data:

- `serviceInterest` accepts only ids from the catalog
- `proposedSlots` accepts only times the availability module offered on this request
- `priority`, `nextAction` and the rest are fixed enumerations

The system prompt carries the catalog, the policies, the free times, and a short list of rules
where every prohibition is paired with what to do instead, because "never quote a price" on its own
leaves the model with nothing to say. Effort is set to `low`: this is a short classification with a
deterministic guard behind it, so the tokens are better spent on being quick.

If the call fails for any reason the inquiry falls back to a safe reading: needs a person, warm
priority, a callback queued, and a neutral holding reply. **A failed classification never loses a
lead**, it only means someone reads it unaided.

### After the model: `lib/guard.ts`

Drops a treatment that is not in the catalog, drops a time that was not offered, drops a time the
recommended treatment could not finish in before closing, flags a voucher pointed at something the
voucher does not cover, withholds appointment times entirely from someone writing in to complain,
and stops sending a guest to online booking once a person needs to look.

Each of those adds a line to the reason shown on the lead, so the dashboard says why an inquiry was
held back rather than just that it was.

### Availability: `lib/availability.ts`

Sample slots, generated deterministically so the same date always produces the same free and taken
times and a demonstration looks the same twice. The spa is closed on Mondays, opens nine to seven,
weekends are busier, and a treatment must finish before closing, so a half day package simply has
fewer possible start times than a facial.

Times have to be offered in the same breath as the recommendation, before anyone knows which
treatment it will be, so the length is rounded up to the longest candidate. A slot that fits a half
day also fits a facial; the reverse is not true, which is the reason it rounds up rather than down.

---

## Automations

Four steps run after every inquiry, in `lib/automations.ts`. Each writes one row to
`automation_runs` through a single helper, so there is one place where a result is recorded rather
than four.

| Step | What it does | When it skips |
|---|---|---|
| `confirmation` | Prepares an acknowledgement, by email, text or call, whichever the guest asked for | Held back when the inquiry goes to a manager, so a complaint is not answered by an autoresponder |
| `hot_lead_notification` | Tells the front desk | When the priority is not hot |
| `followup_task` | Creates a task with the escalation reason | When nothing needs a person |
| `crm_sync` | Upserts the guest and inquiry | Does not skip |

**Every one of these is simulated, and says so in the text it writes to the log.** No automation
sends anything and nothing is written outside this database. The one place a real message can leave
the building is the dashboard, where a staff member hands the approved draft to their own mail or
messages app and presses send themselves. The wording is deliberate: a dashboard that looks
convincing is exactly the thing that could be misread as evidence that a guest was emailed.

What is being demonstrated is the decision each step takes, not the delivery. Which guests should
be emailed at all is the part worth getting right.

### Replacing the simulations with live integrations

Each step is a single function returning a string. The change in every case is the body of that
function; the logging, the skip conditions and the failure handling stay as they are.

| Step | Live version |
|---|---|
| `confirmation` | Resend or Postmark for email, Twilio for text. The step already branches on the guest's stated preference, so the live version swaps the body for a real send, triggered by a staff member approving the draft rather than automatically on submit. Today the dashboard hands the approved draft to the staff member's own mail or messages app, which means a person genuinely sends it without a mail provider being wired in. |
| Text messages | Twilio, gated on `contactMethod` being `text` and on the same approval. |
| `hot_lead_notification` | Slack incoming webhook, or Twilio for a text to the duty manager out of hours. |
| `followup_task` | Whatever the spa already uses. A Booker/Mindbody task if their plan exposes one, otherwise a shared inbox or a Trello card via webhook. |
| `crm_sync` | The Booker/Mindbody customer API, matching on email or phone first so a returning guest is updated rather than duplicated. |
| `availability` | Replace `slotsFor()` with a call to the booking system's availability endpoint, cached for a minute or two. The rest of the pipeline is unchanged because it already treats availability as data handed to it. |

A live version would also want an outbound queue rather than firing inside the request lifecycle,
so a failed send can be retried without re-reading the inquiry.

---

## Running it locally

Requires Node 20 or newer and a PostgreSQL database.

```bash
git clone https://github.com/cordovarossmarco-rai/majesty-concierge
cd majesty-concierge
npm install

cp .env.example .env.local
# then fill in .env.local:
#   DATABASE_URL      a Postgres connection string
#   ANTHROPIC_API_KEY from console.anthropic.com
#   ADMIN_PASSWORD    the shared staff password for /admin
#   ANTHROPIC_MODEL   optional, defaults to claude-opus-5

npm run db:push     # create the tables
npm run dev         # http://localhost:3000
```

The guest form is at `/`. The staff dashboard is at `/admin` and asks for the `ADMIN_PASSWORD`.

```bash
npm test            # unit tests for triage, the guard, and availability
npm run build       # production build
```

---

## Security

**What was done.** No credentials in the source; everything sensitive is read from the environment
and `.env*` is gitignored. Both the browser and the server validate against the same Zod schema, and
the server's check is the one that counts. Database access goes through Drizzle's parameterised
queries. The admin area is gated by middleware on every `/admin` request, and the gate refuses
everyone when `ADMIN_PASSWORD` is unset rather than falling open. The session cookie is httpOnly,
sameSite lax, and secure in production. Test data only; no real guest information was used at any
point.

**What is missing, and would matter in production.** These are stated plainly because a prototype
that hides them is worse than one that does not have them.

- The admin gate is one shared password, not authentication. There are no accounts and no roles, so it
  cannot tell you who changed a lead. Anyone with the token has full access.
- No rate limiting on the public form. Someone could submit repeatedly and run up API cost.
- No CSRF protection beyond the framework defaults, and no bot protection on the form.
- Guest contact details are stored in plain columns with no encryption at rest beyond whatever the
  database provider gives, and there is no retention policy or deletion route.
- No audit trail. A status change or a draft edit overwrites without recording who or when.
- Inquiry text is sent to Anthropic's API. Real deployment needs that in a privacy notice, and a
  data processing agreement.

---

## Known limitations

- The photographs are placeholders chosen to set the tone, not licensed assets. Real use needs the
  spa's own photography or properly licensed images, and the background in particular wants a
  higher resolution file than the one used here.
- The frosted panel is a CSS approximation of glass, not Apple's Liquid Glass, which is documented
  for Apple platforms and has no web implementation. It falls back to a solid surface where the
  browser cannot blur or the reader has asked for less transparency.
- Availability is generated, not real. Times shown to a guest are not held, and two guests could be
  offered the same slot.
- The catalog is seven representative treatments, hardcoded. Real use needs it in a table the front
  desk can edit without a deploy.
- Nothing is sent by the system itself. The dashboard hands the approved draft to the staff
  member's own mail or messages app, so a reply can actually go out today, but there is no
  server-side delivery and therefore no record of what was sent or when.
- No duplicate detection. The same guest submitting twice creates two leads.
- A failed automation is recorded but not retried.
- The reading happens moments after submission, so a lead can briefly appear with no summary. The
  dashboard says so rather than hiding it.
- No pagination on the lead list, which is fine at prototype volume and would not be at a year's.
- English only.

---

## What production would need

Roughly in the order it would matter:

1. **Real authentication.** Accounts, roles and an audit trail, so a manager and a receptionist do
   not share one login.
2. **Server-side sending.** The draft is editable and the dashboard already hands it to the staff
   member's own mail or messages app, so a reply can go out today. What is missing is sending it
   from the server, which is what gives you a record of what was sent, to whom and when.
3. **Live availability and booking.** Read from Booker/Mindbody, hold a slot rather than suggest
   one.
4. **A queue for outbound work,** so a failed email retries by itself.
5. **The catalog and policies in the database**, editable by staff, with the prompt reading from
   whatever is current.
6. **Rate limiting and bot protection** on the public form.
7. **Retention and deletion** for guest data, with the privacy notice to match.
8. **Monitoring.** An alert when classifications start failing, rather than finding out from the
   automation log.
9. **Evaluation set.** Thirty or so real inquiries with the right answers written down, so a prompt
   change can be checked rather than eyeballed.

---

## Estimated monthly cost in production

Assuming a single spa at roughly 100 inquiries a month. The low column is what it actually costs to
run: Vercel Pro is required for commercial use, Neon's free tier carries this volume comfortably,
and at 100 inquiries nothing else has a bill.

| | | |
|---|---|---|
| Vercel | Pro, required for commercial use | $20 |
| Neon Postgres | free tier at this volume, Launch if backups and branching are wanted | $0 to $19 |
| Anthropic API | ~100 inquiries at roughly $0.02 to $0.04 each | $2 to $4 |
| Resend | free to 3,000 emails a month, which 100 inquiries never approaches | $0 |
| Twilio | only if texts are used, about $0.008 each | $0 to $1 |
| Domain | amortised | $2 |
| | | **about $24 to $46 a month** |

The AI is the smallest line, which is worth saying out loud, because it is usually assumed to be the
largest. Hosting is roughly ten times the model spend.

### Why the model tier is what it is

A cheaper tier is the obvious saving, so it was measured rather than assumed. Running the three
required scenarios three times each:

| | Opus | A cheaper tier |
|---|---|---|
| Same classification on every run | 3 of 3 scenarios | 1 of 3 |
| Recommended a package for the anniversary guest | every run | 1 run in 3; otherwise asked her to choose |
| Priority assigned to the service complaint | general, every run | hot, every run |

The last row is the one that decided it. A complaint is not a sales lead, and labelling it hot puts
it in the queue staff use to chase revenue rather than the one they use to fix problems. The cheaper
tier did that consistently, not occasionally.

The saving would have been under a dollar a month at this volume. Consistency on the judgments the
system is actually graded on is worth more than that, so the default stays. The tier is read from
`ANTHROPIC_MODEL`, so it can be re-tested and changed without a code change as models and prices
move — which they do.
