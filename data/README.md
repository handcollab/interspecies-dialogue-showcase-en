# Interspecies Dialogue · Plant-side data

Between 2025-12-10 and 2026-02-11 the research team recorded the stomata of leaf epidermis opening and closing under a microscope, over hundreds of trials in all. This folder holds a curated selection of 200 segments from those recordings: their spreadsheet records, reorganised into a format the website can read directly.

Every file has been de-identified: there are no names of people, no accounts, no cloud links and no other identifiers, and the annotators' signatures in the original sheet have been removed. People are referred to only as "the research team".

This is the English edition of the data README. The data files themselves are the same as on the Chinese site: values from the original sheet (plant names, methods, notes) stay in Chinese, with English fields alongside where noted below. Literal values are shown in `code` with an English gloss.

## Files

| File | Contents |
| --- | --- |
| `experiments.json` | Conditions and results of the 200 curated segments (an array, one entry per segment) |
| `experiments.csv` | A compact table of the same, UTF-8 with a BOM so that Excel opens it directly |
| `annotations.csv` | The 55 annotated segments as a table: the first 14 columns are the original sheet's columns (annotation number … note), with Chinese column names as in the original; the last 5 are the derived outcome class, whether the row is counted, the annotation format, the aperture curve and the peak aperture |
| `annotations.json` (originally `yolo.json`) | Aperture annotations for those 55 segments (an array), for training automatic detection |
| `site.json` | The compact form of the same records that the page itself reads (shared with the Chinese site) |
| `notes-en.json` | English renderings of the `note` field, keyed by record id, used only for the tooltips of this English site. They are translations; the Chinese `note` in `experiments.json` is the record of reference |

## experiments.json fields

| Field | Description |
| --- | --- |
| `id` | 1–200, the original spreadsheet row number minus 1 (`sheet_row` is the original row number) |
| `date` | Recording date (ISO) |
| `plant_zh` / `plant_en` | `鴨拓草` Inchplant (called a purple-backed inchplant in the documentary's "Experiment" chapter), `紫錦草` Purple heart, `扶桑花` Chinese hibiscus, `佛羅里達蔓綠絨` Philodendron 'Florida'. The Chinese common names follow the sheet; the English and botanical names are presumed, not verified |
| `scope` / `handheld` | `MICROTECH` (December to January) or `Dino-Lite` (the handheld microscope, from February) |
| `mag` / `mag_approx` | Magnification; for the handheld microscope it is approximate (`mag_approx: true`) |
| `variable` / `variable_en` | The sheet's experimental variable: `水` water or `光照` light |
| `method` / `method_en` | `噴水` spray, `刷毛` brush, `浸泡` soak, `浸泡 5 秒` soak 5 s, `浸泡 5 秒 + 刷毛` soak 5 s + brush, `藍光` blue light, `白光` white light, `手機手電筒` phone flashlight |
| `stimulus` | A coarse grouping for statistics: `水` water, `藍光` blue light, `其他光` other light (white light, phone flashlight) |
| `humidity` / `temp` | Humidity in %, temperature in °C; the first 3 records have no reading (`null`) |
| `light` | The sheet's "light" column. All 200 read 450 nm / 660 nm, presumably the fixed lighting of the recording setup; the "blue light" of the experimental variable is a separate blue flashlight shone on the leaf |
| `note` | The sheet's note, kept word for word in Chinese (checked to contain no names). English renderings are in `notes-en.json` |
| `outcome` / `outcome_en` | The outcome class; rules below |
| `outcome_phrase` / `outcome_rule` / `outcome_confidence` | The phrase in the note that decided the class, the rule applied, and the confidence |
| `watered_ago_hours` | Hours since the last watering: just watered = 0, about a week = 168, "about X days" = X × 24; `null` if not stated |
| `watered_ago_text` | The phrase in the note it was read from |
| `flags` | Markers drawn from the note (in Chinese): `更換電池` battery replaced, `藍光電力微弱` blue lamp battery weak, `藍光電力下降` blue lamp battery running down, `藍光中途沒電` blue lamp died midway, `藍色玻璃紙照明` blue cellophane lighting, `新葉` new leaf, `蟲害` pest damage, `自然斷枝` naturally broken branch, `前一日剪下` cut the day before, `錄影檔毀損` recording file corrupted, `溫濕度未記錄` temperature and humidity not recorded, `疑似氣體排出` possible gas release, `植株狀況不佳` plant in poor condition, `葉片綠化` leaf turned green, `正常葉片` normal leaf, `實驗前可能已開` possibly open before the experiment, `部分氣孔已微開` some stomata already slightly open |
| `yolo_id` | If the segment has an aperture annotation, the matching `id` in `annotations.json` |

## Outcome rules

The classes use the research team's own words (the note text); the videos were not re-watched to judge them. The rules are checked in order, and the first match wins:

| Rule | The note contains | Class (`outcome` / `outcome_en`) | Confidence |
| --- | --- | --- | --- |
| R1 | `有待商榷` "open to question" | `待商榷` Uncertain | high |
| R2 | `難以觀測` "hard to observe" | `難以觀測` Hard to observe | high |
| R3 | `顯著` "striking", as in `效果顯著` or `開關緩慢但顯著` | `顯著` Striking | high |
| R4 | `開關不明顯` or `開關緩慢不明顯` "opening and closing not obvious" | `不明顯` Subtle | high |
| R5 | `無明顯開關` "no obvious opening or closing" | `無明顯` None | high |
| R6 | only `開關緩慢` "slow to open and close" or `些微打開` "opened slightly" | `不明顯` Subtle (a conservative call) | low |
| R7 | the note cell is empty | `未記錄` Unrecorded | — |
| R8 | the note has text, but says nothing about opening or closing | `明顯(空白)` Visible | medium |

R8 follows the research team's convention: a note that does not mention the outcome means the opening and closing were clear but not striking, a class the team calls "blank" (`空白`). For the 2 records under R7 (ids 8 and 17) the cell was left empty, so it cannot be said whether the convention applies; the aperture annotation for id 17 shows it opening from 0% to about 40%.

On the website, Uncertain, Hard to observe and Unrecorded are drawn together as "Other".

## annotations.json fields

| Field | Description |
| --- | --- |
| `id` / `exp_id` | Annotation number 1–55; the matching experiment `id` |
| `counted` / `skip_reason` | Annotations 34 and 52 have no aperture percentages and were not counted by the research team |
| `format` | `points`: aperture / time marked point by point (mostly annotations 1–32); `segments`: marked by time ranges (from annotation 33, or rows that mix in ranges); `none`: no aperture |
| `target` | Which stoma in the frame is tracked (for example, the stoma at the top left) |
| `aperture` | `[[seconds, aperture %], …]`, sorted by time, ready to plot as a curve |
| `aperture_interpolated` | `true` where the annotation gives several steps such as "20% - 30% - 40%"; the values in between are spread evenly across the range, as an illustration only |
| `aperture_ambiguous` | `true` where the annotation is written as "0% / 30%", listing several stomata at once; the curve follows whichever opens widest, so it can jump |
| `segments` | The raw structure of range-style annotations: `start`, `end`, `label` (original text), `from` / `to` (aperture at the start and end), `lo` / `hi` (the range of all values in the segment), `ranges`, `other_stomata` (`true` when the annotation says it refers to another stoma; not used in the main curve) |
| `good_segments` | From annotation 33, the stretches marked as good picture quality, `[[start, end], …]` in seconds |
| `noise` | Noisy stretches such as blur or small changes of position, `[[start, end], …]` in seconds; from annotation 13 the research team notes that noise is marked only roughly (`noise_coarse`) |
| `blurry` | The annotation mentions that the picture is rather blurred |
| `duration_s_est` | The latest time mentioned in the annotation, roughly the length of the video |
| `metrics` | Computed from `aperture`: starting aperture, peak aperture and its time, the rise, the time of the first reading 10 percentage points above the start (`t_rise10`), and the fall after the peak |
| `annotation_notes` / `raw_aperture` / `raw_noise` / `parse_issues` | Written remarks in the annotation, the original strings, and any problems met while parsing |

Cases handled while parsing: time written as m:ss and h:mm:ss; full-width brackets and punctuation; "40 ~ 60%" (read as a range of values); "a - b - c - d" with one hyphen too many (split into two ranges); ranges whose end comes before their start (dropped and recorded in `parse_issues`); times that go backwards (re-sorted on output and recorded). All 55 annotations can be parsed; 4 of them keep `parse_issues`.

## Limits

- These 200 segments are a curated selection from hundreds of trials, not all of the trials; every count and proportion describes only these 200.
- These are observation records, not a controlled experiment. Dates, plants, leaves, microscopes, lamp battery and watering intervals are all mixed together, so the differences seen cannot be read as cause and effect.
- The sample is small and uneven: purple heart 110 segments, inchplant 63, Chinese hibiscus 26, Philodendron 'Florida' 1.
- The outcome classes are the research team's judgement by eye; the aperture percentages are also the annotators' estimates by eye, not measurements from the images.
- Watering intervals are mostly approximate ("about X days").
- The 55 segments with YOLO annotations were chosen as material and lean toward clips where opening and closing can be seen.
