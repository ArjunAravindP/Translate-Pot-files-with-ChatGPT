// "use server"

// import { GoogleGenerativeAI } from "@google/generative-ai"
// import { NextResponse } from "next/server"

// const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
// const CHUNK_SIZE = 50

// const chunkArray = <T>(array: T[], size: number): T[][] => {
//   return Array.from({ length: Math.ceil(array.length / size) }, (_, i) => array.slice(i * size, i * size + size))
// }

// export async function POST(request: Request) {
//   try {
//     const { texts, targetLanguage } = await request.json()

//     if (!texts || !targetLanguage || !Array.isArray(texts)) {
//       return NextResponse.json({ error: "Missing or invalid required fields" }, { status: 400 })
//     }

//     const model = genAI.getGenerativeModel({ model: "gemini-pro" })
//     const allTranslations: { [key: number]: string } = {}
//     const chunks = chunkArray(texts, CHUNK_SIZE)

//     for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
//       const chunk = chunks[chunkIndex]
//       const startIndex = chunkIndex * CHUNK_SIZE

//       // Use local indices in the prompt but keep track of global indices
//       const formattedInput = chunk.map((text, localIndex) => `[${localIndex}] ${text}`).join("\n")

//       const prompt = `Translate the following texts to ${targetLanguage}.
// Each text is prefixed with a number in brackets [N].
// Respond with translations in the exact same format, preserving the numbers.
// Only provide the translations, no explanations or additional text.

// ${formattedInput}`

//       const result = await model.generateContent(prompt)
//       const response = await result.response
//       const translatedContent = response.text()

//       if (!translatedContent) {
//         throw new Error(`No translation received for chunk ${chunkIndex}`)
//       }

//       // Parse translations using local indices
//       const translations = new Map<number, string>()
//       translatedContent
//         .split("\n")
//         .filter(line => line.trim())
//         .forEach(line => {
//           const match = line.match(/\[(\d+)\]\s(.+)/)
//           if (match) {
//             const localIndex = parseInt(match[1])
//             const translation = match[2].trim()
//             translations.set(localIndex, translation)
//           }
//         })

//       // Verify we got all translations for this chunk
//       if (translations.size !== chunk.length) {
//         throw new Error(`Translation count mismatch in chunk ${chunkIndex}: expected ${chunk.length}, got ${translations.size}`)
//       }

//       // Map local indices to global indices
//       chunk.forEach((_, localIndex) => {
//         const globalIndex = startIndex + localIndex
//         const translation = translations.get(localIndex)
//         if (translation !== undefined) {
//           allTranslations[globalIndex] = translation
//         } else {
//           throw new Error(`Missing translation for index ${localIndex} in chunk ${chunkIndex}`)
//         }
//       })
//     }

//     // Final verification
//     if (Object.keys(allTranslations).length !== texts.length) {
//       throw new Error(`Final translation count mismatch: expected ${texts.length}, got ${Object.keys(allTranslations).length}`)
//     }

//     return NextResponse.json({ translations: allTranslations })
//   } catch (error) {
//     console.error("Translation error:", error)
//     return NextResponse.json(
//       {
//         error: "Translation failed",
//         details: error instanceof Error ? error.message : "Unknown error"
//       },
//       { status: 500 }
//     )
//   }
// }

"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
const CHUNK_SIZE = 50

const chunkArray = <T>(array: T[], size: number): T[][] => {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) => array.slice(i * size, i * size + size))
}

export async function POST(request: Request) {
  try {
    const { texts, targetLanguage } = await request.json()

    if (!texts || !targetLanguage || !Array.isArray(texts)) {
      return NextResponse.json({ error: "Missing or invalid required fields" }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" })
    const allTranslations: { [key: number]: string } = {}
    const chunks = chunkArray(texts, CHUNK_SIZE)

    // Process each chunk with chunk boundary markers
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      const startIndex = chunkIndex * CHUNK_SIZE

      // Create input with chunk boundary markers
      const formattedInput = `===CHUNK START ${chunkIndex}===\n` + chunk.map((text, localIndex) => `[${localIndex}] ${text}`).join("\n") + `\n===CHUNK END ${chunkIndex}===`

      const prompt = `You are translating chunk ${chunkIndex + 1} of ${chunks.length} to ${targetLanguage}.
Translate only the texts between CHUNK START and CHUNK END markers.
Keep the same [N] numbering format.
Start your response with ===CHUNK START ${chunkIndex}=== and end with ===CHUNK END ${chunkIndex}===
Only translate the text after each [N], keep the numbers as is.

${formattedInput}`

      const result = await model.generateContent(prompt)
      const response = await result.response
      const translatedContent = response.text()

      if (!translatedContent) {
        throw new Error(`No translation received for chunk ${chunkIndex}`)
      }

      // Verify chunk boundaries
      if (!translatedContent.includes(`===CHUNK START ${chunkIndex}===`) || !translatedContent.includes(`===CHUNK END ${chunkIndex}===`)) {
        throw new Error(`Invalid chunk boundaries in response for chunk ${chunkIndex}`)
      }

      // Extract content between chunk markers
      const chunkRegex = new RegExp(`===CHUNK START ${chunkIndex}===\n([\\s\\S]*?)\n===CHUNK END ${chunkIndex}===`)
      const chunkMatch = translatedContent.match(chunkRegex)

      if (!chunkMatch || !chunkMatch[1]) {
        throw new Error(`Could not extract translations from chunk ${chunkIndex}`)
      }

      const chunkContent = chunkMatch[1].trim()

      // Parse translations for this chunk
      const translations = new Map<number, string>()
      chunkContent
        .split("\n")
        .filter(line => line.trim())
        .forEach(line => {
          const match = line.match(/\[(\d+)\]\s(.+)/)
          if (match) {
            const localIndex = parseInt(match[1])
            const translation = match[2].trim()

            // Verify the local index is within chunk bounds
            if (localIndex >= chunk.length) {
              throw new Error(`Invalid local index ${localIndex} in chunk ${chunkIndex}`)
            }

            translations.set(localIndex, translation)
          }
        })

      // Verify we got all translations for this chunk
      if (translations.size !== chunk.length) {
        throw new Error(`Translation count mismatch in chunk ${chunkIndex}: ` + `expected ${chunk.length}, got ${translations.size}`)
      }

      // Map to global indices
      for (let localIndex = 0; localIndex < chunk.length; localIndex++) {
        const globalIndex = startIndex + localIndex
        const translation = translations.get(localIndex)

        if (!translation) {
          throw new Error(`Missing translation for index ${localIndex} in chunk ${chunkIndex}`)
        }

        allTranslations[globalIndex] = translation
      }

      // Verify global indices for this chunk
      for (let i = 0; i < chunk.length; i++) {
        const globalIndex = startIndex + i
        if (!allTranslations[globalIndex]) {
          throw new Error(`Missing global index ${globalIndex} after processing chunk ${chunkIndex}`)
        }
      }
    }

    // Final verification
    for (let i = 0; i < texts.length; i++) {
      if (!allTranslations[i]) {
        throw new Error(`Missing translation for index ${i} in final output`)
      }
    }

    return NextResponse.json({ translations: allTranslations })
  } catch (error) {
    console.error("Translation error:", error)
    return NextResponse.json(
      {
        error: "Translation failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
