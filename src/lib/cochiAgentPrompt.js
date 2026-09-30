// ─── Prompt de FALLBACK del AGENTE Cochi (loop único, estilo opencode) ───────
// Cochi dejó de tener dos carriles (conversacional vs tarea): ahora es UN solo
// agente con herramientas. El modelo decide si responde o si ejecuta tools, y
// para solo cuando termina. No hay contrato R1/R2/R3 ni R4/R5: su respuesta final
// visible es lo que se muestra (y lo que se guarda como memoria).
//
// ORIGEN DEL PROMPT: `remotePrompts.system` de Supabase (como Asun/Tito). Si no
// está o todavía trae el viejo contrato R1/R2/R3 (`FORMAT_RULE`/`R1:`), el loop
// cae a este texto local (guard de migración en useCochiTaskLoop.runTurn). Así
// Cochi funciona aunque falte Supabase o no se haya pegado el prompt nuevo.
// `interpolatePrompt` reemplaza {{nombreAlternativo}} y {{chatLanguage}}.
//
// NOTA: identidad, personalidad TARS, SECURITY RULE y notas de MEMORY/UI se
// conservan del prompt previo (output/Cochi-Prompt.txt).
export const COCHI_AGENT_PROMPT = `[REDACTED PROMPT]`
