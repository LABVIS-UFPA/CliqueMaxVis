# fase1_treinar_vae_perceptual.py (Arquitetura V2 + Perceptual Loss)
# -*- coding: utf-8 -*-

import tensorflow as tf
from tensorflow.keras import layers, Model, applications
from tensorflow.keras.callbacks import Callback, ReduceLROnPlateau
from tensorflow.keras.datasets import cifar10
import numpy as np
import matplotlib.pyplot as plt
import os

# --- 1. CONFIGURAÇÃO ---
IMG_SHAPE = (32, 32, 3)
BATCH_SIZE = 128
EPOCHS = 3 # V2 treinava bem com menos épocas, mas perceptual loss pode pedir mais.
LATENT_DIM = 512 

# Pesos das perdas (Ajuste Fino é crucial aqui)
# A Perceptual Loss tem valores grandes, então o peso é pequeno para equilibrar
PERCEPTUAL_LOSS_WEIGHT = 0.1 
RECONSTRUCTION_LOSS_WEIGHT = 1.0 # Peso do MSE (pixel-a-pixel)
KL_ANNEALING_TARGET = 0.1
KL_ANNEALING_RATE = 0.99

# --- 2. PREPARAÇÃO DOS DADOS ---
(x_train, _), (x_test, _) = cifar10.load_data()
def preprocess_images(images):
    return images.astype("float32") / 255.0 # Normalizado [0,1]
x_train = preprocess_images(x_train)
x_test = preprocess_images(x_test)

train_dataset = tf.data.Dataset.from_tensor_slices(x_train).shuffle(len(x_train)).batch(BATCH_SIZE)
test_dataset = tf.data.Dataset.from_tensor_slices(x_test).batch(BATCH_SIZE)

# --- 3. PREPARANDO A VGG19 (PERCEPTUAL LOSS) ---
def build_vgg_feature_extractor():
    # Carrega VGG19 pré-treinada na ImageNet
    vgg = applications.VGG19(include_top=False, weights='imagenet', input_shape=(64, 64, 3))
    vgg.trainable = False # Congela os pesos
    
    # Escolhemos camadas intermediárias que capturam texturas e formas
    # block3_conv3 é um padrão comum para estilo/percepção
    outputs = [vgg.get_layer("block3_conv3").output]
    
    model = Model(inputs=vgg.input, outputs=outputs, name="vgg_extractor")
    return model

# Instância global do extrator para ser usada dentro do VAE
vgg_extractor = build_vgg_feature_extractor()

# --- 4. ARQUITETURA V2 (Restaurada) ---
class Sampling(layers.Layer):
    def call(self, inputs):
        z_mean, z_log_var = inputs
        batch = tf.shape(z_mean)[0]
        dim = tf.shape(z_mean)[1]
        epsilon = tf.keras.backend.random_normal(shape=(batch, dim))
        return z_mean + tf.exp(0.5 * z_log_var) * epsilon

# Encoder V2 (Simples: 32 -> 64 -> 128)
encoder_inputs = layers.Input(shape=IMG_SHAPE, name="encoder_input")
x = layers.Conv2D(32, 3, activation="relu", strides=2, padding="same")(encoder_inputs)
x = layers.Conv2D(64, 3, activation="relu", strides=2, padding="same")(x)
x = layers.Conv2D(128, 3, activation="relu", strides=2, padding="same")(x)
x = layers.Flatten()(x)
# Camada densa intermediária da V2 (menor que a V3)
x = layers.Dense(16, activation="relu")(x) # Nota: V2 original tinha essa camada pequena, mas com Latent 512 pode ser gargalo.
# Vou aumentar levemente para 256 para não sufocar o latent de 512, mas manter a estrutura V2.
# Se quiser estritamente a V2 original, mude para 16, mas recomendo 1024 para latent 512.
# Vou manter a estrutura lógica da V2 mas com largura compatível com o latent 512.
x = layers.Dense(1024, activation="relu")(x) 

z_mean = layers.Dense(LATENT_DIM, name="z_mean")(x)
z_log_var = layers.Dense(LATENT_DIM, name="z_log_var")(x)
z = Sampling()([z_mean, z_log_var])
encoder = Model(encoder_inputs, [z_mean, z_log_var, z], name="encoder")

# Decoder V2 (Simples: 128 -> 64 -> 32)
latent_inputs = layers.Input(shape=(LATENT_DIM,), name="decoder_input")
x = layers.Dense(1024, activation="relu")(latent_inputs)
x = layers.Dense(4 * 4 * 128, activation="relu")(x)
x = layers.Reshape((4, 4, 128))(x)
x = layers.Conv2DTranspose(128, 3, activation="relu", strides=2, padding="same")(x)
x = layers.Conv2DTranspose(64, 3, activation="relu", strides=2, padding="same")(x)
x = layers.Conv2DTranspose(32, 3, activation="relu", strides=2, padding="same")(x)
decoder_outputs = layers.Conv2DTranspose(3, 3, activation="sigmoid", padding="same")(x)
decoder = Model(latent_inputs, decoder_outputs, name="decoder")

# --- 5. CLASSE VAE COM PERCEPTUAL LOSS ---
class VAE(Model):
    def __init__(self, encoder, decoder, vgg_extractor, **kwargs):
        super().__init__(**kwargs)
        self.encoder = encoder
        self.decoder = decoder
        self.vgg_extractor = vgg_extractor
        self.kl_weight = tf.Variable(0.0, trainable=False, name="kl_weight")
        
        # Métricas
        self.total_loss_tracker = tf.keras.metrics.Mean(name="total_loss")
        self.recon_loss_tracker = tf.keras.metrics.Mean(name="recon_loss")
        self.perceptual_loss_tracker = tf.keras.metrics.Mean(name="perceptual_loss") # Nova métrica
        self.kl_loss_tracker = tf.keras.metrics.Mean(name="kl_loss")

    @property
    def metrics(self):
        return [
            self.total_loss_tracker, 
            self.recon_loss_tracker, 
            self.perceptual_loss_tracker,
            self.kl_loss_tracker
        ]

    def call(self, inputs):
        z_mean, z_log_var, z = self.encoder(inputs)
        reconstruction = self.decoder(z)
        return reconstruction

    def calculate_loss(self, data, reconstruction, z_mean, z_log_var):
        # 1. Pixel-wise Loss (MSE)
        recon_loss = tf.reduce_mean(tf.reduce_sum(tf.square(data - reconstruction), axis=(1, 2, 3)))
        
        # 2. Perceptual Loss (VGG)
        # Precisamos redimensionar para 64x64 para a VGG funcionar bem e preprocessar
        data_resized = tf.image.resize(data, (64, 64))
        recon_resized = tf.image.resize(reconstruction, (64, 64))
        
        # VGG espera entradas preprocessadas (geralmente não normalizadas [0,1], mas a VGG do keras lida bem se consistente)
        # O mais seguro para VGG Keras 'imagenet' é converter para 0-255 e usar preprocess_input
        # Mas para simplificar e manter gradientes limpos, vamos usar a diferença direta nas features com entrada [0,1] * 255
        # (Isso é uma aproximação comum em VAEs customizados)
        
        # Extrair features
        real_features = self.vgg_extractor(data_resized * 255.0)
        fake_features = self.vgg_extractor(recon_resized * 255.0)
        
        # MSE entre as features
        perceptual_loss = tf.reduce_mean(tf.square(real_features - fake_features))
        
        # 3. KL Loss
        kl_loss = -0.5 * (1 + z_log_var - tf.square(z_mean) - tf.exp(z_log_var))
        kl_loss = tf.reduce_mean(tf.reduce_sum(kl_loss, axis=1))
        
        # Soma Ponderada
        total_loss = (recon_loss * RECONSTRUCTION_LOSS_WEIGHT) + \
                     (perceptual_loss * PERCEPTUAL_LOSS_WEIGHT) + \
                     (kl_loss * self.kl_weight)
                     
        return total_loss, recon_loss, perceptual_loss, kl_loss

    def train_step(self, data):
        with tf.GradientTape() as tape:
            z_mean, z_log_var, z = self.encoder(data)
            reconstruction = self.decoder(z)
            total_loss, recon_loss, p_loss, kl_loss = self.calculate_loss(data, reconstruction, z_mean, z_log_var)
            
        grads = tape.gradient(total_loss, self.trainable_weights)
        self.optimizer.apply_gradients(zip(grads, self.trainable_weights))
        
        self.total_loss_tracker.update_state(total_loss)
        self.recon_loss_tracker.update_state(recon_loss)
        self.perceptual_loss_tracker.update_state(p_loss)
        self.kl_loss_tracker.update_state(kl_loss)
        return {m.name: m.result() for m in self.metrics}

    def test_step(self, data):
        z_mean, z_log_var, z = self.encoder(data)
        reconstruction = self.decoder(z)
        total_loss, recon_loss, p_loss, kl_loss = self.calculate_loss(data, reconstruction, z_mean, z_log_var)
        
        self.total_loss_tracker.update_state(total_loss)
        self.recon_loss_tracker.update_state(recon_loss)
        self.perceptual_loss_tracker.update_state(p_loss)
        self.kl_loss_tracker.update_state(kl_loss)
        return {m.name: m.result() for m in self.metrics}

# --- 6. CALLBACKS ---
class KLAnnealingCallback(Callback):
    def __init__(self, target, rate, **kwargs):
        super().__init__(**kwargs)
        self.target = target
        self.rate = rate
    def on_epoch_begin(self, epoch, logs=None):
        new_weight = self.model.kl_weight.numpy() * self.rate + self.target * (1 - self.rate)
        self.model.kl_weight.assign(new_weight)
        if epoch % 5 == 0:
            tf.print(f" - Epoch {epoch}: Setting kl_weight to: {self.model.kl_weight.numpy():.6f}")

lr_scheduler = ReduceLROnPlateau(
    monitor='total_loss', # Monitoramos a perda total agora (que inclui a perceptual)
    mode='min',
    factor=0.5,
    patience=5,
    min_lr=1e-6,
    verbose=1
)

# --- 7. EXECUÇÃO ---
vae = VAE(encoder, decoder, vgg_extractor)
vae.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001)) # Sem loss no compile, pois é customizada

print("\nIniciando o treinamento do VAE V2 + Perceptual Loss...")
vae.fit(
    train_dataset, 
    epochs=EPOCHS, 
    batch_size=BATCH_SIZE, 
    validation_data=test_dataset,
    callbacks=[
        KLAnnealingCallback(KL_ANNEALING_TARGET, KL_ANNEALING_RATE),
        lr_scheduler
    ]
)
print("Treinamento concluído!")

# Salvar
decoder_save_path = "decoder_cifar10_perceptual.keras"
decoder.save(decoder_save_path)
print(f"\nModelo do Decodificador Perceptual salvo em: {decoder_save_path}")

# Visualização
print("Gerando visualização...")
num_images_to_show = 10
test_sample_batch = next(iter(test_dataset.take(1)))
test_sample_images = test_sample_batch[:num_images_to_show]
reconstructions = vae.predict(test_sample_images)

fig, axes = plt.subplots(2, num_images_to_show, figsize=(15, 3))
fig.suptitle("V2 Perceptual - Originais (Cima) vs. Reconstruídas (Baixo)", fontsize=16)
for i in range(num_images_to_show):
    axes[0, i].imshow(test_sample_images[i])
    axes[0, i].axis('off')
    axes[1, i].imshow(reconstructions[i])
    axes[1, i].axis('off')
plt.tight_layout(rect=[0, 0, 1, 0.96])
plt.show()