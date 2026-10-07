# Forma → Essentials merge (v1.4.0)

Forma (`mohan9398/gym`: FastAPI + Postgres backend, React/Capacitor web app,
trainer/member roles) was a separate fitness app. In v1.4.0 its single-user
features were rebuilt inside Essentials on the local-first Firebase storage
pattern, the same way Catalyst was folded in v1.2.0
([`CATALYST_MERGE.md`](CATALYST_MERGE.md)). Nothing was copied wholesale: data
and drawings were ported, Python logic was rewritten as small TypeScript
functions, and every screen was redrawn in the "Glance" design (`Hue.train`
only). The Forma repo itself is untouched.

## Feature map

| Forma | Essentials | Notes |
|---|---|---|
| Exercise catalog (34) + anatomy atlas (14 muscles) — `exercises/catalog.py`, `anatomy.py` | `data/training/exercises.json`, `muscles.json`, `utils/ExerciseCatalog.ts` | Dumped once from the Python source (helper defaults and muscle mapping expanded). `search()`/`regionsWithCounts()` are ports of `service.py`. |
| `BodyMap.tsx` (SVG body, 14 regions, heat map) | `components/training/BodyMap.tsx` | react-native-svg; CSS classes became inline props, hover/keyboard became `onPress`, drop-shadow filters dropped. Palette is graphite + coral. |
| `ExerciseArt.tsx`, `poses.ts`, `MuscleChip.tsx` | `components/training/ExerciseArt.tsx`, `data/training/poses.ts`, `MuscleChip.tsx` | Arrowheads are drawn paths (no SVG markers). |
| Muscle explorer (`AnatomyPage`) + library (`TrainingPage`) | `train/explore.tsx` | Front/back, named selector, equipment/level filters, search, favourites (`training/favourites`). |
| Exercise detail | `train/exercise/[id].tsx` | Steps, breathing, mistakes, alternative, "Add to a day". |
| Routines / `PUT /plans/me` | `train/edit-day.tsx` | The 7-day split stays the plan model; edit a day from the week plan. Forma's routine library and month calendar were not ported. |
| `WorkoutModal` + `PreviousSession` | Train tab + `ExerciseRow` | Per-set reps × kg, "Use last time", remaining-sets stepper, 60 s rest ring. Last time comes from logged sessions, matched by move name. |
| `records.py` | `utils/TrainingRecords.ts` | Heaviest set and Epley e1RM per move, plus "new record" detection on the finish screen. Forma only took max weight and max reps separately. |
| `goals.py` | `utils/GoalStorage.ts` | Sessions / minutes / active days; status ported exactly. `users/{uid}/goals/{id}`. |
| `progress/router.py` recap + heat maps | `train/progress.tsx`, `utils/TrainingVolume.ts` | 7/30 days, muscle-load body maps, sets per day. |
| Weekly check-in | **Weekly review**, `utils/ReviewStorage.ts` | Renamed to avoid the office Check-in. One per week at `reviews/{monday}`. `share_with_coach` dropped. |

## Dropped

FastAPI backend, Postgres/SQLite, Alembic, auth and demo mode, trainer/member
roles, coaching and messaging, `PlanModal`, Coach/Members/Auth pages, Capacitor
shells, NDJSON export, the starting-point questionnaire, ShareCard (needs
`react-native-view-shot`/`expo-sharing`; not added), and Forma's nutrition
macros and water/sleep/energy recovery logging (Fuel and Hydration cover those).

## Data

Additive and backwards compatible. New optional fields: `Exercise.catalogId`,
`Exercise.muscles`, `WorkoutSession.minutes`, `SessionExercise.sets`. Sessions
logged before v1.4.0 have no sets: records use their top weight, volume uses
the old per-move weight sum, and a completed move counts as one set in recaps.
`TrainingDay.anatomyFocus` and the PNG anatomy plates were replaced by the
body map. Forma's database contents were not migrated.

## Notes

The library text and illustrations are Forma's starter content and still need
qualified review before wide release. Sets, reps and load are starting values,
not prescriptions.
