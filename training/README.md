# CalcInk Model Fine-Tuning

> Expand the MobileNetV2 CNN from **19 → 26 classes** via transfer learning.

## New Classes Being Added

| Index | Class Name | Token | Source |
|:------|:-----------|:------|:-------|
| 19 | `L_Paren` | `(` | CROHME / HASYv2 |
| 20 | `R_Paren` | `)` | CROHME / HASYv2 |
| 21 | `Caret` | `^` | HASYv2 |
| 22 | `Sqrt` | `√` | CROHME / HASYv2 |
| 23 | `Pi` | `π` | HASYv2 |
| 24 | `A` | `a` | CROHME / HASYv2 |
| 25 | `B` | `b` | CROHME / HASYv2 |

## Prerequisites

1. A **Google account** for [Google Colab](https://colab.research.google.com)
2. A **Kaggle account** with an API key (`kaggle.json`)
   - Go to [kaggle.com/settings](https://www.kaggle.com/settings) → "API" → "Create New Token"

## Steps

### 1. Upload to Colab

1. Open [Google Colab](https://colab.research.google.com)
2. Upload `colab_finetune.py` as a new notebook (or copy-paste each cell)
3. Select **Runtime → Change runtime type → T4 GPU**

### 2. Upload Model Files

Upload the current TF.js model files from `public/models/sagyam/` to Colab:
- `model.json`
- `group1-shard1of4.bin`
- `group1-shard2of4.bin`
- `group1-shard3of4.bin`
- `group1-shard4of4.bin`

### 3. Upload Kaggle Key

Upload your `kaggle.json` file to Colab (the notebook will move it to the right location).

### 4. Run All Cells

The notebook handles everything:
- Dataset download (Sagyam + CROHME + HASYv2)
- Data preparation (filter, resize, augment, balance)
- Model conversion (TF.js → Keras)
- Transfer learning (Phase 1: head-only, Phase 2: fine-tune top blocks)
- Evaluation (per-class accuracy, confusion matrix)
- Export (Keras → TF.js format)

### 5. Download & Deploy

After training, download the output files from `/content/tfjs_model_v2/` and replace:
```
public/models/sagyam/model.json          ← new topology
public/models/sagyam/group1-shard*.bin   ← new weights
```

Then apply the code changes described in `post_training_integration.md`.

## Time Estimate

| Phase | Duration |
|:------|:---------|
| Data download & prep | ~30 min |
| Phase 1 training (head-only) | ~15 min |
| Phase 2 training (fine-tune) | ~15 min |
| Evaluation & export | ~5 min |
| **Total** | **~65 min** |

## Validation

Before deploying, check:
- [ ] Per-class accuracy ≥ 90% for all 26 classes
- [ ] Original 19 classes maintain accuracy within 2%
- [ ] No systematic `(` / `3` or `)` / `0` confusion
- [ ] TF.js model loads in browser without errors
