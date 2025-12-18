import pandas as pd
import json
import os

# Carregar o arquivo JSON
file_path = os.path.join(os.path.dirname(__file__), 'results', 'global_results.json')
with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Criar DataFrame
df = pd.DataFrame(data)

# 1. Limpeza e Pré-processamento
# Remover entradas que são questionários, manter apenas as tarefas
if 'type' in df.columns:
    # Algumas entradas tem type dentro de details, mas o nível superior tem 'type' apenas para questionários
    # Olhando o JSON, questionários tem "type": "questionnaire". Tentativas não tem campo "type" na raiz, ou tem participantID.
    # Vamos filtrar onde participantID não é nulo.
    df = df[df['participantID'].notna()]

# Converter 'correct' para 0 e 1 (Acurácia)
# Certificar que é booleano antes de converter ou mapear direto
df['accuracy'] = df['correct'].map({True: 1, False: 0})

# Converter 'rt' de ms para segundos
df['rt_seconds'] = df['rt'] / 1000.0

# 2. Gerar arquivos separados por Task e Diff
tasks = df['task'].unique()
diffs = df['diff'].unique()

generated_files = []

# Dicionário para armazenar prévias para mostrar ao usuário
previews = {}

for task in tasks:
    for diff in diffs:
        # Filtrar o subconjunto de dados
        subset = df[(df['task'] == task) & (df['diff'] == diff)]
        
        if subset.empty:
            continue
            
        # --- Tabela de Acurácia ---
        # Pivot table: Index=Participant, Columns=Vis, Values=Accuracy (mean caso haja multiplas trials)
        acc_pivot = subset.pivot_table(index='participantID', columns='vis', values='accuracy', aggfunc='mean')
        
        # Nome do arquivo
        acc_filename = f'friedman_{task}_{diff}_accuracy.csv'
        acc_pivot.to_csv(acc_filename)
        generated_files.append(acc_filename)
        
        # Guardar preview se for o primeiro
        if not previews:
            previews['accuracy_example'] = acc_pivot.head()

        # --- Tabela de Tempo de Resposta (RT) ---
        rt_pivot = subset.pivot_table(index='participantID', columns='vis', values='rt_seconds', aggfunc='mean')
        
        rt_filename = f'friedman_{task}_{diff}_rt.csv'
        rt_pivot.to_csv(rt_filename)
        generated_files.append(rt_filename)

print(f"Arquivos gerados: {generated_files}")
print("\nExemplo de estrutura (Acurácia - Similarity - High):")
print(previews.get('accuracy_example'))