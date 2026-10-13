// Catálogo de estilos de imagen de Asun. Migrado de la tabla `estilos_imagen_public`
// (S10) con sus `prompt_base` traídos de Supabase (S11): los `id` siguen siendo los
// UUID de producción (clave con la que se nombran las filas de `estilos_imagen`),
// pero el prompt ya vive acá y la generación es directa contra OpenRouter.
const REALISM_PROMPT =
  'Photorealistic image, ultra-high detail, 8K resolution, physically accurate lighting, ' +
  'sharp focus across entire frame, true-to-life textures and materials, natural color grading, ' +
  'lifestyle editorial photography style, warm authentic lighting, no artistic stylization, ' +
  'authentic shadows and highlights, Canon 5D Mark IV aesthetic.'

const ILLUSTRATION_3D_PROMPT =
  'Stylized 3D digital illustration, painterly concept art finish, soft character design, ' +
  'Studio Ghibli x Pixar aesthetic. Highly detailed facial features, expressive eyes with depth, ' +
  'fine individual hair strands, fabric with visible texture and weight. Smooth render with matte ' +
  'textures and subtle subsurface scattering. Soft volumetric lighting, gentle rim light, diffuse ' +
  'fill light. Soft contrast, moody exposure, smooth gradients. Shallow depth of field, soft focus ' +
  'background, atmospheric haze, dreamy bloom effect.'

const ILLUSTRATION_2D_PROMPT =
  'Semi-realistic digital illustration, Artgerm and WLOP inspired style. Porcelain smooth skin, ' +
  'flawless airbrushed complexion, seamless color transitions, ultra-smooth subsurface scattering. ' +
  'Hyper-detailed individual hair strands, intricate accessories and armor. Dramatic cinematic ' +
  'lighting, sharp specular highlights on eyes, deep volumetric shadows. High contrast, vibrant ' +
  'color accents, brighter exposure, warm luminous tones, lifted shadows, cinematic close-up ' +
  'composition.'

const COMIC_PROMPT =
  'Detailed modern anime illustration, digital painting environment, cinematographic anime ' +
  'background art style. Soft cel-shading, painterly digital brushstroke textures on foliage and ' +
  'environment, wet floor reflections. Warm golden hour backlighting, vibrant rim light, glowing ' +
  'street neons. High dynamic contrast, sharp line-art, sunset exposure with saturated tones. ' +
  'Shot on 35mm lens, f/1.8, soft round background bokeh, cinematic bloom and soft glow effect, ' +
  'subtle chromatic aberration.'

const CINEMA_PROMPT =
  'Photorealistic cinematic film still, atmospheric realism, high-fidelity render. Strictly ' +
  'lineless, photorealistic, no outlines, shapes defined by light and natural shadows. Highly ' +
  'tactile and detailed organic surface textures. Cinematic low-key lighting, soft diffused ' +
  'directional light, ambient glowing accent lights. Soft cinematic contrast, smooth shadow ' +
  'gradients, moody exposure with rich shadow details. Shot on 50mm cinematic lens, f/1.8, extreme ' +
  'shallow depth of field, sharp focus on the foreground subject, soft blurred background ' +
  'cinematic bokeh, subtle atmospheric haze and soft light bloom.'

const VECTOR_PROMPT =
  'Minimalist graphic design 3D mockup, premium corporate presentation style, realistic studio ' +
  'render. Strictly lineless, borderless, precise geometric edges, sharp 3D beveled cuts. ' +
  'Fine-grain matte textured paper background, polished stone and satin metallic surface textures ' +
  'on the main elements. Soft overhead studio lighting, subtle specular edge highlights, gentle ' +
  'soft drop shadow under the 3D elements. Low-key balanced exposure, clean sharp focus, ' +
  'symmetrical composition. fine-grain dark matte surface background.'

const PAINTING_PROMPT =
  'Detailed graphic digital illustration, matte painting concept art, high-definition metropolitan ' +
  'background with towering structures. Solid defined line-art, sharp graphic outlines, bold clean ' +
  'linework. Hyper-realistic weathered concrete wall texture with cracks and paint drips, polished ' +
  '3D beveled lettering with metallic and marble textures. Directional spotlight illuminating the ' +
  'top, ambient diffuse daylight mixed with luminous signage glow. High tonal contrast, deep drop ' +
  'shadows on 3D elements. Low-angle shot, 24mm wide-angle lens, deep depth of field, atmospheric ' +
  'haze and volumetric smog, crisp details and subtle light bloom.'

export const IMAGE_STYLES = Object.freeze([
  Object.freeze({ id: 'd05aa9f3-3f6e-400d-8bfe-a94e5fb031e2', name: 'Realism', previewUrl: '/assets/realista.webp', order: 1, promptBase: REALISM_PROMPT }),
  Object.freeze({ id: '433b2528-cb87-4144-b1e6-a44d22a0b0d0', name: '3D Illustration', previewUrl: '/assets/Ilustra3D.webp', order: 2, promptBase: ILLUSTRATION_3D_PROMPT }),
  Object.freeze({ id: '41ee3ca6-d098-468b-9db5-dfa69132ec51', name: '2D Illustration', previewUrl: '/assets/Ilustra2D.webp', order: 3, promptBase: ILLUSTRATION_2D_PROMPT }),
  Object.freeze({ id: 'e36a0c04-a7bf-41e4-be0b-fb079d990a59', name: 'Comic', previewUrl: '/assets/Comic.webp', order: 4, promptBase: COMIC_PROMPT }),
  Object.freeze({ id: '883d4e4e-e786-4594-aed5-dd6926f575c3', name: 'Cinema', previewUrl: '/assets/Cinema.webp', order: 5, promptBase: CINEMA_PROMPT }),
  Object.freeze({ id: '5cad8890-5488-4967-9f7b-15f64eaa1548', name: 'Vector', previewUrl: '/assets/Vector.webp', order: 6, promptBase: VECTOR_PROMPT }),
  Object.freeze({ id: 'a02afe45-23c7-42ae-94f3-654a01971c62', name: 'Painting', previewUrl: '/assets/Pintura.webp', order: 7, promptBase: PAINTING_PROMPT }),
])

export function sortImageStyles(rows) {
  return (Array.isArray(rows) ? [...rows] : []).sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
}

export function listImageStyles() {
  return sortImageStyles(IMAGE_STYLES)
}

export function findImageStyle(id) {
  if (!id) return null
  return IMAGE_STYLES.find(style => style.id === id) || null
}
