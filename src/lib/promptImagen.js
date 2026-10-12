export const IMAGE_STYLES = [
  {
    id: 'ilustracion_2d',
    nombre: '2D Illustration',
    asset: '/assets/Ilustra2D.webp',
    prompt_base: 'Semi-realistic digital illustration, Artgerm and WLOP inspired style. Porcelain smooth skin, flawless airbrushed complexion, seamless color transitions, ultra-smooth subsurface scattering. Hyper-detailed individual hair strands, intricate accessories and armor. Dramatic cinematic lighting, sharp specular highlights on eyes, deep volumetric shadows. High contrast, vibrant color accents, brighter exposure, warm luminous tones, lifted shadows, cinematic close-up composition.',
  },
  {
    id: 'ilustracion_3d',
    nombre: '3D Illustration',
    asset: '/assets/Ilustra3D.webp',
    prompt_base: 'Stylized 3D digital illustration, painterly concept art finish, soft character design, Studio Ghibli x Pixar aesthetic. Highly detailed facial features, expressive eyes with depth, fine individual hair strands, fabric with visible texture and weight. Smooth render with matte textures and subtle subsurface scattering. Soft volumetric lighting, gentle rim light, diffuse fill light. Soft contrast, moody exposure, smooth gradients. Shallow depth of field, soft focus background, atmospheric haze, dreamy bloom effect.',
  },
  {
    id: 'vector',
    nombre: 'Vector',
    asset: '/assets/Vector.webp',
    prompt_base: 'Minimalist graphic design 3D mockup, premium corporate presentation style, realistic studio render. Strictly lineless, borderless, precise geometric edges, sharp 3D beveled cuts. Fine-grain matte textured paper background, polished stone and satin metallic surface textures on the main elements. Soft overhead studio lighting, subtle specular edge highlights, gentle soft drop shadow under the 3D elements. Low-key balanced exposure, clean sharp focus, symmetrical composition. fine-grain dark matte surface background.',
  },
  {
    id: 'cinema',
    nombre: 'Cinema',
    asset: '/assets/Cinema.webp',
    prompt_base: 'Photorealistic cinematic film still, atmospheric realism, high-fidelity render. Strictly lineless, photorealistic, no outlines, shapes defined by light and natural shadows. Highly tactile and detailed organic surface textures. Cinematic low-key lighting, soft diffused directional light, ambient glowing accent lights. Soft cinematic contrast, smooth shadow gradients, moody exposure with rich shadow details. Shot on 50mm cinematic lens, f/1.8, extreme shallow depth of field, sharp focus on the foreground subject, soft blurred background cinematic bokeh, subtle atmospheric haze and soft light bloom.',
  },
  {
    id: 'pintura',
    nombre: 'Painting',
    asset: '/assets/Pintura.webp',
    prompt_base: 'Detailed graphic digital illustration, matte painting concept art, high-definition metropolitan background with towering structures. Solid defined line-art, sharp graphic outlines, bold clean linework. Hyper-realistic weathered concrete wall texture with cracks and paint drips, polished 3D beveled lettering with metallic and marble textures. Directional spotlight illuminating the top, ambient diffuse daylight mixed with luminous signage glow. High tonal contrast, deep drop shadows on 3D elements. Low-angle shot, 24mm wide-angle lens, deep depth of field, atmospheric haze and volumetric smog, crisp details and subtle light bloom.',
  },
  {
    id: 'realismo',
    nombre: 'Realism',
    asset: '/assets/realista.webp',
    prompt_base: 'Photorealistic image, ultra-high detail, 8K resolution, physically accurate lighting, sharp focus across entire frame, true-to-life textures and materials, natural color grading, lifestyle editorial photography style, warm authentic lighting, no artistic stylization, authentic shadows and highlights, Canon 5D Mark IV aesthetic.',
  },
  {
    id: 'comic',
    nombre: 'Comic',
    asset: '/assets/Comic.webp',
    prompt_base: 'Detailed modern anime illustration, digital painting environment, cinematographic anime background art style. Soft cel-shading, painterly digital brushstroke textures on foliage and environment, wet floor reflections. Warm golden hour backlighting, vibrant rim light, glowing street neons. High dynamic contrast, sharp line-art, sunset exposure with saturated tones. Shot on 35mm lens, f/1.8, soft round background bokeh, cinematic bloom and soft glow effect, subtle chromatic aberration.',
  },
]

export const VISTA_OPTIONS = [
  { label: 'Extreme close-up', value: 'extreme_close_up', prompt: 'extreme close-up shot' },
  { label: 'Portrait', value: 'medium_close_up', prompt: 'medium close-up portrait shot' },
  { label: 'First person', value: 'first_person_pov', prompt: 'first-person POV shot' },
  { label: 'Full body', value: 'full_body', prompt: 'full-body shot' },
  { label: 'Wide landscape', value: 'wide_panoramic', prompt: 'wide panoramic shot' },
]

export const FORMATO_OPTIONS = [
  { label: 'Landscape 16:9', value: 'horizontal', ratio: '16:9' },
  { label: 'Portrait 9:16', value: 'vertical', ratio: '9:16' },
  { label: 'Square 1:1', value: 'cuadrado', ratio: '1:1' },
]

export const UBICACION_OPTIONS = [
  { label: 'Indoor', value: 'interior_setting', prompt: 'set in an indoor interior environment' },
  { label: 'Outdoor', value: 'exterior_setting', prompt: 'set in an outdoor exterior environment' },
]

export const MOMENTO_OPTIONS = [
  { label: 'Broad daylight', value: 'clear_bright_daylight', prompt: 'during clear bright daylight' },
  { label: 'Sunrise', value: 'misty_soft_morning', prompt: 'during a misty soft morning' },
  { label: 'Sunset', value: 'warm_golden_hour_sunset', prompt: 'during a warm golden hour sunset' },
  { label: 'Night', value: 'dark_midnight', prompt: 'at dark midnight' },
]

export const CLIMA_OPTIONS = [
  { label: 'Clear', value: 'clear_weather', prompt: 'with clear weather' },
  { label: 'Rainy', value: 'rain_falling_wet', prompt: 'with rain falling and wet surfaces' },
  { label: 'Snowy', value: 'freezing_snowy', prompt: 'in a freezing snowy landscape' },
  { label: 'Foggy', value: 'dense_mysterious_fog', prompt: 'surrounded by dense mysterious fog' },
  { label: 'Autumn', value: 'autumn_leaves', prompt: 'with autumn leaves' },
  { label: 'Spring', value: 'blooming_spring', prompt: 'with blooming spring flowers' },
]

export const EPOCA_OPTIONS = [
  { label: 'Modern', value: 'contemporary_modern', prompt: 'with contemporary modern background' },
  { label: 'Futuristic', value: 'futuristic_sci_fi', prompt: 'with futuristic structures and glowing holographic elements' },
  { label: 'Medieval', value: 'ancient_medieval', prompt: 'with ancient historical architecture' },
  { label: 'Fantasy', value: 'whimsical_fantasy', prompt: 'with whimsical fantasy elements' },
]

export const PALETA_OPTIONS = [
  { label: 'Warm', value: 'warm_amber_orange', prompt: 'warm color palette dominated by amber, orange, and soft brown tones' },
  { label: 'Cool', value: 'cool_blue_teal', prompt: 'cool color palette dominated by deep blues, teal, and slate grey tones' },
  { label: 'Pastel', value: 'soft_pastel', prompt: 'soft pastel color palette with gentle pink, lavender, and mint tones' },
  { label: 'B/W', value: 'monochrome_bw', prompt: 'monochromatic black and white color palette with rich greyscale values' },
  { label: 'Vibrant', value: 'vibrant_highly_saturated', prompt: 'vibrant and highly saturated color palette with rich contrasting hues' },
  { label: 'Muted', value: 'muted_desaturated', prompt: 'muted and desaturated color palette with soft earthy tones' },
]

export const CHOICE_STEPS = [
  { key: 'vista', briefKey: 'vista', label: 'Framing', question: 'How do we frame the scene?', options: VISTA_OPTIONS },
  { key: 'formato', briefKey: 'formato', label: 'Format', question: 'What format?', options: FORMATO_OPTIONS },
  { key: 'ubicacion', briefKey: 'ubicacion', label: 'Location', question: 'Indoor or outdoor?', options: UBICACION_OPTIONS },
  { key: 'momento', briefKey: 'momento_dia', label: 'Time of day', question: 'What time of day does the scene take place?', options: MOMENTO_OPTIONS },
  { key: 'clima', briefKey: 'clima', label: 'Weather', question: 'What weather or season sets the mood?', options: CLIMA_OPTIONS },
  { key: 'epoca', briefKey: 'epoca', label: 'Era', question: 'Era or theme?', options: EPOCA_OPTIONS },
  { key: 'paleta', briefKey: 'paleta_color', label: 'Palette', question: 'Pick a color palette.', options: PALETA_OPTIONS },
]

export const WIZARD_ORDER = [
  'estilo',
  ...CHOICE_STEPS.map(s => s.key),
  'descripcion',
  'resultado',
]

export const BLANK_IMAGE_BRIEF = {
  estilo_id: null,
  estilo_nombre: null,
  vista: null,
  formato: null,
  ubicacion: null,
  momento_dia: null,
  clima: null,
  epoca: null,
  paleta_color: null,
  descripcion: '',
}

export const PROMPT_MODULES = [
  { key: 'imagen', label: 'Images', ready: true },
]

export function imageStyleById(id) {
  return IMAGE_STYLES.find(s => s.id === id) || null
}

function tidy(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

function asSentence(text) {
  const t = tidy(text)
  if (!t) return ''
  const base = /[.!?]$/.test(t) ? t : `${t}.`
  return base.charAt(0).toUpperCase() + base.slice(1)
}

function optionPrompt(options, value) {
  const found = options.find(o => o.value === value)
  return found ? tidy(found.prompt) : ''
}

export function aspectRatio(value) {
  const found = FORMATO_OPTIONS.find(o => o.value === value)
  return found ? found.ratio : ''
}

export function stepIndex(step) {
  return WIZARD_ORDER.indexOf(step)
}

export function nextStep(step) {
  const i = stepIndex(step)
  if (i < 0) return WIZARD_ORDER[0]
  return WIZARD_ORDER[Math.min(i + 1, WIZARD_ORDER.length - 1)]
}

export function prevStep(step) {
  const i = stepIndex(step)
  if (i <= 0) return WIZARD_ORDER[0]
  return WIZARD_ORDER[i - 1]
}

export function choiceStepByKey(key) {
  return CHOICE_STEPS.find(s => s.key === key) || null
}

export function stepQuestion(step) {
  if (step === 'estilo') return 'Choose the visual style for your prompt.'
  if (step === 'descripcion') return 'Describe in English what you want to see. The app builds the prompt from this.'
  if (step === 'resultado') return 'Prompt ready. Copy and paste it where you generate the image.'
  const found = choiceStepByKey(step)
  return found ? found.question : ''
}

export function stepValue(brief, step) {
  const found = choiceStepByKey(step)
  if (!found) return null
  return brief[found.briefKey] ?? null
}

export function isStepComplete(step, brief = BLANK_IMAGE_BRIEF) {
  if (step === 'estilo') return Boolean(brief.estilo_id)
  if (step === 'descripcion') return tidy(brief.descripcion).length > 0
  if (step === 'resultado') return Boolean(brief.estilo_id) && tidy(brief.descripcion).length > 0
  if (choiceStepByKey(step)) {
    const found = choiceStepByKey(step)
    return Boolean(brief[found.briefKey])
  }
  return false
}

export function firstIncompleteStep(brief = BLANK_IMAGE_BRIEF) {
  const missing = WIZARD_ORDER.find(s => s !== 'resultado' && !isStepComplete(s, brief))
  return missing || 'resultado'
}

export function hasNonEnglishHint(text) {
  return /[áéíóúüñ¿¡]/i.test(String(text ?? ''))
}

export function buildImagePrompt(brief = BLANK_IMAGE_BRIEF) {
  const style = imageStyleById(brief.estilo_id)
  const lines = []

  const subject = asSentence(brief.descripcion)
  if (subject) lines.push(subject)
  if (style) lines.push(tidy(style.prompt_base))

  const vista = optionPrompt(VISTA_OPTIONS, brief.vista)
  if (vista) lines.push(`Framing: ${vista}.`)

  const escena = [
    optionPrompt(UBICACION_OPTIONS, brief.ubicacion),
    optionPrompt(MOMENTO_OPTIONS, brief.momento_dia),
    optionPrompt(CLIMA_OPTIONS, brief.clima),
    optionPrompt(EPOCA_OPTIONS, brief.epoca),
  ].filter(Boolean)
  if (escena.length > 0) lines.push(`Setting: ${escena.join(', ')}.`)

  const paleta = optionPrompt(PALETA_OPTIONS, brief.paleta_color)
  if (paleta) lines.push(`Color palette: ${paleta}.`)

  const ratio = aspectRatio(brief.formato)
  if (ratio) lines.push(`Aspect ratio: ${ratio}.`)

  return lines.join('\n')
}

