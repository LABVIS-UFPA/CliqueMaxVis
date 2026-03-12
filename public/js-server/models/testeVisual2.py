# -*- coding: utf-8 -*-

import tensorflow as tf
from tensorflow.keras import layers, Model, optimizers
import numpy as np
import matplotlib.pyplot as plt

# --- Imports para a Interface Gráfica ---
import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk

# --- 1. CONFIGURAÇÃO ---
BITMAP_SIZE = 64
IMG_HEIGHT = 32
IMG_WIDTH = 32
IMG_CHANNELS = 3
EPOCHS = 300 # Reduzi para demonstração, pode aumentar
BATCH_SIZE = 32
LEARNING_RATE = 0.0002

# --- 2. CONSTRUÇÃO DA REDE SINTETIZADORA ---
def build_synthesizer(input_shape=(BITMAP_SIZE,)):
    inputs = layers.Input(shape=input_shape)
    x = layers.Dense(8 * 8 * 128, activation='relu')(inputs)
    x = layers.Reshape((8, 8, 128))(x)
    x = layers.Conv2DTranspose(64, kernel_size=3, strides=2, padding='same', activation='relu')(x)
    x = layers.Conv2DTranspose(32, kernel_size=3, strides=2, padding='same', activation='relu')(x)
    outputs = layers.Conv2DTranspose(IMG_CHANNELS, kernel_size=3, strides=1, padding='same', activation='sigmoid')(x)
    model = Model(inputs=inputs, outputs=outputs, name="synthesizer")
    return model

# --- 3. FUNÇÃO DE PERDA ---
def multi_scale_proportional_loss(bitmap_a, bitmap_b, image_a, image_b):
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

# --- 4. FUNÇÃO PARA GERAR DADOS ---
def create_pair_batch(batch_size=BATCH_SIZE, bitmap_size=BITMAP_SIZE):
    bitmaps_a = np.random.choice([-1.0, 1.0], size=(batch_size, bitmap_size)).astype('float32')
    bitmaps_b = np.random.choice([-1.0, 1.0], size=(batch_size, bitmap_size)).astype('float32')
    return bitmaps_a, bitmaps_b

# --- 5. LOOP DE TREINAMENTO ---
synthesizer = build_synthesizer()
optimizer = optimizers.Adam(learning_rate=LEARNING_RATE)
print("\nIniciando o treinamento...")
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


# --- 6. APLICAÇÃO GRÁFICA INTERATIVA (Tkinter) ---

class VisualizationApp:
    def __init__(self, model):
        self.model = model
        self.root = tk.Tk()
        self.root.title("Visualizador de Similaridade")
        self.root.geometry("400x250") # Tamanho da janela

        # Define o bitmap e a imagem base (fixos)
        self.base_bitmap = np.full((1, BITMAP_SIZE), -1.0).astype('float32')
        self.base_image_tensor = self.model(self.base_bitmap, training=False)
        self.base_photo = self._tensor_to_photo(self.base_image_tensor, zoom=3)

        # ---- Criação dos Widgets ----
        
        # Frame para as imagens
        frame_images = ttk.Frame(self.root)
        frame_images.pack(pady=10)

        self.label_base_img = ttk.Label(frame_images, image=self.base_photo)
        self.label_base_img.pack(side=tk.LEFT, padx=10)
        
        # Placeholder para a imagem aleatória
        self.label_random_img = ttk.Label(frame_images)
        self.label_random_img.pack(side=tk.LEFT, padx=10)
        
        # Frame para os textos de distância
        frame_info = ttk.Frame(self.root)
        frame_info.pack(pady=10)
        
        self.label_hamming_dist = ttk.Label(frame_info, text="Dist. Hamming: -", font=("Helvetica", 12))
        self.label_hamming_dist.pack()
        
        self.label_image_dist = ttk.Label(frame_info, text="Dist. Imagem: -", font=("Helvetica", 12))
        self.label_image_dist.pack()
        
        # Botão para gerar um novo código
        self.generate_button = ttk.Button(self.root, text="Gerar Novo Código Aleatório", command=self.generate_new)
        self.generate_button.pack(pady=20)
        
        # Gera o primeiro exemplo ao iniciar
        self.generate_new()

    def _tensor_to_photo(self, tensor, zoom=1):
        """Converte um tensor de imagem do TF para um objeto de imagem do Tkinter."""
        # Converte para numpy, escala para 0-255 e converte para inteiros
        img_np = (tensor.numpy().squeeze() * 255).astype(np.uint8)
        
        # Cria a imagem com a biblioteca Pillow
        pil_img = Image.fromarray(img_np)
        
        # Redimensiona para melhor visualização (opcional)
        if zoom > 1:
            pil_img = pil_img.resize((IMG_WIDTH * zoom, IMG_HEIGHT * zoom), Image.NEAREST)

        return ImageTk.PhotoImage(pil_img)

    def generate_new(self):
        """Função chamada pelo botão para gerar e exibir um novo par."""
        # 1. Gera um novo bitmap aleatório
        random_bitmap = np.random.choice([-1.0, 1.0], size=(1, BITMAP_SIZE)).astype('float32')

        # 2. Calcula a distância de Hamming normalizada
        hamming_dist = np.mean(np.abs(self.base_bitmap - random_bitmap) / 2.0)
        
        # 3. Gera a nova imagem
        random_image_tensor = self.model(random_bitmap, training=False)
        
        # 4. Calcula a distância da imagem (MAE na escala 1x)
        image_dist = tf.reduce_mean(tf.abs(self.base_image_tensor - random_image_tensor)).numpy()

        # 5. Atualiza a interface gráfica
        
        # Converte a nova imagem para o formato do Tkinter
        # IMPORTANTE: Manter uma referência à imagem para não ser deletada pelo garbage collector
        self.random_photo = self._tensor_to_photo(random_image_tensor, zoom=3)
        self.label_random_img.config(image=self.random_photo)
        
        # Atualiza os textos
        self.label_hamming_dist.config(text=f"Dist. Hamming: {hamming_dist:.4f}")
        self.label_image_dist.config(text=f"Dist. Imagem: {image_dist:.4f}")

    def run(self):
        """Inicia a aplicação."""
        self.root.mainloop()


# --- Inicia a aplicação após o treinamento ---
if __name__ == '__main__':
    app = VisualizationApp(synthesizer)
    app.run()