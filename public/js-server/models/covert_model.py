# converter_modelo.py (Ajustado para o formato .keras)
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Layer, Input
import tensorflow_hub as hub
import os

# --- 1. Definição dos caminhos ---
LOCAL_MODEL_PATH = "./compare-gan-cifar10-model-11"
OUTPUT_DIR = "./modelos_keras"
os.makedirs(OUTPUT_DIR, exist_ok=True)

if not os.path.exists(LOCAL_MODEL_PATH):
    raise FileNotFoundError(f"A pasta do modelo do Hub não foi encontrada em: {LOCAL_MODEL_PATH}")

print(f"Carregando modelo do Hub de: {LOCAL_MODEL_PATH}")
gan_module = hub.load(LOCAL_MODEL_PATH)
generator_fn = gan_module.signatures['generator']
discriminator_fn = gan_module.signatures['discriminator']

# --- 2. Camada Adaptadora (Wrapper) ---
class HubFunctionWrapper(Layer):
    def __init__(self, hub_function, output_key=None, **kwargs):
        super().__init__(**kwargs)
        self.hub_function = hub_function
        self.output_key = output_key
    def call(self, inputs):
        output = self.hub_function(inputs)
        if self.output_key:
            return output[self.output_key]
        return output

# --- 3. ETAPA DE CONVERSÃO DO GERADOR ---
print("Construindo e salvando o modelo do Gerador...")
latent_dim_input = Input(shape=(128,), name="latent_vector")
generator_wrapper = HubFunctionWrapper(generator_fn, output_key='default')
generated_image_output = generator_wrapper(latent_dim_input)
generator_model = Model(inputs=latent_dim_input, outputs=generated_image_output, name="generator")

# CORREÇÃO: Mudar a extensão do arquivo para .keras
generator_path = os.path.join(OUTPUT_DIR, "generator_gan.keras")
generator_model.save(generator_path)
print(f"Gerador salvo em: {generator_path}")

# --- 4. ETAPA DE CONVERSÃO DO EXTRATOR DE CARACTERÍSTICAS ---
print("\nConstruindo e salvando o modelo do Extrator de Características...")
image_input = Input(shape=(32, 32, 3), name="image")
discriminator_wrapper = HubFunctionWrapper(discriminator_fn)
discriminator_output = discriminator_wrapper(image_input)
full_discriminator_model = Model(inputs=image_input, outputs=discriminator_output, name="full_discriminator")

feature_extractor_output = full_discriminator_model.layers[-2].output
feature_extractor_model = Model(inputs=full_discriminator_model.input, outputs=feature_extractor_output, name="feature_extractor")

# CORREÇÃO: Mudar a extensão do arquivo para .keras
feature_extractor_path = os.path.join(OUTPUT_DIR, "feature_extractor.keras")
feature_extractor_model.save(feature_extractor_path)
print(f"Extrator de Características salvo em: {feature_extractor_path}")

print("\nConversão concluída com sucesso! ✅")