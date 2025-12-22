import scipy.stats as stats
import numpy as np

def calculate_friedman_power(N, k, W, alpha=0.05):
    """
    Calcula o poder estatístico aproximado para o teste de Friedman.
    
    Parâmetros:
    N: Número de participantes
    k: Número de condições (visualizações)
    W: Kendall's W (Tamanho do Efeito observado)
    alpha: Nível de significância (padrão 0.05)
    """
    if W <= 0: return 0.0
    
    # Graus de liberdade
    df = k - 1
    
    # 1. Encontrar o valor crítico do Qui-Quadrado para H0 (distribuição central)
    # Valor que o Chi² precisa ultrapassar para p < 0.05
    chi2_critical = stats.chi2.ppf(1 - alpha, df)
    
    # 2. Estimar o Chi² observado esperado para esse tamanho de efeito
    # Fórmula: Chi²_obs = N * (k - 1) * W
    chi2_observed = N * (k - 1) * W
    
    # 3. Calcular o Poder usando Chi-Quadrado Não-Central
    # O parâmetro de não-centralidade (lambda) é o próprio Chi² esperado pelo efeito
    non_centrality_param = chi2_observed
    
    # Poder = Probabilidade de obter um Chi² maior que o crítico, dada a não-centralidade
    power = 1 - stats.ncx2.cdf(chi2_critical, df, non_centrality_param)
    
    return power

def find_min_detectable_effect(N, k, target_power=0.80, alpha=0.05):
    """ Encontra o menor W que atinge 80% de poder """
    for w in np.arange(0.01, 1.0, 0.001):
        p = calculate_friedman_power(N, k, w, alpha)
        if p >= target_power:
            return w
    return 1.0

# --- DADOS DO SEU EXPERIMENTO ---
N_PARTICIPANTS = 28
K_CONDITIONS = 5 # (sketch, cnn, particles, heatmap, scatter)

# Resultados extraídos do seu log (Kendall's W)
results = [
    # TAREFA: LOOP
    {"task": "Loop (Acurácia)", "W": 0.0925, "sig": True},
    {"task": "Loop (Lag Time)", "W": 0.0739, "sig": False}, # Não significante, W baixo?
    
    # TAREFA: MEMÓRIA
    {"task": "Memória Dense (Acurácia)", "W": 0.2160, "sig": True},
    {"task": "Memória Medium (Acurácia)", "W": 0.2190, "sig": True},
    {"task": "Memória (Tempo)",          "W": 0.0755, "sig": False}, # Estimado do p=0.0595
    
    # TAREFA: SIMILARIDADE
    {"task": "Similaridade Dense (Acc)", "W": 0.2288, "sig": True},
    {"task": "Similaridade High (Acc)",  "W": 0.2419, "sig": True},
    {"task": "Similaridade Med (Acc)",   "W": 0.0977, "sig": True}, # Significante mas W baixo
    {"task": "Similaridade (Tempo)",     "W": 0.0550, "sig": False}, # W muito baixo
    
    # TAREFA: TENDÊNCIA
    {"task": "Tendência (Acurácia)",     "W": 0.0562, "sig": False},
    {"task": "Tendência (Tempo)",        "W": 0.0694, "sig": False},
    
    # QUESTIONÁRIOS
    {"task": "Quest. Memória",           "W": 0.4670, "sig": True},
    {"task": "Quest. Loop",              "W": 0.3391, "sig": True},
    {"task": "Quest. Similaridade",      "W": 0.2975, "sig": True},
    {"task": "Quest. Tendência",         "W": 0.1806, "sig": True},
]

print(f"=== ANÁLISE DE PODER ESTATÍSTICO (N={N_PARTICIPANTS}, k={K_CONDITIONS}) ===\n")

print(f"{'TAREFA':<30} | {'W (Efeito)':<10} | {'PODER CALCULADO':<15} | {'RESULTADO REAL'}")
print("-" * 80)

for res in results:
    power = calculate_friedman_power(N_PARTICIPANTS, K_CONDITIONS, res['W'])
    power_pct = f"{power:.1%}"
    
    # Diagnóstico
    status = ""
    if power < 0.50 and not res['sig']:
        status = "⚠️ Underpowered (Risco Falso Negativo)"
    elif power >= 0.80:
        status = "✅ Poder Adequado"
    elif res['sig']:
        status = "✅ Detectado (Mesmo com poder médio)"
    else:
        status = "🔸 Poder Baixo"

    print(f"{res['task']:<30} | {res['W']:.4f}     | {power_pct:<15} | {status}")

print("-" * 80)

# --- SENSIBILIDADE ---
mde = find_min_detectable_effect(N_PARTICIPANTS, K_CONDITIONS)
print(f"\n>> SENSIBILIDADE DO EXPERIMENTO:")
print(f"Com N=28, você tem 80% de chance de detectar qualquer efeito com W >= {mde:.3f}")
print(f"OBS: Cohen sugere W=0.1 (Pequeno), W=0.3 (Médio), W=0.5 (Grande).")