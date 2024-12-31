"use client"

// Import necessary dependencies
import { useState, useCallback, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { Download, Upload, Loader2 } from "lucide-react" // Icons for UI elements
import JSZip from "jszip"
// import { POST as translateAPI } from "../api/translate-openai"

// Define supported languages for translation
const languages = [
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese" }
]

export default function Translation() {
  // State management for component
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0)
  const [currentDate, setCurrentDate] = useState("")

  // Set current date when component mounts
  useEffect(() => {
    setCurrentDate(new Date().toISOString())
  }, [])

  // Handle file drop functionality
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file && file.name.endsWith(".pot")) {
      setSelectedFile(file)
      setError("")
    } else {
      setError("Please upload a valid .pot file")
    }
  }, [])

  // Configure dropzone with file type restrictions
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/x-gettext": [".pot"]
    },
    multiple: false
  })

  // Toggle language selection in the UI
  const toggleLanguage = (code: string) => {
    setSelectedLanguages(prev => (prev.includes(code) ? prev.filter(lang => lang !== code) : [...prev, code]))
  }

  // Extract translatable strings from POT file
  const extractStrings = async (file: File) => {
    const text = await file.text()
    const msgidRegex = /msgid "(.+?)"\nmsgstr/g
    const matches = [...text.matchAll(msgidRegex)]
    return matches.map(match => match[1])
  }

  // Translate text using API
  const translateText = async (text: string, targetLang: string) => {
    try {
      const response = await fetch("/api/gemini-translate", {
        // use /api/openai-translate to translate using openai
        // use /api/groq-translate to translate using groq
        // use /api/gemini-translate to translate using google gemini
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLanguage: targetLang })
      })
      const data = await response.json()
      return data.translation
    } catch (err) {
      console.error(`Translation error:`, err)
      throw err
    }
  }

  // Main function to process translations and generate PO files
  const processTranslations = async () => {
    if (!selectedFile || selectedLanguages.length === 0) {
      setError("Please select a file and at least one language.")
      return
    }

    setIsProcessing(true)
    setError("")
    setProgress(0)

    try {
      // Extract strings from POT file
      const strings = await extractStrings(selectedFile)
      const zip = new JSZip()

      // Process each selected language
      for (let i = 0; i < selectedLanguages.length; i++) {
        const langCode = selectedLanguages[i]
        const translations = await Promise.all(strings.map(str => translateText(str, langCode)))

        // Generate PO file content with headers
        let poContent = `msgid ""
msgstr ""
"Project-Id-Version: Plugin Translation\\n"
"POT-Creation-Date: ${currentDate}\\n"
"PO-Revision-Date: ${currentDate}\\n"
"Language: ${langCode}\\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"\n\n`

        // Add translated strings to PO content
        strings.forEach((str, index) => {
          poContent += `msgid "${str}"\nmsgstr "${translations[index]}"\n\n`
        })

        // Add PO file to zip archive
        zip.file(`${langCode}.po`, poContent)
        setProgress(((i + 1) * 100) / selectedLanguages.length)
      }

      // Generate and trigger download of zip file
      const blob = await zip.generateAsync({ type: "blob" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "translations.zip"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Error processing translations:", err)
      setError("An error occurred while processing translations. Please try again.")
    } finally {
      setIsProcessing(false)
      setProgress(0)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-4xl bg-white border border-gray-200 rounded-lg shadow-sm p-6 md:p-8">
        <h1 className="text-3xl font-bold mb-8 text-center text-black">Plugin Translation Manager</h1>

        {/* File Upload Section */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 md:p-8 mb-6 text-center cursor-pointer
          ${isDragActive ? "border-black bg-gray-50" : "border-gray-300"}
          ${selectedFile ? "bg-gray-50" : ""}`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          {selectedFile ? <p className="text-lime-500">Selected: {selectedFile.name}</p> : <p className="text-gray-500">{isDragActive ? "Drop the POT file here" : "Drag & drop a POT file, or click to select"}</p>}
        </div>

        {/* Language Selection Grid */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 text-black">Select Languages</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {languages.map(({ code, name }) => (
              <button
                key={code}
                onClick={() => toggleLanguage(code)}
                className={`p-2.5 rounded-lg border transition-colors
                ${selectedLanguages.includes(code) ? "bg-black text-white border-black" : "bg-white text-black border-gray-300 hover:bg-gray-50"}`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Error Message Display */}
        {error && <div className="bg-red-500 text-white p-4 rounded-lg mb-4 border border-red-600">{error}</div>}

        {/* Progress Bar for Translation Process */}
        {isProcessing && (
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
            <div className="bg-black h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
        )}

        {/* Process Button with Loading State */}
        <button
          onClick={processTranslations}
          disabled={isProcessing || !selectedFile || selectedLanguages.length === 0}
          className={`w-full p-4 rounded-lg font-semibold flex items-center justify-center
          ${isProcessing || !selectedFile || selectedLanguages.length === 0 ? "bg-gray-300 cursor-not-allowed" : "bg-black hover:bg-gray-900 text-white"}`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              <Download className="mr-2" />
              Generate Translations
            </>
          )}
        </button>
      </div>
    </div>
  )
}
