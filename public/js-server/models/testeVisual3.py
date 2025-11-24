# # -*- coding: utf-8 -*-
# ## Está gerando bem uma imagem abstrata.

# import tensorflow as tf
# from tensorflow.keras import layers, Model, optimizers
# import numpy as np
# # Removido o import do matplotlib, pois não será mais usado diretamente
# # import matplotlib.pyplot as plt

# # Imports para a nova interface gráfica
# import tkinter as tk
# from tkinter import ttk
# from PIL import Image, ImageTk


# # --- 1. CONFIGURAÇÃO ---
# # Parâmetros que você pode ajustar

# BITMAP_SIZE = 3000      # Tamanho do vetor de bits de entrada
# IMG_HEIGHT = 32       # Altura da imagem de saída
# IMG_WIDTH = 32        # Largura da imagem de saída
# IMG_CHANNELS = 3      # 3 para RGB, 1 para escala de cinza

# # Parâmetros de Treinamento
# EPOCHS = 300
# BATCH_SIZE = 32
# LEARNING_RATE = 0.0002

# # --- 2. CONSTRUÇÃO DA REDE SINTETIZADORA ---
# # Esta parte permanece a mesma do seu arquivo.

# def build_synthesizer(input_shape=(BITMAP_SIZE,)):
#     """Cria o modelo da rede sintetizadora."""
#     inputs = layers.Input(shape=input_shape)
#     x = layers.Dense(8 * 8 * 128, activation='relu')(inputs)
#     x = layers.Reshape((8, 8, 128))(x)
#     x = layers.Conv2DTranspose(64, kernel_size=3, strides=2, padding='same', activation='relu')(x)
#     x = layers.Conv2DTranspose(32, kernel_size=3, strides=2, padding='same', activation='relu')(x)
#     outputs = layers.Conv2DTranspose(IMG_CHANNELS, kernel_size=3, strides=1, padding='same', activation='sigmoid')(x)
#     model = Model(inputs=inputs, outputs=outputs, name="synthesizer")
#     return model

# # --- 3. FUNÇÃO DE PERDA PROPORCIONAL E MULTI-ESCALA ---
# # Esta parte permanece a mesma do seu arquivo.

# def multi_scale_proportional_loss(bitmap_a, bitmap_b, image_a, image_b):
#     """
#     Calcula a perda forçando a distância MÉDIA da imagem (em várias escalas)
#     a ser igual à distância do bitmap.
#     """
#     target_distance = tf.reduce_mean(tf.abs(bitmap_a - bitmap_b) / 2.0, axis=-1)
#     scales = [2.0, 1.0, 0.5, 0.25]
#     scale_distances = []
#     for scale in scales:
#         new_height = int(IMG_HEIGHT * scale)
#         new_width = int(IMG_WIDTH * scale)
#         image_a_scaled = tf.image.resize(image_a, [new_height, new_width])
#         image_b_scaled = tf.image.resize(image_b, [new_height, new_width])
#         dist_at_scale = tf.reduce_mean(tf.abs(image_a_scaled - image_b_scaled), axis=[1, 2, 3])
#         scale_distances.append(dist_at_scale)
#     predicted_distance = tf.reduce_mean(tf.stack(scale_distances), axis=0)
#     loss = tf.reduce_mean(tf.square(target_distance - predicted_distance))
#     return loss

# # --- 4. FUNÇÃO PARA GERAR DADOS DE TREINAMENTO ---
# # Esta parte permanece a mesma do seu arquivo.

# def create_pair_batch(batch_size=BATCH_SIZE, bitmap_size=BITMAP_SIZE):
#     """Gera um lote de dados com pares (bitmap_a, bitmap_b)."""
#     bitmaps_a = np.random.choice([-1.0, 1.0], size=(batch_size, bitmap_size)).astype('float32')
#     bitmaps_b = np.random.choice([-1.0, 1.0], size=(batch_size, bitmap_size)).astype('float32')
#     return bitmaps_a, bitmaps_b


# # --- 5. LOOP DE TREINAMENTO ---
# # Esta parte permanece a mesma do seu arquivo.

# synthesizer = build_synthesizer()
# optimizer = optimizers.Adam(learning_rate=LEARNING_RATE)
# synthesizer.summary()
# print("\nIniciando o treinamento com perda proporcional e multi-escala...")

# for epoch in range(1, EPOCHS + 1):
#     bitmaps_a, bitmaps_b = create_pair_batch()
#     with tf.GradientTape() as tape:
#         images_a = synthesizer(bitmaps_a, training=True)
#         images_b = synthesizer(bitmaps_b, training=True)
#         loss_value = multi_scale_proportional_loss(bitmaps_a, bitmaps_b, images_a, images_b)
#     grads = tape.gradient(loss_value, synthesizer.trainable_variables)
#     optimizer.apply_gradients(zip(grads, synthesizer.trainable_variables))
#     if epoch % 5 == 0:
#         print(f"Época: {epoch}, Perda: {loss_value.numpy():.6f}")

# print("\nTreinamento concluído!")

# # --- 6. APLICAÇÃO GRÁFICA INTERATIVA (INTEGRADA) ---
# # Substitui a função visualize_results.

# # class VisualizationApp:
# #     def __init__(self, model):
# #         self.model = model
# #         self.root = tk.Tk()
# #         self.root.title("Visualizador de Similaridade Comparativo")
# #         self.root.geometry("800x250") 

# #         main_frame = ttk.Frame(self.root)
# #         main_frame.pack(pady=10, padx=10, fill=tk.BOTH, expand=True)

# #         self.image_labels, self.title_labels, self.hamming_labels, self.image_dist_labels, self.photos = [], [], [], [], []
# #         titles = ["Base (Aleatória)", "Oposto (100% Flip)", "1-Bit Flip (idx 0)", "1-Bit Flip (idx 1)", "50% Flip"]

# #         for i in range(5):
# #             col_frame = ttk.Frame(main_frame)
# #             col_frame.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=5)
# #             title_label = ttk.Label(col_frame, text=titles[i], font=("Helvetica", 10, "bold"))
# #             title_label.pack()
# #             self.title_labels.append(title_label)
# #             img_label = ttk.Label(col_frame)
# #             img_label.pack()
# #             self.image_labels.append(img_label)
# #             hamming_label = ttk.Label(col_frame, text="Hamming: -")
# #             hamming_label.pack()
# #             self.hamming_labels.append(hamming_label)
# #             img_dist_label = ttk.Label(col_frame, text="Imagem: -")
# #             img_dist_label.pack()
# #             self.image_dist_labels.append(img_dist_label)
        
# #         self.generate_button = ttk.Button(self.root, text="Gerar Novo Conjunto Aleatório", command=self.generate_new_set)
# #         self.generate_button.pack(pady=10)
# #         self.generate_new_set()

# #     def _tensor_to_photo(self, tensor, zoom=3):
# #         """Converte um tensor de imagem do TF para um objeto de imagem do Tkinter."""
# #         img_np = (tensor.numpy().squeeze() * 255).astype(np.uint8)
# #         # Adaptado para RGB
# #         pil_img = Image.fromarray(img_np, mode='RGB')
# #         if zoom > 1:
# #             pil_img = pil_img.resize((IMG_WIDTH * zoom, IMG_HEIGHT * zoom), Image.NEAREST)
# #         return ImageTk.PhotoImage(pil_img)

# #     def generate_new_set(self):
# #         """Função chamada pelo botão para gerar e exibir um novo conjunto de 5 imagens."""
# #         base_bitmap = np.random.choice([-1.0, 1.0], size=(1, BITMAP_SIZE)).astype('float32')
# #         opposite_bitmap = base_bitmap * -1
# #         bitflip_A_bitmap = base_bitmap.copy(); bitflip_A_bitmap[0, 0] *= -1
# #         bitflip_B_bitmap = base_bitmap.copy(); bitflip_B_bitmap[0, 1] *= -1
# #         half_flip_bitmap = base_bitmap.copy()
# #         num_flips = int(BITMAP_SIZE * 0.5)
# #         flip_indices = np.random.choice(BITMAP_SIZE, num_flips, replace=False)
# #         half_flip_bitmap[0, flip_indices] *= -1
# #         bitmaps = [base_bitmap, opposite_bitmap, bitflip_A_bitmap, bitflip_B_bitmap, half_flip_bitmap]
# #         image_tensors = [self.model(b, training=False) for b in bitmaps]
# #         base_image_tensor = image_tensors[0]
# #         self.photos.clear()

# #         for i in range(len(bitmaps)):
# #             photo = self._tensor_to_photo(image_tensors[i])
# #             self.photos.append(photo)
# #             self.image_labels[i].config(image=photo)
# #             if i == 0:
# #                 self.hamming_labels[i].config(text="Hamming: 0.0")
# #                 self.image_dist_labels[i].config(text="Imagem: 0.0")
# #             else:
# #                 hamming_dist = np.mean(np.abs(base_bitmap - bitmaps[i]) / 2.0)
# #                 image_dist = tf.reduce_mean(tf.abs(base_image_tensor - image_tensors[i])).numpy()
# #                 self.hamming_labels[i].config(text=f"Hamming: {hamming_dist:.4f}")
# #                 self.image_dist_labels[i].config(text=f"Imagem: {image_dist:.4f}")

# #     def run(self):
# #         """Inicia a aplicação."""
# #         self.root.mainloop()

# # # --- Inicia a aplicação após o treinamento ---
# # if __name__ == '__main__':
# #     app = VisualizationApp(synthesizer)
# #     app.run()

# # --- 6. APLICAÇÃO GRÁFICA INTERATIVA ---
# class VisualizationApp:
#     def __init__(self, model):
#         self.model = model
#         self.root = tk.Tk()
#         self.root.title("Ferramenta de Análise de Sensibilidade")
#         self.root.geometry("800x450") # Aumentei um pouco a altura

#         # Listas para manter referências e evitar garbage collection
#         self.static_photos = []
#         self.interactive_photos = []

#         # --- Seção de Progressão Estática (MELHORIA 1) ---
#         static_frame = ttk.LabelFrame(self.root, text="Casos de Teste Fixos", padding=10)
#         static_frame.pack(padx=10, pady=10, fill=tk.X)
#         self.static_image_frame = ttk.Frame(static_frame)
#         self.static_image_frame.pack()
#         self.static_labels = self._create_image_grid(self.static_image_frame, 5, 
#             ["Todos -1", "Todos 1", "Metade/Metade", "Um Bit 1", "Um Bit -1"])
        
#         # --- Seção Interativa com Slider (MELHORIA 2) ---
#         inter_frame = ttk.LabelFrame(self.root, text="Análise Interativa com Caminho Fixo", padding=10)
#         inter_frame.pack(padx=10, pady=10, fill=tk.X, expand=True)
        
#         inter_base_frame = ttk.Frame(inter_frame)
#         inter_base_frame.pack(side=tk.LEFT, padx=20)
#         ttk.Label(inter_base_frame, text="Imagem Base", font=("Helvetica", 10, "bold")).pack()
#         self.interactive_base_img_label = ttk.Label(inter_base_frame)
#         self.interactive_base_img_label.pack()
#         ttk.Button(inter_base_frame, text="Reiniciar com Imagem Aleatória", command=self.reset_interactive_section).pack(pady=10)
        
#         inter_slider_frame = ttk.Frame(inter_frame)
#         inter_slider_frame.pack(side=tk.LEFT, padx=20, expand=True)
#         self.interactive_slider_title = ttk.Label(inter_slider_frame, text="Bitflip: 0.0%", font=("Helvetica", 10, "bold"))
#         self.interactive_slider_title.pack()
#         self.interactive_slider_img_label = ttk.Label(inter_slider_frame)
#         self.interactive_slider_img_label.pack()
#         self.slider = ttk.Scale(inter_slider_frame, from_=0.0, to=1.0, orient=tk.HORIZONTAL, length=300, command=self.update_slider_image)
#         self.slider.pack(pady=10)
        
#         # Inicializa a UI
#         self.setup_static_row()
#         self.reset_interactive_section()

#     def _create_image_grid(self, parent, num_images, titles):
#         labels_dict = {}
#         for i in range(num_images):
#             col_frame = ttk.Frame(parent)
#             col_frame.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=5)
#             labels_dict[i] = { 'title': ttk.Label(col_frame, text=titles[i], font=("Helvetica", 10, "bold")), 'img': ttk.Label(col_frame) }
#             labels_dict[i]['title'].pack(); labels_dict[i]['img'].pack()
#         return labels_dict

#     def _tensor_to_photo(self, tensor, zoom=3):
#         img_np = (tensor.numpy().squeeze() * 255).astype(np.uint8)
#         pil_img = Image.fromarray(img_np, mode='L')
#         if zoom > 1: pil_img = pil_img.resize((IMG_WIDTH * zoom, IMG_HEIGHT * zoom), Image.NEAREST)
#         return ImageTk.PhotoImage(pil_img)

#     def setup_static_row(self):
#         """Preenche a linha de cima com os 5 bitmaps fixos."""
#         self.static_photos.clear()
        
#         # 1. Tudo -1
#         bm1 = np.full((1, BITMAP_SIZE), -1.0, dtype=np.float32)
#         # 2. Tudo 1
#         bm2 = np.full((1, BITMAP_SIZE), 1.0, dtype=np.float32)
#         # 3. Metade / Metade
#         bm3 = np.full((1, BITMAP_SIZE), -1.0, dtype=np.float32)
#         bm3[0, BITMAP_SIZE // 2:] = 1.0
#         # 4. Tudo -1 com um 1
#         bm4 = np.full((1, BITMAP_SIZE), -1.0, dtype=np.float32)
#         bm4[0, 0] = 1.0
#         # 5. Tudo 1 com um -1
#         bm5 = np.full((1, BITMAP_SIZE), 1.0, dtype=np.float32)
#         bm5[0, 0] = -1.0
        
#         bitmaps = [bm1, bm2, bm3, bm4, bm5]
        
#         control_points_list = [self.model(b, training=False) for b in bitmaps]
#         image_tensors = [differentiable_renderer(cp) for cp in control_points_list]

#         for i, image_tensor in enumerate(image_tensors):
#             photo = self._tensor_to_photo(image_tensor)
#             self.static_photos.append(photo)
#             self.static_labels[i]['img'].config(image=photo)

#     def reset_interactive_section(self):
#         """Gera uma nova imagem base e uma nova sequência de flips para o slider."""
#         # Gera a nova imagem base
#         self.interactive_base_bitmap = np.random.choice([-1.0, 1.0], size=(1, BITMAP_SIZE)).astype('float32')
#         cp = self.model(self.interactive_base_bitmap, training=False)
#         self.interactive_base_image_tensor = differentiable_renderer(cp)
        
#         photo = self._tensor_to_photo(self.interactive_base_image_tensor, zoom=4)
#         self.interactive_photos.append(photo) # Manter referência
#         self.interactive_base_img_label.config(image=photo)
        
#         # MELHORIA 2: Cria e armazena a sequência de flips
#         indices = np.arange(BITMAP_SIZE)
#         np.random.shuffle(indices)
#         self.shuffled_indices = indices
        
#         # Reseta o slider para a posição 0
#         self.slider.set(0.0)
#         self.update_slider_image(0.0)

#     def update_slider_image(self, value):
#         """Atualiza a imagem da direita com base na posição do slider e na sequência de flips."""
#         flip_ratio = float(value)
        
#         # Cria uma cópia da imagem base para modificar
#         flipped_bitmap = self.interactive_base_bitmap.copy()
        
#         # Calcula quantos bits devem ser flipados
#         num_flips = int(BITMAP_SIZE * flip_ratio)
        
#         if num_flips > 0:
#             # Pega os primeiros 'num_flips' índices da nossa sequência embaralhada
#             indices_to_flip = self.shuffled_indices[:num_flips]
#             # Flipa os bits nesses índices específicos
#             flipped_bitmap[0, indices_to_flip] *= -1
            
#         # Gera a nova imagem
#         cp = self.model(flipped_bitmap, training=False)
#         image_tensor = differentiable_renderer(cp)
        
#         # Atualiza a GUI
#         photo = self._tensor_to_photo(image_tensor, zoom=4)
#         self.interactive_photos.append(photo) # Manter referência
#         self.interactive_slider_img_label.config(image=photo)
#         self.interactive_slider_title.config(text=f"Bitflip: {flip_ratio:.1%} (#{num_flips})")

#     def run(self):
#         self.root.mainloop()

# if __name__ == '__main__':
#     app = VisualizationApp(synthesizer)
#     app.run()



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
EPOCHS = 200
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
        img_np = (tensor.numpy().squeeze() * 255).astype(np.uint8)
        # MODIFICADO: modo 'RGB' para imagens coloridas
        pil_img = Image.fromarray(img_np, mode='RGB')
        if zoom > 1: pil_img = pil_img.resize((IMG_WIDTH * zoom, IMG_HEIGHT * zoom), Image.NEAREST)
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