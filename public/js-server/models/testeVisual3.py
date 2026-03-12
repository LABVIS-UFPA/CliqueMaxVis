# -*- coding: utf-8 -*-

import tensorflow as tf
from tensorflow.keras import layers, Model, optimizers
import numpy as np
import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk


# --- 1. CONFIGURAÇÃO ---
# Parâmetros do seu modelo antigo que gera "manchas"
BITMAP_SIZE = 3000
IMG_HEIGHT = 32
IMG_WIDTH = 32
IMG_CHANNELS = 3 # Imagens coloridas

# Parâmetros de Treinamento
EPOCHS = 100
BATCH_SIZE = 32
LEARNING_RATE = 0.002

# --- 2. CONSTRUÇÃO DA REDE SINTETIZADORA (Seu Modelo Antigo) ---
def build_synthesizer(input_shape=(BITMAP_SIZE,)):
    """Cria o modelo da rede sintetizadora que gera pixels diretamente."""
    inputs = layers.Input(shape=input_shape)
    x = layers.Dense(8 * 8 * 128, activation='relu')(inputs)
    x = layers.Reshape((8, 8, 128))(x)
    x = layers.Conv2DTranspose(64, kernel_size=3, strides=2, padding='same', activation='relu')(x)
    x = layers.Conv2DTranspose(32, kernel_size=3, strides=2, padding='same', activation='relu')(x)
    outputs = layers.Conv2DTranspose(IMG_CHANNELS, kernel_size=3, strides=1, padding='same', activation='sigmoid')(x)
    model = Model(inputs=inputs, outputs=outputs, name="synthesizer")
    return model

# --- 3. FUNÇÃO DE PERDA PROPORCIONAL E MULTI-ESCALA ---
def multi_scale_proportional_loss(bitmap_a, bitmap_b, image_a, image_b):
    """Calcula a perda forçando a distância MÉDIA da imagem a ser igual à distância do bitmap."""
    target_distance = tf.reduce_mean(tf.abs(bitmap_a - bitmap_b) / 2.0, axis=-1)
    scales = [2.0, 1.0, 0.5, 0.25]
    scale_distances = []
    for scale in scales:
        new_height = int(IMG_HEIGHT * scale)
        new_width = int(IMG_WIDTH * scale)
        image_a_scaled = tf.image.resize(image_a, [new_height, new_width])
        image_b_scaled = tf.image.resize(image_b, [new_height, new_width])
        dist_at_scale = tf.reduce_mean(tf.abs(image_a_scaled - image_b_scaled), axis=[1, 2, 3])
        scale_distances.append(dist_at_scale)
    predicted_distance = tf.reduce_mean(tf.stack(scale_distances), axis=0)
    loss = tf.reduce_mean(tf.square(target_distance - predicted_distance))
    return loss

# --- 4. FUNÇÃO PARA GERAR DADOS DE TREINAMENTO ---
def create_pair_batch(batch_size=BATCH_SIZE, bitmap_size=BITMAP_SIZE):
    """Gera um lote de dados com pares (bitmap_a, bitmap_b)."""
    bitmaps_a = np.random.choice([-1.0, 1.0], size=(batch_size, bitmap_size)).astype('float32')
    bitmaps_b = np.random.choice([-1.0, 1.0], size=(batch_size, bitmap_size)).astype('float32')
    return bitmaps_a, bitmaps_b

# --- 5. LOOP DE TREINAMENTO ---
synthesizer = build_synthesizer()
optimizer = optimizers.Adam(learning_rate=LEARNING_RATE)
synthesizer.summary()
print("\nIniciando o treinamento com perda proporcional e multi-escala...")

for epoch in range(1, EPOCHS + 1):
    bitmaps_a, bitmaps_b = create_pair_batch()
    with tf.GradientTape() as tape:
        images_a = synthesizer(bitmaps_a, training=True)
        images_b = synthesizer(bitmaps_b, training=True)
        loss_value = multi_scale_proportional_loss(bitmaps_a, bitmaps_b, images_a, images_b)
    grads = tape.gradient(loss_value, synthesizer.trainable_variables)
    optimizer.apply_gradients(zip(grads, synthesizer.trainable_variables))
    if epoch % 5 == 0:
        print(f"Época: {epoch}, Perda: {loss_value.numpy():.6f}")

print("\nTreinamento concluído!")

# --- 6. APLICAÇÃO GRÁFICA INTERATIVA (ADAPTADA PARA O MODELO ANTIGO) ---

class VisualizationApp:
    def __init__(self, model):
        self.model = model
        self.root = tk.Tk()
        self.root.title("Ferramenta de Análise de Sensibilidade (Modelo de Manchas)")
        self.root.geometry("800x450")

        self.static_photos = []
        self.interactive_photos = []

        # --- Seção de Progressão Estática ---
        static_frame = ttk.LabelFrame(self.root, text="Casos de Teste Fixos", padding=10)
        static_frame.pack(padx=10, pady=10, fill=tk.X)
        self.static_image_frame = ttk.Frame(static_frame)
        self.static_image_frame.pack()
        self.static_labels = self._create_image_grid(self.static_image_frame, 5, 
            ["Todos -1", "Todos 1", "Metade/Metade", "Um Bit 1", "Um Bit -1"])
        
        # --- Seção Interativa com Slider ---
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
        """
        Converte tensor (batch removed) em ImageTk.PhotoImage suportando 1 (L) ou 3 (RGB) canais.
        """
        arr = tensor.numpy().squeeze()  # pode ficar (H,W) ou (H,W,C)

        # Normaliza/clip e converte para uint8
        # trata casos de canal extra (e.g. (H,W,1)) e canais inesperados
        if arr.ndim == 2:
            img_np = (arr * 255.0).clip(0, 255).astype(np.uint8)
            mode = 'L'
        elif arr.ndim == 3:
            c = arr.shape[2]
            if c == 1:
                img_np = (arr[:, :, 0] * 255.0).clip(0, 255).astype(np.uint8)
                mode = 'L'
            elif c == 3:
                img_np = (arr * 255.0).clip(0, 255).astype(np.uint8)
                mode = 'RGB'
            elif c == 4:
                img_np = (arr * 255.0).clip(0, 255).astype(np.uint8)
                mode = 'RGBA'
            else:
                # fallback: se canais >3, descarta extras; se <3 mas >1, replica primeiro canal
                if c > 3:
                    img_np = (arr[:, :, :3] * 255.0).clip(0, 255).astype(np.uint8)
                    mode = 'RGB'
                else:
                    # replica canal 0 para formar RGB
                    rgb = np.repeat(arr[:, :, :1], 3, axis=2)
                    img_np = (rgb * 255.0).clip(0, 255).astype(np.uint8)
                    mode = 'RGB'
        else:
            raise ValueError(f"Formato de tensor inesperado para imagem: shape={arr.shape}")

        pil_img = Image.fromarray(img_np, mode=mode)
        if zoom > 1:
            pil_img = pil_img.resize((IMG_WIDTH * zoom, IMG_HEIGHT * zoom), Image.NEAREST)
        return ImageTk.PhotoImage(pil_img)

    def setup_static_row(self):
        self.static_photos.clear()
        bm1 = np.full((1, BITMAP_SIZE), -1.0, dtype=np.float32)
        bm2 = np.full((1, BITMAP_SIZE), 1.0, dtype=np.float32)
        bm3 = np.full((1, BITMAP_SIZE), -1.0, dtype=np.float32)
        bm3[0, BITMAP_SIZE // 2:] = 1.0
        bm4 = np.full((1, BITMAP_SIZE), -1.0, dtype=np.float32)
        bm4[0, 0] = 1.0
        bm5 = np.full((1, BITMAP_SIZE), 1.0, dtype=np.float32)
        bm5[0, 0] = -1.0
        bitmaps = [bm1, bm2, bm3, bm4, bm5]
        
        # MODIFICADO: Chamada direta ao modelo, sem renderizador
        image_tensors = [self.model(b, training=False) for b in bitmaps]

        for i, image_tensor in enumerate(image_tensors):
            photo = self._tensor_to_photo(image_tensor)
            self.static_photos.append(photo)
            self.static_labels[i]['img'].config(image=photo)

    def reset_interactive_section(self):
        self.interactive_base_bitmap = np.random.choice([-1.0, 1.0], size=(1, BITMAP_SIZE)).astype('float32')
        
        # MODIFICADO: Chamada direta ao modelo, sem renderizador
        self.interactive_base_image_tensor = self.model(self.interactive_base_bitmap, training=False)
        
        photo = self._tensor_to_photo(self.interactive_base_image_tensor, zoom=4)
        self.interactive_photos.append(photo)
        self.interactive_base_img_label.config(image=photo)
        
        indices = np.arange(BITMAP_SIZE)
        np.random.shuffle(indices)
        self.shuffled_indices = indices
        
        self.slider.set(0.0)
        self.update_slider_image(0.0)

    def update_slider_image(self, value):
        flip_ratio = float(value)
        flipped_bitmap = self.interactive_base_bitmap.copy()
        num_flips = int(BITMAP_SIZE * flip_ratio)
        
        if num_flips > 0:
            indices_to_flip = self.shuffled_indices[:num_flips]
            flipped_bitmap[0, indices_to_flip] *= -1
            
        # MODIFICADO: Chamada direta ao modelo, sem renderizador
        image_tensor = self.model(flipped_bitmap, training=False)
        
        photo = self._tensor_to_photo(image_tensor, zoom=4)
        self.interactive_photos.append(photo)
        self.interactive_slider_img_label.config(image=photo)
        self.interactive_slider_title.config(text=f"Bitflip: {flip_ratio:.1%} (#{num_flips})")

    def run(self):
        self.root.mainloop()

if __name__ == '__main__':
    app = VisualizationApp(synthesizer)
    app.run()