// @ts-nocheck
// ─── Recognition Worker ────────────────────────────────────────────
// Runs MobileNetV2 CNN inference off the main thread for high-accuracy
// handwritten math symbol recognition (from Sagyam/Handwritten-Optical-Character-Recognition).
// Automatically supports instant local fallback to guarantee 100% offline availability.

import * as tf from '@tensorflow/tfjs';

// Custom regularizers required by Sagyam's Keras export
class L2 {
  static className = 'L2';
  constructor(config: any) {
    return tf.regularizers.l1l2(config);
  }
}
class L1 {
  static className = 'L1';
  constructor(config: any) {
    return tf.regularizers.l1l2(config);
  }
}

try {
  (tf.serialization.registerClass as any)(L2);
  (tf.serialization.registerClass as any)(L1);
} catch {
  // Already registered
}

const SAGYAM_CLASSES = [
  '0','1','2','3','4','5','6','7','8','9',
  'Add','Decimal','Division','Equals','Multiply','Minus',
  'X','Y','Z',
  'L_Paren','R_Paren','Caret','Sqrt','Pi','A','B'
];

const SAGYAM_TOKEN_MAP: Record<string, string> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  'Add': '+', 'Decimal': '.', 'Division': '÷', 'Equals': '=',
  'Multiply': '×', 'Minus': '-', 'X': 'x', 'Y': 'y', 'Z': 'z',
  'L_Paren': '(', 'R_Paren': ')', 'Caret': '^', 'Sqrt': '√', 'Pi': 'π', 'A': 'a', 'B': 'b'
};

// 17 Classes from irfanchahyadi/Handwriting-Calculator for 784 fallback
const CLASS_LABELS: Record<number, string> = {
  0: '0', 1: '1', 2: '2', 3: '3', 4: '4',
  5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '+', 11: '-', 12: '×', 13: '÷', 14: '(', 15: ')', 16: '.',
};

let tfModel: tf.GraphModel | null = null;
let fallbackWeights: {
  w1: Float32Array; b1: Float32Array;
  w2: Float32Array; b2: Float32Array;
  w3: Float32Array; b3: Float32Array;
} | null = null;

let initPromise: Promise<void> | null = null;

async function initModel(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // 1. Load MobileNetV2 CNN model
    try {
      tfModel = await tf.loadGraphModel('/models/sagyam/model.json');
      console.log('MobileNetV2 CNN model loaded successfully!');
    } catch (e) {
      console.warn('Failed to load MobileNetV2, trying fallback weights:', e);
    }

    // 2. Fetch binary weights for 784-element fallback
    try {
      const binRes = await fetch('/models/weights.bin');
      if (binRes.ok) {
        const buf = await binRes.arrayBuffer();
        const w = new Float32Array(buf);
        fallbackWeights = {
          w1: w.subarray(0, 15680),
          b1: w.subarray(15680, 15700),
          w2: w.subarray(15700, 16100),
          b2: w.subarray(16100, 16120),
          w3: w.subarray(16120, 16460),
          b3: w.subarray(16460, 16477),
        };
      }
    } catch {
      // weights.bin fetch failed
    }
  })();

  return initPromise;
}

function runDirectForwardPass(input784: Float32Array): { label: string; confidence: number } {
  if (!fallbackWeights) {
    return { label: '?', confidence: 0 };
  }
  const { w1, b1, w2, b2, w3, b3 } = fallbackWeights;

  const h1 = new Float32Array(20);
  for (let j = 0; j < 20; j++) {
    let sum = b1[j];
    for (let i = 0; i < 784; i++) {
      sum += input784[i] * w1[i * 20 + j];
    }
    h1[j] = Math.max(0, sum);
  }

  const h2 = new Float32Array(20);
  for (let j = 0; j < 20; j++) {
    let sum = b2[j];
    for (let i = 0; i < 20; i++) {
      sum += h1[i] * w2[i * 20 + j];
    }
    h2[j] = Math.max(0, sum);
  }

  const logits = new Float32Array(17);
  let maxLogit = -Infinity;
  for (let j = 0; j < 17; j++) {
    let sum = b3[j];
    for (let i = 0; i < 20; i++) {
      sum += h2[i] * w3[i * 17 + j];
    }
    logits[j] = sum;
    if (sum > maxLogit) maxLogit = sum;
  }

  let expSum = 0;
  const probs = new Float32Array(17);
  for (let j = 0; j < 17; j++) {
    probs[j] = Math.exp(logits[j] - maxLogit);
    expSum += probs[j];
  }

  let maxIdx = 0;
  let maxVal = probs[0] / (expSum || 1);
  for (let j = 1; j < 17; j++) {
    const p = probs[j] / (expSum || 1);
    if (p > maxVal) {
      maxVal = p;
      maxIdx = j;
    }
  }

  return {
    label: CLASS_LABELS[maxIdx] ?? '?',
    confidence: maxVal,
  };
}

interface ClassifyRequest {
  type: 'classify';
  id: number;
  tensors: Float32Array[];
  batchSize: number;
}

interface ClassifyResponse {
  type: 'result';
  id: number;
  labels: string[];
  confidences: number[];
}

interface ErrorResponse {
  type: 'error';
  id: number;
  message: string;
}

self.onmessage = async (e: MessageEvent<ClassifyRequest>) => {
  const { type, id, tensors } = e.data;
  if (type !== 'classify') return;

  try {
    await initModel();

    const labels: string[] = [];
    const confidences: number[] = [];

    if (tfModel) {
      for (const tensor of tensors) {
        if (tensor.length === 30000) {
          // 100x100x3 RGB image for MobileNetV2
          const tensor4d = tf.tensor4d(tensor, [1, 100, 100, 3]);
          const pred = tfModel.predict(tensor4d) as tf.Tensor;
          const probs = pred.dataSync();
          tensor4d.dispose();
          pred.dispose();

          let maxIdx = 0;
          let maxVal = probs[0];
          for (let i = 1; i < SAGYAM_CLASSES.length; i++) {
            if (probs[i] > maxVal) {
              maxVal = probs[i];
              maxIdx = i;
            }
          }
          const rawLabel = SAGYAM_CLASSES[maxIdx] ?? '?';
          const token = SAGYAM_TOKEN_MAP[rawLabel] ?? rawLabel;
          labels.push(token);
          confidences.push(maxVal);
        } else {
          const { label, confidence } = runDirectForwardPass(tensor);
          labels.push(label);
          confidences.push(confidence);
        }
      }
    } else {
      for (const tensor of tensors) {
        const { label, confidence } = runDirectForwardPass(tensor);
        labels.push(label);
        confidences.push(confidence);
      }
    }

    console.log('[CalcInk:Worker] Inference complete:', labels.map((l, i) => `${l} (${Math.round((confidences[i] || 0) * 100)}%)`).join(', '));
    const response: ClassifyResponse = { type: 'result', id, labels, confidences };
    self.postMessage(response);
  } catch (err) {
    console.error('[CalcInk:Worker] Inference failed:', err);
    const response: ErrorResponse = {
      type: 'error',
      id,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
    self.postMessage(response);
  }
};
