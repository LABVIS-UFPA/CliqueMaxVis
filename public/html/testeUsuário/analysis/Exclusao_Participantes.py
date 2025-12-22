import pandas as pd
import json
import matplotlib.pyplot as plt
import seaborn as sns
import textwrap
import os

# Load Data
json_path = os.path.join(os.path.dirname(__file__), 'results', 'global_results.json')
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
df_results = pd.DataFrame(data)

csv_path = os.path.join(os.path.dirname(__file__), 'results', 'Experimento para avaliar a eficiência perceptiva, memorabilidade e detectabilidade de padrões (respostas) - Respostas ao formulário 1.csv')
try:
    df_profile = pd.read_csv(csv_path, encoding='utf-8')
except:
    df_profile = pd.read_csv(csv_path, encoding='latin1')

# Preprocess JSON
# Filter relevant rows
valid_results = df_results[
    (df_results['participantID'].notna()) &
    (df_results.get('diff') != 'training') &
    (df_results.get('type') != 'questionnaire')
].copy()

# Conversions
valid_results['correct_num'] = valid_results['correct'].apply(lambda x: 1 if x is True else 0)
valid_results['rt_sec'] = valid_results['rt'] / 1000.0

# Aggregating per participant
# We want the general performance of each participant to correlate with their profile
participant_metrics = valid_results.groupby('participantID').agg(
    Mean_Accuracy=('correct_num', 'mean'),
    Mean_Time=('rt_sec', 'mean')
).reset_index()

# Preprocess CSV
# Rename ID column
if 'Coluna 1' in df_profile.columns:
    df_profile.rename(columns={'Coluna 1': 'participantID'}, inplace=True)

# Merge
df_merged = pd.merge(participant_metrics, df_profile, on='participantID', how='inner')

# Columns to analyze
demographic_cols = [
    'Faixa etária',
    'Escolaridade',
    'Visão',
    'É daltônico (Percepção de cor)?',
    'Familiaridade do usuário com computação',
    'Familiaridade com visualização da informação'
]

# Set Plotting Theme
sns.set_theme(style="whitegrid")

# --- Diretório para os Gráficos ---
output_dir = os.path.join(os.path.dirname(__file__), 'plots_perfil')
os.makedirs(output_dir, exist_ok=True)

# Generate Plots
created_files = []

for col in demographic_cols:
    if col not in df_merged.columns:
        continue
    
    # Create figure with 2 subplots (Accuracy and Time)
    fig, axes = plt.subplots(1, 2, figsize=(16, 6))
    
    # Wrap x-labels function
    def wrap_labels(ax, width=15):
        labels = []
        for label in ax.get_xticklabels():
            text = label.get_text()
            labels.append(textwrap.fill(text, width))
        ax.set_xticklabels(labels, rotation=0)

    # Plot Accuracy
    sns.boxplot(x=col, y='Mean_Accuracy', data=df_merged, ax=axes[0], palette="viridis")
    sns.stripplot(x=col, y='Mean_Accuracy', data=df_merged, ax=axes[0], color='black', alpha=0.3, jitter=True) # Show individual points
    axes[0].set_title(f'Acurácia por {col}')
    axes[0].set_ylabel('Acurácia Média (0-1)')
    axes[0].set_xlabel('')
    axes[0].set_ylim(0, 1.1)
    wrap_labels(axes[0])

    # Plot Time
    sns.boxplot(x=col, y='Mean_Time', data=df_merged, ax=axes[1], palette="magma")
    sns.stripplot(x=col, y='Mean_Time', data=df_merged, ax=axes[1], color='black', alpha=0.3, jitter=True)
    axes[1].set_title(f'Tempo de Resposta por {col}')
    axes[1].set_ylabel('Tempo Médio (s)')
    axes[1].set_xlabel('')
    wrap_labels(axes[1])

    # Limpa o nome do arquivo e salva
    safe_col_name = "".join([c if c.isalnum() else "_" for c in col])
    filename = f"analysis_{safe_col_name}.png"
    output_path = os.path.join(output_dir, filename)
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
    created_files.append(output_path)

print("Files created:", created_files)



# import pandas as pd
# import json
# import matplotlib.pyplot as plt
# import seaborn as sns
# import textwrap
# import os

# # Load Data
# json_path = os.path.join(os.path.dirname(__file__), 'results', 'global_results.json')
# with open(json_path, 'r', encoding='utf-8') as f:
#     data = json.load(f)
# df_results = pd.DataFrame(data)

# csv_path = os.path.join(os.path.dirname(__file__), 'results', 'Experimento para avaliar a eficiência perceptiva, memorabilidade e detectabilidade de padrões (respostas) - Respostas ao formulário 1.csv')
# try:
#     df_profile = pd.read_csv(csv_path, encoding='utf-8')
# except:
#     df_profile = pd.read_csv(csv_path, encoding='latin1')

# # Preprocess JSON
# # Filter relevant rows
# valid_results = df_results[
#     (df_results['participantID'].notna()) &
#     (df_results.get('diff') != 'training') &
#     (df_results.get('type') != 'questionnaire')
# ].copy()

# # Conversions
# valid_results['correct_num'] = valid_results['correct'].apply(lambda x: 1 if x is True else 0)
# valid_results['rt_sec'] = valid_results['rt'] / 1000.0

# # Aggregating per participant
# # We want the general performance of each participant to correlate with their profile
# participant_metrics = valid_results.groupby('participantID').agg(
#     Mean_Accuracy=('correct_num', 'mean'),
#     Mean_Time=('rt_sec', 'mean')
# ).reset_index()

# # Preprocess CSV
# # Rename ID column
# if 'Coluna 1' in df_profile.columns:
#     df_profile.rename(columns={'Coluna 1': 'participantID'}, inplace=True)

# # Merge
# df_merged = pd.merge(participant_metrics, df_profile, on='participantID', how='inner')

# # Columns to analyze
# demographic_cols = [
#     'Faixa etária',
#     'Escolaridade',
#     'Visão',
#     'É daltônico (Percepção de cor)?',
#     'Familiaridade do usuário com computação',
#     'Familiaridade com visualização da informação'
# ]

# # Set Plotting Theme
# sns.set_theme(style="whitegrid")

# # --- Diretório para os Gráficos ---
# output_dir = os.path.join(os.path.dirname(__file__), 'plots_perfil')
# os.makedirs(output_dir, exist_ok=True)

# # Generate Plots
# created_files = []

# for col in demographic_cols:
#     if col not in df_merged.columns:
#         continue
    
#     # Create figure with 2 subplots (Accuracy and Time)
#     fig, axes = plt.subplots(1, 2, figsize=(16, 6))
    
#     # Wrap x-labels function
#     def wrap_labels(ax, width=15):
#         labels = []
#         for label in ax.get_xticklabels():
#             text = label.get_text()
#             labels.append(textwrap.fill(text, width))
#         ax.set_xticklabels(labels, rotation=0)

#     # Plot Accuracy
#     sns.boxplot(x=col, y='Mean_Accuracy', data=df_merged, ax=axes[0], palette="viridis")
#     sns.stripplot(x=col, y='Mean_Accuracy', data=df_merged, ax=axes[0], color='black', alpha=0.3, jitter=True) # Show individual points
#     axes[0].set_title(f'Acurácia por {col}')
#     axes[0].set_ylabel('Acurácia Média (0-1)')
#     axes[0].set_xlabel('')
#     axes[0].set_ylim(0, 1.1)
#     wrap_labels(axes[0])

#     # Plot Time
#     sns.boxplot(x=col, y='Mean_Time', data=df_merged, ax=axes[1], palette="magma")
#     sns.stripplot(x=col, y='Mean_Time', data=df_merged, ax=axes[1], color='black', alpha=0.3, jitter=True)
#     axes[1].set_title(f'Tempo de Resposta por {col}')
#     axes[1].set_ylabel('Tempo Médio (s)')
#     axes[1].set_xlabel('')
#     wrap_labels(axes[1])

#     # Limpa o nome do arquivo e salva
#     safe_col_name = "".join([c if c.isalnum() else "_" for c in col])
#     filename = f"analysis_{safe_col_name}.png"
#     output_path = os.path.join(output_dir, filename)
#     plt.tight_layout()
#     plt.savefig(output_path)
#     plt.close()
#     created_files.append(output_path)

# print("Files created:", created_files)

