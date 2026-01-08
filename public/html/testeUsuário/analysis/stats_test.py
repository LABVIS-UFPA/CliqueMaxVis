

import json
import pandas as pd
import numpy as np
import scipy.stats as stats
import os
import itertools
import scikit_posthocs as sp 

# --- CONFIGURAÇÃO ---
RESULTS_PATH = './results/global_results.json'

TASK_MAP = {
    'similarity': 'Similaridade',
    'memory': 'Memória',
    'trend': 'Tendência',
    'loop': 'Loop',
    'trend2': 'Tendência V2 (Replay)'
}

# Lista global para armazenar resultados para a análise de poder final
power_analysis_data = []

# ==========================================
# FUNÇÕES DE CARREGAMENTO E ESTATÍSTICA
# ==========================================

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

        # --- Questionários ---
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
        
        # --- Performance ---
        else:
            task = entry.get('task')
            vis = entry.get('vis')
            details = entry.get('details', {})
            diff = entry.get('diff') 

            # --- Usar Cenário como Dificuldade para Trend 2 ---
            # if task == 'trend2':
            #     # Tenta pegar 'targetTrend' (novo) ou 'correct' (velho) dos detalhes
            #     scenario = details.get('targetTrend') or details.get('correct')
            #     if scenario:
            #         diff = scenario # Sobrescreve "medium2" por "convergence", etc.
            
            # 1. Acurácia
            is_correct = 1 if entry.get('correct') else 0
            
            # 2. Tempo de Reação (RT)
            # Aceita RT mesmo com erro para medir tempo total gasto
            rt = entry.get('rt') 

            # --- Extrair Replays ---
            replays = np.nan
            if task == 'trend2':
                replays = details.get('replays') # Captura o nº de replays salvo
            
            # 3. Lag Time (Loop)
            lag_time = details.get('lagTime') if task == 'loop' else np.nan
            
            perf_rows.append({
                'Participant': current_pid,
                'Task': task,
                'Diff': diff,
                'Visualization': vis,
                'Correct': is_correct,
                'RT': rt,
                'LagTime': lag_time,
                'Replays': replays
            })

    return pd.DataFrame(perf_rows), pd.DataFrame(quest_rows)

def filter_low_accuracy_participants(df, threshold=0.25):
    """
    Remove participantes que tiveram acurácia média <= threshold 
    em uma tarefa específica (indicando que não entenderam a tarefa).
    """
    print(f"\n{'='*20} FILTRO DE QUALIDADE DE DADOS {'='*20}")
    
    # 1. Calcula a acurácia média de cada participante POR TAREFA
    # Agrupamos por Task e Participant para ver o desempenho global naquela tarefa
    acc_summary = df.groupby(['Task', 'Participant'])['Correct'].mean().reset_index()
    
    # 2. Identifica quem falhou no critério (Acurácia <= 0.25)
    bad_performers = acc_summary[acc_summary['Correct'] <= threshold]
    
    if bad_performers.empty:
        print(">> Nenhum participante removido (Todos acima do limiar).")
        return df

    # 3. Cria uma lista de pares (Task, Participant) para remover
    # Usamos um set de strings "Task_Participant" para filtragem rápida
    keys_to_remove = set(bad_performers['Task'] + "_" + bad_performers['Participant'])
    
    # Cria coluna temporária no DF original para comparar
    df['temp_key'] = df['Task'] + "_" + df['Participant']
    
    # 4. Filtra o DataFrame mantendo apenas quem NÃO está na lista de remoção
    df_clean = df[~df['temp_key'].isin(keys_to_remove)].copy()
    
    # Remove a coluna temporária
    df_clean.drop(columns=['temp_key'], inplace=True)
    
    # Relatório de quem saiu
    print(f">> Critério: Remover participantes com Acurácia <= {threshold:.0%} na tarefa.")
    for _, row in bad_performers.iterrows():
        print(f"   [REMOVIDO] {row['Participant']} da tarefa '{row['Task']}' (Acc média: {row['Correct']:.1%})")
        
    print(f">> Registros restantes: {len(df_clean)} (de {len(df)})")
    print("="*65 + "\n")
    
    return df_clean

def run_friedman_test(df, metric_col, group_col='Visualization', block_col='Participant'):
    """ Executa Friedman, retorna dados e médias descritivas. """
    
    # 1. Descritiva
    desc_stats = df.groupby(group_col)[metric_col].mean()
    desc_count = df.groupby(group_col)[metric_col].count()
    is_time_metric = metric_col in ['RT', 'LagTime']
    sorted_stats = desc_stats.sort_values(ascending=is_time_metric)
    unit = "ms" if is_time_metric else ("%" if metric_col == 'Correct' else "")
    multiplier = 100 if metric_col == 'Correct' else 1
    
    print("   Médias (Descritiva):")
    print("   " + ", ".join([f"{k}={v*multiplier:.1f}{unit} (n={desc_count[k]})" for k, v in sorted_stats.items()]))

    # 2. Pivot e Limpeza
    pivot = df.pivot_table(index=block_col, columns=group_col, values=metric_col, aggfunc='mean')
    pivot_clean = pivot.dropna() 
    
    N = len(pivot_clean)
    if N < 2:
        return f">> N insuficiente para teste estatístico pareado (N={N}). Use apenas as médias acima."

    # 3. Friedman
    data_arrays = [pivot_clean[col].values for col in pivot_clean.columns]
    stat, p_value = stats.friedmanchisquare(*data_arrays)
    
    # Cálculo do Tamanho do Efeito (Kendall's W)
    k = len(pivot_clean.columns)
    W = stat / (N * (k - 1))
    
    return {
        'N': N,
        'k': k,
        'Statistic': stat,
        'p-value': p_value,
        'KendallW': W,
        'Means': pivot_clean.mean().to_dict(),
        'Significant': p_value < 0.05,
        'PivotData': pivot_clean
    }

def run_posthoc_tests(friedman_result):
    """ Teste de Conover (Post-hoc) """
    pivot = friedman_result['PivotData']
    data_melted = pivot.melt(ignore_index=False, var_name='Visualization', value_name='Value').reset_index()
    
    try:
        posthoc = sp.posthoc_conover(data_melted, val_col='Value', group_col='Visualization', p_adjust='bonferroni')
    except Exception as e:
        print(f"   Erro no Post-hoc: {e}")
        return []

    print("\n   [POST-HOC] Conover's Test (p-values ajustados por Bonferroni)")
    print(posthoc.round(4))
    
    significant_pairs = []
    groups = pivot.columns.tolist()
    pairs = list(itertools.combinations(groups, 2))
    
    for g1, g2 in pairs:
        p_val = posthoc.loc[g1, g2]
        if p_val < 0.05:
            mean1 = friedman_result['Means'][g1]
            mean2 = friedman_result['Means'][g2]
            winner = g1 if mean1 > mean2 else g2 
            significant_pairs.append((g1, g2, p_val, winner))
            
    return significant_pairs

# ==========================================
# FUNÇÕES DE ANÁLISE DE PODER
# ==========================================

def calculate_friedman_power(N, k, W, alpha=0.05):
    """ Calcula o poder estatístico aproximado para Friedman (Chi2 Não-Central) """
    if W <= 0: return 0.0
    df = k - 1
    chi2_critical = stats.chi2.ppf(1 - alpha, df)
    chi2_observed = N * (k - 1) * W # Lambda (Non-centrality param)
    power = 1 - stats.ncx2.cdf(chi2_critical, df, chi2_observed)
    return power

def find_min_detectable_effect(N, k, target_power=0.80, alpha=0.05):
    """ Encontra o menor W que atinge 80% de poder """
    for w in np.arange(0.01, 1.0, 0.001):
        p = calculate_friedman_power(N, k, w, alpha)
        if p >= target_power:
            return w
    return 1.0

def print_separator(title):
    print(f"\n{'='*60}")
    print(f" {title.upper()}")
    print(f"{'='*60}")

# ==========================================
# EXECUÇÃO PRINCIPAL
# ==========================================

df_perf, df_quest = load_and_flatten_data(RESULTS_PATH)

# --- NOVO: APLICA O FILTRO DE ACURÁCIA ---
if df_perf is not None and not df_perf.empty:
    df_perf = filter_low_accuracy_participants(df_perf, threshold=0.25)

if df_perf is not None and not df_perf.empty:
    
    combinations = df_perf[['Task', 'Diff']].drop_duplicates().sort_values(by=['Task', 'Diff']).values
    
    for task, diff in combinations:
        print_separator(f"TAREFA: {TASK_MAP.get(task, task)} | DIFICULDADE: {diff}")
        subset = df_perf[(df_perf['Task'] == task) & (df_perf['Diff'] == diff)]
        
        # --- A. ACURÁCIA ---
        print(f"\n--- Acurácia ---")
        res = run_friedman_test(subset, 'Correct')
        
        if isinstance(res, dict):
            print(f"Friedman N={res['N']} | Chi²={res['Statistic']:.2f} | p={res['p-value']:.4f} | Kendall's W={res['KendallW']:.4f}")
            
            # Armazena para Power Analysis
            power_analysis_data.append({
                'Label': f"{TASK_MAP.get(task, task)} {diff} (Acc)",
                'N': res['N'],
                'k': res['k'],
                'W': res['KendallW'],
                'Sig': res['Significant']
            })

            if res['Significant']:
                print(">> DIFERENÇA DETECTADA! Rodando Post-hoc...")
                pairs = run_posthoc_tests(res)
                if pairs:
                    print("\n   Diferenças Reais encontradas:")
                    for g1, g2, p, winner in pairs:
                         print(f"   * {winner} foi melhor que {g1 if winner==g2 else g2} (p={p:.4f})")
        else:
            print(res)

        # --- B. MÉTICAS DE EFICIÊNCIA (TEMPO / LAG / REPLAYS) ---
        # Define qual métrica usar baseada na tarefa
        if task == 'loop':
            metric = 'LagTime'
            label = 'Lag Time'
            suffix = "(Lag)"
        elif task == 'trend2':     # <--- NOVO CASO
            metric = 'Replays'
            label = 'Qtd Replays'
            suffix = "(Replays)"
        else:
            metric = 'RT'
            label = 'Tempo'
            suffix = "(Time)"
        
        print(f"\n--- {label} ---")
        # Note: Para Replays, 'menor é melhor', igual ao Tempo. A lógica de ranking funciona.
        res = run_friedman_test(subset, metric)
        
        if isinstance(res, dict):
            # Formata a string de output dependendo da métrica
            # Separamos o formato numérico (fmt) da unidade (unit)
            if metric == 'Replays':
                fmt = ".1f"
                unit = ""
            else:
                fmt = ".0f"
                unit = "ms"
            
            print(f"Friedman N={res['N']} | p={res['p-value']:.4f} | Kendall's W={res['KendallW']:.4f}")
            
            # Ordena médias (Menor é melhor)
            sorted_means = sorted(res['Means'].items(), key=lambda x: x[1])
            # Correção: aplicamos a unidade fora da formatação numérica
            print("Ranking:", ", ".join([f"{k}={v:{fmt}}{unit}" for k,v in sorted_means]))

            # --- Armazena para Power Analysis ---
            # O cálculo de poder usa o N e o W (Effect Size) calculados aqui.
            power_analysis_data.append({
                'Label': f"{TASK_MAP.get(task, task)} {diff} {suffix}",
                'N': res['N'],
                'k': res['k'],
                'W': res['KendallW'],
                'Sig': res['Significant']
            })
            # ------------------------------------

            if res['Significant']:
                print(">> DIFERENÇA DETECTADA! Rodando Post-hoc...")
                pairs = run_posthoc_tests(res)
                if pairs:
                    print("\n   Diferenças Reais encontradas:")
                    for g1, g2, p, _ in pairs:
                         m1 = res['Means'][g1]
                         m2 = res['Means'][g2]
                         winner = g1 if m1 < m2 else g2
                         loser = g2 if winner == g1 else g1
                         print(f"   * {winner} foi melhor ({label} menor) que {loser} (p={p:.4f})")
        else:
            print(res)

       
# --- QUESTIONÁRIOS ---
if df_quest is not None and not df_quest.empty:
    print_separator("QUESTIONÁRIOS (SUBJETIVO)")
    tasks_q = df_quest['Task_Full'].unique()
    
    for task_q in tasks_q:
        print(f"\n> {task_q}")
        subset_q = df_quest[df_quest['Task_Full'] == task_q]
        res = run_friedman_test(subset_q, 'Rating')
        
        if isinstance(res, dict):
            print(f"Friedman N={res['N']} | p={res['p-value']:.4f} | Kendall's W={res['KendallW']:.4f}")
            
            # Armazena para Power Analysis
            power_analysis_data.append({
                'Label': f"Quest. {task_q}",
                'N': res['N'],
                'k': res['k'],
                'W': res['KendallW'],
                'Sig': res['Significant']
            })

            if res['Significant']:
                pairs = run_posthoc_tests(res)
                if pairs:
                    print("\n   Preferências Confirmadas:")
                    for g1, g2, p, winner in pairs:
                        print(f"   * Usuários preferiram {winner} a {g1 if winner==g2 else g2}")
        else:
            print(res)

# ==========================================
# RELATÓRIO FINAL DE PODER ESTATÍSTICO
# ==========================================

if power_analysis_data:
    print("\n\n")
    print("=" * 100)
    print(" ANÁLISE AUTOMÁTICA DE PODER ESTATÍSTICO (POST-HOC SENSITIVITY)")
    print(" Baseado nos N e W observados agora.")
    print("=" * 100)
    
    print(f"{'TAREFA/METRICA':<40} | {'N':<3} | {'W (Efeito)':<10} | {'PODER (calc)':<12} | {'STATUS'}")
    print("-" * 100)

    # Ordena por W para facilitar visualização
    # power_analysis_data.sort(key=lambda x: x['W'], reverse=True)

    for entry in power_analysis_data:
        power = calculate_friedman_power(entry['N'], entry['k'], entry['W'])
        power_pct = f"{power:.1%}"
        
        status = ""
        if power < 0.50 and not entry['Sig']:
            status = "⚠️ Underpowered (Risco Falso Negativo)"
        elif power >= 0.80:
            status = "✅ Poder Adequado"
        elif entry['Sig']:
            status = "✅ Detectado (Mesmo c/ poder médio)"
        else:
            status = "🔸 Poder Baixo"
            
        print(f"{entry['Label']:<40} | {entry['N']:<3} | {entry['W']:.4f}     | {power_pct:<12} | {status}")

    print("-" * 100)
    
    # Sensibilidade Média
    if len(power_analysis_data) > 0:
        avg_N = int(np.mean([e['N'] for e in power_analysis_data]))
        avg_k = int(np.mean([e['k'] for e in power_analysis_data]))
        mde = find_min_detectable_effect(avg_N, avg_k)
        
        print(f"\n>> SENSIBILIDADE DO EXPERIMENTO (Média N={avg_N}):")
        print(f"   Com {avg_N} participantes, você tem 80% de chance de detectar efeitos com W >= {mde:.3f}.")
        print(f"   (Referência Cohen: W=0.1 Pequeno, W=0.3 Médio, W=0.5 Grande)")