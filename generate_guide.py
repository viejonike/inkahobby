#!/usr/bin/env python3
"""
InkaHobby - Guia de Despliegue Gratuito Permanente
Genera un PDF con instrucciones paso a paso para desplegar
InkaHobby en Vercel + Neon PostgreSQL de forma gratuita.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, Image
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── Color Palette ────────────────────────────────────────
ACCENT       = colors.HexColor('#1a7897')
TEXT_PRIMARY  = colors.HexColor('#202324')
TEXT_MUTED    = colors.HexColor('#7f878b')
BG_SURFACE   = colors.HexColor('#d6dee2')
BG_PAGE      = colors.HexColor('#eaedef')

TABLE_HEADER_COLOR = ACCENT
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = BG_SURFACE

# ── Font Registration ───────────────────────────────────
pdfmetrics.registerFont(TTFont('NotoSerifSC', '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif-Bold', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSansMono', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))

registerFontFamily('LiberationSerif', normal='LiberationSerif', bold='LiberationSerif-Bold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans-Bold')
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')

# ── Styles ──────────────────────────────────────────────
BODY_FONT = 'LiberationSerif'
HEADING_FONT = 'LiberationSerif'
CODE_FONT = 'DejaVuSansMono'

PAGE_W, PAGE_H = A4
LEFT_M = 1.0 * inch
RIGHT_M = 1.0 * inch
TOP_M = 0.8 * inch
BOTTOM_M = 0.8 * inch
CONTENT_W = PAGE_W - LEFT_M - RIGHT_M

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'CustomTitle', fontName=HEADING_FONT, fontSize=28, leading=34,
    alignment=TA_CENTER, textColor=ACCENT, spaceAfter=6
)
subtitle_style = ParagraphStyle(
    'CustomSubtitle', fontName=BODY_FONT, fontSize=14, leading=18,
    alignment=TA_CENTER, textColor=TEXT_MUTED, spaceAfter=24
)
h1_style = ParagraphStyle(
    'H1', fontName=HEADING_FONT, fontSize=20, leading=26,
    textColor=ACCENT, spaceBefore=18, spaceAfter=10
)
h2_style = ParagraphStyle(
    'H2', fontName=HEADING_FONT, fontSize=15, leading=20,
    textColor=ACCENT, spaceBefore=14, spaceAfter=8
)
h3_style = ParagraphStyle(
    'H3', fontName=HEADING_FONT, fontSize=12, leading=16,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6
)
body_style = ParagraphStyle(
    'Body', fontName=BODY_FONT, fontSize=10.5, leading=17,
    alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=6,
    firstLineIndent=0
)
bullet_style = ParagraphStyle(
    'Bullet', fontName=BODY_FONT, fontSize=10.5, leading=17,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY, spaceAfter=4,
    leftIndent=20, bulletIndent=8, bulletFontName=BODY_FONT
)
code_style = ParagraphStyle(
    'Code', fontName=CODE_FONT, fontSize=9, leading=14,
    alignment=TA_LEFT, textColor=colors.HexColor('#1a1a2e'),
    backColor=colors.HexColor('#f0f4f5'), spaceAfter=6,
    leftIndent=12, rightIndent=12, spaceBefore=4,
    borderPadding=6
)
note_style = ParagraphStyle(
    'Note', fontName=BODY_FONT, fontSize=10, leading=15,
    alignment=TA_LEFT, textColor=ACCENT, spaceAfter=8,
    leftIndent=20, borderPadding=6, backColor=colors.HexColor('#e8f4f8')
)
table_header_style = ParagraphStyle(
    'TableHeader', fontName=BODY_FONT, fontSize=10, leading=14,
    textColor=TABLE_HEADER_TEXT, alignment=TA_CENTER
)
table_cell_style = ParagraphStyle(
    'TableCell', fontName=BODY_FONT, fontSize=9.5, leading=14,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT
)
table_cell_center = ParagraphStyle(
    'TableCellCenter', fontName=BODY_FONT, fontSize=9.5, leading=14,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER
)

# ── Helper Functions ────────────────────────────────────
def make_table(headers, rows, col_ratios=None):
    """Create a styled table with proper formatting."""
    if col_ratios is None:
        col_ratios = [1.0 / len(headers)] * len(headers)
    col_widths = [r * CONTENT_W for r in col_ratios]

    data = [[Paragraph(f'<b>{h}</b>', table_header_style) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), table_cell_style) for c in row])

    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

def code_block(text):
    """Create a code block paragraph."""
    return Paragraph(text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'), code_style)

def note_box(text):
    """Create a note/highlight box."""
    return Paragraph(f'<b>NOTA:</b> {text}', note_style)

def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet>{text}', bullet_style)

def step_header(num, title):
    return Paragraph(f'<b>Paso {num}: {title}</b>', h2_style)

# ── Build Document ──────────────────────────────────────
output_path = '/home/z/my-project/download/InkaHobby_Guia_Despliegue_Gratuito.pdf'
os.makedirs(os.path.dirname(output_path), exist_ok=True)

doc = SimpleDocTemplate(
    output_path, pagesize=A4,
    leftMargin=LEFT_M, rightMargin=RIGHT_M,
    topMargin=TOP_M, bottomMargin=BOTTOM_M,
    title='InkaHobby - Guia de Despliegue Gratuito Permanente',
    author='Z.ai',
    creator='Z.ai'
)

story = []

# ── Cover / Title ───────────────────────────────────────
story.append(Spacer(1, 80))
story.append(Paragraph('<b>InkaHobby</b>', title_style))
story.append(Spacer(1, 8))
story.append(Paragraph('Guia de Despliegue Gratuito Permanente', subtitle_style))
story.append(Spacer(1, 24))
story.append(HRFlowable(width='60%', thickness=2, color=ACCENT, spaceAfter=24, spaceBefore=0))
story.append(Spacer(1, 16))

cover_body = ParagraphStyle('CoverBody', fontName=BODY_FONT, fontSize=11, leading=18,
    alignment=TA_CENTER, textColor=TEXT_PRIMARY)
story.append(Paragraph(
    'Esta guia te explica como desplegar InkaHobby en la nube de forma '
    '<b>100% gratuita y permanente</b>, para que funcione como Facebook: '
    'cualquier usuario en el mundo puede descargar la APK, registrarse, '
    'y sus datos se sincronizan automaticamente con el servidor central. '
    'Los administradores pueden acceder desde cualquier dispositivo y ver '
    'toda la informacion sincronizada.', cover_body))

story.append(Spacer(1, 24))

# Architecture overview
story.append(Paragraph('<b>Arquitectura Final</b>', ParagraphStyle(
    'CoverH2', fontName=HEADING_FONT, fontSize=14, leading=18,
    alignment=TA_CENTER, textColor=ACCENT, spaceAfter=12)))

arch_data = [
    ['Componente', 'Servicio Gratuito', 'Que hace'],
    ['Servidor API', 'Vercel (Hobby Free)', 'Ejecuta Next.js con rutas API, HTTPS automatico'],
    ['Base de datos', 'Neon PostgreSQL (Free)', 'Almacena usuarios y archivos en la nube'],
    ['App Android (APK)', 'Capacitor + Vercel URL', 'Se conecta al servidor publico, sin IP config'],
    ['App Web (PWA)', 'Vercel (mismo servidor)', 'Acceso desde cualquier navegador'],
]
arch_table = Table(
    [[Paragraph(f'<b>{c}</b>' if i==0 else c, table_header_style if i==0 else table_cell_style) 
      for c in row] for i, row in enumerate(arch_data)],
    colWidths=[0.20*CONTENT_W, 0.30*CONTENT_W, 0.50*CONTENT_W],
    hAlign='CENTER'
)
arch_style = TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
    ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
    ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('BACKGROUND', (0, 1), (-1, 1), TABLE_ROW_EVEN),
    ('BACKGROUND', (0, 2), (-1, 2), TABLE_ROW_ODD),
    ('BACKGROUND', (0, 3), (-1, 3), TABLE_ROW_EVEN),
    ('BACKGROUND', (0, 4), (-1, 4), TABLE_ROW_ODD),
])
arch_table.setStyle(arch_style)
story.append(arch_table)

story.append(Spacer(1, 20))

# Cost table
story.append(Paragraph('<b>Limites del Plan Gratuito</b>', ParagraphStyle(
    'CoverH3', fontName=HEADING_FONT, fontSize=12, leading=16,
    alignment=TA_CENTER, textColor=TEXT_PRIMARY, spaceAfter=10)))

cost_data = [
    ['Servicio', 'Limite Gratuito', 'Equivalente Aproximado'],
    ['Vercel Bandwidth', '100 GB/mes', '~10,000 usuarios activos'],
    ['Vercel Serverless', '100,000 ejecuciones/mes', '~3,300 por dia'],
    ['Neon Storage', '0.5 GB', '~5,000 fotos o ~500 videos cortos'],
    ['Neon Compute', '100 horas/mes', 'Mas que suficiente para uso normal'],
]
cost_table = Table(
    [[Paragraph(f'<b>{c}</b>' if i==0 else c, table_header_style if i==0 else table_cell_center) 
      for c in row] for i, row in enumerate(cost_data)],
    colWidths=[0.30*CONTENT_W, 0.35*CONTENT_W, 0.35*CONTENT_W],
    hAlign='CENTER'
)
cost_table.setStyle(arch_style)
story.append(cost_table)

story.append(PageBreak())

# ══════════════════════════════════════════════════════════
# SECTION 1: REQUISITOS PREVIOS
# ══════════════════════════════════════════════════════════
story.append(Paragraph('<b>1. Requisitos Previos</b>', h1_style))
story.append(Paragraph(
    'Antes de comenzar, necesitas crear cuentas en los siguientes servicios. '
    'Todas las cuentas son completamente gratuitas y no requieren tarjeta de credito. '
    'El proceso completo deberia tomar entre 15 y 30 minutos si sigues cada paso '
    'con cuidado. Asegurate de tener acceso a tu correo electronico para verificar '
    'las cuentas durante el registro.', body_style))

story.append(Spacer(1, 8))
story.append(Paragraph('<b>1.1 Cuentas Necesarias</b>', h2_style))

story.append(bullet('<b>GitHub</b> (github.com) - Necesario para subir tu codigo y conectar con Vercel. '
    'Si ya tienes cuenta, puedes usar la existente. Si no, ve a github.com y crea una cuenta gratuita.'))
story.append(bullet('<b>Vercel</b> (vercel.com) - Plataforma de hosting donde se desplegara tu servidor. '
    'Ofrece plan Hobby gratuito para siempre con HTTPS automatico y dominio .vercel.app incluido.'))
story.append(bullet('<b>Neon</b> (neon.tech) - Base de datos PostgreSQL en la nube. El plan gratuito '
    'incluye 0.5 GB de almacenamiento y 100 horas de compute mensuales, lo cual es mas que suficiente '
    'para una aplicacion con cientos de usuarios.'))

story.append(Spacer(1, 8))
story.append(Paragraph('<b>1.2 Herramientas en tu Computadora</b>', h2_style))
story.append(bullet('<b>Node.js 18+</b> - Descargalo de nodejs.org. Verifica con: node --version'))
story.append(bullet('<b>Git</b> - Descargalo de git-scm.com. Verifica con: git --version'))
story.append(bullet('<b>Un editor de codigo</b> - VS Code recomendado (code.visualstudio.com)'))

story.append(Spacer(1, 12))
story.append(note_box(
    'Todo el proceso se puede hacer desde Windows, Mac o Linux. No necesitas un servidor '
    'propio ni una IP fija. Todo vive en la nube gratuitamente.'
))

# ══════════════════════════════════════════════════════════
# SECTION 2: CREAR BASE DE DATOS EN NEON
# ══════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(Paragraph('<b>2. Crear la Base de Datos en Neon</b>', h1_style))
story.append(Paragraph(
    'Neon es una base de datos PostgreSQL serverless que funciona perfectamente con Vercel. '
    'Su plan gratuito es ideal para InkaHobby porque se escala automaticamente: cuando no hay '
    'actividad, la base de datos se suspende para ahorrar recursos, y cuando alguien accede a la app, '
    'se reactiva en segundos. Esto significa que nunca pagas por tiempo inactivo. A continuacion '
    'se detallan los pasos exactos para crear tu base de datos.', body_style))

story.append(step_header(1, 'Ir a neon.tech y crear cuenta'))
story.append(Paragraph(
    'Abre tu navegador y ve a <b>neon.tech</b>. Haz clic en "Sign Up" y registrate usando tu cuenta '
    'de GitHub (es la forma mas rapida) o con tu correo electronico. No se requiere tarjeta de credito. '
    'Una vez registrado, seras redirigido al dashboard de Neon donde puedes crear y gestionar '
    'tus bases de datos.', body_style))

story.append(step_header(2, 'Crear un nuevo proyecto'))
story.append(Paragraph(
    'En el dashboard de Neon, haz clic en el boton <b>"New Project"</b>. Se abrira un formulario '
    'con las siguientes opciones que debes configurar cuidadosamente:', body_style))
story.append(bullet('<b>Project name</b>: Escribe "inkahobby" (o el nombre que prefieras)'))
story.append(bullet('<b>Region</b>: Selecciona la region mas cercana a tus usuarios. '
    'Si la mayoria estan en Latinoamerica, elige "AWS US East (Ohio)" o "AWS US West (Oregon)" '
    'ya que no hay regiones en Sudamerica en el plan gratuito y estas son las mas cercanas.'))
story.append(bullet('<b>PostgreSQL version</b>: Deja la version por defecto (16 o 17)'))
story.append(bullet('Haz clic en <b>"Create Project"</b>'))

story.append(step_header(3, 'Copiar la cadena de conexion'))
story.append(Paragraph(
    'Despues de crear el proyecto, Neon mostrara una pantalla con la cadena de conexion a tu base '
    'de datos. Es muy importante que copies esta cadena porque la necesitaras mas adelante. '
    'La cadena se ve asi:', body_style))
story.append(code_block(
    'postgresql://neondb_owner:AbCdEfGh123456@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require'
))
story.append(Paragraph(
    'Guarda esta cadena en un lugar seguro. La necesitaras en dos formatos: la original como '
    '<b>DIRECT_URL</b> y una version con "?sslmode=require" reemplazado por '
    '"?pgbouncer=true&amp;sslmode=require" como <b>DATABASE_URL</b>. Neon usa PgBouncer '
    'para manejar conexiones en el plan gratuito, y Vercel necesita esta version especial para '
    'las migraciones de Prisma.', body_style))

story.append(note_box(
    'Necesitas DOS cadenas: DATABASE_URL (con pgbouncer=true) y DIRECT_URL (sin pgbouncer). '
    'Ambas se basan en la misma cadena que Neon te da.'
))

story.append(step_header(4, 'Obtener las dos cadenas'))
story.append(Paragraph(
    'Desde el dashboard de Neon, ve a <b>Connection Details</b> y copia la cadena. Luego crea '
    'las dos versiones de esta manera:', body_style))

story.append(Paragraph('<b>DATABASE_URL</b> (para consultas desde la app, con PgBouncer):', body_style))
story.append(code_block(
    'postgresql://neondb_owner:PASSWORD@ep-XXXXX.us-east-2.aws.neon.tech/neondb?pgbouncer=true&amp;sslmode=require'
))
story.append(Paragraph('<b>DIRECT_URL</b> (para migraciones de Prisma, sin PgBouncer):', body_style))
story.append(code_block(
    'postgresql://neondb_owner:PASSWORD@ep-XXXXX.us-east-2.aws.neon.tech/neondb?sslmode=require'
))

# ══════════════════════════════════════════════════════════
# SECTION 3: SUBIR CODIGO A GITHUB
# ══════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(Paragraph('<b>3. Subir el Codigo a GitHub</b>', h1_style))
story.append(Paragraph(
    'Vercel despliega automaticamente tu aplicacion cada vez que haces un cambio en GitHub. '
    'Por eso necesitas subir tu codigo de InkaHobby a un repositorio de GitHub. Si ya tienes '
    'el proyecto en tu computadora, sigue estos pasos. Si no, puedes descargar el codigo del '
    'proyecto y colocarlo en una carpeta antes de continuar.', body_style))

story.append(step_header(1, 'Inicializar el repositorio Git'))
story.append(Paragraph('Abre una terminal en la carpeta de tu proyecto y ejecuta:', body_style))
story.append(code_block('cd /ruta/a/tu/proyecto/inkahobby\ngit init\ngit add .\ngit commit -m "InkaHobby - version inicial"'))

story.append(step_header(2, 'Crear repositorio en GitHub'))
story.append(Paragraph(
    'Ve a github.com y haz clic en el boton <b>"New repository"</b> (icono + en la esquina '
    'superior derecha). Nombra el repositorio "inkahobby". Puedes elegir Publico o Privado '
    '(ambos funcionan con Vercel). NO marques las opciones de README, .gitignore o License '
    'porque el proyecto ya tiene estos archivos. Haz clic en <b>"Create repository"</b>.', body_style))

story.append(step_header(3, 'Subir el codigo'))
story.append(Paragraph(
    'GitHub te mostrara instrucciones para subir tu codigo existente. Ejecuta los comandos '
    'que aparecen ahi, que seran algo asi:', body_style))
story.append(code_block(
    'git remote add origin https://github.com/TU-USUARIO/inkahobby.git\ngit branch -M main\ngit push -u origin main'
))
story.append(Paragraph(
    'Reemplaza "TU-USUARIO" con tu nombre de usuario de GitHub. Despues de ejecutar estos '
    'comandos, refresca la pagina de GitHub y deberias ver todos los archivos de tu proyecto '
    'en el repositorio.', body_style))

# ══════════════════════════════════════════════════════════
# SECTION 4: DESPLEGAR EN VERCEL
# ══════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(Paragraph('<b>4. Desplegar en Vercel</b>', h1_style))
story.append(Paragraph(
    'Vercel es la plataforma de hosting que ejecutara tu servidor Next.js en la nube. '
    'Su plan Hobby es completamente gratuito e incluye HTTPS automatico, un dominio '
    '.vercel.app, y despliegue automatico cada vez que haces push a GitHub. A diferencia '
    'de un servidor local que solo funciona en tu red WiFi, Vercel hace que tu aplicacion '
    'este disponible desde cualquier lugar del mundo con una URL publica y segura.', body_style))

story.append(step_header(1, 'Ir a vercel.com y crear cuenta'))
story.append(Paragraph(
    'Abre tu navegador y ve a <b>vercel.com</b>. Haz clic en "Sign Up" y registrate usando '
    'tu cuenta de GitHub (recomendado para que Vercel pueda acceder a tus repositorios). '
    'No se requiere tarjeta de credito para el plan gratuito.', body_style))

story.append(step_header(2, 'Importar el proyecto'))
story.append(Paragraph(
    'Despues de iniciar sesion en Vercel, seras llevado al dashboard. Haz clic en '
    '<b>"Add New..."</b> y luego en <b>"Project"</b>. Veras una lista de tus repositorios '
    'de GitHub. Busca "inkahobby" y haz clic en <b>"Import"</b> junto al repositorio. '
    'Si no aparece, haz clic en "Adjust GitHub App Permissions" para dar permiso a Vercel '
    'para acceder al repositorio.', body_style))

story.append(step_header(3, 'Configurar variables de entorno'))
story.append(Paragraph(
    'Antes de hacer el despliegue, necesitas configurar las variables de entorno. En la pagina '
    'de configuracion del proyecto, busca la seccion <b>"Environment Variables"</b> y agrega '
    'las siguientes variables una por una. Es MUY IMPORTANTE que las escribas exactamente como '
    'se muestran aqui, sin espacios adicionales:', body_style))

env_data = [
    ['Variable', 'Valor', 'Descripcion'],
    ['DATABASE_URL', 'postgresql://neondb_owner:PASSWORD@ep-XXXXX.neon.tech/neondb?pgbouncer=true&sslmode=require', 'Conexion con PgBouncer para consultas'],
    ['DIRECT_URL', 'postgresql://neondb_owner:PASSWORD@ep-XXXXX.neon.tech/neondb?sslmode=require', 'Conexion directa para migraciones'],
    ['NEXT_PUBLIC_API_URL', 'https://inkahobby.vercel.app', 'URL publica de tu app (la que Vercel te asigne)'],
]
env_table = Table(
    [[Paragraph(f'<b>{c}</b>' if i==0 else c, table_header_style if i==0 else table_cell_style) 
      for c in row] for i, row in enumerate(env_data)],
    colWidths=[0.22*CONTENT_W, 0.45*CONTENT_W, 0.33*CONTENT_W],
    hAlign='CENTER'
)
env_style_cmds = [
    ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
    ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
    ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('BACKGROUND', (0, 1), (-1, 1), TABLE_ROW_EVEN),
    ('BACKGROUND', (0, 2), (-1, 2), TABLE_ROW_ODD),
    ('BACKGROUND', (0, 3), (-1, 3), TABLE_ROW_EVEN),
]
env_table.setStyle(TableStyle(env_style_cmds))
story.append(Spacer(1, 8))
story.append(env_table)

story.append(Spacer(1, 8))
story.append(note_box(
    'Para NEXT_PUBLIC_API_URL, usa la URL que Vercel te asignara. Inicialmente puedes poner '
    'cualquier URL provisional como "https://inkahobby.vercel.app". Despues del primer despliegue, '
    'Vercel te dara la URL real y podras actualizar esta variable.'
))

story.append(step_header(4, 'Configurar Build Settings'))
story.append(Paragraph(
    'En la misma pagina de configuracion, ve a la seccion <b>"Build and Output Settings"</b> '
    'y verifica que la configuracion sea la siguiente. Normalmente Vercel detecta automaticamente '
    'que es un proyecto Next.js, pero es buena idea verificarlo:', body_style))
story.append(bullet('<b>Framework Preset</b>: Next.js (deberia detectarse automaticamente)'))
story.append(bullet('<b>Build Command</b>: next build (por defecto, no cambiar)'))
story.append(bullet('<b>Output Directory</b>: Dejar vacio (Vercel lo maneja automaticamente)'))
story.append(bullet('<b>Install Command</b>: npm install (por defecto)'))

story.append(step_header(5, 'Desplegar'))
story.append(Paragraph(
    'Haz clic en el boton <b>"Deploy"</b>. Vercel comenzara el proceso de construccion y despliegue. '
    'Esto tomara entre 2 y 5 minutos la primera vez. Veras un progreso en tiempo real. Si todo '
    'sale bien, veras una pantalla de exito con confeti y la URL de tu aplicacion. Anota esta URL '
    'porque la necesitaras para configurar el APK y actualizar NEXT_PUBLIC_API_URL.', body_style))

story.append(note_box(
    'Si el primer despliegue falla, no te preocupes. Lo mas comun es que las variables de entorno '
    'esten mal configuradas. Revisa las cadenas de conexion de Neon y vuelve a intentarlo.'
))

# ══════════════════════════════════════════════════════════
# SECTION 5: INICIALIZAR LA BASE DE DATOS
# ══════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(Paragraph('<b>5. Inicializar la Base de Datos</b>', h1_style))
story.append(Paragraph(
    'Despues del primer despliegue en Vercel, necesitas crear las tablas en la base de datos de Neon. '
    'Hay dos formas de hacerlo: usando Prisma desde tu computadora local, o usando la ruta de seed '
    'que ya tiene InkaHobby. La forma mas sencilla es usar Prisma desde tu maquina local conectandote '
    'a la base de datos remota de Neon.', body_style))

story.append(step_header(1, 'Configurar variables locales'))
story.append(Paragraph(
    'En tu computadora, edita el archivo <b>.env</b> del proyecto y actualiza las variables para '
    'apuntar a la base de datos de Neon (las mismas que configuraste en Vercel):', body_style))
story.append(code_block(
    'DATABASE_URL="postgresql://neondb_owner:PASSWORD@ep-XXXXX.neon.tech/neondb?pgbouncer=true&amp;sslmode=require"\n'
    'DIRECT_URL="postgresql://neondb_owner:PASSWORD@ep-XXXXX.neon.tech/neondb?sslmode=require"'
))

story.append(step_header(2, 'Crear las tablas con Prisma'))
story.append(Paragraph(
    'Ejecuta el siguiente comando para crear las tablas en la base de datos de Neon. Este comando '
    'usa Prisma para generar las tablas automaticamente basandose en el esquema que ya tiene el proyecto:', body_style))
story.append(code_block('npx prisma db push'))
story.append(Paragraph(
    'Este comando se conectara a la base de datos de Neon usando la cadena de conexion que '
    'configuraste y creara las tablas "User" y "VaultFile" automaticamente. Si ves un mensaje '
    'de exito, las tablas estan listas. Si hay un error de conexion, verifica que las cadenas '
    'de conexion sean correctas y que tu IP no este bloqueada.', body_style))

story.append(step_header(3, 'Crear los usuarios admin y superadmin'))
story.append(Paragraph(
    'InkaHobby tiene una ruta de seed que crea automaticamente los usuarios admin y superadmin. '
    'Abre tu navegador y visita la siguiente URL (reemplaza con tu URL de Vercel):', body_style))
story.append(code_block('https://TU-PROYECTO.vercel.app/api/seed'))
story.append(Paragraph(
    'Deberias ver una respuesta JSON confirmando que los usuarios fueron creados. Los credenciales '
    'por defecto son los siguientes, pero te recomiendo cambiarlos despues del primer inicio de sesion:', body_style))

cred_data = [
    ['Rol', 'Correo', 'Contrasena'],
    ['Super Admin', 'superadmin@inkahobby.com', 'InkaSuper2024!'],
    ['Admin', 'admin@inkahobby.com', 'InkaAdmin2024!'],
]
cred_table = Table(
    [[Paragraph(f'<b>{c}</b>' if i==0 else c, table_header_style if i==0 else table_cell_center) 
      for c in row] for i, row in enumerate(cred_data)],
    colWidths=[0.25*CONTENT_W, 0.40*CONTENT_W, 0.35*CONTENT_W],
    hAlign='CENTER'
)
cred_style_cmds = list(env_style_cmds)
cred_table.setStyle(TableStyle(cred_style_cmds))
story.append(Spacer(1, 6))
story.append(cred_table)

# ══════════════════════════════════════════════════════════
# SECTION 6: ACTUALIZAR URL Y REDESPLEGAR
# ══════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(Paragraph('<b>6. Actualizar la URL Publica y Redesplegar</b>', h1_style))
story.append(Paragraph(
    'Despues del primer despliegue, Vercel te asigno una URL definitiva para tu proyecto, algo como '
    '<b>inkahobby.vercel.app</b> o <b>inkahobby-xyz123.vercel.app</b>. Necesitas actualizar la variable '
    'NEXT_PUBLIC_API_URL con esta URL real para que el APK de Android sepa donde conectarse. '
    'Esta variable se inserta en el codigo del APK en el momento de la compilacion, por lo que '
    'es fundamental que sea correcta antes de generar el APK final.', body_style))

story.append(step_header(1, 'Actualizar NEXT_PUBLIC_API_URL en Vercel'))
story.append(Paragraph(
    'Ve al dashboard de Vercel, selecciona tu proyecto, y ve a <b>Settings > Environment Variables</b>. '
    'Busca la variable NEXT_PUBLIC_API_URL y actualiza su valor con la URL real que Vercel te asigno. '
    'Por ejemplo, si tu URL es "inkahobby-abc.vercel.app", el valor seria:', body_style))
story.append(code_block('https://inkahobby-abc.vercel.app'))

story.append(step_header(2, 'Redesplegar'))
story.append(Paragraph(
    'Despues de actualizar la variable de entorno, necesitas redesplegar para que los cambios '
    'tengan efecto. Ve a la pestana <b>"Deployments"</b> en tu proyecto de Vercel, busca el '
    'ultimo despliegue, haz clic en los tres puntos (...) y selecciona <b>"Redeploy"</b>. '
    'Esto reconstruira la aplicacion con la nueva URL. El proceso toma 1-3 minutos.', body_style))

# ══════════════════════════════════════════════════════════
# SECTION 7: CONSTRUIR APK DE ANDROID
# ══════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(Paragraph('<b>7. Construir el APK de Android</b>', h1_style))
story.append(Paragraph(
    'El APK de Android es la version instalable de la aplicacion que los usuarios pueden descargar '
    'directamente en sus telefonos. Este APK viene preconfigurado con la URL de tu servidor en Vercel, '
    'por lo que los usuarios solo necesitan instalarlo y registrarse, sin configurar ninguna IP '
    'ni estar conectados a la misma red WiFi. El proceso de construccion usa Capacitor para '
    'empaquetar la aplicacion web como una app nativa de Android.', body_style))

story.append(step_header(1, 'Configurar la URL del servidor'))
story.append(Paragraph(
    'Antes de construir el APK, asegurate de que la variable de entorno NEXT_PUBLIC_API_URL '
    'este configurada correctamente en tu archivo .env local. Debe apuntar a tu servidor '
    'en Vercel:', body_style))
story.append(code_block('NEXT_PUBLIC_API_URL=https://tu-proyecto.vercel.app'))

story.append(step_header(2, 'Construir el APK'))
story.append(Paragraph(
    'Ejecuta el script de construccion que ya viene con el proyecto. Este script compila la '
    'aplicacion en modo estatico (para Capacitor), sincroniza con el proyecto Android, y genera '
    'el archivo APK:', body_style))
story.append(code_block('INKA_SERVER_URL=https://tu-proyecto.vercel.app ./build-capacitor.sh'))
story.append(Paragraph(
    'El proceso completo puede tomar entre 5 y 15 minutos dependiendo de tu computadora. '
    'Al finalizar, encontraras el archivo <b>InkaHobby.apk</b> en la carpeta raiz del proyecto '
    'y en la carpeta public/. Este archivo es el que distribuiras a los usuarios para que '
    'instalen la aplicacion en sus dispositivos Android.', body_style))

story.append(step_header(3, 'Subir el APK a Vercel'))
story.append(Paragraph(
    'Para que los usuarios puedan descargar el APK directamente desde la app web, sube el '
    'archivo a la carpeta public/ del repositorio y haz push a GitHub:', body_style))
story.append(code_block(
    'cp InkaHobby.apk public/InkaHobby.apk\ngit add public/InkaHobby.apk\ngit commit -m "Actualizar APK"\ngit push'
))
story.append(Paragraph(
    'Vercel detectara el cambio y redesplegara automaticamente. Despues de esto, los usuarios '
    'podran descargar el APK desde tu URL publica: https://tu-proyecto.vercel.app/InkaHobby.apk', body_style))

# ══════════════════════════════════════════════════════════
# SECTION 8: VERIFICAR QUE TODO FUNCIONA
# ══════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(Paragraph('<b>8. Verificar que Todo Funciona</b>', h1_style))
story.append(Paragraph(
    'Despues de completar todos los pasos anteriores, es fundamental verificar que el sistema '
    'funciona correctamente de extremo a extremo. Realiza las siguientes pruebas para asegurarte '
    'de que todo esta configurado correctamente y de que los usuarios podran usar la aplicacion '
    'sin problemas desde cualquier lugar del mundo.', body_style))

story.append(Paragraph('<b>8.1 Prueba de la API</b>', h2_style))
story.append(Paragraph(
    'Abre tu navegador y visita estas URLs para verificar que el servidor esta respondiendo '
    'correctamente. Reemplaza "tu-proyecto" con tu URL real de Vercel:', body_style))
story.append(bullet('<b>https://tu-proyecto.vercel.app/api/seed</b> - Deberia mostrar los usuarios creados'))
story.append(bullet('<b>https://tu-proyecto.vercel.app/api/users</b> - Deberia mostrar la lista de usuarios (admin, superadmin)'))
story.append(bullet('<b>https://tu-proyecto.vercel.app</b> - Deberia cargar la pantalla de login de InkaHobby'))

story.append(Paragraph('<b>8.2 Prueba de Registro de Usuario</b>', h2_style))
story.append(Paragraph(
    'Abre la app desde un navegador o descarga el APK en un dispositivo Android. Registra un '
    'nuevo usuario con un nombre de usuario y PIN. Despues de registrarte, ve al panel de '
    'superadmin (manten presionado el boton "Ayuda" por el tiempo configurado, luego ingresa '
    'con las credenciales de superadmin) y verifica que el nuevo usuario aparezca en la lista. '
    'Esto confirma que la sincronizacion con la base de datos de Neon esta funcionando.', body_style))

story.append(Paragraph('<b>8.3 Prueba de Sincronizacion de Archivos</b>', h2_style))
story.append(Paragraph(
    'Desde la app, importa una foto o video al vault del usuario que creaste. Espera unos '
    'segundos para que la sincronizacion se complete (recuerda que la app sincroniza cada 15 '
    'segundos). Luego ve al panel de superadmin desde OTRO dispositivo o navegador y verifica '
    'que el archivo aparezca en la lista de archivos del usuario. Esto confirma que los archivos '
    'se estan almacenando correctamente en la base de datos de Neon y son accesibles desde '
    'cualquier dispositivo.', body_style))

story.append(Paragraph('<b>8.4 Prueba Desde Otra Red</b>', h2_style))
story.append(Paragraph(
    'Para verificar que la app funciona desde cualquier red (no solo desde tu WiFi), conecta '
    'tu telefono a datos moviles en lugar de WiFi y abre la app. Intenta registrar un nuevo '
    'usuario o importar un archivo. Si funciona, significa que la arquitectura global esta '
    'operativa y los usuarios podran usar la app desde cualquier parte del mundo, tal como '
    'funciona Facebook o Instagram.', body_style))

# ══════════════════════════════════════════════════════════
# SECTION 9: MANTENIMIENTO Y ACTUALIZACIONES
# ══════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(Paragraph('<b>9. Mantenimiento y Actualizaciones</b>', h1_style))
story.append(Paragraph(
    'Una de las grandes ventajas de esta arquitectura es que el mantenimiento es minimo. '
    'Vercel y Neon se encargan de la infraestructura, las actualizaciones de seguridad, '
    'y la disponibilidad del servicio. Sin embargo, hay algunas tareas de mantenimiento '
    'que deberias realizar periodicamente para asegurar el correcto funcionamiento de la '
    'aplicacion a largo plazo.', body_style))

story.append(Paragraph('<b>9.1 Como Actualizar el Codigo</b>', h2_style))
story.append(Paragraph(
    'Cada vez que hagas cambios en el codigo de InkaHobby, el proceso es simple: haz commit '
    'y push a GitHub. Vercel detectara automaticamente los cambios y redesplegara la aplicacion. '
    'Esto significa que no necesitas hacer nada manual en Vercel, solo subir el codigo a GitHub. '
    'El proceso de redespliegue toma generalmente entre 1 y 3 minutos. La app web se actualiza '
    'inmediatamente para todos los usuarios, pero el APK de Android necesita ser reconstruido '
    'y redistribuido si quieres que los usuarios de la app nativa tambien reciban los cambios.', body_style))
story.append(code_block(
    'git add .\ngit commit -m "Descripcion del cambio"\ngit push'
))

story.append(Paragraph('<b>9.2 Monitorear el Uso</b>', h2_style))
story.append(Paragraph(
    'Puedes monitorear el uso de tu aplicacion desde los dashboards de Vercel y Neon. En Vercel, '
    've a la pestana "Analytics" para ver el numero de visitas y el rendimiento de las funciones '
    'serverless. En Neon, ve al dashboard para ver el almacenamiento usado y las horas de compute '
    'consumidas. Si en algun momento superas los limites gratuitos, puedes considerar migrar '
    'a un plan de pago (que son bastante economicos) o optimizar tu aplicacion para usar menos '
    'recursos, por ejemplo comprimiendo las imagenes antes de subirlas o implementando un sistema '
    'de limpieza automatica de archivos antiguos.', body_style))

story.append(Paragraph('<b>9.3 Respaldos de la Base de Datos</b>', h2_style))
story.append(Paragraph(
    'Neon incluye respaldos automaticos en su plan gratuito con un punto de restauracion de '
    'hasta 7 dias. Esto significa que si algo sale mal, puedes restaurar la base de datos a '
    'un estado anterior. Sin embargo, te recomiendo hacer respaldos manuales periodicos usando '
    'el comando pg_dump. Tambien puedes usar la funcion de backup integrada de InkaHobby '
    '(el boton de restaurar respaldo .inkabak en la pantalla de login) para que los usuarios '
    'tengan una copia local de sus datos como medida de seguridad adicional.', body_style))

story.append(Paragraph('<b>9.4 Escalar si es Necesario</b>', h2_style))
story.append(Paragraph(
    'Si tu aplicacion crece y los limites gratuitos ya no son suficientes, tienes varias opciones '
    'para escalar sin gastar mucho dinero. El plan Pro de Vercel cuesta $20/mes e incluye '
    '1 TB de bandwidth y funciones serverless ilimitadas. El plan Pro de Neon cuesta $19/mes '
    'e incluye 10 GB de almacenamiento y compute ilimitado. Alternativamente, puedes migrar '
    'a otros servicios como Railway ($5/mes), Render ($7/mes), o incluso un VPS en DigitalOcean '
    'o Hetzner por $4-5/mes. La arquitectura de InkaHobby esta disenada para ser portable y '
    'funcionar en cualquier plataforma que soporte Node.js y PostgreSQL.', body_style))

# ══════════════════════════════════════════════════════════
# SECTION 10: SOLUCION DE PROBLEMAS
# ══════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(Paragraph('<b>10. Solucion de Problemas Comunes</b>', h1_style))
story.append(Paragraph(
    'A continuacion se presentan los problemas mas comunes que pueden surgir durante el despliegue '
    'y su solucion. Si encuentras un problema que no esta listado aqui, revisa los logs de Vercel '
    '(en la pestana "Deployments" > selecciona un despliegue > "Function Logs") y los logs de '
    'Neon (en la pestana "Monitoring" del dashboard) para obtener mas informacion sobre el error.', body_style))

trouble_data = [
    ['Problema', 'Causa Probable', 'Solucion'],
    ['Error 500 en la API', 'DATABASE_URL mal configurada', 'Verifica la cadena de conexion en Vercel Settings'],
    ['Usuarios no se sincronizan', 'La API no responde', 'Revisa los Function Logs en Vercel'],
    ['Archivos no aparecen', 'Usuario no existe en el servidor', 'El usuario debe sincronizarse antes que los archivos'],
    ['APK no conecta al servidor', 'NEXT_PUBLIC_API_URL incorrecta', 'Reconstruir el APK con la URL correcta de Vercel'],
    ['Base de datos suspendida', 'Neon suspende por inactividad', 'Se reactiva automaticamente al acceder, es normal'],
    ['Error de CORS', 'Falta configuracion CORS', 'Ya incluida en el codigo, verificar en Vercel logs'],
    ['Deploy falla en Vercel', 'Error en build de Next.js', 'Revisar Build Logs en Vercel para detalles'],
]
trouble_table = Table(
    [[Paragraph(f'<b>{c}</b>' if i==0 else c, table_header_style if i==0 else table_cell_style) 
      for c in row] for i, row in enumerate(trouble_data)],
    colWidths=[0.25*CONTENT_W, 0.32*CONTENT_W, 0.43*CONTENT_W],
    hAlign='CENTER'
)
trouble_style = list(env_style_cmds)
# Add more alternating rows
for i in range(4, len(trouble_data)):
    bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
    trouble_style.append(('BACKGROUND', (0, i), (-1, i), bg))
trouble_table.setStyle(TableStyle(trouble_style))
story.append(Spacer(1, 8))
story.append(trouble_table)

# ══════════════════════════════════════════════════════════
# SECTION 11: RESUMEN DE ARCHIVOS MODIFICADOS
# ══════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(Paragraph('<b>11. Resumen de Archivos Modificados</b>', h1_style))
story.append(Paragraph(
    'Para que InkaHobby funcione con la arquitectura global (Vercel + Neon PostgreSQL), '
    'se realizaron las siguientes modificaciones en el codigo del proyecto. Estos cambios '
    'ya estan hechos en tu copia local, solo necesitas subirlos a GitHub para que Vercel '
    'los despliegue automaticamente.', body_style))

files_data = [
    ['Archivo', 'Cambio Realizado'],
    ['prisma/schema.prisma', 'Proveedor cambiado de sqlite a postgresql, agregado @db.Text para campos grandes, agregado directUrl, indices optimizados'],
    ['package.json', 'Agregado script postinstall para Prisma generate (necesario para Vercel), agregado db:migrate:prod'],
    ['.env', 'Actualizado con plantillas para DATABASE_URL y DIRECT_URL de Neon PostgreSQL'],
    ['.env.example', 'Nuevo archivo con plantilla de configuracion para referencia'],
    ['src/lib/api.ts', 'Ya usa NEXT_PUBLIC_API_URL para APK, sin cambios necesarios'],
    ['src/components/LoginScreen.tsx', 'Ya no tiene configuracion de IP, sin cambios necesarios'],
    ['capacitor.config.ts', 'Ya usa androidScheme: https para CORS, sin cambios necesarios'],
    ['build-capacitor.sh', 'Ya usa INKA_SERVER_URL para la URL publica, sin cambios necesarios'],
]
files_table = Table(
    [[Paragraph(f'<b>{c}</b>' if i==0 else c, table_header_style if i==0 else table_cell_style) 
      for c in row] for i, row in enumerate(files_data)],
    colWidths=[0.30*CONTENT_W, 0.70*CONTENT_W],
    hAlign='CENTER'
)
files_style = list(env_style_cmds)
for i in range(4, len(files_data)):
    bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
    files_style.append(('BACKGROUND', (0, i), (-1, i), bg))
files_table.setStyle(TableStyle(files_style))
story.append(Spacer(1, 8))
story.append(files_table)

# ══════════════════════════════════════════════════════════
# SECTION 12: CHECKLIST FINAL
# ══════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(Paragraph('<b>12. Checklist Final</b>', h1_style))
story.append(Paragraph(
    'Usa esta lista de verificacion para asegurarte de que has completado todos los pasos '
    'necesarios para que InkaHobby funcione globalmente. Marca cada item a medida que lo '
    'completes. Si algun paso no esta funcionando, revisa la seccion correspondiente de esta '
    'guia o consulta la tabla de solucion de problemas en la seccion 10.', body_style))

checklist = [
    'Cuenta de GitHub creada y repositorio "inkahobby" configurado',
    'Cuenta de Neon creada y proyecto PostgreSQL inicializado',
    'Cadena de conexion DATABASE_URL copiada (con pgbouncer=true)',
    'Cadena de conexion DIRECT_URL copiada (sin pgbouncer)',
    'Cuenta de Vercel creada y proyecto importado desde GitHub',
    'Variables de entorno configuradas en Vercel (DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_API_URL)',
    'Primer despliegue en Vercel exitoso',
    'Tablas creadas en Neon con "npx prisma db push"',
    'Ruta /api/seed visitada para crear admin y superadmin',
    'NEXT_PUBLIC_API_URL actualizada con la URL real de Vercel',
    'Segundo despliegue (redeploy) ejecutado en Vercel',
    'APK construido con la URL correcta del servidor',
    'APK subido a public/ y push a GitHub',
    'Prueba de API exitosa (visitar /api/users en el navegador)',
    'Prueba de registro de usuario exitosa',
    'Prueba de sincronizacion de archivos exitosa',
    'Prueba desde otra red (datos moviles) exitosa',
]
for item in checklist:
    story.append(Paragraph(f'<bullet>&#9744;</bullet> {item}', bullet_style))

story.append(Spacer(1, 20))
story.append(HRFlowable(width='100%', thickness=1, color=TEXT_MUTED, spaceAfter=12))
story.append(Paragraph(
    '<b> felicidades!</b> Si completaste todos los pasos de esta guia, InkaHobby ahora '
    'funciona como una aplicacion global: los usuarios pueden descargar la APK desde cualquier '
    'parte del mundo, registrarse automaticamente sin configurar ninguna IP, y sus datos se '
    'sincronizan con tu servidor en la nube. Tu como administrador puedes ver toda la informacion '
    'desde cualquier dispositivo conectado a Internet. Todo esto de forma completamente gratuita.',
    ParagraphStyle('FinalNote', fontName=BODY_FONT, fontSize=11, leading=18,
        alignment=TA_CENTER, textColor=ACCENT, spaceBefore=6)
))

# ── Build PDF ───────────────────────────────────────────
doc.build(story)
print(f"PDF generado exitosamente: {output_path}")
