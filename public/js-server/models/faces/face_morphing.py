import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# --- CONFIGURAÇÃO ---
IMG1_PATH = "009_03.jpg"
IMG2_PATH = "002_03.jpg"
MODEL_PATH = "face_landmarker.task" # Certifique-se que este arquivo está na pasta
ALPHA = 0.75 
SHOW_POINTS = True # Se True, desenha os pontos nas imagens de origem

# --- FUNÇÕES AUXILIARES DE VISUALIZAÇÃO ---
def draw_landmarks(img, points, color=(0, 255, 0)):
    """Desenha os pontos na imagem para debug."""
    vis_img = img.copy()
    # O script adiciona 8 pontos extras nas bordas no final da detecção.
    # Não queremos desenhar esses 8 pontos, pois polui a visualização.
    num_actual_landmarks = len(points) - 8
    
    for i, p in enumerate(points):
        if i < num_actual_landmarks:
            cv2.circle(vis_img, (int(p[0]), int(p[1])), 3, color, -1)
    return vis_img

def resize_for_display(img, max_height=600):
    """Redimensiona a imagem composta se ela ficar muito grande para a tela."""
    h, w = img.shape[:2]
    if h > max_height:
        scale = max_height / h
        new_w = int(w * scale)
        new_h = int(h * scale)
        return cv2.resize(img, (new_w, new_h))
    return img

# --- FUNÇÕES CORE ---
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
    
    # Converter BGR para RGB para o MediaPipe
    img_rgb = cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB)
    image_mp = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
    
    detection_result = detector.detect(image_mp)
    
    if not detection_result.face_landmarks:
        raise ValueError(f"Nenhum rosto detectado em {img_path}")

    landmarks = detection_result.face_landmarks[0]
    points = []
    h, w = img_cv.shape[:2]
    for lm in landmarks:
        x, y = int(lm.x * w), int(lm.y * h)
        points.append((x, y))
            
    # Adiciona cantos para o fundo (Total de 8 pontos extras)
    points.extend([(0,0), (w-1,0), (w-1,h-1), (0,h-1)]) 
    points.extend([(w//2,0), (w-1,h//2), (w//2,h-1), (0,h//2)])
        
    return points, img_cv

def align_images(img1, img2, points1, points2):
    """Alinha img2 para a geometria de img1 usando transformação rígida."""
    # Remove os 8 pontos de borda para o cálculo do alinhamento,
    # queremos alinhar apenas pelos pontos faciais.
    p1_face = np.float32(points1[:-8])
    p2_face = np.float32(points2[:-8])

    # estimateAffinePartial2D: apenas rotação, escala e translação (sem shear)
    M, inliers = cv2.estimateAffinePartial2D(p2_face, p1_face, method=cv2.RANSAC)

    if M is None:
        print("Aviso: Não foi possível alinhar as imagens automaticamente. Usando originais.")
        return img2, points2

    # Aplica a transformação na Imagem 2
    aligned_img2 = cv2.warpAffine(img2, M, (img1.shape[1], img1.shape[0]))
    
    # Transforma TODOS os pontos de img2 (inclusive os de borda)
    points2_np = np.float32(points2)
    ones = np.ones((len(points2_np), 1))
    points2_homo = np.hstack([points2_np, ones]) 
    aligned_points2 = M.dot(points2_homo.T).T
    
    return aligned_img2, aligned_points2.tolist()

# --- FUNÇÕES DE MORPHING (Warping Triangular) ---
def apply_affine_transform(src, src_tri, dst_tri, size):
    warp_mat = cv2.getAffineTransform(np.float32(src_tri), np.float32(dst_tri))
    # borderMode=cv2.BORDER_REPLICATE ajuda a evitar linhas pretas finas nas junções
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
    
    if img1_rect.size == 0 or img2_rect.size == 0: return # Evita crash em crops vazios

    size = (r[2], r[3])
    warped_img1 = apply_affine_transform(img1_rect, t1_rect, t_rect, size)
    warped_img2 = apply_affine_transform(img2_rect, t2_rect, t_rect, size)
    
    img_rect = (1.0 - alpha) * warped_img1 + alpha * warped_img2
    mask = np.zeros((r[3], r[2], 3), dtype=np.float32)
    cv2.fillConvexPoly(mask, np.int32(t_rect), (1.0, 1.0, 1.0), 16, 0)
    
    # Blending na imagem final usando a máscara triangular
    img[r[1]:r[1]+r[3], r[0]:r[0]+r[2]] = img[r[1]:r[1]+r[3], r[0]:r[0]+r[2]] * (1 - mask) + img_rect * mask

def main():
    print("Detectando pontos...")
    try:
        points1, img1 = get_landmarks_new_api(IMG1_PATH)
        points2_raw, img2_raw = get_landmarks_new_api(IMG2_PATH)
    except Exception as e:
        print(f"Erro fatal: {e}")
        return

    print("Alinhando imagens...")
    # Alinha a Imagem 2 para bater com a geometria da Imagem 1
    img2, points2 = align_images(img1, img2_raw, points1, points2_raw)
    
    # --- CRIAÇÃO DAS IMAGENS DE INSPEÇÃO ---
    if SHOW_POINTS:
        # Desenha pontos verdes na Img1 e vermelhos na Img2 (já alinhada)
        vis_img1 = draw_landmarks(img1, points1, color=(0, 255, 0))
        vis_img2 = draw_landmarks(img2, points2, color=(0, 0, 255))
    else:
        vis_img1 = img1.copy()
        vis_img2 = img2.copy()

    # Garante float32 para o processamento do morph
    img1_f = np.float32(img1)
    img2_f = np.float32(img2)

    print("Calculando geometria intermediária...")
    points_avg = []
    for i in range(len(points1)):
        x = (1 - ALPHA) * points1[i][0] + ALPHA * points2[i][0]
        y = (1 - ALPHA) * points1[i][1] + ALPHA * points2[i][1]
        points_avg.append((x, y))

    # Delaunay
    rect = (0, 0, img1.shape[1], img1.shape[0])
    subdiv = cv2.Subdiv2D(rect)
    for p in points_avg:
        # Verifica se o ponto está dentro dos limites antes de inserir
        if p[0] >= rect[0] and p[1] >= rect[1] and p[0] < rect[2] and p[1] < rect[3]:
            subdiv.insert(p)

    triangle_list = subdiv.getTriangleList()
    delaunay_tri_indices = []

    # Mapeia os triângulos de volta para índices
    for t in triangle_list:
        pts = [(t[0], t[1]), (t[2], t[3]), (t[4], t[5])]
        indices = []
        for pt in pts:
            idx = -1
            # Busca com tolerância pequena
            for i, p_avg in enumerate(points_avg):
                if abs(pt[0] - p_avg[0]) < 0.1 and abs(pt[1] - p_avg[1]) < 0.1:
                    idx = i
                    break
            if idx != -1: indices.append(idx)
        if len(indices) == 3: delaunay_tri_indices.append(indices)

    print(f"Gerando Morph com {len(delaunay_tri_indices)} triângulos...")
    morph_img = np.zeros(img1_f.shape, dtype=img1_f.dtype)
    for indices in delaunay_tri_indices:
        t1 = [points1[indices[0]], points1[indices[1]], points1[indices[2]]]
        t2 = [points2[indices[0]], points2[indices[1]], points2[indices[2]]]
        t_avg = [points_avg[indices[0]], points_avg[indices[1]], points_avg[indices[2]]]
        morph_triangle(img1_f, img2_f, morph_img, t1, t2, t_avg, ALPHA)

    # Resultado final em uint8
    result_uint8 = np.uint8(morph_img)

    # --- MONTAGEM DO DISPLAY FINAL ---
    # Junta as 3 imagens horizontalmente: Img1+Pts | Img2+Pts(Alinhada) | Resultado
    combined_view = np.hstack([vis_img1, vis_img2, result_uint8])
    
    # Redimensiona se ficar muito grande para a tela
    final_display = resize_for_display(combined_view, max_height=600)

    cv2.imshow("Inspecao: Alinhamento e Morph", final_display)
    cv2.waitKey(0)
    cv2.destroyAllWindows()
    # cv2.imwrite("resultado_inspecao.jpg", combined_view) # Salvar se quiser

if __name__ == "__main__":
    main()