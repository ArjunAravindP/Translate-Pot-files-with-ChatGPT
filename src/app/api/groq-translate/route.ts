// app/api/translate/route.ts
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { text, targetLanguage } = await request.json()

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the following text to ${targetLanguage}. Preserve any markup or special characters. Only respond with the translation, no explanations.`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3
      })
    })

    const completion = await response.json()
    return NextResponse.json({
      translation: completion.choices[0].message.content.trim()
    })
  } catch (error) {
    console.error("Translation error:", error)
    return NextResponse.json({ error: "Translation failed" }, { status: 500 })
  }
}
