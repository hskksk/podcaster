# English Sentence Mechanics

Load this when the output language is English. It covers what makes an English sentence readable — where the verb sits, how information is ordered within a sentence, and which constructions bury the action. Paragraph- and argument-level norms live in `prose-style.md`.

Source: prism-data-labs-agent `write-clear-prose/references/english.md` (Gopen and Swan, Williams, plain-language practice). Analysis-specific examples are rewritten for research.

## 1. Put the action in the verb

English buries its meaning by turning verbs into nouns and then propping them up with a weak verb. Find the real action and make it the verb.

```
Weak: The implementation of the new import step resulted in a reduction of failed rows.
Better: The new import step reduced failed rows by 40%.

Weak: An investigation into the discrepancy was conducted.
Better: The discrepancy traces to two duplicated orders.
```

Watch for `-tion`, `-ment`, `-ance`, `-ity` paired with `make`, `perform`, `conduct`, `provide`, `achieve`, `result in`. Each pair usually hides one strong verb.

## 2. Keep subject and verb together, and both near the start

A reader holds the subject in mind until the verb arrives. Everything inserted between them is held open at the same time.

```
Hard: The cohort of customers acquired before 2024, which by the end of the period accounted for
      94% of revenue and had a markedly higher repeat rate, was responsible for the growth.
Better: The pre-2024 cohort drove the growth. It accounted for 94% of revenue by the end of the
      period, and its repeat rate was markedly higher.
```

Two habits follow: open with the grammatical subject rather than a long qualifying clause, and move the qualifications into their own sentence rather than into the gap.

## 3. Old information first, new information last

Each sentence should start from something the previous sentence established and end on what is new. The end of a sentence is its stress position; put there the thing you want remembered.

```
Disconnected: A change to the retry policy is the cause. Failed jobs rose 4.3x in the nightly queue.
Connected:    Failed jobs in the nightly queue rose 4.3x. That rise traces to a change in the retry
              policy: a job now gives up after two attempts, down from five.
```

Stacked, this creates a chain — each sentence's new element becomes the next one's starting point — and it is what makes a paragraph feel like it is going somewhere.

## 4. Prefer the active voice, and know when not to

Active by default: it names who acts and is shorter. Passive is correct when the actor is unknown, irrelevant, or genuinely not the point — and in a research report, when the finding rather than the researcher is the subject.

```
Active:  The import step drops rows without a customer id.
Passive, correct: 11% of delivery timestamps were never recorded.
Passive, evasive:  Errors were introduced during processing.   ← by what?
```

Never use the passive to avoid saying that a source was not read or a check was not run. That is a register failure, not a style choice.

## 5. Make parallel things look parallel

When items share a role, give them the same grammatical shape. A reader who sees the pattern break assumes the meaning broke too.

```
Ragged: The fix improves accuracy, reduced latency, and the cost will be lower.
Parallel: The fix improves accuracy, reduces latency, and lowers cost.
```

This governs list items, table cell phrasing, and headings within one document.

## 6. Sentence length

Vary it; do not cap it. A long sentence is fine when it carries one idea with its qualifications attached, and a sequence of short ones reads as choppy and disconnected. The problem is never length by itself — it is a long sentence carrying two independent claims, which should be two sentences.

Diagnostic: if you cannot say the sentence aloud in one breath and still name its subject and verb, split it at the seam between its claims.

## 7. Cut what carries nothing

- **Throat-clearing openers**: "It is important to note that", "It should be mentioned that", "There are several factors that". Delete and start with the content.
- **Empty intensifiers**: "very", "quite", "significantly" where no significance was tested, "clearly", "obviously".
- **Doubled words**: "each and every", "first and foremost", "basic fundamentals".
- **`There is` / `It is` openings** that displace the real subject: "There are three tables that lack a primary key" → "Three tables lack a primary key".
- **Hedge stacks**: "may possibly suggest that it could be". One hedge, chosen deliberately, carries meaning; three cancel each other and read as evasion.

## 8. Words

Prefer the plain word to the formal one where they mean the same thing: `use` over `utilize`, `about` over `approximately` in prose, `show` over `demonstrate`, `start` over `commence`, `so` over `accordingly`. Keep the technical term when it is the technical term — `cardinality`, `cohort`, `idempotent` — and define it on first use if the reader may not share it.

Be consistent: one name per thing, used every time. Elegant variation ("the table", "the dataset", "the collection" for one object) makes the reader wonder whether three things are in play.

## 9. Punctuation that carries structure

- **Em dash** — one pair per paragraph at most, for an aside the sentence could survive without.
- **Colon**: introduces the thing just promised; the promise must come first.
- **Semicolon**: joins two independent clauses whose connection you want to assert without a conjunction. Not a stronger comma.
- **Serial comma**: use it, always. `A, B, and C` cannot be misread as `A` and `(B and C)`.

## 10. What the Japanese revision changed, and what carries over

Three conventions were reversed for Japanese output after measuring two real reports. Two of them carry over to English; one does not.

**Carries over — numbered `[n]` citations.** Put the citation at the end of the sentence and keep the source name out of the subject position. Without a citation mechanism, every source becomes a grammatical subject and the report turns into a bibliography.

```
Weak:   Validatar's "10 Data Quality Tests" notes that missing referential integrity in
        PIT/Bridge surfaces as a reporting gap rather than an error.
Better: Missing referential integrity in PIT/Bridge surfaces as a reporting gap, not an error [25].
```

Name a source in running text only when its position is itself the subject — "Brooks separated essential from accidental complexity" is right, because Brooks is what the sentence is about.

**Carries over — headings that state the finding.** `## 3. Hash contracts — they break silently and joins disappear`. The original rule sent conclusions to each section's first sentence and left headings as bare noun phrases. That produces a table of contents a reader cannot navigate, in either language. Run the **contents test**: read only the headings, top to bottom, and see whether you can state the survey's conclusion.

**Does not carry over — bold density.** Japanese has no capitals and no spaces between words, so bold is one of the few scanning landmarks, and `japanese.md` 2.10 removes the cap on it. English already has capitals, italics and word spacing. Keep bold sparse here: a couple of spans per section, and only to prevent a misreading.
