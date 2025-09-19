import { GoogleGenAI, Content } from "@google/genai";

export const config = {
  runtime: 'edge',
};

// Helper to convert the SDK's async iterable stream to a web ReadableStream
function geminiStreamToWebStream(stream: AsyncIterable<any>, extractText: (chunk: any) => string) {
    return new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            for await (const chunk of stream) {
                const text = extractText(chunk);
                if (text) {
                    controller.enqueue(encoder.encode(text));
                }
            }
            controller.close();
        }
    });
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  if (!process.env.API_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured on the server' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const { type, payload } = await req.json();

    switch (type) {
      case 'chat': {
        const { history, message, model, config: chatConfig } = payload;
        const chat = ai.chats.create({
            model: model,
            config: chatConfig,
            history: history as Content[],
        });
        const stream = await chat.sendMessageStream({ message });
        const webStream = geminiStreamToWebStream(stream, (chunk) => chunk.text);
        return new Response(webStream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }

      case 'generate-title': {
        const { titlePrompt } = payload;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: titlePrompt,
            config: { temperature: 0.3, maxOutputTokens: 60 },
        });
        const text = response.text;
        return new Response(JSON.stringify({ text }), { headers: { 'Content-Type': 'application/json' } });
      }

      case 'summarize':
      case 'summarize-follow-up': {
        const { prompt, model } = payload;
        const stream = await ai.models.generateContentStream({
            model: model, 
            contents: prompt,
        });
        const webStream = geminiStreamToWebStream(stream, (chunk) => chunk.text);
        return new Response(webStream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid proxy type' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error: any) {
    console.error(`Error in /api/proxy`, error);
    // Attempt to parse a more specific error message if available
    let errorMessage = 'An internal server error occurred';
    if (error && error.message) {
      errorMessage = error.message;
      try {
        // Errors from the API client might be JSON strings
        const parsedError = JSON.parse(error.message);
        if (parsedError.error && parsedError.error.message) {
            errorMessage = parsedError.error.message;
        }
      } catch (e) {
        // Not a JSON string, use the original message
      }
    }
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
