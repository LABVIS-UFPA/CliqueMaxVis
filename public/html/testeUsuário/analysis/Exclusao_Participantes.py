import pandas as pd
import json
import matplotlib.pyplot as plt
import seaborn as sns
import os
import textwrap

# --- CONFIGURAÇÃO ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(BASE_DIR, 'results')
JSON_PATH = os.path.join(RESULTS_DIR, 'global_results.json')
# Nome exato do arquivo CSV fornecido
CSV_NAME = 'Experimento para avaliar a eficiência perceptiva, memorabilidade e detectabilidade de padrões (respostas) - Respostas ao formulário 1.csv'
CSV_PATH = os.path.join(RESULTS_DIR, CSV_NAME)
OUTPUT_DIR = os.path.join(BASE_DIR, 'plots_perfil')

# Configuração visual do Seaborn
sns.set_theme(style="whitegrid")

def load_data():
    # 1. Carregar Resultados (JSON)
    if not os.path.exists(JSON_PATH):
        print(f"ERRO: JSON não encontrado em {JSON_PATH}")
        return None, None

    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    df_results = pd.DataFrame(data)

    # Filtrar dados irrelevantes (treino e questionários embutidos)
    if 'participantID' in df_results.columns:
        df_results = df_results[df_results['participantID'].notna()]
    
    if 'diff' in df_results.columns:
        df_results = df_results[df_results['diff'] != 'training']
    if 'type' in df_results.columns:
        df_results = df_results[df_results['type'] != 'questionnaire']

    # Converter acurácia para numérico (0 ou 1) e tempo para segundos
    if 'correct' in df_results.columns:
        df_results['correct_int'] = df_results['correct'].apply(lambda x: 1 if x is True else 0)
    
    if 'rt' in df_results.columns:
        df_results['rt_sec'] = df_results['rt'] / 1000.0

    # Agrupar por Participante e Tarefa (Média de cada participante por tarefa)
    if 'participantID' not in df_results.columns or 'task' not in df_results.columns:
        print("Colunas necessárias (participantID, task) ausentes no JSON.")
        return None, None

    df_metrics = df_results.groupby(['participantID', 'task']).agg(
        Accuracy=('correct_int', 'mean'),
        Time=('rt_sec', 'mean')
    ).reset_index()

    # 2. Carregar Perfil (CSV)
    if not os.path.exists(CSV_PATH):
        print(f"ERRO: CSV não encontrado em {CSV_PATH}")
        return None, None

    try:
        df_profile = pd.read_csv(CSV_PATH, encoding='utf-8')
    except UnicodeDecodeError:
        df_profile = pd.read_csv(CSV_PATH, encoding='latin1')

    # Renomear coluna de ID para padronizar
    if 'Coluna 1' in df_profile.columns:
        df_profile.rename(columns={'Coluna 1': 'participantID'}, inplace=True)
    
    return df_metrics, df_profile

def generate_plots(df_merged):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    cols_to_analyze = [
        'Faixa etária',
        'Escolaridade',
        'Visão',
        'É daltônico (Percepção de cor)?',
        'Familiaridade do usuário com computação',
        'Familiaridade com visualização da informação'
    ]

    for col in cols_to_analyze:
        if col not in df_merged.columns:
            continue

        print(f"Gerando gráficos para: {col}")
        safe_name = "".join([c if c.isalnum() else "_" for c in col])

        # Função auxiliar para plotar
        def plot_metric(metric_col, ylabel, filename_prefix):
            plt.figure(figsize=(14, 7))
            try:
                ax = sns.boxplot(x=col, y=metric_col, hue='task', data=df_merged, palette="Set2")
                
                # Melhorar rótulos do eixo X (quebrar texto longo)
                labels = []
                for label in ax.get_xticklabels():
                    labels.append(textwrap.fill(label.get_text(), 20))
                ax.set_xticklabels(labels)
                
                plt.title(f'Influência de "{col}" em {ylabel}')
                plt.ylabel(ylabel)
                plt.xlabel('')
                plt.legend(title='Tarefa', bbox_to_anchor=(1.01, 1), loc='upper left')
                plt.tight_layout()
                plt.savefig(os.path.join(OUTPUT_DIR, f'{filename_prefix}_{safe_name}.png'))
                plt.close()
            except Exception as e:
                print(f"Erro ao gerar gráfico para {col}: {e}")
                plt.close()

        # Plotar Acurácia
        plot_metric('Accuracy', 'Acurácia Média (0-1)', 'Acc')
        
        # Plotar Tempo
        plot_metric('Time', 'Tempo Médio (s)', 'Time')

def main():
    df_metrics, df_profile = load_data()
    if df_metrics is None or df_profile is None:
        return

    # Cruzar tabelas
    df_merged = pd.merge(df_metrics, df_profile, on='participantID', how='inner')
    print(f"Participantes com dados completos: {df_merged['participantID'].nunique()}")
    
    if df_merged.empty:
        print("Aviso: O cruzamento de dados resultou em uma tabela vazia. Verifique se os IDs no CSV correspondem aos do JSON.")
        return

    generate_plots(df_merged)
    print(f"Análise concluída! Verifique a pasta: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
import pandas as pd
import json
import matplotlib.pyplot as plt
import seaborn as sns
import os
import textwrap

# --- CONFIGURAÇÃO ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(BASE_DIR, 'results')
JSON_PATH = os.path.join(RESULTS_DIR, 'global_results.json')
# Nome exato do arquivo CSV fornecido
CSV_NAME = 'Experimento para avaliar a eficiência perceptiva, memorabilidade e detectabilidade de padrões (respostas) - Respostas ao formulário 1.csv'
CSV_PATH = os.path.join(RESULTS_DIR, CSV_NAME)
OUTPUT_DIR = os.path.join(BASE_DIR, 'plots_perfil')

# Configuração visual do Seaborn
sns.set_theme(style="whitegrid")

def load_data():
    # 1. Carregar Resultados (JSON)
    if not os.path.exists(JSON_PATH):
        print(f"ERRO: JSON não encontrado em {JSON_PATH}")
        return None, None

    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    df_results = pd.DataFrame(data)

    # Filtrar dados irrelevantes (treino e questionários embutidos)
    df_results = df_results[df_results['participantID'].notna()]
    if 'diff' in df_results.columns:
        df_results = df_results[df_results['diff'] != 'training']
    if 'type' in df_results.columns:
        df_results = df_results[df_results['type'] != 'questionnaire']

    # Converter acurácia para numérico (0 ou 1) e tempo para segundos
    df_results['correct_int'] = df_results['correct'].apply(lambda x: 1 if x is True else 0)
    df_results['rt_sec'] = df_results['rt'] / 1000.0

    # Agrupar por Participante e Tarefa (Média de cada participante por tarefa)
    df_metrics = df_results.groupby(['participantID', 'task']).agg(
        Accuracy=('correct_int', 'mean'),
        Time=('rt_sec', 'mean')
    ).reset_index()

    # 2. Carregar Perfil (CSV)
    if not os.path.exists(CSV_PATH):
        print(f"ERRO: CSV não encontrado em {CSV_PATH}")
        return None, None

    try:
        df_profile = pd.read_csv(CSV_PATH, encoding='utf-8')
    except UnicodeDecodeError:
        df_profile = pd.read_csv(CSV_PATH, encoding='latin1')

    # Renomear coluna de ID para padronizar
    if 'Coluna 1' in df_profile.columns:
        df_profile.rename(columns={'Coluna 1': 'participantID'}, inplace=True)
    
    return df_metrics, df_profile

def generate_plots(df_merged):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    cols_to_analyze = [
        'Faixa etária',
        'Escolaridade',
        'Visão',
        'É daltônico (Percepção de cor)?',
        'Familiaridade do usuário com computação',
        'Familiaridade com visualização da informação'
    ]

    for col in cols_to_analyze:
        if col not in df_merged.columns:
            continue

        print(f"Gerando gráficos para: {col}")
        safe_name = "".join([c if c.isalnum() else "_" for c in col])

        # Função auxiliar para plotar
        def plot_metric(metric_col, ylabel, filename_prefix):
            plt.figure(figsize=(14, 7))
            ax = sns.boxplot(x=col, y=metric_col, hue='task', data=df_merged, palette="Set2")
            
            # Melhorar rótulos do eixo X (quebrar texto longo)
            labels = [textwrap.fill(label.get_text(), 20) for label in ax.get_xticklabels()]
            ax.set_xticklabels(labels)
            
            plt.title(f'Influência de "{col}" em {ylabel}')
            plt.ylabel(ylabel)
            plt.xlabel('')
            plt.legend(title='Tarefa', bbox_to_anchor=(1.01, 1), loc='upper left')
            plt.tight_layout()
            plt.savefig(os.path.join(OUTPUT_DIR, f'{filename_prefix}_{safe_name}.png'))
            plt.close()

        # Plotar Acurácia
        plot_metric('Accuracy', 'Acurácia Média (0-1)', 'Acc')
        
        # Plotar Tempo
        plot_metric('Time', 'Tempo Médio (s)', 'Time')

def main():
    df_metrics, df_profile = load_data()
    if df_metrics is None or df_profile is None:
        return

    # Cruzar tabelas
    df_merged = pd.merge(df_metrics, df_profile, on='participantID', how='inner')
    print(f"Participantes com dados completos: {df_merged['participantID'].nunique()}")

    generate_plots(df_merged)
    print(f"Análise concluída! Verifique a pasta: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
