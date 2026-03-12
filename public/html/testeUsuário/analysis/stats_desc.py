import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# 1. Carregar Dados
try:
    with open('./results/global_results.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f"Carregados {len(data)} registros.")
except FileNotFoundError:
    print("Erro: 'global_results.json' não encontrado.")
    data = []

# 2. Processar Dados
rows = []
for entry in data:
    if entry.get('diff') == 'training': continue
    if entry.get('type') == 'questionnaire': continue
        
    pid = entry.get('participantID', 'Unknown')
    task = entry.get('task')
    details = entry.get('details', {})
    
    # Define a métrica de "Eficiência" baseada na tarefa
    efficiency = np.nan
    metric_type = 'Tempo (ms)'
    
    if task == 'trend2':
        efficiency = details.get('replays', 0)
        metric_type = 'Replays'
    elif task == 'loop':
        # No Loop, usamos LagTime se for HIT
        if details.get('outcome') == 'HIT':
            efficiency = details.get('lagTime')
            metric_type = 'Lag Time (ms)'
        else:
            # Se errou o loop, ignoramos o tempo ou usamos RT padrão?
            # Aqui ignoramos (NaN) para não sujar a média de "percepção"
            efficiency = np.nan 
    else:
        efficiency = entry.get('rt') # Reaction Time padrão

    rows.append({
        'ParticipantID': pid,
        'Task': task,
        'Correct': 1 if entry.get('correct') else 0,
        'Efficiency': efficiency,
        'MetricType': metric_type
    })

df = pd.DataFrame(rows)

if not df.empty:
    # 3. Agregar por Participante
    df_agg = df.groupby(['Task', 'ParticipantID']).agg({
        'Correct': 'mean',
        'Efficiency': 'mean',
        'MetricType': 'first'
    }).reset_index()
    
    # Renomear colunas
    df_agg.rename(columns={'Correct': 'Acurácia Média', 'Efficiency': 'Eficiência Média'}, inplace=True)

    # 4. Exibir Estatísticas e Outliers no Console
    print("\n=== ESTATÍSTICAS DESCRITIVAS POR TAREFA ===")
    tasks = df_agg['Task'].unique()
    
    for task in tasks:
        subset = df_agg[df_agg['Task'] == task]
        metric_label = subset['MetricType'].iloc[0]
        
        print(f"\n>> TAREFA: {task.upper()} (N={len(subset)})")
        print(subset[['Acurácia Média', 'Eficiência Média']].describe().round(4))
        
        # Detecção Simples de Outlier (Média +/- 2 Desvios Padrão)
        mean_acc = subset['Acurácia Média'].mean()
        std_acc = subset['Acurácia Média'].std()
        
        # Quem acertou muito pouco?
        low_acc = subset[subset['Acurácia Média'] < (mean_acc - 2*std_acc)]
        if not low_acc.empty:
            print(f"   ⚠️ Outliers de Baixa Acurácia (< {(mean_acc - 2*std_acc):.1%}):")
            for _, r in low_acc.iterrows():
                print(f"      - {r['ParticipantID']}: {r['Acurácia Média']:.1%}")

        # Quem demorou muito (ou deu muitos replays)?
        mean_eff = subset['Eficiência Média'].mean()
        std_eff = subset['Eficiência Média'].std()
        high_eff = subset[subset['Eficiência Média'] > (mean_eff + 2*std_eff)]
        
        if not high_eff.empty:
            print(f"   ⚠️ Outliers de Alta {metric_label} (> {(mean_eff + 2*std_eff):.2f}):")
            for _, r in high_eff.iterrows():
                print(f"      - {r['ParticipantID']}: {r['Eficiência Média']:.2f}")

    # 5. Plotar Beeswarm Plot
    sns.set_style("whitegrid")
    n_tasks = len(tasks)
    fig, axes = plt.subplots(n_tasks, 2, figsize=(12, 4 * n_tasks))
    
    if n_tasks == 1: axes = [axes] # Garante lista se for só 1 tarefa

    for i, task in enumerate(tasks):
        subset = df_agg[df_agg['Task'] == task]
        metric_label = subset['MetricType'].iloc[0]
        
        ax_acc = axes[i][0] if n_tasks > 1 else axes[0]
        ax_eff = axes[i][1] if n_tasks > 1 else axes[1]
        
        # Plot Acurácia
        sns.swarmplot(data=subset, y='Acurácia Média', ax=ax_acc, color='teal', size=7, alpha=0.8)
        sns.boxplot(data=subset, y='Acurácia Média', ax=ax_acc, color='white', width=0.3, boxprops={'facecolor':'None', 'edgecolor':'grey'})
        ax_acc.set_title(f"{task.upper()} - Acurácia")
        ax_acc.set_ylim(-0.05, 1.05)
        
        # Plot Eficiência (Tempo ou Replays)
        sns.swarmplot(data=subset, y='Eficiência Média', ax=ax_eff, color='orange', size=7, alpha=0.8)
        sns.boxplot(data=subset, y='Eficiência Média', ax=ax_eff, color='white', width=0.3, boxprops={'facecolor':'None', 'edgecolor':'grey'})
        ax_eff.set_title(f"{task.upper()} - {metric_label}")
        ax_eff.set_ylabel(metric_label)

    plt.tight_layout()
    plt.show()
    # plt.savefig('descriptive_analysis_beeswarm.png')
    # print("\nGráfico salvo como 'descriptive_analysis_beeswarm.png'")
else:
    print("Nenhum dado válido encontrado.")