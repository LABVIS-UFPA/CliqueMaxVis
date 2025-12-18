import json
import pandas as pd
import numpy as np
import scipy.stats as stats
import os
import itertools # Necessário para gerar os pares de comparação
import scikit_posthocs as sp # Biblioteca para o teste de Conover

# --- CONFIGURAÇÃO ---
RESULTS_PATH = './results/global_results.json'

# Mapeamento para nomes mais curtos
TASK_MAP = {
    'similarity': 'Similaridade',
    'memory': 'Memória',
    'trend': 'Tendência',
    'loop': 'Loop'
}

def load_and_flatten_data(filepath):
    """ Lê e organiza o JSON plano """
    if not os.path.exists(filepath):
        print(f"ERRO: Arquivo não encontrado em {filepath}")
        return None, None

    with open(filepath, 'r', encoding='utf-8') as f:
        global_data = json.load(f)

    perf_rows = []
    quest_rows = []
    current_pid = "Unknown"

    print(f"Processando {len(global_data)} registros...")

    for entry in global_data:
        if 'participantID' in entry: current_pid = entry['participantID']
        if entry.get('diff') == 'training': continue

        # Questionários
        if entry.get('type') == 'questionnaire':
            task_name = entry.get('task')
            ratings = entry.get('ratings', {})
            for vis, score in ratings.items():
                quest_rows.append({
                    'Participant': current_pid,
                    'Task_Full': task_name,
                    'Visualization': vis,
                    'Rating': int(score)
                })
        
        # Performance
        else:
            task = entry.get('task')
            vis = entry.get('vis')
            details = entry.get('details', {})
            is_correct = 1 if entry.get('correct') else 0
            rt = entry.get('rt')
            lag_time = details.get('lagTime') if task == 'loop' else np.nan
            
            # Filtra erros no Loop para análise de tempo
            if task == 'loop' and details.get('outcome') != 'HIT':
                lag_time = np.nan

            perf_rows.append({
                'Participant': current_pid,
                'Task': task,
                'Diff': entry.get('diff'),
                'Visualization': vis,
                'Correct': is_correct,
                'RT': rt,
                'LagTime': lag_time
            })

    return pd.DataFrame(perf_rows), pd.DataFrame(quest_rows)

def run_friedman_test(df, metric_col, group_col='Visualization', block_col='Participant'):
    """ Executa Friedman e retorna dados para o Post-hoc """
    pivot = df.pivot_table(index=block_col, columns=group_col, values=metric_col, aggfunc='mean')
    pivot = pivot.dropna() # Remove participantes incompletos
    
    if len(pivot) < 2: return None

    data_arrays = [pivot[col].values for col in pivot.columns]
    stat, p_value = stats.friedmanchisquare(*data_arrays)
    
    # Cálculo do Kendall's W (Effect Size)
    # W = Chi2 / (N * (k - 1))
    n_participants = len(pivot)
    k_groups = len(pivot.columns)
    kendall_w = stat / (n_participants * (k_groups - 1))

    return {
        'N': len(pivot),
        'Statistic': stat,
        'p-value': p_value,
        'KendallW': kendall_w,
        'Means': pivot.mean().to_dict(),
        'Significant': p_value < 0.05,
        'PivotData': pivot # Retornamos a tabela pivô para usar no post-hoc
    }

# def run_posthoc_tests(friedman_result):
#     """
#     Executa comparações par-a-par usando Wilcoxon com correção de Bonferroni.
#     Só deve ser chamado se o Friedman for significante.
#     """
#     pivot = friedman_result['PivotData']
#     groups = pivot.columns.tolist()
    
#     # Gera todos os pares possíveis (ex: CNN vs Sketch, CNN vs Heatmap...)
#     pairs = list(itertools.combinations(groups, 2))
#     n_comparisons = len(pairs)
    
#     # Correção de Bonferroni: Divide o alpha (0.05) pelo número de comparações
#     corrected_alpha = 0.05 / n_comparisons
    
#     print(f"\n   [POST-HOC] Wilcoxon Signed-Rank (Bonferroni alpha = {corrected_alpha:.5f})")

#     # Inicializa matriz para visualização (estilo matriz de confusão)
#     p_matrix = pd.DataFrame(index=groups, columns=groups)
#     p_matrix[:] = "-"
    
#     significant_pairs = []

#     for g1, g2 in pairs:
#         data1 = pivot[g1]
#         data2 = pivot[g2]
        
#         # Teste de Wilcoxon
#         # 'pratt' é bom para lidar com empates (zeros) em dados Likert
#         try:
#             stat, p = stats.wilcoxon(data1, data2, zero_method='pratt') 
#         except ValueError:
#             p = 1.0 # Caso os dados sejam idênticos

#         is_sig = p < corrected_alpha
#         sig_symbol = "**" if is_sig else ""
        
#         # Preenche a matriz com o p-value e asteriscos se significante
#         val = f"{p:.4f}{sig_symbol}"
#         p_matrix.loc[g1, g2] = val
#         p_matrix.loc[g2, g1] = val
        
#         if is_sig:
#             mean1 = data1.mean()
#             mean2 = data2.mean()
#             winner = g1 if mean1 > mean2 else g2 # Nota: Depende se "maior" é bom ou ruim
#             significant_pairs.append((g1, g2, p, winner))

#     print(p_matrix.to_string())
    
#     return significant_pairs



def run_posthoc_tests(friedman_result):
    """
    Executa comparações par-a-par usando Teste de Conover com correção de Bonferroni.
    (Versão corrigida: Passando tabela WIDE para evitar erro de duplicatas)
    """
    # Pegamos a tabela pivô direta (Linhas=Participantes, Colunas=Visualizações)
    pivot = friedman_result['PivotData']
    
    print(f"\n   [POST-HOC] Conover's Test (p-values ajustados por Bonferroni)")

    # CORREÇÃO: Passamos a 'pivot' direto. 
    # A biblioteca entende que as colunas são os grupos e as linhas são os blocos.
    p_matrix = sp.posthoc_conover_friedman(
        pivot,                  # DataFrame WIDE (Matriz)
        p_adjust='bonferroni'   # Ajuste automático
    )
    
    # Formata a matriz para exibição
    print(p_matrix.round(4))

    significant_pairs = []
    groups = p_matrix.columns.tolist()
    
    # Loop para identificar os pares significativos
    for i in range(len(groups)):
        for j in range(i + 1, len(groups)):
            g1 = groups[i]
            g2 = groups[j]
            
            p_val = p_matrix.loc[g1, g2]
            
            if p_val < 0.05:
                mean1 = friedman_result['Means'][g1]
                mean2 = friedman_result['Means'][g2]
                
                # Define quem foi "melhor" baseado na média maior
                winner = g1 if mean1 > mean2 else g2 
                significant_pairs.append((g1, g2, p_val, winner))
    
    return significant_pairs

def print_separator(title):
    print(f"\n{'='*60}")
    print(f" {title.upper()}")
    print(f"{'='*60}")

# ==========================================
# EXECUÇÃO PRINCIPAL
# ==========================================

df_perf, df_quest = load_and_flatten_data(RESULTS_PATH)

if df_perf is not None and not df_perf.empty:
    
    # Gera combinações únicas de Tarefa e Dificuldade para análise separada
    combinations = df_perf[['Task', 'Diff']].drop_duplicates().sort_values(by=['Task', 'Diff']).values

    for task, diff in combinations:
        print_separator(f"TAREFA: {TASK_MAP.get(task, task)} | DIFICULDADE: {diff}")
        subset = df_perf[(df_perf['Task'] == task) & (df_perf['Diff'] == diff)]
        
        # --- A. ACURÁCIA (MAIOR É MELHOR) ---
        print(f"\n--- Acurácia ---")
        res = run_friedman_test(subset, 'Correct')
        
        if res:
            print(f"Friedman N={res['N']} | Chi²={res['Statistic']:.2f} | p={res['p-value']:.4f} | Kendall's W={res['KendallW']:.4f}")
            sorted_means = sorted(res['Means'].items(), key=lambda x: x[1], reverse=True)
            print("Ranking:", ", ".join([f"{k}={v:.1%}" for k,v in sorted_means]))
            
            if res['Significant']:
                print(">> DIFERENÇA DETECTADA! Rodando Post-hoc...")
                pairs = run_posthoc_tests(res)
                # Interpretação para Acurácia (Quem tem média maior ganhou)
                if pairs:
                    print("\n   Diferenças Reais encontradas:")
                    for g1, g2, p, winner in pairs:
                         print(f"   * {winner} foi melhor que {g1 if winner==g2 else g2} (p={p:.4f})")
            else:
                print(">> Nenhuma diferença estatística entre as visualizações.")

        # --- B. TEMPO (MENOR É MELHOR) ---
        metric = 'LagTime' if task == 'loop' else 'RT'
        label = 'Lag Time' if task == 'loop' else 'Tempo'
        
        print(f"\n--- {label} (ms) ---")
        res = run_friedman_test(subset, metric)
        
        if res:
            print(f"Friedman p={res['p-value']:.4f} | Kendall's W={res['KendallW']:.4f}")
            sorted_means = sorted(res['Means'].items(), key=lambda x: x[1]) # Menor primeiro
            print("Ranking:", ", ".join([f"{k}={v:.0f}ms" for k,v in sorted_means]))
            
            if res['Significant']:
                print(">> DIFERENÇA DETECTADA! Rodando Post-hoc...")
                pairs = run_posthoc_tests(res)
                # Interpretação para Tempo (Quem tem média MENOR ganhou)
                if pairs:
                    print("\n   Diferenças Reais encontradas:")
                    for g1, g2, p, _ in pairs:
                         # Recalcula quem ganhou (menor tempo)
                         m1 = res['Means'][g1]
                         m2 = res['Means'][g2]
                         winner = g1 if m1 < m2 else g2
                         loser = g2 if winner == g1 else g1
                         print(f"   * {winner} foi mais rápido que {loser} (p={p:.4f})")
            else:
                print(">> Nenhuma diferença estatística.")

# --- QUESTIONÁRIOS ---
if df_quest is not None and not df_quest.empty:
    print_separator("QUESTIONÁRIOS (SUBJETIVO)")
    tasks_q = df_quest['Task_Full'].unique()
    
    for task_q in tasks_q:
        print(f"\n> {task_q}")
        subset_q = df_quest[df_quest['Task_Full'] == task_q]
        res = run_friedman_test(subset_q, 'Rating')
        
        if res:
            print(f"Friedman p={res['p-value']:.4f} | Kendall's W={res['KendallW']:.4f}")
            if res['Significant']:
                pairs = run_posthoc_tests(res)
                if pairs:
                    print("\n   Preferências Confirmadas:")
                    for g1, g2, p, winner in pairs:
                        print(f"   * Usuários preferiram {winner} a {g1 if winner==g2 else g2}")
            else:
                print(">> Preferência igual entre todas.")