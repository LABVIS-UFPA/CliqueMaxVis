import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from skimage.metrics import structural_similarity as ssim
from skimage.feature import local_binary_pattern


# --- CONFIGURAÇÃO ---
IMG1_PATH = "009_03.jpg"
IMG2_PATH = "008_03.jpg"
MODEL_PATH = "face_landmarker.task"
SHOW_POINTS = True
BLUR_AMOUNT = 45 # O "Threshold" de suavização da borda (número ímpar!)
KERNEL_SIZE = 25

# --- FUNÇÕES DE MÁSCARA ---
def get_face_mask(img_shape, points, blur_ksize=21):
    """
    Cria uma máscara suave (0 a 1) cobrindo apenas a região do rosto.
    """
    mask = np.zeros(img_shape[:2], dtype=np.float32)
    
    # IMPORTANTE: Removemos os últimos 8 pontos que são os cantos da imagem.
    # Queremos o Hull apenas dos pontos faciais.
    face_points = np.array(points[:-8], dtype=np.int32)
    
    # Encontra o contorno externo dos pontos do rosto (Convex Hull)
    hull = cv2.convexHull(face_points)
    
    # Preenche o polígono com branco (1.0)
    cv2.fillConvexPoly(mask, hull, 1.0)

    # --- Dilatação Morfológica ---
    # Isso expande a área branca em todas as direções. 
    kernel = np.ones((KERNEL_SIZE, KERNEL_SIZE), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=1)
    
    # Aplica GaussianBlur para criar o degradê (feathering) nas bordas
    # O kernel size define quão larga é a área de transição
    mask = cv2.GaussianBlur(mask, (blur_ksize, blur_ksize), 0)
    
    # Expande dimensões para permitir multiplicação correta (H, W, 1)
    return np.dstack([mask, mask, mask])

# --- FUNÇÕES CORE ---
def draw_landmarks(img, points, color=(0, 255, 0)):
    vis_img = img.copy()
    num_actual_landmarks = len(points) - 8
    for i, p in enumerate(points):
        if i < num_actual_landmarks:
            cv2.circle(vis_img, (int(p[0]), int(p[1])), 2, color, -1)
    return vis_img

def resize_for_display(img, max_height=300):
    h, w = img.shape[:2]
    if h > max_height:
        scale = max_height / h
        return cv2.resize(img, (int(w * scale), int(h * scale)))
    return img

def get_landmarks_new_api(img_path):
    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.FaceLandmarkerOptions(
        base_options=base_options,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
        num_faces=1)
    detector = vision.FaceLandmarker.create_from_options(options)

    img_cv = cv2.imread(img_path)
    if img_cv is None: raise ValueError(f"Erro ao abrir {img_path}")
    img_rgb = cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB)
    image_mp = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
    detection_result = detector.detect(image_mp)
    
    if not detection_result.face_landmarks:
        raise ValueError(f"Nenhum rosto detectado em {img_path}")

    landmarks = detection_result.face_landmarks[0]
    points = []
    h, w = img_cv.shape[:2]
    for lm in landmarks:
        points.append((int(lm.x * w), int(lm.y * h)))
    
    # 8 Pontos de borda
    points.extend([(0,0), (w-1,0), (w-1,h-1), (0,h-1)]) 
    points.extend([(w//2,0), (w-1,h//2), (w//2,h-1), (0,h//2)])
    return points, img_cv

def align_images(img1, img2, points1, points2):
    p1_face = np.float32(points1[:-8])
    p2_face = np.float32(points2[:-8])
    M, _ = cv2.estimateAffinePartial2D(p2_face, p1_face, method=cv2.RANSAC)
    if M is None: return img2, points2

    aligned_img2 = cv2.warpAffine(img2, M, (img1.shape[1], img1.shape[0]))
    points2_np = np.float32(points2)
    ones = np.ones((len(points2_np), 1))
    aligned_points2 = M.dot(np.hstack([points2_np, ones]).T).T
    return aligned_img2, aligned_points2.tolist()

def apply_affine_transform(src, src_tri, dst_tri, size):
    warp_mat = cv2.getAffineTransform(np.float32(src_tri), np.float32(dst_tri))
    dst = cv2.warpAffine(src, warp_mat, (size[0], size[1]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return dst

def morph_triangle(img1, img2, img, t1, t2, t, alpha):
    r1 = cv2.boundingRect(np.float32([t1]))
    r2 = cv2.boundingRect(np.float32([t2]))
    r = cv2.boundingRect(np.float32([t]))
    
    t1_rect, t2_rect, t_rect = [], [], []
    for i in range(3):
        t_rect.append(((t[i][0] - r[0]), (t[i][1] - r[1])))
        t1_rect.append(((t1[i][0] - r1[0]), (t1[i][1] - r1[1])))
        t2_rect.append(((t2[i][0] - r2[0]), (t2[i][1] - r2[1])))

    if r[2] <= 0 or r[3] <= 0: return 
    img1_rect = img1[r1[1]:r1[1] + r1[3], r1[0]:r1[0] + r1[2]]
    img2_rect = img2[r2[1]:r2[1] + r2[3], r2[0]:r2[0] + r2[2]]
    
    if img1_rect.size == 0 or img2_rect.size == 0: return

    size = (r[2], r[3])
    warped_img1 = apply_affine_transform(img1_rect, t1_rect, t_rect, size)
    warped_img2 = apply_affine_transform(img2_rect, t2_rect, t_rect, size)
    
    img_rect = (1.0 - alpha) * warped_img1 + alpha * warped_img2
    mask = np.zeros((r[3], r[2], 3), dtype=np.float32)
    cv2.fillConvexPoly(mask, np.int32(t_rect), (1.0, 1.0, 1.0), 16, 0)
    img[r[1]:r[1]+r[3], r[0]:r[0]+r[2]] = img[r[1]:r[1]+r[3], r[0]:r[0]+r[2]] * (1 - mask) + img_rect * mask

def calculate_perceptual_distance(img1, img2):
    """
    Calcula a distância perceptual entre dois rostos alinhados.
    Retorna um valor float onde:
    0.0 = Idênticos
    Valores altos = Muito diferentes
    """
    
    # 1. Pré-processamento: Conversão para Escala de Cinza
    # A percepção humana de estrutura é baseada em luminância, não em cor.
    g1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    g2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)

    # ---------------------------------------------------------
    # MÉTRICA 1: DSSIM (Distance based on Structural Similarity)
    # ---------------------------------------------------------
    # O SSIM retorna um valor entre -1 e 1 (1 = idêntico).
    # Convertemos para distância: (1 - SSIM) / 2
    # win_size: tamanho da janela de comparação (ímpar). 
    # Para rostos 64x64 ou maiores, 7 ou 11 funciona bem.
    score_ssim, _ = ssim(g1, g2, full=True, win_size=11, data_range=255)
    dist_ssim = (1 - score_ssim) # Intervalo [0, 1] (0 = igual)

    # ---------------------------------------------------------
    # MÉTRICA 2: Histograma de LBP (Textura/Identidade)
    # ---------------------------------------------------------
    # LBP é excelente para capturar "quem é a pessoa" ignorando iluminação global.
    radius = 3
    n_points = 8 * radius
    
    # Calcula o padrão binário local
    lbp1 = local_binary_pattern(g1, n_points, radius, method='uniform')
    lbp2 = local_binary_pattern(g2, n_points, radius, method='uniform')
    
    # Gera histogramas (distribuição das texturas)
    # n_points + 2 é o número de bins para método 'uniform'
    n_bins = int(lbp1.max() + 1)
    hist1, _ = np.histogram(lbp1.ravel(), bins=n_bins, range=(0, n_bins), density=True)
    hist2, _ = np.histogram(lbp2.ravel(), bins=n_bins, range=(0, n_bins), density=True)
    
    # Distância Chi-Quadrado entre histogramas (Padrão ouro para LBP)
    # Valores comuns variam de 0 a 0.5 para rostos parecidos
    eps = 1e-10
    dist_lbp = 0.5 * np.sum(((hist1 - hist2) ** 2) / (hist1 + hist2 + eps))

    # ---------------------------------------------------------
    # COMBINAÇÃO PONDERADA
    # ---------------------------------------------------------
    # SSIM cuida da estrutura visual macro.
    # LBP cuida dos detalhes finos e identidade.
    # Pesos empíricos sugeridos: 60% SSIM, 40% LBP
    final_distance = (dist_ssim * 0.6) + (dist_lbp * 0.4)
    
    return final_distance, dist_ssim, dist_lbp

def calculate_procrustes_metric(img1, img2, points1, points2):
    """
    Calcula uma métrica híbrida de percepção humana:
    1. Geometria (Procrustes): Mede a diferença na estrutura óssea/formato.
    2. Estrutura Visual (SSIM): Mede a semelhança de aparência global (pele, iluminação).
    """
    
    # --- 1. Distância Geométrica (Procrustes Analysis) ---
    # Normaliza os pontos para remover escala e posição
    # (Centraliza na média e divide pelo desvio padrão)
    p1 = np.array(points1[:-8], dtype=np.float32)
    p2 = np.array(points2[:-8], dtype=np.float32)
    
    # Centralizar (remover translação)
    p1 -= np.mean(p1, axis=0)
    p2 -= np.mean(p2, axis=0)
    
    # Normalizar escala (Fator de escala de Frobenius)
    p1 /= np.linalg.norm(p1)
    p2 /= np.linalg.norm(p2)
    
    # Encontrar a rotação ótima de p2 para alinhar com p1 (Kabsch algorithm)
    # SVD da matriz de covariância
    covariance = np.dot(p1.T, p2)
    U, S, Vt = np.linalg.svd(covariance)
    R = np.dot(U, Vt)
    
    # Aplica a rotação
    p2_aligned = np.dot(p2, R.T)
    
    # Calcula a diferença quadrática (Procrustes Distance)
    procrustes_dist = np.sum(np.square(p1 - p2_aligned)) * 100 

    # --- 2. Distância Visual (SSIM) ---
    g1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    g2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
    
    # Win_size deve ser ímpar. 11 é padrão para percepção humana.
    score_ssim, _ = ssim(g1, g2, full=True, win_size=11, data_range=255)
    ssim_dist = (1 - score_ssim) # Escala 0 a 100
    
    # --- 3. Métrica Híbrida Final ---
    # Pesos sugeridos: 60% Geometria (Forma), 40% Visual (Aparência)
    # Para morphing, a forma é mais crítica que a cor.
    final_score = (procrustes_dist * 0.6) + (ssim_dist * 0.4)
    
    return final_score, procrustes_dist, ssim_dist

def main():
    try:
        points1, img1 = get_landmarks_new_api(IMG1_PATH)
        points2_raw, img2_raw = get_landmarks_new_api(IMG2_PATH)
        img2, points2 = align_images(img1, img2_raw, points1, points2_raw)
    except Exception as e:
        print(f"Erro: {e}")
        return

    if SHOW_POINTS:
        vis_img1 = draw_landmarks(img1, points1)
        vis_img2 = draw_landmarks(img2, points2, color=(0,0,255))
    else:
        vis_img1, vis_img2 = img1.copy(), img2.copy()

    img1_f = np.float32(img1)
    img2_f = np.float32(img2)

    # Calcula a distância entre as imagens.
    # --- Exemplo de Uso ---
    dist_total, d_ssim, d_lbp = calculate_perceptual_distance(img1, img2)

    print(f"Distância Perceptual Total: {dist_total:.4f}")
    print(f"Detalhes -> SSIM: {d_ssim:.4f} | LBP: {d_lbp:.4f}")

    score_total, d_geom, d_visual = calculate_procrustes_metric(img1, img2, points1, points2)
    print(f"Diferença Total: {score_total:.2f}")
    print(f" > Geometria (Forma): {d_geom:.2f}")
    print(f" > Visual (SSIM):     {d_visual:.2f}")
    
    # Delaunay Base
    points_avg_fixed = []
    for i in range(len(points1)):
        points_avg_fixed.append((0.5 * points1[i][0] + 0.5 * points2[i][0], 
                                 0.5 * points1[i][1] + 0.5 * points2[i][1]))

    rect = (0, 0, img1.shape[1], img1.shape[0])
    subdiv = cv2.Subdiv2D(rect)
    for p in points_avg_fixed:
        if p[0] >= rect[0] and p[1] >= rect[1] and p[0] < rect[2] and p[1] < rect[3]:
            subdiv.insert(p)

    triangle_list = subdiv.getTriangleList()
    delaunay_tri_indices = []
    for t in triangle_list:
        pts = [(t[0], t[1]), (t[2], t[3]), (t[4], t[5])]
        indices = []
        for pt in pts:
            idx = -1
            for i, p_avg in enumerate(points_avg_fixed):
                if abs(pt[0] - p_avg[0]) < 0.1 and abs(pt[1] - p_avg[1]) < 0.1:
                    idx = i; break
            if idx != -1: indices.append(idx)
        if len(indices) == 3: delaunay_tri_indices.append(indices)

    # --- CALLBACK DE ATUALIZAÇÃO ---
    def update_morph(val):
        alpha = val / 100.0
        
        # 1. Calcula a geometria atual do rosto morphado
        points_current = []
        for i in range(len(points1)):
            x = (1 - alpha) * points1[i][0] + alpha * points2[i][0]
            y = (1 - alpha) * points1[i][1] + alpha * points2[i][1]
            points_current.append((x, y))

        # 2. Gera a imagem Morph completa (incluindo fundo fantasma)
        morph_img = img1_f.copy()#np.zeros(img1_f.shape, dtype=img1_f.dtype)
        for indices in delaunay_tri_indices:
            t1 = [points1[indices[0]], points1[indices[1]], points1[indices[2]]]
            t2 = [points2[indices[0]], points2[indices[1]], points2[indices[2]]]
            t_curr = [points_current[indices[0]], points_current[indices[1]], points_current[indices[2]]]
            morph_triangle(img1_f, img2_f, morph_img, t1, t2, t_curr, alpha)

        # 3. MÁGICA DO MASKING (Correção do Fundo)
        # Cria máscara baseada na geometria ATUAL do rosto morphado
        face_mask = get_face_mask(img1.shape, points_current, blur_ksize=BLUR_AMOUNT)
        
        # Compõe: Onde a máscara é 1 usa o Morph, onde é 0 usa a Img1 original
        final_composite = (morph_img * face_mask) + (img1_f * (1.0 - face_mask))

        # Visualização
        result_uint8 = np.uint8(final_composite)
        combined_view = np.hstack([vis_img1, vis_img2, result_uint8])
        final_display = resize_for_display(combined_view)
        
        cv2.imshow("Morphing Interativo", final_display)

    cv2.namedWindow("Morphing Interativo")
    cv2.createTrackbar("Alpha", "Morphing Interativo", 50, 100, update_morph)
    update_morph(50)

    print("Pressione ESC para sair.")
    while True:
        if cv2.waitKey(1) & 0xFF == 27: break
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()