# -*- coding: utf-8 -*-

import tensorflow as tf
from tensorflow.keras import layers, Model, optimizers
import numpy as np
import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk

# --- 1. CONFIGURAÇÃO ---
BITMAP_SIZE = 300
IMG_HEIGHT = 32
IMG_WIDTH = 32
IMG_CHANNELS = 3 

# Parâmetros da Curva
NUM_CONTROL_POINTS = 20
NUM_CURVE_SAMPLES = 64
LINE_THICKNESS = 1

# Parâmetros de Treinamento
EPOCHS = 500
BATCH_SIZE = 32
LEARNING_RATE = 0.000081

# MODIFICADO: Pesos da Loss simplificados
W_CP = 1.0      # Apenas a perda de CP será usada
W_IMG = 0.0
W_AREA = 0.0

# --- 2. O GERADOR ---
def build_generator(output_dim=NUM_CONTROL_POINTS * 2, input_shape=(BITMAP_SIZE,), activation='leaky_relu'):
    inputs = layers.Input(shape=input_shape)
    x = layers.Dense(256)(inputs)
    if activation == 'leaky_relu': x = layers.LeakyReLU(alpha=0.2)(x); x = layers.Dense(512)(x); x = layers.LeakyReLU(alpha=0.2)(x); x = layers.Dense(512)(x); x = layers.LeakyReLU(alpha=0.2)(x)
    else: x = layers.ReLU()(x); x = layers.Dense(512)(x); x = layers.ReLU()(x); x = layers.Dense(512)(x); x = layers.ReLU()(x)
    outputs = layers.Dense(output_dim, activation='sigmoid')(x)
    model = Model(inputs=inputs, outputs=outputs, name="generator")
    return model

# --- 3. O RENDERIZADOR DIFERENCIÁVEL ---
# (Nenhuma alteração aqui, ele ainda é necessário para a visualização)
GRID_X, GRID_Y = tf.meshgrid(tf.range(IMG_WIDTH, dtype=tf.float32), tf.range(IMG_HEIGHT, dtype=tf.float32))
PIXEL_GRID = tf.stack([GRID_X, GRID_Y], axis=-1)

@tf.function
def bezier_curve(control_points, num_samples):
    n = tf.shape(control_points)[1] - 1; t = tf.linspace(0.0, 1.0, num_samples)
    i = tf.range(0, n + 1, dtype=tf.float32); n_float = tf.cast(n, dtype=tf.float32)
    log_n_factorial = tf.math.lgamma(n_float + 1.0); log_i_factorial = tf.math.lgamma(i + 1.0)
    log_n_minus_i_factorial = tf.math.lgamma(n_float - i + 1.0)
    log_combinations = log_n_factorial - log_i_factorial - log_n_minus_i_factorial
    combinations = tf.exp(log_combinations)
    t_pow_i = t[:, tf.newaxis] ** i[tf.newaxis, :]; one_minus_t_pow_n_minus_i = (1 - t[:, tf.newaxis]) ** (n_float - i[tf.newaxis, :])
    bernstein_polynomials = combinations * t_pow_i * one_minus_t_pow_n_minus_i
    curve_points = tf.einsum('bpc,sp->bsc', control_points, bernstein_polynomials)
    return curve_points

@tf.function
def min_distance_and_t_to_polyline(pixel_grid, polyline):
    num_segments = tf.shape(polyline)[1] - 1; pixel_grid_exp = pixel_grid[tf.newaxis, :, :, tf.newaxis, :]
    p1 = polyline[:, tf.newaxis, tf.newaxis, :-1, :]; p2 = polyline[:, tf.newaxis, tf.newaxis, 1:, :]
    line_vec = p2 - p1; point_vec = pixel_grid_exp - p1
    line_len_sq = tf.reduce_sum(line_vec**2, axis=-1, keepdims=True); line_len_sq = tf.maximum(line_len_sq, 1e-6)
    t_local = tf.reduce_sum(point_vec * line_vec, axis=-1, keepdims=True) / line_len_sq
    t_local = tf.clip_by_value(t_local, 0.0, 1.0); nearest_point = p1 + t_local * line_vec
    dist_sq = tf.reduce_sum((pixel_grid_exp - nearest_point)**2, axis=-1)
    closest_segment_index = tf.argmin(dist_sq, axis=-1); min_dist = tf.sqrt(tf.reduce_min(dist_sq, axis=-1))
    t_local_winner = tf.gather(tf.squeeze(t_local, axis=-1), closest_segment_index, axis=-1, batch_dims=3)
    t_global = (tf.cast(closest_segment_index, tf.float32) + t_local_winner) / tf.cast(num_segments, tf.float32)
    return min_dist, t_global

@tf.function
def differentiable_renderer(control_points_flat):
    control_points = tf.reshape(control_points_flat, [-1, NUM_CONTROL_POINTS, 2])
    control_points_scaled = control_points * tf.constant([IMG_WIDTH-1, IMG_HEIGHT-1], dtype=tf.float32)
    curve_polyline = bezier_curve(control_points_scaled, NUM_CURVE_SAMPLES)
    distance_map, t_map = min_distance_and_t_to_polyline(PIXEL_GRID, curve_polyline)
    H = t_map*0.5; S = tf.ones_like(H); V = tf.exp(-distance_map**2 / LINE_THICKNESS**2)
    hsv_image = tf.stack([H, S, V], axis=-1)
    rgb_image = tf.image.hsv_to_rgb(hsv_image)
    return rgb_image

# --- 4. FUNÇÃO DE PERDA (SUPER SIMPLIFICADA) ---

# MODIFICADO: A função de perda agora é muito mais simples e rápida.
def create_vector_loss(bitmap_a, bitmap_b, control_points_a, control_points_b):
    """Calcula a perda baseada apenas na distância dos pontos de controle."""
    # Objetivo: Distância de Hamming Normalizada
    target_distance = tf.reduce_mean(tf.abs(bitmap_a - bitmap_b) / 2.0, axis=-1)

    # Métrica: Distância (MSE) entre os vetores de pontos de controle
    control_point_distance = tf.reduce_mean(tf.square(control_points_a - control_points_b), axis=-1)
    
    # A PERDA é o erro entre a distância dos CPs e a distância alvo
    loss_cp = tf.reduce_mean(tf.square(target_distance - control_point_distance))

    return loss_cp

def create_pair_batch(batch_size=BATCH_SIZE, bitmap_size=BITMAP_SIZE):
    bitmaps_a = np.random.choice([-1.0, 1.0], size=(batch_size, bitmap_size)).astype('float32')
    bitmaps_b = np.random.choice([-1.0, 1.0], size=(batch_size, bitmap_size)).astype('float32')
    return bitmaps_a, bitmaps_b

# --- 5. LOOP DE TREINAMENTO (OTIMIZADO) ---
generator = build_generator()
optimizer = optimizers.Adam(learning_rate=LEARNING_RATE, beta_1=0.5)
print("\nIniciando o treinamento otimizado (apenas perda de CP)...")

for epoch in range(1, EPOCHS + 1):
    bitmaps_a, bitmaps_b = create_pair_batch()
    with tf.GradientTape() as tape:
        control_points_a = generator(bitmaps_a, training=True)
        control_points_b = generator(bitmaps_b, training=True)
        
        # MODIFICADO: Não renderiza mais as imagens durante o treino.
        # A perda é calculada diretamente a partir dos pontos de controle.
        loss_value = create_vector_loss(bitmaps_a, bitmaps_b, control_points_a, control_points_b)
        
    grads = tape.gradient(loss_value, generator.trainable_variables)
    optimizer.apply_gradients(zip(grads, generator.trainable_variables))
    if epoch % 2 == 0:
        print(f"Época: {epoch}, Perda: {loss_value.numpy():.6f}")

print("\nTreinamento concluído!")

# --- 6. APLICAÇÃO GRÁFICA INTERATIVA ---
# (Nenhuma alteração necessária aqui, ela continua funcionando como antes)
class VisualizationApp:
    def __init__(self, model):
        # (código da GUI permanece o mesmo)
        self.model = model; self.root = tk.Tk(); self.root.title("Visualizador de Curvas Coloridas"); self.root.geometry("800x450")
        self.static_photos, self.interactive_photos = [], []
        static_frame = ttk.LabelFrame(self.root, text="Casos de Teste Fixos", padding=10); static_frame.pack(padx=10, pady=10, fill=tk.X)
        self.static_image_frame = ttk.Frame(static_frame); self.static_image_frame.pack()
        self.static_labels = self._create_image_grid(self.static_image_frame, 5, ["Todos -1", "Todos 1", "Metade/Metade", "Um Bit 1", "Um Bit -1"])
        inter_frame = ttk.LabelFrame(self.root, text="Análise Interativa com Caminho Fixo", padding=10); inter_frame.pack(padx=10, pady=10, fill=tk.X, expand=True)
        inter_base_frame = ttk.Frame(inter_frame); inter_base_frame.pack(side=tk.LEFT, padx=20)
        ttk.Label(inter_base_frame, text="Imagem Base", font=("Helvetica", 10, "bold")).pack()
        self.interactive_base_img_label = ttk.Label(inter_base_frame); self.interactive_base_img_label.pack()
        ttk.Button(inter_base_frame, text="Reiniciar com Imagem Aleatória", command=self.reset_interactive_section).pack(pady=10)
        inter_slider_frame = ttk.Frame(inter_frame); inter_slider_frame.pack(side=tk.LEFT, padx=20, expand=True)
        self.interactive_slider_title = ttk.Label(inter_slider_frame, text="Bitflip: 0.0%", font=("Helvetica", 10, "bold")); self.interactive_slider_title.pack()
        self.interactive_slider_img_label = ttk.Label(inter_slider_frame); self.interactive_slider_img_label.pack()
        self.slider = ttk.Scale(inter_slider_frame, from_=0.0, to=1.0, orient=tk.HORIZONTAL, length=300, command=self.update_slider_image); self.slider.pack(pady=10)
        self.setup_static_row(); self.reset_interactive_section()
    def _create_image_grid(self, parent, num_images, titles):
        labels_dict = {};
        for i in range(num_images):
            col_frame = ttk.Frame(parent); col_frame.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=5)
            labels_dict[i] = { 'title': ttk.Label(col_frame, text=titles[i], font=("Helvetica", 10, "bold")), 'img': ttk.Label(col_frame) }
            labels_dict[i]['title'].pack(); labels_dict[i]['img'].pack()
        return labels_dict
    def _tensor_to_photo(self, tensor, zoom=3):
        img_np = (tensor.numpy().squeeze() * 255).astype(np.uint8)
        pil_img = Image.fromarray(img_np, mode='RGB')
        if zoom > 1: pil_img = pil_img.resize((IMG_WIDTH * zoom, IMG_HEIGHT * zoom), Image.NEAREST)
        return ImageTk.PhotoImage(pil_img)
    def setup_static_row(self):
        self.static_photos.clear()
        bm1 = np.full((1, BITMAP_SIZE), -1.0, dtype=np.float32); bm2 = np.full((1, BITMAP_SIZE), 1.0, dtype=np.float32)
        bm3 = np.full((1, BITMAP_SIZE), -1.0, dtype=np.float32); bm3[0, BITMAP_SIZE // 2:] = 1.0
        bm4 = np.full((1, BITMAP_SIZE), -1.0, dtype=np.float32); bm4[0, 0] = 1.0
        bm5 = np.full((1, BITMAP_SIZE), 1.0, dtype=np.float32); bm5[0, 0] = -1.0
        bitmaps = [bm1, bm2, bm3, bm4, bm5]
        control_points_list = [self.model(b, training=False) for b in bitmaps]
        image_tensors = [differentiable_renderer(cp) for cp in control_points_list]
        for i, image_tensor in enumerate(image_tensors):
            photo = self._tensor_to_photo(image_tensor)
            self.static_photos.append(photo); self.static_labels[i]['img'].config(image=photo)
    def reset_interactive_section(self):
        self.interactive_base_bitmap = np.random.choice([-1.0, 1.0], size=(1, BITMAP_SIZE)).astype('float32')
        cp = self.model(self.interactive_base_bitmap, training=False)
        self.interactive_base_image_tensor = differentiable_renderer(cp)
        photo = self._tensor_to_photo(self.interactive_base_image_tensor, zoom=4)
        self.interactive_photos.append(photo); self.interactive_base_img_label.config(image=photo)
        indices = np.arange(BITMAP_SIZE); np.random.shuffle(indices); self.shuffled_indices = indices
        self.slider.set(0.0); self.update_slider_image(0.0)
    def update_slider_image(self, value):
        flip_ratio = float(value); flipped_bitmap = self.interactive_base_bitmap.copy()
        num_flips = int(BITMAP_SIZE * flip_ratio)
        if num_flips > 0:
            indices_to_flip = self.shuffled_indices[:num_flips]; flipped_bitmap[0, indices_to_flip] *= -1
        cp = self.model(flipped_bitmap, training=False); image_tensor = differentiable_renderer(cp)
        photo = self._tensor_to_photo(image_tensor, zoom=4)
        self.interactive_photos.append(photo); self.interactive_slider_img_label.config(image=photo)
        self.interactive_slider_title.config(text=f"Bitflip: {flip_ratio:.1%} (#{num_flips})")
    def run(self): self.root.mainloop()

if __name__ == '__main__':
    app = VisualizationApp(generator)
    app.run()