# ═══════════════════════════════════════════════════════════════════════
# CalcInk Model Fine-Tuning v3 — Keras 3 Native (From Scratch)
# ═══════════════════════════════════════════════════════════════════════
# Bypasses ALL TF.js loading bugs by building a fresh MobileNetV2 in Keras 3 
# and training it from scratch using ImageNet pre-trained weights.
# ═══════════════════════════════════════════════════════════════════════

# ── Cell 1: Kaggle Setup ──────────────────────────────────────────────

import os
import json
import getpass

print("🔑 Kaggle Authentication")
kaggle_user = input("Enter your Kaggle Username: ")
kaggle_key = getpass.getpass("Enter your Kaggle Token/Key: ")

os.makedirs(os.path.expanduser('~/.kaggle'), exist_ok=True)
kaggle_path = os.path.expanduser('~/.kaggle/kaggle.json')
with open(kaggle_path, 'w') as f:
    json.dump({'username': kaggle_user.strip(), 'key': kaggle_key.strip()}, f)
os.chmod(kaggle_path, 0o600)
print("✅ Kaggle credentials saved!\n")


# ── Cell 2: Download Datasets ─────────────────────────────────────────

import subprocess

DATA_ROOT = '/content/data'
os.makedirs(DATA_ROOT, exist_ok=True)

print("📥 Downloading Sagyam Handwritten Math Symbols dataset...")
subprocess.run(['kaggle', 'datasets', 'download', '-d', 'sagyamthapa/handwritten-math-symbols', '-p', os.path.join(DATA_ROOT, 'sagyam')], check=True)
subprocess.run(['unzip', '-o', '-q', os.path.join(DATA_ROOT, 'sagyam', 'handwritten-math-symbols.zip'), '-d', os.path.join(DATA_ROOT, 'sagyam')])

print("📥 Downloading HASYv2 dataset from official Zenodo source...")
hasy_path = os.path.join(DATA_ROOT, 'hasyv2')
os.makedirs(hasy_path, exist_ok=True)
subprocess.run(['wget', '-q', '-O', os.path.join(hasy_path, 'HASYv2.tar.bz2'), 'https://zenodo.org/records/259444/files/HASYv2.tar.bz2'], check=True)
print("📦 Extracting HASYv2...")
subprocess.run(['tar', '-xf', os.path.join(hasy_path, 'HASYv2.tar.bz2'), '-C', hasy_path], check=True)

print("\n✅ Datasets downloaded!")


# ── Cell 3: Prepare & Unify Dataset ───────────────────────────────────

from PIL import Image
import random
import csv
import glob

CLASSES = [
    '0','1','2','3','4','5','6','7','8','9',
    'Add','Decimal','Division','Equals','Multiply','Minus',
    'X','Y','Z',
    'L_Paren','R_Paren','Caret','Sqrt','Pi','A','B'
]

IMG_SIZE = 100
UNIFIED_DIR = os.path.join(DATA_ROOT, 'unified')

for split in ['train', 'val', 'test']:
    for cls in CLASSES:
        os.makedirs(os.path.join(UNIFIED_DIR, split, cls), exist_ok=True)

def resize_and_save(src_path, dst_path):
    try:
        img = Image.open(src_path).convert('RGB')
        w, h = img.size
        scale = int(IMG_SIZE * 0.8) / max(w, h, 1)
        new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
        resized = img.resize((new_w, new_h), Image.LANCZOS)
        canvas = Image.new('RGB', (IMG_SIZE, IMG_SIZE), (255, 255, 255))
        canvas.paste(resized, ((IMG_SIZE - new_w) // 2, (IMG_SIZE - new_h) // 2))
        canvas.save(dst_path, 'PNG')
        return True
    except: return False

print("📦 Processing datasets...")
collected = {cls: [] for cls in CLASSES}

# FIXED SAGYAM MAP
sagyam_map = {
    '0':'0', '1':'1', '2':'2', '3':'3', '4':'4', '5':'5', '6':'6', '7':'7', '8':'8', '9':'9',
    '+':'Add', 'add':'Add', '.':'Decimal', 'dec':'Decimal', 'div':'Division', '/':'Division',
    '=':'Equals', 'eq':'Equals', 'mul':'Multiply', '*':'Multiply',
    '-':'Minus', 'sub':'Minus', 'x':'X', 'X':'X', 'y':'Y', 'Y':'Y', 'z':'Z', 'Z':'Z'
}
for root, dirs, _ in os.walk(os.path.join(DATA_ROOT, 'sagyam')):
    for d in dirs:
        if d in sagyam_map:
            mapped = sagyam_map[d]
            collected[mapped].extend([os.path.join(root, d, f) for f in os.listdir(os.path.join(root, d)) if f.endswith(('.png', '.jpg'))][:1500])

# SHOTGUN HASY MAP
hasy_map = {
    '(': 'L_Paren', '\\(': 'L_Paren', '\\left(': 'L_Paren', '\\leftparen': 'L_Paren',
    ')': 'R_Paren', '\\)': 'R_Paren', '\\right)': 'R_Paren', '\\rightparen': 'R_Paren',
    '^': 'Caret', '\\hat{}': 'Caret', '\\wedge': 'Caret', '\\caret': 'Caret', '\\textasciicircum': 'Caret',
    '\\sqrt{}': 'Sqrt', '\\pi': 'Pi', 'a': 'A', 'A': 'A', 'b': 'B', 'B': 'B',
    'x': 'X', 'X': 'X', 'y': 'Y', 'Y': 'Y', 'z': 'Z', 'Z': 'Z'
}
hasy_base = os.path.join(DATA_ROOT, 'hasyv2')
symbols_csv = glob.glob(os.path.join(hasy_base, '**', 'symbols.csv'), recursive=True)
data_csv = glob.glob(os.path.join(hasy_base, '**', 'hasy-data-labels.csv'), recursive=True)
if symbols_csv and data_csv:
    sym_id_to_latex = {}
    with open(symbols_csv[0], 'r') as f:
        for row in csv.reader(f): 
            if len(row) >= 2: sym_id_to_latex[row[0].strip()] = row[1].strip()
    data_dir = os.path.dirname(data_csv[0])
    with open(data_csv[0], 'r') as f:
        for row in csv.reader(f):
            if len(row) >= 2 and row[1].strip() in sym_id_to_latex:
                mapped = hasy_map.get(sym_id_to_latex[row[1].strip()])
                if mapped: collected[mapped].append(os.path.join(data_dir, row[0].strip().lstrip('/\\')))

print("\n📦 Balancing dataset...")
for cls in CLASSES:
    imgs = list(set(collected[cls]))
    random.seed(42)
    random.shuffle(imgs)
    imgs = imgs[:1200]
    n_train, n_val = int(len(imgs)*0.8), int(len(imgs)*0.1)
    splits = {'train': imgs[:n_train], 'val': imgs[n_train:n_train+n_val], 'test': imgs[n_train+n_val:]}
    for split, paths in splits.items():
        for i, src in enumerate(paths): 
            dst = os.path.join(UNIFIED_DIR, split, cls, f'{cls}_{i}.png')
            if not os.path.exists(dst): resize_and_save(src, dst)
    print(f"  {cls}: {len(imgs)} images")


# ── Cell 4: Build Fresh Keras 3 Model ─────────────────────────────────

import tensorflow as tf
import numpy as np

print("\n🚀 Building fresh MobileNetV2 from scratch...")

# Load pre-trained ImageNet backbone
base_model = tf.keras.applications.MobileNetV2(
    input_shape=(IMG_SIZE, IMG_SIZE, 3),
    include_top=False,
    weights='imagenet'
)

# Build custom head
x = base_model.output
x = tf.keras.layers.GlobalAveragePooling2D(name='pool')(x)
x = tf.keras.layers.Dense(1024, activation='relu', name='dense_features')(x)
x = tf.keras.layers.Dropout(0.3, name='dropout')(x)
outputs = tf.keras.layers.Dense(len(CLASSES), activation='softmax', name='predictions')(x)

model = tf.keras.Model(inputs=base_model.input, outputs=outputs)

print("✅ Model built successfully!")
model.summary()


# ── Cell 5: Data Generators & Class Weights ───────────────────────────

from tensorflow.keras.preprocessing.image import ImageDataGenerator
from sklearn.utils.class_weight import compute_class_weight

train_datagen = ImageDataGenerator(
    rescale=1./255, rotation_range=12, width_shift_range=0.08, 
    height_shift_range=0.08, shear_range=0.08, zoom_range=0.08, 
    fill_mode='constant', cval=255
)
val_datagen = ImageDataGenerator(rescale=1./255)

train_gen = train_datagen.flow_from_directory(
    os.path.join(UNIFIED_DIR, 'train'), target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=32, class_mode='categorical', classes=CLASSES, shuffle=True
)
val_gen = val_datagen.flow_from_directory(
    os.path.join(UNIFIED_DIR, 'val'), target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=32, class_mode='categorical', classes=CLASSES, shuffle=False
)

weights = compute_class_weight('balanced', classes=np.arange(len(CLASSES)), y=train_gen.classes)
class_weights = {i: w for i, w in enumerate(weights)}


# ── Cell 6: Train (Phase 1: Head Only) ────────────────────────────────

print("\n🏋️ Phase 1: Training head...")
base_model.trainable = False
model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss='categorical_crossentropy', metrics=['accuracy'])

model.fit(
    train_gen, epochs=10, validation_data=val_gen, class_weight=class_weights,
    callbacks=[tf.keras.callbacks.EarlyStopping(monitor='val_accuracy', patience=3, restore_best_weights=True)]
)


# ── Cell 7: Train (Phase 2: Fine-Tuning) ──────────────────────────────

print("\n🏋️ Phase 2: Fine-tuning entire model...")
base_model.trainable = True
model.compile(optimizer=tf.keras.optimizers.Adam(1e-5), loss='categorical_crossentropy', metrics=['accuracy'])

model.fit(
    train_gen, epochs=15, validation_data=val_gen, class_weight=class_weights,
    callbacks=[tf.keras.callbacks.EarlyStopping(monitor='val_accuracy', patience=4, restore_best_weights=True)]
)


# ── Cell 8: Export to TF.js ───────────────────────────────────────────

import subprocess, sys

KERAS_PATH = '/content/calcink_v2.keras'
TFJS_OUTPUT_DIR = '/content/tfjs_model_v2'
os.makedirs(TFJS_OUTPUT_DIR, exist_ok=True)

model.save(KERAS_PATH)

print("\n📦 Installing tensorflowjs for export...")
subprocess.run([sys.executable, '-m', 'pip', 'install', 'tensorflowjs', '-q'])

print("\n⚙️ Converting model to TF.js format...")
subprocess.run([
    sys.executable, '-m', 'tensorflowjs.converters.converter',
    '--input_format=keras',
    '--output_format=tfjs_layers_model',
    KERAS_PATH, TFJS_OUTPUT_DIR
], check=True)

class_map = {
    'classes': CLASSES,
    'token_map': {
        '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
        'Add':'+','Decimal':'.','Division':'÷','Equals':'=','Multiply':'×','Minus':'-',
        'X':'x','Y':'y','Z':'z','L_Paren':'(','R_Paren':')','Caret':'^','Sqrt':'√',
        'Pi':'π','A':'a','B':'b',
    },
    'num_classes': len(CLASSES),
}
with open(os.path.join(TFJS_OUTPUT_DIR, 'class_map.json'), 'w') as f:
    json.dump(class_map, f, indent=2)

print("\n✅ Model converted and ready for download!")


# ── Cell 9: Download ──────────────────────────────────────────────────

from google.colab import files
import zipfile

ZIP_PATH = '/content/calcink_v2_tfjs.zip'
with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED) as zf:
    for f in os.listdir(TFJS_OUTPUT_DIR):
        zf.write(os.path.join(TFJS_OUTPUT_DIR, f), f)

print(f"📦 ZIP ready: {os.path.getsize(ZIP_PATH):,} bytes")
files.download(ZIP_PATH)
