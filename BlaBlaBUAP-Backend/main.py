import time
import asyncio
import unicodedata
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from paddleocr import PaddleOCR
import logging

logging.getLogger("ppocr").setLevel(logging.ERROR)

app = FastAPI(title="BlaBlaBUAP API")

# Dejamos el CORS abierto para evitar problemas mientras probamos
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Cargando modelo de PaddleOCR...")
ocr_engine = PaddleOCR(
    lang='es',
    text_detection_model_name="PP-OCRv5_mobile_det",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    text_det_limit_side_len=600,
    text_det_limit_type="max",
    enable_mkldnn=False  # 👈 Línea clave para evitar el bug de oneDNN
)
print("¡Modelo cargado y listo!")

def procesar_imagen_y_leer_texto(image_bytes: bytes) -> str:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None: return ""

    # Reducir imagen a máximo 600px para ahorrar RAM extrema
    alto, ancho = img.shape[:2]
    if max(alto, ancho) > 600:
        escala = 600 / max(alto, ancho)
        img = cv2.resize(img, (int(ancho * escala), int(alto * escala)), interpolation=cv2.INTER_AREA)

    img_procesada = cv2.GaussianBlur(img, (5, 5), 0)
    resultado = ocr_engine.predict(img_procesada)

    texto_extraido = []
    if resultado and len(resultado) > 0:
        primer_resultado = resultado[0]
        if isinstance(primer_resultado, dict):
            textos = primer_resultado.get("rec_texts", [])
            puntajes = primer_resultado.get("rec_scores", [])
            for i, texto in enumerate(textos):
                if (puntajes[i] if i < len(puntajes) else 1.0) > 0.6:
                    texto_extraido.append(texto)
    return "\n".join(texto_extraido)

def normalizar_texto(texto: str) -> str:
    if not texto: return ""
    texto = texto.lower()
    texto = ''.join(c for c in unicodedata.normalize('NFD', texto) if unicodedata.category(c) != 'Mn')
    return texto

def validar_nombres(nombre_usuario: str, texto_ine: str, texto_student: str) -> bool:
    nombre_limpio = normalizar_texto(nombre_usuario)
    ine_limpio = normalizar_texto(texto_ine)
    student_limpio = normalizar_texto(texto_student)
    palabras = nombre_limpio.split()
    if not palabras: return False
    for palabra in palabras:
        if len(palabra) < 3: continue
        if palabra not in ine_limpio or palabra not in student_limpio:
            return False
    return True

@app.post("/api/verificar-credenciales")
async def verificar_credenciales(
    nombre: str = Form(...),
    email: str = Form(...),
    ine: UploadFile = File(...),
    student: UploadFile = File(...)
):
    print(f"\nRecibiendo credenciales de: {nombre}")
    
    ine_bytes = await ine.read()
    student_bytes = await student.read()

    print("Procesando INE con IA...")
    texto_ine = await asyncio.to_thread(procesar_imagen_y_leer_texto, ine_bytes)

    print("Procesando Credencial de Estudiante con IA...")
    texto_student = await asyncio.to_thread(procesar_imagen_y_leer_texto, student_bytes)

    es_valido = validar_nombres(nombre, texto_ine, texto_student)

    if not es_valido:
        print(f"❌ ERROR: El nombre '{nombre}' no coincide.")
        raise HTTPException(status_code=400, detail="El nombre no coincide con las credenciales. Intenta de nuevo.")

    print("✅ Validación exitosa.")

    return {
        "status": "success",
        "mensaje": f"Credenciales de {nombre} verificadas correctamente.",
        "texto_ocr_ine": texto_ine
    }