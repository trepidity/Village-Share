/**
 * Minimal Gemini REST API client.
 *
 * Uses fetch directly (no SDK) to keep the dependency footprint small.
 * This module is only invoked as a fallback when rule-based parsing fails.
 */

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent'

/**
 * Call the Gemini API with a system prompt and user prompt.
 * Returns the generated text, or an empty string if anything goes wrong.
 */
export async function callGemini(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not set; skipping AI fallback.')
    return ''
  }

  const start = Date.now()

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 256,
        },
      }),
    })

    if (!response.ok) {
      console.log(JSON.stringify({
        event: 'gemini_api_call',
        timestamp: new Date().toISOString(),
        systemPrompt,
        userPrompt,
        durationMs: Date.now() - start,
        ok: false,
        status: response.status,
        error: response.statusText,
      }))
      return ''
    }

    const data = await response.json()

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') {
      console.log(JSON.stringify({
        event: 'gemini_api_call',
        timestamp: new Date().toISOString(),
        systemPrompt,
        userPrompt,
        durationMs: Date.now() - start,
        ok: false,
        error: 'Unexpected response shape',
      }))
      return ''
    }

    console.log(JSON.stringify({
      event: 'gemini_api_call',
      timestamp: new Date().toISOString(),
      systemPrompt,
      userPrompt,
      durationMs: Date.now() - start,
      ok: true,
      responseText: text,
    }))

    return text
  } catch (err) {
    console.log(JSON.stringify({
      event: 'gemini_api_call',
      timestamp: new Date().toISOString(),
      systemPrompt,
      userPrompt,
      durationMs: Date.now() - start,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }))
    return ''
  }
}
