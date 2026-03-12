// morph_worker.js

// Carrega as bibliotecas dentro do Worker
importScripts('./opencv.js'); 
importScripts('./delaunator.min.js');

let cvReady = false;
let img1Mat = null;
let img2Mat = null; // Original
let img2Aligned = null;
let img1Points = null;
let img2Points = null;
let delaunayTriangles = null;

// Aguarda o carregamento do OpenCV
cv['onRuntimeInitialized'] = () => {
    cvReady = true;
    postMessage({ type: 'status', msg: '✅ OpenCV Carregado no Worker' });
};

// --- FUNÇÕES DE PROCESSAMENTO ---

function alignImages() {
    // Remove bordas para cálculo da matriz
    const p1 = img1Points.slice(0, img1Points.length - 8);
    const p2 = img2Points.slice(0, img2Points.length - 8);

    let srcTri = cv.matFromArray(p2.length, 1, cv.CV_32FC2, p2.flatMap(p => [p.x, p.y]));
    let dstTri = cv.matFromArray(p1.length, 1, cv.CV_32FC2, p1.flatMap(p => [p.x, p.y]));

    let M = cv.estimateAffine2D(srcTri, dstTri);
    let dsize = new cv.Size(img1Mat.cols, img1Mat.rows);
    
    img2Aligned = new cv.Mat();
    cv.warpAffine(img2Mat, img2Aligned, M, dsize, cv.INTER_LINEAR, cv.BORDER_REFLECT, new cv.Scalar());

    // Transforma pontos
    let m00 = M.data64F[0], m01 = M.data64F[1], m02 = M.data64F[2];
    let m10 = M.data64F[3], m11 = M.data64F[4], m12 = M.data64F[5];

    // Atualiza os pontos da img2 para a nova posição
    let alignedPoints = [];
    for (let p of img2Points) {
        alignedPoints.push({
            x: m00 * p.x + m01 * p.y + m02,
            y: m10 * p.x + m11 * p.y + m12
        });
    }
    
    // Substitui os pontos originais pelos alinhados no contexto global do worker
    img2Points = alignedPoints;
    
    // Limpeza
    srcTri.delete(); dstTri.delete(); M.delete();

    // --- CÁLCULO DE MÉTRICAS (SIMPLIFICADO) ---
    // 1. Shape Dist (Geometria/Procrustes)
    // const shapeDist = calculateShapeDistance(img1Points, img2Points)

    // Envia a imagem alinhada de volta para mostrar na tela
    const imgData = matToImageData(img2Aligned);
    postMessage({ 
        type: 'aligned', 
        imageData: imgData
        // metrics: {
        //     shape: shapeDist
        // }
    });
}






function calculateDelaunay() {
    let pointsAvg = [];
    for (let i = 0; i < img1Points.length; i++) {
        pointsAvg.push((img1Points[i].x + img2Points[i].x) / 2);
        pointsAvg.push((img1Points[i].y + img2Points[i].y) / 2);
    }

    const delaunay = new Delaunator(pointsAvg);
    const triangles = delaunay.triangles;

    delaunayTriangles = [];
    for (let i = 0; i < triangles.length; i += 3) {
        delaunayTriangles.push([triangles[i], triangles[i + 1], triangles[i + 2]]);
    }
}


function morphTriangle(img1, img2, imgMorph, t1, t2, t, alpha) {
    // --- Helper: Cria um Rect seguro (Clamped) ---
    // Garante que o recorte nunca saia dos limites da imagem, evitando o crash do ROI
    function getSafeRect(tri, cols, rows) {
        let minX = Math.floor(Math.min(tri[0].x, tri[1].x, tri[2].x));
        let minY = Math.floor(Math.min(tri[0].y, tri[1].y, tri[2].y));
        let maxX = Math.ceil(Math.max(tri[0].x, tri[1].x, tri[2].x));
        let maxY = Math.ceil(Math.max(tri[0].y, tri[1].y, tri[2].y));
        
        // Garante que x,y sejam >= 0
        let x = Math.max(0, minX);
        let y = Math.max(0, minY);
        
        // Garante que largura/altura não estourem o tamanho da imagem
        let w = Math.min(cols, maxX) - x; 
        let h = Math.min(rows, maxY) - y;
        
        return new cv.Rect(x, y, w, h);
    }

    // Calcula Rects seguros para cada imagem (evita o erro ___cxa_throw)
    let r1 = getSafeRect(t1, img1.cols, img1.rows);
    let r2 = getSafeRect(t2, img2.cols, img2.rows);
    let r  = getSafeRect(t,  imgMorph.cols, imgMorph.rows);

    // Se qualquer retângulo for inválido ou vazio, ignora este triângulo
    if (r.width <= 0 || r.height <= 0 || r1.width <= 0 || r1.height <= 0 || r2.width <= 0 || r2.height <= 0) {
        return;
    }

    // --- Offsets baseados nos Rects seguros ---
    // Importante: Usamos o r.x/r.y "seguro" para calcular as coordenadas relativas
    let t1Rect = t1.map(p => ({x: p.x - r1.x, y: p.y - r1.y}));
    let t2Rect = t2.map(p => ({x: p.x - r2.x, y: p.y - r2.y}));
    let tRect  = t.map(p => ({x: p.x - r.x,  y: p.y - r.y}));

    // Crops (Agora seguros, não vão crashar)
    let img1Rect = img1.roi(r1);
    let img2Rect = img2.roi(r2);
    
    // Configura tamanho do warp baseado no rect de destino
    let dsize = new cv.Size(r.width, r.height);
    let warp1 = new cv.Mat(), warp2 = new cv.Mat();

    // Matrizes para Transformação Afim
    let tri1Mat = cv.matFromArray(3, 1, cv.CV_32FC2, [t1Rect[0].x, t1Rect[0].y, t1Rect[1].x, t1Rect[1].y, t1Rect[2].x, t1Rect[2].y]);
    let tri2Mat = cv.matFromArray(3, 1, cv.CV_32FC2, [t2Rect[0].x, t2Rect[0].y, t2Rect[1].x, t2Rect[1].y, t2Rect[2].x, t2Rect[2].y]);
    let triMat  = cv.matFromArray(3, 1, cv.CV_32FC2, [tRect[0].x, tRect[0].y, tRect[1].x, tRect[1].y, tRect[2].x, tRect[2].y]);

    let M1 = cv.getAffineTransform(tri1Mat, triMat);
    let M2 = cv.getAffineTransform(tri2Mat, triMat);

    // Warp com BORDER_REFLECT para preencher pixels que possam ter ficado fora do crop
    cv.warpAffine(img1Rect, warp1, M1, dsize, cv.INTER_LINEAR, cv.BORDER_REFLECT_101);
    cv.warpAffine(img2Rect, warp2, M2, dsize, cv.INTER_LINEAR, cv.BORDER_REFLECT_101);

    // Blend das duas imagens
    let imgRect = new cv.Mat();
    cv.addWeighted(warp1, 1 - alpha, warp2, alpha, 0.0, imgRect);

    // Máscara Triangular
    let mask = new cv.Mat.zeros(r.height, r.width, cv.CV_8UC3);
    let ptsData = [tRect[0].x, tRect[0].y, tRect[1].x, tRect[1].y, tRect[2].x, tRect[2].y];
    let ptsMat = cv.matFromArray(3, 1, cv.CV_32SC2, ptsData);
    let ptsVec = new cv.MatVector(); ptsVec.push_back(ptsMat);
    
    // Preenche triângulo na máscara
    cv.fillPoly(mask, ptsVec, new cv.Scalar(1, 1, 1));

    // Copia para o destino
    let dstRoi = imgMorph.roi(r);
    let mask1C = new cv.Mat();
    cv.cvtColor(mask, mask1C, cv.COLOR_BGR2GRAY); // Usa constante corrigida
    
    imgRect.copyTo(dstRoi, mask1C);

    // Limpeza de memória (Crucial em loops)
    img1Rect.delete(); img2Rect.delete(); warp1.delete(); warp2.delete();
    tri1Mat.delete(); tri2Mat.delete(); triMat.delete(); M1.delete(); M2.delete();
    imgRect.delete(); mask.delete(); ptsMat.delete(); ptsVec.delete(); dstRoi.delete(); mask1C.delete();
}

function processMorph(alpha) {
    if (!img1Mat || !img2Aligned || !delaunayTriangles) return;

    let currentPoints = [];
    for (let i = 0; i < img1Points.length; i++) {
        currentPoints.push({
            x: (1 - alpha) * img1Points[i].x + alpha * img2Points[i].x,
            y: (1 - alpha) * img1Points[i].y + alpha * img2Points[i].y
        });
    }

    // Morph Base
    let morphMat = img1Mat.clone();

    for (let indices of delaunayTriangles) {
        let t1 = [img1Points[indices[0]], img1Points[indices[1]], img1Points[indices[2]]];
        let t2 = [img2Points[indices[0]], img2Points[indices[1]], img2Points[indices[2]]];
        let t = [currentPoints[indices[0]], currentPoints[indices[1]], currentPoints[indices[2]]];
        morphTriangle(img1Mat, img2Aligned, morphMat, t1, t2, t, alpha);
    }

    // Masking (Face Mask)
    let mask = new cv.Mat.zeros(img1Mat.rows, img1Mat.cols, cv.CV_8UC1);
    let hullPoints = currentPoints.slice(0, currentPoints.length - 8); 
    let hullFlat = hullPoints.flatMap(p=>[p.x, p.y]);
    
    // Convex Hull
    let ptsMat = cv.matFromArray(hullPoints.length, 1, cv.CV_32SC2, hullFlat);
    let hullIdx = new cv.Mat();
    cv.convexHull(ptsMat, hullIdx, false, false);

    let hullOrdered = [];
    for(let i=0; i<hullIdx.rows; i++) {
        let idx = hullIdx.data32S[i];
        hullOrdered.push(hullPoints[idx].x, hullPoints[idx].y);
    }
    
    let polyMat = cv.matFromArray(hullOrdered.length/2, 1, cv.CV_32SC2, hullOrdered);
    let polyVec = new cv.MatVector(); polyVec.push_back(polyMat);
    cv.fillPoly(mask, polyVec, new cv.Scalar(255));
    
    let M = cv.Mat.ones(10, 10, cv.CV_8U);
    cv.dilate(mask, mask, M);
    let ksize = new cv.Size(45, 45);
    cv.GaussianBlur(mask, mask, ksize, 0);

    // Composite
    let maskF = new cv.Mat(); mask.convertTo(maskF, cv.CV_32FC3, 1.0/255.0);
    cv.cvtColor(maskF, maskF, cv.COLOR_GRAY2BGR);
    
    let morphF = new cv.Mat(); morphMat.convertTo(morphF, cv.CV_32FC3);
    let bgF = new cv.Mat(); 
    let img1F = new cv.Mat(); img1Mat.convertTo(img1F, cv.CV_32FC3);
    img1F.copyTo(bgF);

    let result = new cv.Mat();
    let one = new cv.Mat(maskF.rows, maskF.cols, maskF.type(), new cv.Scalar(1.0, 1.0, 1.0));
    let invMask = new cv.Mat();
    cv.subtract(one, maskF, invMask);

    let partA = new cv.Mat(); cv.multiply(morphF, maskF, partA);
    let partB = new cv.Mat(); cv.multiply(bgF, invMask, partB);
    cv.add(partA, partB, result);

    result.convertTo(result, cv.CV_8UC3);

    // Enviar resultado
    const finalData = matToImageData(result);
    postMessage({ type: 'result', imageData: finalData });

    // Cleanup local
    morphMat.delete(); mask.delete(); ptsMat.delete(); hullIdx.delete();
    polyMat.delete(); polyVec.delete(); M.delete(); maskF.delete();
    morphF.delete(); bgF.delete(); img1F.delete(); result.delete();
    one.delete(); invMask.delete(); partA.delete(); partB.delete();
}

// Helper: Converter cv.Mat para ImageData (para enviar ao main thread)
function matToImageData(mat) {
    const img = new cv.Mat();
    const depth = mat.type() % 8;
    const scale = depth <= cv.CV_8S ? 1 : 255;
    const shift = depth <= cv.CV_8S ? 0 : 255;
    mat.convertTo(img, cv.CV_8U, scale, shift);
    
    // Converte caso precise de RGB/RGBA
    switch (img.channels()) {
        case 1: cv.cvtColor(img, img, cv.COLOR_GRAY2RGBA); break;
        case 3: cv.cvtColor(img, img, cv.COLOR_RGB2RGBA); break;
        case 4: break;
    }
    const imgData = new ImageData(new Uint8ClampedArray(img.data), img.cols, img.rows);
    img.delete();
    return imgData;
}

// --- MENSAGENS DO MAIN THREAD ---
onmessage = function(e) {
    if (!cvReady) return;
    
    const { type, payload } = e.data;

    if (type === 'setImages') {
        // payload: { img1: ImageData, img2: ImageData, p1: [], p2: [] }
        if (img1Mat) img1Mat.delete();
        if (img2Mat) img2Mat.delete();

        if (img2Aligned) img2Aligned.delete(); img2Aligned = null;

        img1Mat = cv.matFromImageData(payload.img1);
        img2Mat = cv.matFromImageData(payload.img2);
        
        // Converte RGBA para RGB
        cv.cvtColor(img1Mat, img1Mat, cv.COLOR_RGBA2RGB);
        cv.cvtColor(img2Mat, img2Mat, cv.COLOR_RGBA2RGB);

        img1Points = payload.p1;
        img2Points = payload.p2;

        alignImages();
        calculateDelaunay();
        
        // Faz um morph inicial no meio
        processMorph(0.5); 
    }

    if (type === 'morph') {
        processMorph(payload.alpha);
    }
};