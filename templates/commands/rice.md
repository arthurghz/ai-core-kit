---
description: Prioritize features with RICE scoring (Reach, Impact, Confidence, Effort), optionally under an effort-capacity limit. Usage: /rice <features.csv|inline list> [--capacity N]
argument-hint: <features.csv | inline list> [--capacity N]
---

# /rice

Score and rank the features in **$ARGUMENTS** using the RICE framework, then
recommend what to build.

## Input

Accept either a CSV path or an inline list. Expected columns:

```csv
feature,reach,impact,confidence,effort
Dark mode,5000,2,0.8,3
API v2,12000,3,0.9,8
SSO integration,3000,2,0.7,5
Mobile app,20000,3,0.5,13
```

| Field | Meaning | Scale |
|---|---|---|
| reach | users/events affected per time period | count (e.g. per quarter) |
| impact | per-user impact | 3 = massive, 2 = high, 1 = medium, 0.5 = low, 0.25 = minimal |
| confidence | how sure the estimates are | 1.0 = high, 0.8 = medium, 0.5 = low |
| effort | person-months (or person-weeks — be consistent) | positive number |

If a field is missing, estimate it, **mark the estimate**, and lower
`confidence` accordingly. If `--capacity N` is given, treat `N` as the total
effort budget for the period.

## Scoring

```
RICE = (reach × impact × confidence) / effort
```

Compute the score for every feature, rank descending. When `--capacity` is set,
greedily select top-ranked features until the cumulative effort would exceed the
budget, and list the rest as deferred.

## Output

```markdown
## RICE prioritization

| Rank | Feature | Reach | Impact | Conf | Effort | RICE | Selected |
|---|---|---|---|---|---|---|---|
| 1 | <name> | … | … | … | … | <score> | yes/no |

**Recommended this period** (effort ≤ capacity): <features> (Σ effort = X / N)
**Deferred:** <features>

### Notes
- <any estimated inputs, ties, or caveats>
- <a feature with a high score but huge effort worth splitting>
```

Round RICE scores to one decimal. Call out close calls (scores within ~10%) so
the human can break the tie on strategy, not just arithmetic.

## Notes

- RICE ranks **comparable** features; do not compare across wildly different
  effort units. Keep effort in one unit across the list.
- A low-confidence high-score item is a candidate for a spike, not a commitment.
- Feed the winning items into `/prd` to specify them before building.
