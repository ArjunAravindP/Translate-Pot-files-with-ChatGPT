// Mark this as a server-side component
"use server"

// Import required dependencies
import OpenAI from "openai"
import { NextResponse } from "next/server"

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// API route handler for POST requests
export async function POST(request: Request) {
  try {
    // Extract text to translate and target language from request body
    const { text, targetLanguage } = await request.json()

    // Validate required fields are present
    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Call OpenAI API to translate the text
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Use GPT-3.5 for translation
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
      temperature: 0.3 // Lower temperature for more consistent translations
    })

    // Verify we received a translation
    if (!completion.choices[0].message?.content) {
      throw new Error("No translation content received")
    }

    // Return the translated text
    return NextResponse.json({
      translation: completion.choices[0].message.content.trim()
    })
  } catch (error) {
    // Log and handle any errors that occur during translation
    console.error("Translation error:", error)
    return NextResponse.json({ error: "Translation failed" }, { status: 500 })
  }
}
