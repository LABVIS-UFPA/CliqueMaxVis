import json
import pandas as pd
import numpy as np
import scipy.stats as stats
import os
import itertools # Necessário para gerar os pares de comparação

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
    
    return {
        'N': len(pivot),
        'Statistic': stat,
        'p-value': p_value,
        'Means': pivot.mean().to_dict(),
        'Significant': p_value < 0.05,
        'PivotData': pivot # Retornamos a tabela pivô para usar no post-hoc
    }

def run_posthoc_tests(friedman_result):
    """
    Executa comparações par-a-par usando Wilcoxon com correção de Bonferroni.
    Só deve ser chamado se o Friedman for significante.
    """
    pivot = friedman_result['PivotData']
    groups = pivot.columns.tolist()
    
    # Gera todos os pares possíveis (ex: CNN vs Sketch, CNN vs Heatmap...)
    pairs = list(itertools.combinations(groups, 2))
    n_comparisons = len(pairs)
    
    # Correção de Bonferroni: Divide o alpha (0.05) pelo número de comparações
    corrected_alpha = 0.05 / n_comparisons
    
    print(f"\n   [POST-HOC] Wilcoxon Signed-Rank (Bonferroni alpha = {corrected_alpha:.5f})")
    print(f"   Comparando {n_comparisons} pares...")

    significant_pairs = []

    for g1, g2 in pairs:
        data1 = pivot[g1]
        data2 = pivot[g2]
        
        # Teste de Wilcoxon
        # 'pratt' é bom para lidar com empates (zeros) em dados Likert
        try:
            stat, p = stats.wilcoxon(data1, data2, zero_method='pratt') 
        except ValueError:
            p = 1.0 # Caso os dados sejam idênticos

        is_sig = p < corrected_alpha
        sig_symbol = "**" if is_sig else ""
        
        print(f"     > {g1} vs {g2}: p={p:.4f} {sig_symbol}")
        
        if is_sig:
            mean1 = data1.mean()
            mean2 = data2.mean()
            winner = g1 if mean1 > mean2 else g2 # Nota: Depende se "maior" é bom ou ruim
            significant_pairs.append((g1, g2, p, winner))

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
    
    tasks = df_perf['Task'].unique()
    
    for task in tasks:
        print_separator(f"TAREFA: {TASK_MAP.get(task, task)}")
        subset = df_perf[df_perf['Task'] == task]
        
        # --- A. ACURÁCIA (MAIOR É MELHOR) ---
        print(f"\n--- Acurácia ---")
        res = run_friedman_test(subset, 'Correct')
        
        if res:
            print(f"Friedman N={res['N']} | Friedman Chi²={res['Statistic']:.2f} | p={res['p-value']:.4f}")
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
            print(f"Friedman p={res['p-value']:.4f}")
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
            print(f"Friedman p={res['p-value']:.4f}")
            if res['Significant']:
                pairs = run_posthoc_tests(res)
                if pairs:
                    print("\n   Preferências Confirmadas:")
                    for g1, g2, p, winner in pairs:
                        print(f"   * Usuários preferiram {winner} a {g1 if winner==g2 else g2}")
            else:
                print(">> Preferência igual entre todas.")