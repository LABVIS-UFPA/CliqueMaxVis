# -*- coding: utf-8 -*-

import tensorflow as tf
from tensorflow.keras import layers, Model, optimizers
import numpy as np
import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk

# --- 1. CONFIGURAÇÃO ---
BITMAP_SIZE = 3000 # Mantendo um valor menor, como discutido
IMG_HEIGHT = 32
IMG_WIDTH = 32
IMG_CHANNELS = 1

# Parâmetros da Curva
NUM_CONTROL_POINTS = 12
NUM_CURVE_SAMPLES = 64
LINE_THICKNESS = 1.5

# Parâmetros de Treinamento
EPOCHS = 200 # Pode precisar de mais épocas com a nova loss
BATCH_SIZE = 32
LEARNING_RATE = 0.002

# Pesos da Loss
W_CP = 0.7      # Peso da perda de pontos de controle
W_IMG = 0.3     # Peso da perda de imagem multi-escala
W_AREA = 0.3    # Peso da penalidade de área

# --- 2. O GERADOR (COM LeakyReLU COMO SUGERIDO ANTERIORMENTE) ---
def build_generator(output_dim=NUM_CONTROL_POINTS * 2, input_shape=(BITMAP_SIZE,), activation='relu'):
    """
    Cria a rede que gera as coordenadas dos pontos de controle.

    Args:
        output_dim (int): A dimensão da camada de saída.
        input_shape (tuple): A forma da camada de entrada.
        activation (str): A função de ativação a ser usada ('relu' ou 'leaky_relu').
                          O padrão é 'relu'.
    """
    inputs = layers.Input(shape=input_shape)
    
    # Camadas ocultas com a ativação escolhida
    x = layers.Dense(256)(inputs)
    if activation == 'leaky_relu':
        x = layers.LeakyReLU(alpha=0.2)(x)
        x = layers.Dense(512)(x)
        x = layers.LeakyReLU(alpha=0.2)(x)
        x = layers.Dense(512)(x)
        x = layers.LeakyReLU(alpha=0.2)(x)
    else:
        x = layers.ReLU()(x)
        x = layers.Dense(512)(x)
        x = layers.ReLU()(x)
        x = layers.Dense(512)(x)
        x = layers.ReLU()(x)
    

    # Camada de saída
    outputs = layers.Dense(output_dim, activation='sigmoid')(x)
    model = Model(inputs=inputs, outputs=outputs, name="generator")
    return model

# --- 3. O RENDERIZADOR DIFERENCIÁVEL ---
# (Nenhuma alteração nesta seção)
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
def min_distance_to_polyline(pixel_grid, polyline):
    pixel_grid_exp = pixel_grid[tf.newaxis, :, :, tf.newaxis, :]; p1 = polyline[:, tf.newaxis, tf.newaxis, :-1, :]
    p2 = polyline[:, tf.newaxis, tf.newaxis, 1:, :]; line_vec = p2 - p1; point_vec = pixel_grid_exp - p1
    line_len_sq = tf.reduce_sum(line_vec**2, axis=-1, keepdims=True); line_len_sq = tf.maximum(line_len_sq, 1e-6)
    t = tf.reduce_sum(point_vec * line_vec, axis=-1, keepdims=True) / line_len_sq
    t = tf.clip_by_value(t, 0.0, 1.0); nearest_point = p1 + t * line_vec
    dist_sq = tf.reduce_sum((pixel_grid_exp - nearest_point)**2, axis=-1); min_dist_sq = tf.reduce_min(dist_sq, axis=-1)
    return tf.sqrt(min_dist_sq)

@tf.function
def differentiable_renderer(control_points_flat):
    control_points = tf.reshape(control_points_flat, [-1, NUM_CONTROL_POINTS, 2])
    control_points_scaled = control_points * tf.constant([IMG_WIDTH-1, IMG_HEIGHT-1], dtype=tf.float32)
    curve_polyline = bezier_curve(control_points_scaled, NUM_CURVE_SAMPLES)
    distance_map = min_distance_to_polyline(PIXEL_GRID, curve_polyline)
    image = tf.exp(-distance_map**2 / LINE_THICKNESS**2)
    return image[..., tf.newaxis]

# --- 4. A NOVA FUNÇÃO DE PERDA "HARMONIZADA" ---

def create_vector_loss(image_a, image_b, bitmap_a, bitmap_b, control_points_a, control_points_b):
    """
    Calcula a perda "harmonizada" onde tanto a perda de CP quanto a de Imagem
    são regredidas contra a distância de Hamming.
    """
    # --- OBJETIVO COMUM: Distância de Hamming Normalizada ---
    target_distance = tf.reduce_mean(tf.abs(bitmap_a - bitmap_b) / 2.0, axis=-1)

    # --- Componente 1: Perda dos Pontos de Controle (CP) ---
    # a) Calcula a distância (MSE) entre os vetores de pontos de controle
    dist_cp_direct = tf.reduce_mean(tf.square(control_points_a - control_points_b), axis=-1)
    
    # b) Calcula a distância contra os pontos espelhados
    cp_b_reshaped = tf.reshape(control_points_b, [-1, NUM_CONTROL_POINTS, 2])
    cp_b_mirrored = tf.reverse(cp_b_reshaped, axis=[1])
    cp_b_mirrored_flat = tf.reshape(cp_b_mirrored, [-1, NUM_CONTROL_POINTS * 2])
    dist_cp_mirrored = tf.reduce_mean(tf.square(control_points_a - cp_b_mirrored_flat), axis=-1)
    
    # c) A métrica de distância dos CPs é a menor das duas
    control_point_distance = tf.minimum(dist_cp_direct, dist_cp_mirrored)
    
    # d) A PERDA de CP é o erro entre a distância dos CPs e a distância alvo
    loss_cp = tf.reduce_mean(tf.square(target_distance - control_point_distance))

    # --- Componente 2: Perda das Imagens (IMG) ---
    # a) Calcula a distância multi-escala entre as imagens
    scales = [1.0, 0.5, 0.25]
    scale_distances = [tf.reduce_mean(tf.abs(tf.image.resize(image_a, [int(IMG_HEIGHT*s), int(IMG_WIDTH*s)]) - tf.image.resize(image_b, [int(IMG_HEIGHT*s), int(IMG_WIDTH*s)])), axis=[1,2,3]) for s in scales]
    image_distance = tf.reduce_mean(tf.stack(scale_distances), axis=0)
    
    # b) A PERDA da Imagem é o erro entre a distância da imagem e a distância alvo
    loss_img = tf.reduce_mean(tf.square(target_distance - image_distance))
    
    # --- Componente 3: Penalidade de Área ---
    total_pixels = float(IMG_HEIGHT * IMG_WIDTH)
    total_penalty_area = 0.0
    for img in [image_a, image_b]:
        area = tf.reduce_sum(img, axis=[1, 2, 3]); area_ratio = area / total_pixels
        penalty_low = tf.maximum(0.0, 0.3 - area_ratio); penalty_high = tf.maximum(0.0, area_ratio - 0.7)
        total_penalty_area += tf.reduce_mean(penalty_low + penalty_high)
    penalty_area = total_penalty_area / 2.0
    
    # --- Combinação Final Ponderada ---
    final_loss = (W_CP * loss_cp) + (W_IMG * loss_img) + (W_AREA * penalty_area)
    return final_loss

def create_pair_batch(batch_size=BATCH_SIZE, bitmap_size=BITMAP_SIZE):
    bitmaps_a = np.random.choice([-1.0, 1.0], size=(batch_size, bitmap_size)).astype('float32')
    bitmaps_b = np.random.choice([-1.0, 1.0], size=(batch_size, bitmap_size)).astype('float32')
    return bitmaps_a, bitmaps_b


# --- 5. LOOP DE TREINAMENTO (ATUALIZADO) ---
generator = build_generator()
# Usando o otimizador Adam com beta_1=0.5 como sugerido para estabilidade
optimizer = optimizers.Adam(learning_rate=LEARNING_RATE, beta_1=0.5) 
print("\nIniciando o treinamento com a perda 'harmonizada'...")

for epoch in range(1, EPOCHS + 1):
    bitmaps_a, bitmaps_b = create_pair_batch()
    with tf.GradientTape() as tape:
        control_points_a = generator(bitmaps_a, training=True)
        control_points_b = generator(bitmaps_b, training=True)
        images_a = differentiable_renderer(control_points_a)
        images_b = differentiable_renderer(control_points_b)
        loss_value = create_vector_loss(images_a, images_b, bitmaps_a, bitmaps_b, control_points_a, control_points_b)
    grads = tape.gradient(loss_value, generator.trainable_variables)
    optimizer.apply_gradients(zip(grads, generator.trainable_variables))
    if epoch % 2 == 0:
        print(f"Época: {epoch}, Perda: {loss_value.numpy():.6f}")

print("\nTreinamento concluído!")

# --- 6. APLICAÇÃO GRÁFICA INTERATIVA ---
class VisualizationApp:
    def __init__(self, model):
        self.model = model
        self.root = tk.Tk()
        self.root.title("Ferramenta de Análise de Sensibilidade")
        self.root.geometry("800x450") # Aumentei um pouco a altura

        # Listas para manter referências e evitar garbage collection
        self.static_photos = []
        self.interactive_photos = []

        # --- Seção de Progressão Estática (MELHORIA 1) ---
        static_frame = ttk.LabelFrame(self.root, text="Casos de Teste Fixos", padding=10)
        static_frame.pack(padx=10, pady=10, fill=tk.X)
        self.static_image_frame = ttk.Frame(static_frame)
        self.static_image_frame.pack()
        self.static_labels = self._create_image_grid(self.static_image_frame, 5, 
            ["Todos -1", "Todos 1", "Metade/Metade", "Um Bit 1", "Um Bit -1"])
        
        # --- Seção Interativa com Slider (MELHORIA 2) ---
        inter_frame = ttk.LabelFrame(self.root, text="Análise Interativa com Caminho Fixo", padding=10)
        inter_frame.pack(padx=10, pady=10, fill=tk.X, expand=True)
        
        inter_base_frame = ttk.Frame(inter_frame)
        inter_base_frame.pack(side=tk.LEFT, padx=20)
        ttk.Label(inter_base_frame, text="Imagem Base", font=("Helvetica", 10, "bold")).pack()
        self.interactive_base_img_label = ttk.Label(inter_base_frame)
        self.interactive_base_img_label.pack()
        ttk.Button(inter_base_frame, text="Reiniciar com Imagem Aleatória", command=self.reset_interactive_section).pack(pady=10)
        
        inter_slider_frame = ttk.Frame(inter_frame)
        inter_slider_frame.pack(side=tk.LEFT, padx=20, expand=True)
        self.interactive_slider_title = ttk.Label(inter_slider_frame, text="Bitflip: 0.0%", font=("Helvetica", 10, "bold"))
        self.interactive_slider_title.pack()
        self.interactive_slider_img_label = ttk.Label(inter_slider_frame)
        self.interactive_slider_img_label.pack()
        self.slider = ttk.Scale(inter_slider_frame, from_=0.0, to=1.0, orient=tk.HORIZONTAL, length=300, command=self.update_slider_image)
        self.slider.pack(pady=10)
        
        # Inicializa a UI
        self.setup_static_row()
        self.reset_interactive_section()

    def _create_image_grid(self, parent, num_images, titles):
        labels_dict = {}
        for i in range(num_images):
            col_frame = ttk.Frame(parent)
            col_frame.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=5)
            labels_dict[i] = { 'title': ttk.Label(col_frame, text=titles[i], font=("Helvetica", 10, "bold")), 'img': ttk.Label(col_frame) }
            labels_dict[i]['title'].pack(); labels_dict[i]['img'].pack()
        return labels_dict

    def _tensor_to_photo(self, tensor, zoom=3):
        img_np = (tensor.numpy().squeeze() * 255).astype(np.uint8)
        pil_img = Image.fromarray(img_np, mode='L')
        if zoom > 1: pil_img = pil_img.resize((IMG_WIDTH * zoom, IMG_HEIGHT * zoom), Image.NEAREST)
        return ImageTk.PhotoImage(pil_img)

    def setup_static_row(self):
        """Preenche a linha de cima com os 5 bitmaps fixos."""
        self.static_photos.clear()
        
        # 1. Tudo -1
        bm1 = np.full((1, BITMAP_SIZE), -1.0, dtype=np.float32)
        # 2. Tudo 1
        bm2 = np.full((1, BITMAP_SIZE), 1.0, dtype=np.float32)
        # 3. Metade / Metade
        bm3 = np.full((1, BITMAP_SIZE), -1.0, dtype=np.float32)
        bm3[0, BITMAP_SIZE // 2:] = 1.0
        # 4. Tudo -1 com um 1
        bm4 = np.full((1, BITMAP_SIZE), -1.0, dtype=np.float32)
        bm4[0, 0] = 1.0
        # 5. Tudo 1 com um -1
        bm5 = np.full((1, BITMAP_SIZE), 1.0, dtype=np.float32)
        bm5[0, 0] = -1.0
        
        bitmaps = [bm1, bm2, bm3, bm4, bm5]
        
        control_points_list = [self.model(b, training=False) for b in bitmaps]
        image_tensors = [differentiable_renderer(cp) for cp in control_points_list]

        for i, image_tensor in enumerate(image_tensors):
            photo = self._tensor_to_photo(image_tensor)
            self.static_photos.append(photo)
            self.static_labels[i]['img'].config(image=photo)

    def reset_interactive_section(self):
        """Gera uma nova imagem base e uma nova sequência de flips para o slider."""
        # Gera a nova imagem base
        self.interactive_base_bitmap = np.random.choice([-1.0, 1.0], size=(1, BITMAP_SIZE)).astype('float32')
        cp = self.model(self.interactive_base_bitmap, training=False)
        self.interactive_base_image_tensor = differentiable_renderer(cp)
        
        photo = self._tensor_to_photo(self.interactive_base_image_tensor, zoom=4)
        self.interactive_photos.append(photo) # Manter referência
        self.interactive_base_img_label.config(image=photo)
        
        # MELHORIA 2: Cria e armazena a sequência de flips
        indices = np.arange(BITMAP_SIZE)
        np.random.shuffle(indices)
        self.shuffled_indices = indices
        
        # Reseta o slider para a posição 0
        self.slider.set(0.0)
        self.update_slider_image(0.0)

    def update_slider_image(self, value):
        """Atualiza a imagem da direita com base na posição do slider e na sequência de flips."""
        flip_ratio = float(value)
        
        # Cria uma cópia da imagem base para modificar
        flipped_bitmap = self.interactive_base_bitmap.copy()
        
        # Calcula quantos bits devem ser flipados
        num_flips = int(BITMAP_SIZE * flip_ratio)
        
        if num_flips > 0:
            # Pega os primeiros 'num_flips' índices da nossa sequência embaralhada
            indices_to_flip = self.shuffled_indices[:num_flips]
            # Flipa os bits nesses índices específicos
            flipped_bitmap[0, indices_to_flip] *= -1
            
        # Gera a nova imagem
        cp = self.model(flipped_bitmap, training=False)
        image_tensor = differentiable_renderer(cp)
        
        # Atualiza a GUI
        photo = self._tensor_to_photo(image_tensor, zoom=4)
        self.interactive_photos.append(photo) # Manter referência
        self.interactive_slider_img_label.config(image=photo)
        self.interactive_slider_title.config(text=f"Bitflip: {flip_ratio:.1%} (#{num_flips})")

    def run(self):
        self.root.mainloop()

if __name__ == '__main__':
    app = VisualizationApp(generator)
    app.run()