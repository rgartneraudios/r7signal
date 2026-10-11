// Harness del armador de prompts de imagen de la web (lógica pura, sin UI).
// Ejecutar:  node harness/promptImagen.harness.mjs
import {
  IMAGE_STYLES, CHOICE_STEPS, VISTA_OPTIONS, FORMATO_OPTIONS, UBICACION_OPTIONS,
  MOMENTO_OPTIONS, CLIMA_OPTIONS, EPOCA_OPTIONS, PALETA_OPTIONS, WIZARD_ORDER,
  BLANK_IMAGE_BRIEF, PROMPT_MODULES,
  imageStyleById, aspectRatio, stepIndex, nextStep, prevStep, choiceStepByKey,
  stepQuestion, stepValue, isStepComplete, firstIncompleteStep, hasNonEnglishHint,
  buildImagePrompt,
} from '../src/lib/promptImagen.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— ESTILOS —')
check('7 estilos', IMAGE_STYLES.length, 7)
check('ids', IMAGE_STYLES.map(s => s.id), ['ilustracion_2d', 'ilustracion_3d', 'vector', 'cinema', 'pintura', 'realismo', 'comic'])
check('nombres', IMAGE_STYLES.map(s => s.nombre), ['Ilustración 2D', 'Ilustración 3D', 'Vector', 'Cinema', 'Pintura', 'Realismo', 'Comic'])
check('assets en /assets', IMAGE_STYLES.every(s => s.asset.startsWith('/assets/') && s.asset.endsWith('.webp')), true)
check('assets exactos', IMAGE_STYLES.map(s => s.asset), ['/assets/Ilustra2D.webp', '/assets/Ilustra3D.webp', '/assets/Vector.webp', '/assets/Cinema.webp', '/assets/Pintura.webp', '/assets/realista.webp', '/assets/Comic.webp'])
check('todos con prompt_base', IMAGE_STYLES.every(s => typeof s.prompt_base === 'string' && s.prompt_base.length > 80), true)
check('prompt_base sin saltos de línea', IMAGE_STYLES.every(s => !/\s\s|\n/.test(s.prompt_base)), true)
check('prompt_base en inglés', IMAGE_STYLES.every(s => !hasNonEnglishHint(s.prompt_base)), true)
check('imageStyleById cine', imageStyleById('cinema').nombre, 'Cinema')
check('imageStyleById desconocido', imageStyleById('nope'), null)

console.log('— OPCIONES —')
check('vista 5', VISTA_OPTIONS.length, 5)
check('formato 3', FORMATO_OPTIONS.length, 3)
check('ubicacion 2', UBICACION_OPTIONS.length, 2)
check('momento 4', MOMENTO_OPTIONS.length, 4)
check('clima 6', CLIMA_OPTIONS.length, 6)
check('epoca 4', EPOCA_OPTIONS.length, 4)
check('paleta 6', PALETA_OPTIONS.length, 6)
check('7 pasos de elección', CHOICE_STEPS.length, 7)
check('keys de elección', CHOICE_STEPS.map(s => s.key), ['vista', 'formato', 'ubicacion', 'momento', 'clima', 'epoca', 'paleta'])
check('briefKeys de elección', CHOICE_STEPS.map(s => s.briefKey), ['vista', 'formato', 'ubicacion', 'momento_dia', 'clima', 'epoca', 'paleta_color'])
check('todas las opciones con prompt (salvo formato)', CHOICE_STEPS.filter(s => s.key !== 'formato').every(s => s.options.every(o => typeof o.prompt === 'string' && o.prompt.length > 5)), true)
check('aspect ratios', FORMATO_OPTIONS.map(o => o.ratio), ['16:9', '9:16', '1:1'])
check('aspectRatio horizontal', aspectRatio('horizontal'), '16:9')
check('aspectRatio vertical', aspectRatio('vertical'), '9:16')
check('aspectRatio cuadrado', aspectRatio('cuadrado'), '1:1')
check('aspectRatio desconocido', aspectRatio('nope'), '')
check('sin rama de imagen de referencia', WIZARD_ORDER.includes('image_upload'), false)
check('sin path_select', WIZARD_ORDER.includes('path_select'), false)

console.log('— PASOS —')
check('orden del wizard', WIZARD_ORDER, ['estilo', 'vista', 'formato', 'ubicacion', 'momento', 'clima', 'epoca', 'paleta', 'descripcion', 'resultado'])
check('índice de estilo', stepIndex('estilo'), 0)
check('índice de resultado', stepIndex('resultado'), 9)
check('índice desconocido', stepIndex('zzz'), -1)
check('next estilo', nextStep('estilo'), 'vista')
check('next paleta', nextStep('paleta'), 'descripcion')
check('next descripcion', nextStep('descripcion'), 'resultado')
check('next resultado tope', nextStep('resultado'), 'resultado')
check('next desconocido', nextStep('zzz'), 'estilo')
check('prev vista', prevStep('vista'), 'estilo')
check('prev descripcion', prevStep('descripcion'), 'paleta')
check('prev estilo tope', prevStep('estilo'), 'estilo')
check('choiceStep vista', choiceStepByKey('vista').label, 'Encuadre')
check('choiceStep formato briefKey', choiceStepByKey('formato').briefKey, 'formato')
check('choiceStep inexistente', choiceStepByKey('descripcion'), null)

console.log('— PREGUNTAS —')
check('pregunta estilo', stepQuestion('estilo'), 'Elige el estilo visual para tu prompt.')
check('pregunta vista', stepQuestion('vista'), '¿Cómo encuadramos la escena?')
check('pregunta paleta', stepQuestion('paleta'), 'Elige una paleta de colores.')
check('pregunta descripción pide inglés', stepQuestion('descripcion').includes('inglés'), true)
check('pregunta resultado', stepQuestion('resultado'), 'Prompt listo. Copialo y pegalo donde generes la imagen.')

console.log('— COMPLETITUD —')
check('brief vacío', BLANK_IMAGE_BRIEF.estilo_id, null)
check('brief vacío descripción', BLANK_IMAGE_BRIEF.descripcion, '')
check('estilo incompleto', isStepComplete('estilo', BLANK_IMAGE_BRIEF), false)
check('estilo completo', isStepComplete('estilo', { ...BLANK_IMAGE_BRIEF, estilo_id: 'cinema' }), true)
check('vista incompleta', isStepComplete('vista', BLANK_IMAGE_BRIEF), false)
check('vista completa', isStepComplete('vista', { ...BLANK_IMAGE_BRIEF, vista: 'full_body' }), true)
check('descripción vacía', isStepComplete('descripcion', BLANK_IMAGE_BRIEF), false)
check('descripción con espacios', isStepComplete('descripcion', { ...BLANK_IMAGE_BRIEF, descripcion: '   ' }), false)
check('descripción completa', isStepComplete('descripcion', { ...BLANK_IMAGE_BRIEF, descripcion: 'a cat' }), true)
check('resultado exige estilo + descripción', isStepComplete('resultado', { ...BLANK_IMAGE_BRIEF, descripcion: 'a cat' }), false)
check('primer paso faltante', firstIncompleteStep(BLANK_IMAGE_BRIEF), 'estilo')
check('primer faltante tras estilo', firstIncompleteStep({ ...BLANK_IMAGE_BRIEF, estilo_id: 'cinema' }), 'vista')
check('primer faltante al final', firstIncompleteStep({
  ...BLANK_IMAGE_BRIEF, estilo_id: 'cinema', vista: 'full_body', formato: 'horizontal',
  ubicacion: 'interior_setting', momento_dia: 'dark_midnight', clima: 'clear_weather',
  epoca: 'contemporary_modern', paleta_color: 'soft_pastel', descripcion: 'a cat',
}), 'resultado')
check('stepValue vista', stepValue({ ...BLANK_IMAGE_BRIEF, vista: 'full_body' }, 'vista'), 'full_body')
check('stepValue descripcion', stepValue(BLANK_IMAGE_BRIEF, 'descripcion'), null)

console.log('— AVISO DE IDIOMA —')
check('texto sin acentos', hasNonEnglishHint('un gato en la nieve'), false)
check('detecta ñ', hasNonEnglishHint('un niño'), true)
check('detecta tilde', hasNonEnglishHint('un corazón'), true)
check('detecta signos', hasNonEnglishHint('¿qué?'), true)
check('texto inglés limpio', hasNonEnglishHint('a lone samurai in the rain'), false)
check('texto vacío', hasNonEnglishHint(''), false)
check('texto undefined', hasNonEnglishHint(undefined), false)

console.log('— BUILD (vacío) —')
check('brief vacío → vacío', buildImagePrompt(BLANK_IMAGE_BRIEF), '')
check('sin argumento → vacío', buildImagePrompt(), '')

console.log('— BUILD (parcial) —')
check('solo descripción', buildImagePrompt({ ...BLANK_IMAGE_BRIEF, descripcion: 'a lone wolf' }), 'A lone wolf.')
check('descripción ya con punto', buildImagePrompt({ ...BLANK_IMAGE_BRIEF, descripcion: 'a lone wolf.' }), 'A lone wolf.')
check('solo estilo', buildImagePrompt({ ...BLANK_IMAGE_BRIEF, estilo_id: 'realismo' }), imageStyleById('realismo').prompt_base)
check('estilo + vista', buildImagePrompt({ ...BLANK_IMAGE_BRIEF, estilo_id: 'realismo', vista: 'full_body' }),
  `${imageStyleById('realismo').prompt_base}\nFraming: full-body shot.`)
check('solo formato', buildImagePrompt({ ...BLANK_IMAGE_BRIEF, formato: 'vertical' }), 'Aspect ratio: 9:16.')
check('solo paleta', buildImagePrompt({ ...BLANK_IMAGE_BRIEF, paleta_color: 'monochrome_bw' }),
  'Color palette: monochromatic black and white color palette with rich greyscale values.')
check('vista desconocida ignorada', buildImagePrompt({ ...BLANK_IMAGE_BRIEF, vista: 'nope' }), '')
check('espacios colapsados', buildImagePrompt({ ...BLANK_IMAGE_BRIEF, descripcion: '  a   cat\n on  a mat  ' }), 'A cat on a mat.')

console.log('— BUILD (completo) —')
const full = {
  estilo_id: 'cinema',
  estilo_nombre: 'Cinema',
  vista: 'medium_close_up',
  formato: 'horizontal',
  ubicacion: 'exterior_setting',
  momento_dia: 'warm_golden_hour_sunset',
  clima: 'rain_falling_wet',
  epoca: 'futuristic_sci_fi',
  paleta_color: 'cool_blue_teal',
  descripcion: 'a lone samurai standing on a wet rooftop',
}
const fullPrompt = buildImagePrompt(full)
check('6 líneas', fullPrompt.split('\n').length, 6)
check('línea 1 sujeto', fullPrompt.split('\n')[0], 'A lone samurai standing on a wet rooftop.')
check('línea 2 estilo', fullPrompt.split('\n')[1], imageStyleById('cinema').prompt_base)
check('línea 3 encuadre', fullPrompt.split('\n')[2], 'Framing: medium close-up portrait shot.')
check('línea 4 escena', fullPrompt.split('\n')[3], 'Setting: set in an outdoor exterior environment, during a warm golden hour sunset, with rain falling and wet surfaces, with futuristic structures and glowing holographic elements.')
check('línea 5 paleta', fullPrompt.split('\n')[4], 'Color palette: cool color palette dominated by deep blues, teal, and slate grey tones.')
check('línea 6 ratio', fullPrompt.split('\n')[5], 'Aspect ratio: 16:9.')
check('prompt es texto', typeof fullPrompt, 'string')
check('prompt sin etiquetas R1/R2', /R1:|R2:/.test(fullPrompt), false)
check('prompt sin castellano', hasNonEnglishHint(fullPrompt), false)
check('prompt sin comillas', /["']/.test(fullPrompt), false)
check('prompt con signos de puntuación', /\.$/.test(fullPrompt), true)

console.log('— BUILD (otro estilo) —')
const comicPrompt = buildImagePrompt({
  ...BLANK_IMAGE_BRIEF, estilo_id: 'comic', descripcion: 'a street market at dusk',
  momento_dia: 'dark_midnight', clima: 'dense_mysterious_fog',
})
check('comic: estilo presente', comicPrompt.includes(imageStyleById('comic').prompt_base), true)
check('comic: noche', comicPrompt.includes('Setting: at dark midnight, surrounded by dense mysterious fog.'), true)
check('comic: 3 líneas', comicPrompt.split('\n').length, 3)
check('comic: sin ratio', comicPrompt.includes('Aspect ratio'), false)

console.log('— MÓDULOS —')
check('módulo imagen', PROMPT_MODULES.length, 1)
check('módulo imagen listo', PROMPT_MODULES[0].ready, true)
check('módulo imagen ruta', PROMPT_MODULES[0].key, 'imagen')

console.log(`\n[promptImagen] ${pass}/${pass + fail} checks en verde`)
if (fail > 0) process.exit(1)
