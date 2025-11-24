# -*- coding: utf-8 -*-

import tensorflow as tf
from tensorflow.keras import layers, Model, optimizers
import numpy as np
import matplotlib.pyplot as plt

# --- 1. CONFIGURAÇÃO ---
# Parâmetros que você pode ajustar

BITMAP_SIZE = 64      # Tamanho do vetor de bits de entrada
IMG_HEIGHT = 32       # Altura da imagem de saída
IMG_WIDTH = 32        # Largura da imagem de saída
IMG_CHANNELS = 3      # 3 para RGB, 1 para escala de cinza

# Parâmetros de Treinamento
EPOCHS = 300
BATCH_SIZE = 32
LEARNING_RATE = 0.0002

# --- 2. CONSTRUÇÃO DA REDE SINTETIZADORA ---
# Esta parte permanece a mesma.

def build_synthesizer(input_shape=(BITMAP_SIZE,)):
    """Cria o modelo da rede sintetizadora."""
    inputs = layers.Input(shape=input_shape)
    x = layers.Dense(8 * 8 * 128, activation='relu')(inputs)
    x = layers.Reshape((8, 8, 128))(x)
    x = layers.Conv2DTranspose(64, kernel_size=3, strides=2, padding='same', activation='relu')(x)
    # x = layers.Conv2DTranspose(128, kernel_size=3, strides=2, padding='same', activation='relu')(x)
    # x = layers.Conv2DTranspose(64, kernel_size=3, strides=2, padding='same', activation='relu')(x)
    x = layers.Conv2DTranspose(32, kernel_size=3, strides=2, padding='same', activation='relu')(x)
    outputs = layers.Conv2DTranspose(IMG_CHANNELS, kernel_size=3, strides=1, padding='same', activation='sigmoid')(x)
    model = Model(inputs=inputs, outputs=outputs, name="synthesizer")
    return model

# --- 3. FUNÇÃO DE PERDA PROPORCIONAL E MULTI-ESCALA ---
# ESTA É A VERSÃO FINAL E CORRIGIDA

def multi_scale_proportional_loss(bitmap_a, bitmap_b, image_a, image_b):
    """
    Calcula a perda forçando a distância MÉDIA da imagem (em várias escalas)
    a ser igual à distância do bitmap.
    """
    # 1. Calcula a Distância de Hamming Normalizada (alvo)
    target_distance = tf.reduce_mean(tf.abs(bitmap_a - bitmap_b) / 2.0, axis=-1)
    
    # 2. Calcula a Distância de Imagem em Múltiplas Escalas
    scales = [2.0, 1.0, 0.5, 0.25]
    scale_distances = []

    for scale in scales:
        new_height = int(IMG_HEIGHT * scale)
        new_width = int(IMG_WIDTH * scale)
        
        # Redimensiona as imagens para a escala atual
        image_a_scaled = tf.image.resize(image_a, [new_height, new_width])
        image_b_scaled = tf.image.resize(image_b, [new_height, new_width])
        
        # Calcula a distância L1 (MAE) para esta escala
        dist_at_scale = tf.reduce_mean(tf.abs(image_a_scaled - image_b_scaled), axis=[1, 2, 3])
        scale_distances.append(dist_at_scale)

    # 3. Tira a média das distâncias para ter a predição final
    # tf.stack cria um tensor a partir da lista, e reduce_mean calcula a média na dimensão 0
    predicted_distance = tf.reduce_mean(tf.stack(scale_distances), axis=0)
    
    # 4. A perda é o Erro Quadrático Médio entre a distância alvo e a predita.
    loss = tf.reduce_mean(tf.square(target_distance - predicted_distance))
    
    return loss

# --- 4. FUNÇÃO PARA GERAR DADOS DE TREINAMENTO ---
# Geração de pares, permanece a mesma.

def create_pair_batch(batch_size=BATCH_SIZE, bitmap_size=BITMAP_SIZE):
    """Gera um lote de dados com pares (bitmap_a, bitmap_b)."""
    bitmaps_a = np.random.choice([-1.0, 1.0], size=(batch_size, bitmap_size)).astype('float32')
    bitmaps_b = np.random.choice([-1.0, 1.0], size=(batch_size, bitmap_size)).astype('float32')
    return bitmaps_a, bitmaps_b


# --- 5. LOOP DE TREINAMENTO ---

# Inicializa o modelo e o otimizador
synthesizer = build_synthesizer()
optimizer = optimizers.Adam(learning_rate=LEARNING_RATE)
synthesizer.summary()
print("\nIniciando o treinamento com perda proporcional e multi-escala...")

# Loop principal de treinamento
for epoch in range(1, EPOCHS + 1):
    bitmaps_a, bitmaps_b = create_pair_batch()
    
    with tf.GradientTape() as tape:
        images_a = synthesizer(bitmaps_a, training=True)
        images_b = synthesizer(bitmaps_b, training=True)
        
        # AQUI USAMOS A NOVA FUNÇÃO DE PERDA COMBINADA
        loss_value = multi_scale_proportional_loss(bitmaps_a, bitmaps_b, images_a, images_b)
        
    grads = tape.gradient(loss_value, synthesizer.trainable_variables)
    optimizer.apply_gradients(zip(grads, synthesizer.trainable_variables))
    
    if epoch % 5 == 0:
        print(f"Época: {epoch}, Perda: {loss_value.numpy():.6f}")

print("\nTreinamento concluído!")

# --- 6. VISUALIZAÇÃO DOS RESULTADOS ---
# Permanece a mesma, para verificarmos o resultado final.

def visualize_results(model):
    """Gera e exibe imagens para avaliar a relação de distância."""
    bm_1 = np.full((1, BITMAP_SIZE), -1.0).astype('float32')
    bm_2 = bm_1.copy()
    num_flips_1 = int(BITMAP_SIZE * 0.1)
    bm_2[0, :num_flips_1] *= -1
    bm_3 = bm_1.copy()
    num_flips_2 = int(BITMAP_SIZE * 0.5)
    bm_3[0, :num_flips_2] *= -1
    bm_4 = bm_1.copy() * -1

    test_bitmaps = [bm_1, bm_2, bm_3, bm_4]
    titles = [
        "Bitmap Base (A)",
        "Distância de A: 0.1",
        "Distância de A: 0.5",
        "Distância de A: 1.0"
    ]
    
    generated_images = [model(b, training=False) for b in test_bitmaps]
    
    # Apenas para relatório, calculamos a distância na escala 1x
    dist_img_2 = tf.reduce_mean(tf.abs(generated_images[0] - generated_images[1])).numpy()
    dist_img_3 = tf.reduce_mean(tf.abs(generated_images[0] - generated_images[2])).numpy()
    dist_img_4 = tf.reduce_mean(tf.abs(generated_images[0] - generated_images[3])).numpy()

    plt.figure(figsize=(16, 5))
    for i in range(len(generated_images)):
        ax = plt.subplot(1, len(generated_images), i + 1)
        img_np = generated_images[i].numpy().squeeze()
        if img_np.ndim == 2:
            plt.imshow(img_np, cmap='gray')
        else:
            plt.imshow(img_np)
        plt.title(titles[i])
        plt.axis("off")

    plt.suptitle(f"Distâncias (escala 1x): {dist_img_2:.3f}, {dist_img_3:.3f}, {dist_img_4:.3f}", fontsize=14)
    plt.show()

visualize_results(synthesizer)