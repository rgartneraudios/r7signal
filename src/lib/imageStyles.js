// Catálogo de estilos de imagen de Asun. Migrado de la tabla `estilos_imagen_public`
// (S10): los `id` son los UUID de producción — son la clave con la que `generar-asset`
// resuelve `estilos_imagen.prompt_base`. No renombrar sin migrar esa tabla.
export const IMAGE_STYLES = Object.freeze([
  Object.freeze({ id: 'd05aa9f3-3f6e-400d-8bfe-a94e5fb031e2', name: 'Realism', previewUrl: '/assets/realista.webp', order: 1 }),
  Object.freeze({ id: '433b2528-cb87-4144-b1e6-a44d22a0b0d0', name: '3D Illustration', previewUrl: '/assets/Ilustra3D.webp', order: 2 }),
  Object.freeze({ id: '41ee3ca6-d098-468b-9db5-dfa69132ec51', name: '2D Illustration', previewUrl: '/assets/Ilustra2D.webp', order: 3 }),
  Object.freeze({ id: 'e36a0c04-a7bf-41e4-be0b-fb079d990a59', name: 'Comic', previewUrl: '/assets/Comic.webp', order: 4 }),
  Object.freeze({ id: '883d4e4e-e786-4594-aed5-dd6926f575c3', name: 'Cinema', previewUrl: '/assets/Cinema.webp', order: 5 }),
  Object.freeze({ id: '5cad8890-5488-4967-9f7b-15f64eaa1548', name: 'Vector', previewUrl: '/assets/Vector.webp', order: 6 }),
  Object.freeze({ id: 'a02afe45-23c7-42ae-94f3-654a01971c62', name: 'Painting', previewUrl: '/assets/Pintura.webp', order: 7 }),
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
