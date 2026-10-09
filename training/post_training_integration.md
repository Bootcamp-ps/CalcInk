# Post-Training Integration Guide

> After the Colab training is complete and you've downloaded the new TF.js model files,
> apply these code changes to CalcInk.

---

## Step 1: Replace Model Files

```bash
# From the unzipped calcink_v2_tfjs.zip, copy all files except class_map.json:
cp model.json public/models/sagyam/model.json
cp group1-shard*.bin public/models/sagyam/
```

Verify the new model.json references the correct number of output classes (26 instead of 19).

---

## Step 2: Update `src/workers/recognitionWorker.ts`

### 2a. Update SAGYAM_CLASSES (line 30-33)

**Before:**
```typescript
const SAGYAM_CLASSES = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'Add', 'Decimal', 'Division', 'Equals', 'Multiply', 'Minus', 'X', 'Y', 'Z'
];
```

**After:**
```typescript
const SAGYAM_CLASSES = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'Add', 'Decimal', 'Division', 'Equals', 'Multiply', 'Minus', 'X', 'Y', 'Z',
  'L_Paren', 'R_Paren', 'Caret', 'Sqrt', 'Pi', 'A', 'B'
];
```

### 2b. Update SAGYAM_TOKEN_MAP (line 35-47)

**Add these entries:**
```typescript
const SAGYAM_TOKEN_MAP: Record<string, string> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  'Add': '+',
  'Decimal': '.',
  'Division': '÷',
  'Equals': '=',
  'Multiply': '×',
  'Minus': '-',
  'X': 'x',
  'Y': 'y',
  'Z': 'z',
  // ─── New classes (v2) ───
  'L_Paren': '(',
  'R_Paren': ')',
  'Caret': '^',
  'Sqrt': '√',
  'Pi': 'π',
  'A': 'a',
  'B': 'b',
};
```

---

## Step 3: Update `src/recognition/specialSymbols.ts`

Since brackets `(` and `)` are now handled by the CNN model, the geometric bracket rules
can be **removed** (the `ENABLE_BRACKET_RULES` flag and all bracket detection code from lines 136-171).

The following special symbols should **remain** as geometric rules (they work better than CNN):
- `=` (two horizontal strokes — deterministic, 99% accuracy)
- `÷` (three-stroke: bar + two dots — deterministic)
- `.` (tiny dot — too small for reliable CNN)
- `/` (slash for division — angle-based detection)

**Remove the entire bracket detection block (lines 136-171).**

---

## Step 4: Update `src/recognition/pipeline.ts`

### 4a. Remove bracket-CNN conflict resolution (lines 219-236)

The current logic has a special case where if `specialSymbols.ts` detects a bracket but
the CNN says it's a `3` with high confidence, the CNN wins. This was a workaround for
not having brackets in the model.

**Since brackets are now in the CNN, simplify this to just use CNN results directly:**

**Before:**
```typescript
if (bracketCandidate) {
  if (cnnToken === '3' && cnnConf >= 0.70) {
    rowResults[rowIndex]!.tokens[groupIndex] = cnnToken;
    rowResults[rowIndex]!.confidences[groupIndex] = cnnConf;
  } else {
    rowResults[rowIndex]!.tokens[groupIndex] = bracketCandidate.token;
    rowResults[rowIndex]!.confidences[groupIndex] = bracketCandidate.confidence;
  }
} else {
  rowResults[rowIndex]!.tokens[groupIndex] = cnnToken;
  rowResults[rowIndex]!.confidences[groupIndex] = cnnConf;
}
```

**After:**
```typescript
rowResults[rowIndex]!.tokens[groupIndex] = cnnToken;
rowResults[rowIndex]!.confidences[groupIndex] = cnnConf;
```

### 4b. Remove bracketCandidate from pendingIndices (lines 147-151)

Since we no longer need to track bracket candidates, simplify the pending indices:

```typescript
pendingIndices.push({
  rowIndex: r,
  groupIndex: g,
});
```

---

## Step 5: Update Parser (if `^`, `√`, `π` are added)

These are **new grammar rules** that need to be added to the recursive-descent parser:

### 5a. Power operator `^`

```
expr    → term (('+' | '-') term)*
term    → factor (('×' | '÷') factor)*
factor  → atom ('^' factor)?          ← NEW: right-to-left associativity
atom    → NUMBER | VARIABLE | '(' expr ')' | '√' atom | 'π'
```

### 5b. Square root `√`

Treat `√` as a unary prefix operator:
- `√9` → `Math.sqrt(9)` = 3
- `√(16+9)` → `Math.sqrt(25)` = 5

### 5c. Pi constant `π`

Treat `π` as a numeric constant:
- `π` → `Math.PI` ≈ 3.14159
- `2π` → `2 * Math.PI` ≈ 6.28318

---

## Step 6: Update README.md

### 6a. Update class count (line 69)
```diff
-- **Recognition Model**: [MobileNetV2 CNN](...) (~2.3M parameters, 100×100×3 RGB, 19 classes)
+- **Recognition Model**: [MobileNetV2 CNN](...) (~2.3M parameters, 100×100×3 RGB, 26 classes)
```

### 6b. Update output classes section (line 85-89)
```diff
-- **Output Classes (19)**:
+- **Output Classes (26)**:
   - **Digits (0–9)**: `0, 1, 2, 3, 4, 5, 6, 7, 8, 9`
   - **Operators**: `+` (Add), `-` (Minus), `×` (Multiply), `÷` (Division), `=` (Equals)
   - **Decimal Point**: `.` (Decimal)
   - **Variables**: `x` (X), `y` (Y), `z` (Z)
+  - **Brackets**: `(` (L_Paren), `)` (R_Paren)
+  - **Advanced Math**: `^` (Caret/Power), `√` (Sqrt), `π` (Pi)
+  - **Extended Variables**: `a` (A), `b` (B)
```

### 6c. Update supported operations table (lines 25-33)
Add rows for brackets, power, sqrt, and pi.

---

## Step 7: Verify

```bash
# 1. Build (type-check + bundle)
npm run build

# 2. Run tests
npm run test -- --run

# 3. Start dev server and manually test
npm run dev

# Manual test checklist:
# - Write "2+3=" → should show 5 ✓
# - Write "(2+3)×4=" → should show 20 ✓  (new brackets!)
# - Write "2^3=" → should show 8 ✓  (new power!)
# - Write "x=5" then "x+3=" → should show 8 ✓  (variable regression)
# - Write "3.14×2=" → should show 6.28 ✓  (decimal regression)
# - Open DevTools Network tab → verify 0 external requests ✓
```

---

## Files Changed Summary

| File | Change |
|:-----|:-------|
| `public/models/sagyam/model.json` | Replaced (new 26-class topology) |
| `public/models/sagyam/group1-shard*.bin` | Replaced (new weights) |
| `src/workers/recognitionWorker.ts` | Updated class list + token map |
| `src/recognition/specialSymbols.ts` | Removed bracket detection rules |
| `src/recognition/pipeline.ts` | Simplified CNN result handling |
| `src/parser/` | Added `^`, `√`, `π` grammar rules |
| `README.md` | Updated class count + supported symbols |
