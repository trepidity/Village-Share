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
      console.error(
        `Gemini API error: ${response.status} ${response.statusText}`
      )
      return ''
    }

    const data = await response.json()

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') {
      console.error('Gemini returned unexpected response shape:', data)
      return ''
    }

    return text
  } catch (err) {
    console.error('Gemini fetch failed:', err)
    return ''
  }
}
