// API route handler for translation using Groq's API
// Similar to OpenAI's API but using Groq's Mixtral model
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    // Extract text to translate and target language from request body
    const { text, targetLanguage } = await request.json()

    // Make request to Groq's API endpoint
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        // Use Mixtral model which has strong multilingual capabilities
        model: "mixtral-8x7b-32768",
        messages: [
          {
            // Set up system prompt for translation task
            role: "system",
            content: `You are a professional translator. Translate the following text to ${targetLanguage}. Preserve any markup or special characters. Only respond with the translation, no explanations.`
          },
          {
            // Provide text to be translated
            role: "user",
            content: text
          }
        ],
        // Lower temperature for more consistent translations
        temperature: 0.3
      })
    })

    // Parse response and extract translated text
    const completion = await response.json()
    return NextResponse.json({
      translation: completion.choices[0].message.content.trim()
    })
  } catch (error) {
    // Log and handle any errors that occur during translation
    console.error("Translation error:", error)
    return NextResponse.json({ error: "Translation failed" }, { status: 500 })
  }
}
