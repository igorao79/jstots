import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = "llama-3.3-70b-versatile";

interface FileData {
  name: string;
  content: string;
}

interface ConvertRequest {
  files: FileData[];
  projectMode: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body: ConvertRequest = await req.json();
    const { files, projectMode } = body;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Single file or multiple files without project mode — convert individually
    if (files.length === 1 || !projectMode) {
      const results = await Promise.all(
        files.map(async (file) => {
          const tsContent = await convertSingleFile(file);
          return {
            name: file.name.replace(/\.js$/, ".ts").replace(/\.jsx$/, ".tsx"),
            content: tsContent,
          };
        })
      );
      return NextResponse.json({ results });
    }

    // Multiple files with project mode — analyze context first, then convert
    const results = await convertProjectFiles(files);
    return NextResponse.json({ results });
  } catch (error: unknown) {
    console.error("Conversion error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function convertSingleFile(file: FileData): Promise<string> {
  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are an expert TypeScript developer. Convert the given JavaScript/JSX code to TypeScript/TSX.

Rules:
- Add proper type annotations to all variables, function parameters, and return types
- Replace \`any\` with specific types where possible
- Add interfaces/types for objects and props
- CRITICAL: When an array is modified by splice() that inserts a different type (e.g. numbers from parseFloat into a string[]), you MUST declare it as a union type. Example: \`const numbers: (string | number)[] = ...\` — NEVER use \`string[]\` if splice inserts numbers later
- Track how variables are used throughout the ENTIRE function, not just at declaration — if a value changes type downstream, reflect that in the declaration type
- Convert .js imports to .ts, .jsx to .tsx
- Preserve all logic, comments, and formatting
- Use modern TypeScript features
- Output ONLY the converted code, no explanations or markdown fences`,
      },
      {
        role: "user",
        content: `Convert this file "${file.name}" from JavaScript to TypeScript:\n\n${file.content}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 8192,
  });

  return stripMarkdown(response.choices[0]?.message?.content?.trim() ?? "");
}

function stripMarkdown(code: string): string {
  // Remove ```typescript ... ``` or ```ts ... ``` or ``` ... ``` wrappers
  const fenceRegex = /^```(?:typescript|ts|tsx|javascript|js|jsx)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = code.match(fenceRegex);
  if (match) return match[1].trim();
  // Also handle if it starts with ``` but doesn't end properly
  if (code.startsWith("```")) {
    const firstNewline = code.indexOf("\n");
    const stripped = firstNewline !== -1 ? code.slice(firstNewline + 1) : code;
    return stripped.replace(/\n?```\s*$/, "").trim();
  }
  return code;
}

async function convertProjectFiles(files: FileData[]): Promise<FileData[]> {
  // Step 1: Analyze project context
  const fileList = files
    .map((f) => `--- ${f.name} ---\n${f.content}`)
    .join("\n\n");

  const analysisResponse = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are an expert TypeScript developer analyzing a JavaScript project for conversion to TypeScript.

Analyze ALL provided files together and produce a context analysis:
1. Identify shared types, interfaces, and data structures across files
2. Map imports/exports and dependencies between files
3. Identify React component props and state types
4. Note any shared utility types or enums needed
5. Plan the type definitions that should be consistent across all files

Output a concise analysis in plain text. This will be used as context for converting each file.`,
      },
      {
        role: "user",
        content: `Analyze these project files for TypeScript conversion:\n\n${fileList}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  });

  const analysis = analysisResponse.choices[0]?.message?.content?.trim() ?? "";

  // Step 2: Convert each file with the shared context
  const results = await Promise.all(
    files.map(async (file) => {
      const response = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: `You are an expert TypeScript developer. Convert the given JavaScript file to TypeScript using the project analysis context below.

PROJECT CONTEXT ANALYSIS:
${analysis}

Rules:
- Add proper type annotations consistent with the project analysis
- Use shared interfaces/types identified in the analysis
- Ensure type compatibility across files
- Replace \`any\` with specific types where possible
- CRITICAL: When an array is modified by splice() that inserts a different type (e.g. numbers from parseFloat into a string[]), you MUST declare it as a union type. Example: \`const numbers: (string | number)[] = ...\` — NEVER use \`string[]\` if splice inserts numbers later
- Track how variables are used throughout the ENTIRE function, not just at declaration — if a value changes type downstream, reflect that in the declaration type
- Convert .js imports to .ts, .jsx to .tsx
- Preserve all logic, comments, and formatting
- Use modern TypeScript features
- Output ONLY the converted code, no explanations or markdown fences`,
          },
          {
            role: "user",
            content: `Convert this file "${file.name}" from JavaScript to TypeScript:\n\n${file.content}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 8192,
      });

      return {
        name: file.name.replace(/\.js$/, ".ts").replace(/\.jsx$/, ".tsx"),
        content: stripMarkdown(response.choices[0]?.message?.content?.trim() ?? ""),
      };
    })
  );

  return results;
}
