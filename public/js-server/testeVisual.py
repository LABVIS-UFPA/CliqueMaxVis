# -*- coding: utf-8 -*-

import tensorflow as tf
from tensorflow.keras import layers, Model, optimizers
import numpy as np
import matplotlib.pyplot as plt

# --- 1. CONFIGURAÇÃO ---
# Parâmetros que você pode ajustar

BITMAP_SIZE = 64      # Tamanho do vetor de bits de entrada (ex: 64 bits)
IMG_HEIGHT = 32       # Altura da imagem de saída
IMG_WIDTH = 32        # Largura da imagem de saída
IMG_CHANNELS = 3      # 3 para RGB, 1 para escala de cinza

# Parâmetros de Treinamento
EPOCHS = 200         # Número de épocas de treinamento
BATCH_SIZE = 32       # Quantos trios processar de uma vez
LEARNING_RATE = 0.0002 # Taxa de aprendizado do otimizador
MARGIN = 1.0          # Margem para a função de perda (triplet loss)

# --- 2. CONSTRUÇÃO DA REDE SINTETIZADORA ---
# Esta rede aprende a transformar o bitmap em uma imagem.
# A arquitetura usa camadas "Conv2DTranspose" para fazer o upsampling
# de um vetor para uma imagem, similar a redes generativas.

def build_synthesizer(input_shape=(BITMAP_SIZE,)):
    """Cria o modelo da rede sintetizadora."""
    
    # Camada de entrada
    inputs = layers.Input(shape=input_shape)
    
    # A primeira camada densa projeta o bitmap para um espaço maior
    # e prepara para a remodelação em um formato de imagem pequena.
    x = layers.Dense(8 * 8 * 128, activation='relu')(inputs)
    x = layers.Reshape((8, 8, 128))(x)
    
    # Camadas de convolução transposta para aumentar a resolução (upsampling)
    # 8x8 -> 16x16
    x = layers.Conv2DTranspose(64, kernel_size=3, strides=2, padding='same', activation='relu')(x)
    # 16x16 -> 32x32
    x = layers.Conv2DTranspose(32, kernel_size=3, strides=2, padding='same', activation='relu')(x)
    
    # Camada final para gerar a imagem com os canais de cor desejados.
    # A ativação 'sigmoid' garante que os valores dos pixels fiquem entre 0 e 1.
    outputs = layers.Conv2DTranspose(IMG_CHANNELS, kernel_size=3, strides=1, padding='same', activation='sigmoid')(x)
    
    # Cria e retorna o modelo Keras
    model = Model(inputs=inputs, outputs=outputs, name="synthesizer")
    return model

# --- 3. DEFINIÇÃO DA FUNÇÃO DE PERDA (TRIPLET LOSS) ---
# Esta função ensina o modelo a aproximar imagens de bitmaps similares
# e afastar imagens de bitmaps diferentes.

def triplet_loss(anchor_img, positive_img, negative_img, margin=MARGIN):
    """
    Calcula a perda do trio (triplet loss).
    O objetivo é que a distância (âncora, positivo) seja menor que a distância (âncora, negativo)
    por uma margem `margin`.
    """
    # Calcula a distância L2 (quadrática) entre a âncora e a imagem positiva
    pos_dist = tf.reduce_sum(tf.square(anchor_img - positive_img), axis=[1, 2, 3])
    
    # Calcula a distância L2 (quadrática) entre a âncora e a imagem negativa
    neg_dist = tf.reduce_sum(tf.square(anchor_img - negative_img), axis=[1, 2, 3])
    
    # Calcula a perda básica
    basic_loss = pos_dist - neg_dist + margin
    
    # A perda final é o máximo entre a perda básica e zero.
    # Se basic_loss < 0, significa que a condição já foi satisfeita, e a perda é 0.
    loss = tf.maximum(basic_loss, 0.0)
    
    return tf.reduce_mean(loss)

# --- 4. FUNÇÃO PARA GERAR DADOS DE TREINAMENTO ---

def create_triplet_batch(batch_size=BATCH_SIZE, bitmap_size=BITMAP_SIZE):
    """
    Gera um lote de dados com trios (âncora, positivo, negativo).
    - Âncora: Um bitmap aleatório.
    - Positivo: Uma cópia da âncora com poucos bits invertidos (similar).
    - Negativo: Um bitmap completamente aleatório (diferente).
    """
    # Cria os bitmaps âncora. [cite_start]Usamos -1 e 1 como no artigo[cite: 41].
    anchors = np.random.choice([-1.0, 1.0], size=(batch_size, bitmap_size)).astype('float32')
    
    # Cria os bitmaps positivos invertendo poucos bits da âncora
    positives = anchors.copy()
    num_flips = np.random.randint(1, int(bitmap_size * 0.1) + 1) # Inverte até 10% dos bits
    for i in range(batch_size):
        flip_indices = np.random.choice(bitmap_size, num_flips, replace=False)
        positives[i, flip_indices] *= -1
        
    # Cria os bitmaps negativos (completamente aleatórios)
    negatives = np.random.choice([-1.0, 1.0], size=(batch_size, bitmap_size)).astype('float32')
    
    return anchors, positives, negatives


# --- 5. LOOP DE TREINAMENTO ---

# Inicializa o modelo e o otimizador
synthesizer = build_synthesizer()
# [cite_start]O artigo menciona o uso do otimizador Adam [cite: 76]
optimizer = optimizers.Adam(learning_rate=LEARNING_RATE)

synthesizer.summary()

print("\nIniciando o treinamento...")

# Loop principal de treinamento
for epoch in range(1, EPOCHS + 1):
    # Gera um novo lote de dados
    anchors, positives, negatives = create_triplet_batch()
    
    with tf.GradientTape() as tape:
        # Gera as imagens para o trio de bitmaps
        anchor_imgs = synthesizer(anchors, training=True)
        positive_imgs = synthesizer(positives, training=True)
        negative_imgs = synthesizer(negatives, training=True)
        
        # Calcula a perda
        loss_value = triplet_loss(anchor_imgs, positive_imgs, negative_imgs)
        
    # Calcula os gradientes e atualiza os pesos do modelo
    grads = tape.gradient(loss_value, synthesizer.trainable_variables)
    optimizer.apply_gradients(zip(grads, synthesizer.trainable_variables))
    
    # Exibe o progresso
    if epoch % 2 == 0:
        print(f"Época: {epoch}, Perda: {loss_value.numpy():.4f}")


print("\nTreinamento concluído!")


# --- 6. VISUALIZAÇÃO DOS RESULTADOS ---

def visualize_results(model):
    """Gera e exibe algumas imagens para avaliar o resultado."""
    
    # Criação de bitmaps de teste
    # Teste 1: Bitmap com todos os valores -1
    test_bitmap_1 = np.full((1, BITMAP_SIZE), -1.0).astype('float32')
    
    # Teste 2: Uma versão similar ao primeiro, com apenas um bit invertido
    test_bitmap_2 = test_bitmap_1.copy()
    test_bitmap_2[0, 0] = 1.0
    
    # Teste 3: Outra versão similar, com um bit diferente invertido
    test_bitmap_3 = test_bitmap_1.copy()
    test_bitmap_3[0, 1] = 1.0
    
    # Teste 4: Um bitmap muito diferente (todos os valores 1)
    test_bitmap_4 = np.full((1, BITMAP_SIZE), 1.0).astype('float32')

    # Teste 5: Um bitmap aleatório
    test_bitmap_5 = np.random.choice([-1.0, 1.0], size=(1, BITMAP_SIZE)).astype('float32')

    test_bitmaps = [test_bitmap_1, test_bitmap_2, test_bitmap_3, test_bitmap_4, test_bitmap_5]
    titles = [
        "Todos -1",
        "Similar (1 bit ≠)",
        "Similar (outro bit ≠)",
        "Distante (Todos 1)",
        "Aleatório"
    ]
    
    # Gera as imagens
    generated_images = [model(b, training=False).numpy().squeeze() for b in test_bitmaps]
    
    # Exibe as imagens
    plt.figure(figsize=(15, 5))
    for i in range(len(generated_images)):
        ax = plt.subplot(1, len(generated_images), i + 1)
        plt.imshow(generated_images[i])
        plt.title(titles[i])
        plt.axis("off")
    plt.suptitle("Imagens Geradas a partir de Bitmaps de Teste", fontsize=16)
    plt.show()

# Chama a função para visualizar os resultados com o modelo treinado
visualize_results(synthesizer)