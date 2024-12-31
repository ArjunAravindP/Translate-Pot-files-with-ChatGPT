"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

// Initialize Gemini client with API key from environment variables
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

// API route handler for POST requests
export async function POST(request: Request) {
  try {
    // Extract text to translate and target language from request body
    const { text, targetLanguage } = await request.json()

    // Validate required fields are present
    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Initialize Gemini model
    const model = genAI.getGenerativeModel({ model: "gemini-pro" })

    // Create prompt for translation
    const prompt = `Translate the following text to ${targetLanguage}. Preserve any markup or special characters. Only respond with the translation, no explanations: ${text}`

    // Generate translation using Gemini
    const result = await model.generateContent(prompt)
    const response = await result.response
    const translation = response.text()

    // Verify we received a translation
    if (!translation) {
      throw new Error("No translation content received")
    }

    // Return the translated text
    return NextResponse.json({
      translation: translation.trim()
    })
  } catch (error) {
    // Log and handle any errors that occur during translation
    console.error("Translation error:", error)
    return NextResponse.json({ error: "Translation failed" }, { status: 500 })
  }
}